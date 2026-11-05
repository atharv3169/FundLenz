"""Protected, exact-base, data-only publisher. Separate job; no Gemini key.

An inactive policy always exits without creating a branch. Enabling the switch
alone is insufficient: protection and the dedicated actor must also verify.
"""
import base64
import os
import re
import time
import hashlib
import urllib.parse
import urllib.error
from common import ROOT, retry_after_seconds, dataset_hash, loads, read, require, safe_path, sha, write
from adapters import allowed_paths
from github_api import GitHub


def protection_gate(branch, policy, expected_base):
    require(branch["commit"]["sha"] == expected_base, "Main advanced; discard candidate and rerun reconciliation")
    require(branch.get("protected"), "Main must be protected before unattended publication")
    contexts = branch.get("protection", {}).get("required_status_checks", {}).get("contexts", [])
    require(policy["required_check"] in contexts, "Required exact-head data gate is not enforced")


def strict_protection(api):
    protection = api.call("/branches/main/protection")
    require(protection.get("required_status_checks", {}).get("strict") is True, "Require the branch to be up to date before merge")
    require(protection.get("enforce_admins", {}).get("enabled") is True, "Protection must apply to administrators")
    require(protection.get("required_pull_request_reviews") is not None, "Require a pull request for main")
    require(not protection.get("allow_force_pushes", {}).get("enabled") and not protection.get("allow_deletions", {}).get("enabled"), "Force-push/deletion protection required")
    return protection


def verify_release(result, root=ROOT):
    release = read(result / "release.json")
    paths = [x["path"] for x in release["files"]]
    require(len(paths) == len(set(paths)), "Duplicate release paths")
    require(set(paths) <= allowed_paths(root), "Protected path in sanitized release")
    files = {}
    for item in release["files"]:
        path = safe_path(result / "sanitized", item["path"])
        raw = path.read_bytes()
        require(len(raw) == item["bytes"] and sha(raw) == item["sha256"], "Sanitized output changed")
        files[item["path"]] = raw
    actual = {p.relative_to(result / "sanitized").as_posix() for p in (result / "sanitized").rglob("*") if p.is_file() or p.is_symlink()}
    require(actual == set(paths), "Unlisted output file")
    if "candidate_dataset_sha256" in release:
        # The publisher must independently prove that the exact sanitized
        # overlay produces the declared new dataset. Audit-only PRs never
        # acquire a new catalogue-update date.
        require(release["base_dataset_sha256"] == dataset_hash(root),
                "Release baseline dataset differs from the protected base")
        require(release["candidate_dataset_sha256"] == dataset_hash(root, files),
                "Financial dataset hash differs from the exact sanitized overlay")
        # A metadata/date-only rewrite must never masquerade as a real
        # financial change. An actual trusted adapter must produce at least
        # one changed non-metadata production data file.
        financial_change = any(
            path.startswith("public/data/") and path != "public/data/site-metadata.json" and
            (not (root / path).exists() or (root / path).read_bytes() != raw)
            for path, raw in files.items()
        )
        require(release["data_changes"] is financial_change,
                "Release incorrectly declares financial data changes")
        update_marker = loads(files["public/automation-audit/release.json"])
        require(update_marker["run_id"] == release["run_id"] and
                update_marker["dataset_sha256"] == release["candidate_dataset_sha256"] and
                update_marker["financial_data_changed"] is financial_change,
                "Public release marker inconsistent with the verified data")
        if financial_change:
            require("public/data/site-metadata.json" in files and
                    "public/build-info.json" in files,
                    "Financial updates must atomically include public date and build marker")
            before = read(root / "public/data/site-metadata.json")
            metadata = loads(files["public/data/site-metadata.json"])
            info = loads(files["public/build-info.json"])
            require(metadata["catalogueSourceCheckDate"] == before["catalogueSourceCheckDate"] and
                    metadata["schemaVersion"] == before["schemaVersion"],
                    "Financial update altered the original source-check baseline")
            require(metadata["lastCatalogueUpdateRunId"] == release["run_id"] and
                    update_marker["lastCatalogueUpdateDate"] == metadata["lastCatalogueUpdateDate"] ==
                    info["lastCatalogueUpdateDate"],
                    "Catalogue update-date release markers disagree")
            previous = before.get("lastCatalogueUpdateDate")
            require(previous is None or metadata["lastCatalogueUpdateDate"] >= previous,
                    "Catalogue update date regressed")
        else:
            require("public/data/site-metadata.json" not in files and
                    "public/build-info.json" not in files,
                    "Audit-only release cannot silently change the website date")
            require(update_marker["lastCatalogueUpdateDate"] ==
                    read(root / "public/data/site-metadata.json").get("lastCatalogueUpdateDate"),
                    "Audit-only release claimed a new catalogue update date")
    return release, files



