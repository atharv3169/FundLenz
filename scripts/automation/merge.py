"""Merge only the exact head of an independently checked automated data PR."""
import os
import time
import base64
import datetime as dt
import re
import urllib.error
from zoneinfo import ZoneInfo
from common import ROOT, loads, read, require, write
from github_api import GitHub
from publish import protection_gate, strict_protection


def ready_to_merge(api, number, policy, head, base, actor, checks_api=None):
    """Return pending without weakening any identity, base or protection check."""
    pr = api.call(f"/pulls/{number}")
    require(actor and pr["user"]["login"] == actor, "Wrong publisher identity")
    require(pr["head"]["repo"]["full_name"] == api.repo and pr["head"]["ref"].startswith("automation/catalogue-"), "Wrong PR source")
    require(pr["state"] == "open" and not pr["draft"], "PR is not mergeable")
    require(pr["head"]["sha"] == head and pr["base"]["sha"] == base and pr["base"]["ref"] == "main", "PR head/base moved; do not merge")
    branch = api.call("/branches/main")
    protection_gate(branch, policy, base)
    protection = strict_protection(api)
    checks_api = checks_api or api
    require(checks_api.repo == api.repo, "Check reader repository mismatch")
    checks = checks_api.all("/commits/" + pr["head"]["sha"] + "/check-runs", "check_runs")
    ready = True
    configured = protection.get("required_status_checks", {})
    required = set(branch.get("protection", {}).get("required_status_checks", {}).get("contexts", []))
    required.update(configured.get("contexts", []))
    required.update(c["context"] for c in configured.get("checks", []))
    required.update([policy["required_check"], "Verify FundLenz reviewed release"])
    for name in sorted(required):
        app_id = next((c.get("app_id") for c in configured.get("checks", []) if c["context"] == name), None)
        matches = [c for c in checks if c["name"] == name and
                   (c.get("app", {}).get("slug") == "github-actions" if name in
                    {policy["required_check"], "Verify FundLenz reviewed release"} else
                    (app_id in {None, -1} or c.get("app", {}).get("id") == app_id))]
        latest = max(matches, key=lambda c: c["id"]) if matches else None
        if latest and latest.get("status") == "completed":
            require(latest["conclusion"] == "success", "Required exact-head check failed: " + name)
        context_ready = bool(latest and latest.get("status") == "completed" and latest.get("conclusion") == "success")
        if not matches and name not in {policy["required_check"], "Verify FundLenz reviewed release"}:
            statuses = checks_api.all("/commits/" + head + "/statuses", None)
            matching = [s for s in statuses if s.get("context") == name]
            latest_status = max(matching, key=lambda s: s["id"]) if matching else None
            if latest_status and latest_status["state"] in {"error", "failure"}:
                raise ValueError("Required commit status failed: " + name)
            context_ready = bool(latest_status and latest_status["state"] == "success" and app_id in {None, -1})
        ready = ready and context_ready
    # Never wait for aggregate 'clean': this running merge job is optional.
    # All configured required contexts are checked individually; GitHub still
    # enforces review and protection rules at the merge endpoint.
    return ready and pr.get("mergeable") is True


def wait_for_checks(api, number, policy, head, base, actor, attempts=41, wait=time.sleep, checks_api=None):
    # Ten minutes maximum for a transient pending/unknown merge state. Each
    # attempt rechecks the exact head/base and current branch protections.
    for attempt in range(attempts):
        if ready_to_merge(api, number, policy, head, base, actor, checks_api):
            return
        if attempt + 1 < attempts:
            wait(15)
    raise ValueError("Required checks are still pending/blocked; PR retained without merging")



