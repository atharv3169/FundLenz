"""Merge only the exact head of an independently checked automated data PR."""
import os
import time
from common import ROOT, read, require, write
from github_api import GitHub
from publish import protection_gate, strict_protection


def ready_to_merge(api, number, policy, head, base, actor, checks_api=None):
    """Return pending without weakening any identity, base or protection check."""
    pr = api.call(f"/pulls/{number}")
    require(actor and pr["user"]["login"] == actor, "Wrong publisher identity")
    require(pr["head"]["repo"]["full_name"] == api.repo and pr["head"]["ref"].startswith("automation/catalogue-"), "Wrong PR source")
    require(pr["state"] == "open" and not pr["draft"], "PR is not mergeable")
    require(pr["head"]["sha"] == head and pr["base"]["sha"] == base and pr["base"]["ref"] == "main", "PR head/base moved; do not merge")
    protection_gate(api.call("/branches/main"), policy, base)
    strict_protection(api)
    checks_api = checks_api or api
    require(checks_api.repo == api.repo, "Check reader repository mismatch")
    checks = checks_api.all("/commits/" + pr["head"]["sha"] + "/check-runs", "check_runs")
    gate = [c for c in checks if c["name"] == policy["required_check"] and c.get("app", {}).get("slug") == "github-actions"]
    latest = max(gate, key=lambda c: c["id"]) if gate else None
    if latest and latest.get("status") == "completed":
        require(latest["conclusion"] == "success", "Required exact-head check failed")
    return bool(latest and latest.get("conclusion") == "success" and pr.get("mergeable_state") == "clean")


def wait_for_checks(api, number, policy, head, base, actor, attempts=13, wait=time.sleep, checks_api=None):
    # Three minutes maximum for a transient pending/unknown merge state. Each
    # attempt rechecks the exact head/base and current branch protections.
    for attempt in range(attempts):
        if ready_to_merge(api, number, policy, head, base, actor, checks_api):
            return
        if attempt + 1 < attempts:
            wait(15)
    raise ValueError("Required checks are still pending/blocked; PR retained without merging")


def main():
    policy = read(ROOT / "automation/runtime.json")
    require(policy["publication_enabled"] and read(ROOT / "automation/policy.json")["publication_enabled"], "Publication remains disabled")
    require(os.environ.get("FUNDLENZ_PUBLISH_TOKEN") and os.environ.get("GH_TOKEN"), "Separate publishing and check-reading credentials required")
    api = GitHub(os.environ["FUNDLENZ_PUBLISH_TOKEN"])
    checks_api = GitHub(os.environ["GH_TOKEN"])
    number, head, base = int(os.environ["PR_NUMBER"]), os.environ["VALIDATED_HEAD"], os.environ["VALIDATED_BASE"]
    wait_for_checks(api, number, policy, head, base, os.environ.get("FUNDLENZ_PUBLISHER_LOGIN"), checks_api=checks_api)
    result = api.call(f"/pulls/{number}/merge", "PUT", {"sha": head, "merge_method": "squash"})
    require(result.get("merged"), "GitHub declined merge")
    write(ROOT / "work/merge.json", {"pr_number": number, "merge_complete": True, "commit": result["sha"], "deployment_complete": False})
    print("Validated data PR merged; deployment must be confirmed separately.")


if __name__ == "__main__":
    main()