def require_publishable_release(release):
    """Block audit-only artifacts even if a future job is misconfigured."""
    require(release.get("publication_enabled") is True and release.get("validation_passed") is True,
            "Audit-only release cannot create a catalogue data PR")


def optional_get(api, path):
    try:
        return api.call(path)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        return None


def reconcile_write(write_call, observe, matches, attempts=3, wait=time.sleep):
    """Recover ambiguous ref/PR writes by observing, never by blindly replaying."""
    for attempt in range(attempts):
        try:
            result = write_call()
            require(matches(result), "Publication write returned an unexpected identity")
            return result
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            # Observe before another visible write. Known permanent refusals
            # never gain retries; temporary/unknown ref validation has a cooldown.
            category = getattr(error, "fundlenz_details", {}).get("category")
            cooldown = retry_after_seconds(getattr(error, "headers", {}), 120)
            if isinstance(error, urllib.error.HTTPError):
                throttled = error.code in {403, 429} and cooldown is not None
                if error.code not in {409, 422, 500, 502, 503, 504} and not throttled:
                    raise
                if category in {"workflow_permission_required", "invalid_request", "protection_refusal"}:
                    raise
            found = observe()
            if found is not None:
                require(matches(found), "Ambiguous write conflicts with existing publication")
                return found
            if attempt + 1 == attempts:
                raise
            if (getattr(error, "headers", {}) or {}).get("Retry-After") is not None and cooldown is None:
                raise
            delay = (60 * (attempt + 1)) if category == "provider_throttle" else [5, 15][min(attempt, 1)]
            wait(max(delay, cooldown or 0))
    raise ValueError("Publication write recovery exhausted")