def assert_release_date_current(api, head, today=None):
    """No stale/future update date may be merged as today's catalogue release.

    Read metadata from the exact checked head, not a moving branch. Audit-only
    changes retain the last verified catalogue date without forcing a refresh.
    """
    require(re.fullmatch(r"[0-9a-f]{40}", head), "Invalid checked head for date verification")

    def from_checked_commit(path):
        item = api.call("/contents/" + path + "?ref=" + head)
        require(item.get("type") == "file" and item.get("encoding") == "base64",
                "Cannot verify dated publication file")
        return loads(base64.b64decode(item["content"], validate=False))

    release = from_checked_commit("public/automation-audit/release.json")
    require(type(release.get("financial_data_changed")) is bool,
            "Financial publication marker is missing")
    if release["financial_data_changed"]:
        metadata = from_checked_commit("public/data/site-metadata.json")
        expected = today or dt.datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()
        require(metadata.get("lastCatalogueUpdateDate") == expected and
                release.get("lastCatalogueUpdateDate") == expected and
                metadata.get("lastCatalogueUpdateRunId") == release.get("run_id"),
                "Financial release date is stale, future or inconsistent; rerun on a fresh source base")
    else:
        # Audit-only publication cannot masquerade as a new financial update.
        require(release.get("lastCatalogueUpdateDate") is None or
                re.fullmatch(r"\d{4}-\d{2}-\d{2}", release["lastCatalogueUpdateDate"]),
                "Malformed historical catalogue update date")

def merge_checked(api, checks_api, number, policy, head, base, actor, attempts=41, wait=time.sleep):
    """Reconcile lost merge replies; each retry revalidates the exact head/base."""
    mutations = 0
    for attempt in range(attempts):
        pr = api.call(f"/pulls/{number}")
        if pr.get("merged") or pr.get("merged_at"):
            require(pr["user"]["login"] == actor and pr["head"]["sha"] == head
                    and pr["head"]["repo"]["full_name"] == api.repo and pr["base"]["ref"] == "main"
                    and pr.get("merge_commit_sha"), "Merged PR differs from expected publication")
            return {"merged": True, "sha": pr["merge_commit_sha"]}
        if ready_to_merge(api, number, policy, head, base, actor, checks_api):
            assert_release_date_current(api, head)
            try:
                result = api.call(f"/pulls/{number}/merge", "PUT", {"sha": head, "merge_method": "squash"})
                require(result.get("merged"), "GitHub declined merge")
                return result
            except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
                if isinstance(error, urllib.error.HTTPError) and error.code not in {405, 409, 500, 502, 503, 504}:
                    raise
                if not isinstance(error, urllib.error.HTTPError) or error.code not in {405, 409}:
                    mutations += 1
                    if mutations >= 3:
                        # One final observation can confirm a completed write.
                        current = api.call(f"/pulls/{number}")
                        require(current.get("merged") and current["head"]["sha"] == head,
                                "Merge outcome remains unconfirmed; inspect the PR before recovery")
                        return {"merged": True, "sha": current["merge_commit_sha"]}
        if attempt + 1 < attempts:
            wait(15)
    raise ValueError("Merge/check deadline exhausted; exact PR retained without bypass")


def main():
    policy = read(ROOT / "automation/runtime.json")
    require(policy["publication_enabled"] and read(ROOT / "automation/policy.json")["publication_enabled"], "Publication remains disabled")
    require(os.environ.get("FUNDLENZ_PUBLISH_TOKEN") and os.environ.get("GH_TOKEN"), "Separate publishing and check-reading credentials required")
    api = GitHub(os.environ["FUNDLENZ_PUBLISH_TOKEN"])
    checks_api = GitHub(os.environ["GH_TOKEN"])
    number, head, base = int(os.environ["PR_NUMBER"]), os.environ["VALIDATED_HEAD"], os.environ["VALIDATED_BASE"]
    result = merge_checked(api, checks_api, number, policy, head, base, os.environ.get("FUNDLENZ_PUBLISHER_LOGIN"))
    write(ROOT / "work/merge.json", {"pr_number": number, "merge_complete": True, "commit": result["sha"], "deployment_complete": False})
    print("Validated data PR merged; deployment must be confirmed separately.")


if __name__ == "__main__":
    main()