def git_blob_sha(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def verify_tree_overlay(api, base_tree, candidate_tree, elements):
    before = api.call("/git/trees/" + base_tree + "?recursive=1")
    after = api.call("/git/trees/" + candidate_tree + "?recursive=1")
    require(not before.get("truncated") and not after.get("truncated"), "Truncated publication tree metadata")
    def entries(tree):
        return {e["path"]: (e["sha"], e["mode"], e["type"]) for e in tree["tree"] if e["type"] != "tree"}
    wanted = entries(before)
    wanted.update({e["path"]: (e["sha"], e["mode"], e["type"]) for e in elements})
    require(entries(after) == wanted, "Publication tree changed or omitted files outside the exact overlay")


def verify_created_commit(api, commit, tree, parent, attempts=3, wait=time.sleep):
    for attempt in range(attempts):
        observed = optional_get(api, "/git/commits/" + commit)
        if observed is not None:
            require(observed["tree"]["sha"] == tree and [p["sha"] for p in observed["parents"]] == [parent],
                    "Created publication commit differs from exact tree/parent")
            return
        if attempt + 1 < attempts: wait([5, 15][min(attempt, 1)])
    raise ValueError("Created publication commit is not readable; no branch created")


def publish_candidate(api, release, files, policy, actor):
    expected, run = release["base_commit"], release["run_id"]
    require(re.fullmatch(r"[0-9a-f]{40}", expected) and re.fullmatch(r"[0-9]+-[0-9]+", run),
            "Invalid publication identity")
    branch = "automation/catalogue-" + run
    ref_path = "/git/ref/heads/" + branch
    existing = optional_get(api, ref_path)
    base = api.call("/git/commits/" + expected)
    # Do not re-upload files already identical to the checked-out trusted base.
    changed = {p: raw for p, raw in files.items() if not (ROOT / p).exists() or (ROOT / p).read_bytes() != raw}
    require(changed, "Publication contains no changed files")
    elements = [{"path": p, "mode": "100644", "type": "blob", "sha": git_blob_sha(raw)}
                for p, raw in sorted(changed.items())]
    if existing is None:
        protection_gate(api.call("/branches/main"), policy, expected)
        strict_protection(api)
        print(f"Publishing exact artifact: {len(elements)} changed files.", flush=True)
        for number, item in enumerate(elements, 1):
            raw = changed[item["path"]]
            try:
                blob = api.call("/git/blobs", "POST", {"content": base64.b64encode(raw).decode(), "encoding": "base64"})
            except Exception as error:
                error.add_note(f"Publication object: {item['path']}; bytes={len(raw)}")
                raise
            require(blob["sha"] == item["sha"], "GitHub uploaded blob hash mismatch")
            if number % 25 == 0 or number == len(elements):
                print(f"Uploaded verified objects: {number}/{len(elements)}", flush=True)
    tree = api.call("/git/trees", "POST", {"base_tree": base["tree"]["sha"], "tree": elements})
    verify_tree_overlay(api, base["tree"]["sha"], tree["sha"], elements)
    if existing is not None:
        require(existing.get("object", {}).get("type") == "commit", "Publication ref is not a commit")
        commit = api.call("/git/commits/" + existing["object"]["sha"])
        require(commit["tree"]["sha"] == tree["sha"] and
                [parent["sha"] for parent in commit["parents"]] == [expected],
                "Existing publication differs from this exact artifact/base; no overwrite")
    else:
        commit = api.call("/git/commits", "POST", {"message": "Update verified catalogue audit " + run,
                          "tree": tree["sha"], "parents": [expected]})
        require(commit.get("author") and commit.get("committer"), "Unattributed publishing commit")
        print("Created publication commit: " + commit["sha"] + "; tree=" + tree["sha"], flush=True)
        verify_created_commit(api, commit["sha"], tree["sha"], expected)
        protection_gate(api.call("/branches/main"), policy, expected)
        reconcile_write(lambda: api.call("/git/refs", "POST", {"ref": "refs/heads/" + branch, "sha": commit["sha"]}),
                        lambda: optional_get(api, ref_path),
                        lambda ref: ref.get("object", {}).get("sha") == commit["sha"])

    def find_pr():
        owner = api.repo.split("/")[0]
        query = urllib.parse.urlencode({"state": "all", "head": owner + ":" + branch, "base": "main"})
        matches = api.all("/pulls?" + query)
        require(len(matches) <= 1, "Ambiguous publication PRs; no duplicate creation")
        return matches[0] if matches else None

    def exact_pr(pr):
        return (pr.get("user", {}).get("login") == actor and pr.get("head", {}).get("sha") == commit["sha"]
                and pr.get("head", {}).get("repo", {}).get("full_name") == api.repo
                and pr.get("base", {}).get("ref") == "main" and not pr.get("draft"))

    pr = find_pr()
    if pr is None:
        protection_gate(api.call("/branches/main"), policy, expected)
        strict_protection(api)
        body = {"title": "Catalogue validation " + run, "head": branch, "base": "main",
                "body": "Automated data-only candidate. Required checks independently reproduce the source-backed output.\n\n"
                        "FundLenz-Run: " + run.split("-")[0] + "\nFundLenz-Attempt: " + run.split("-")[1] + "\nFundLenz-Base: " + expected}
        pr = reconcile_write(lambda: api.call("/pulls", "POST", body), find_pr, exact_pr)
    require(exact_pr(pr), "Publication PR identity/head mismatch")
    merged = bool(pr.get("merged_at"))
    require(pr["state"] == "open" or merged, "Publication was closed without merging; explicit review required")
    if not merged:
        protection_gate(api.call("/branches/main"), policy, expected)
    return {"run_id": run, "pr_number": pr["number"], "head": commit["sha"], "base": expected,
            "merge_complete": merged, "commit": pr.get("merge_commit_sha") if merged else None,
            "deployment_complete": False, "url": pr["html_url"]}


def main():
    policy = read(ROOT / "automation/runtime.json")
    if not (policy["publication_enabled"] and read(ROOT / "automation/policy.json")["publication_enabled"]):
        print("Publication disabled: dry-run evidence only. No branch or PR created.")
        return
    actor = os.environ.get("FUNDLENZ_PUBLISHER_LOGIN")
    require(actor, "Dedicated publisher identity not configured")
    require(os.environ.get("FUNDLENZ_PUBLISH_TOKEN"), "Dedicated publisher token not configured")
    api = GitHub(os.environ["FUNDLENZ_PUBLISH_TOKEN"])
    release, files = verify_release(ROOT / "work/result")
    require_publishable_release(release)
    require(release["run_id"].split("-")[0] == os.environ["GITHUB_RUN_ID"], "Artifact belongs to another producer run")
    # publish_candidate rechecks protection before any new ref or PR. Existing
    # publications must match the exact artifact tree and original parent.
    expected = release["base_commit"]
    publication = publish_candidate(api, release, files, policy, actor)
    write(ROOT / "work/publication.json", publication)
    print("Exact data publication " + ("already merged: " if publication["merge_complete"] else "ready for independent checks: ") + publication["url"])


if __name__ == "__main__":
    main()
