"""Protected, exact-base, data-only publisher. Separate job; no Gemini key.

An inactive policy always exits without creating a branch. Enabling the switch
alone is insufficient: protection and the dedicated actor must also verify.
"""
import base64
import os
from common import ROOT, read, require, safe_path, sha, write
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
    return release, files


def main():
    policy = read(ROOT / "automation/runtime.json")
    if not (policy["publication_enabled"] and read(ROOT / "automation/policy.json")["publication_enabled"]):
        print("Publication disabled: dry-run evidence only. No branch or PR created.")
        return
    require(os.environ.get("FUNDLENZ_PUBLISHER_LOGIN"), "Dedicated publisher identity not configured")
    require(os.environ.get("FUNDLENZ_PUBLISH_TOKEN"), "Dedicated publisher token not configured")
    api = GitHub(os.environ["FUNDLENZ_PUBLISH_TOKEN"])
    release, files = verify_release(ROOT / "work/result")
    expected = release["base_commit"]
    protection_gate(api.call("/branches/main"), policy, expected)
    strict_protection(api)
    # Replay trusted validation in this clean job, then compare every output hash.
    from validate import validate
    validate(ROOT, ROOT / "work/run", ROOT / "work/replayed")
    replay, _ = verify_release(ROOT / "work/replayed")
    require(replay == release, "Publisher replay differs from validation artifact")
    base = api.call("/git/commits/" + expected)
    elements = []
    for path, raw in sorted(files.items()):
        blob = api.call("/git/blobs", "POST", {"content": base64.b64encode(raw).decode(), "encoding": "base64"})
        elements.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    tree = api.call("/git/trees", "POST", {"base_tree": base["tree"]["sha"], "tree": elements})
    commit = api.call("/git/commits", "POST", {"message": "Update verified catalogue audit " + release["run_id"], "tree": tree["sha"], "parents": [expected]})
    require(commit.get("author") and commit.get("committer"), "Unattributed publishing commit")
    protection_gate(api.call("/branches/main"), policy, expected)
    branch = "automation/catalogue-" + release["run_id"]
    api.call("/git/refs", "POST", {"ref": "refs/heads/" + branch, "sha": commit["sha"]})
    pr = api.call("/pulls", "POST", {"title": "Catalogue validation " + release["run_id"], "head": branch, "base": "main",
                   "body": "Automated data-only candidate. Required checks independently reproduce the source-backed output.\n\n"
                           "FundLenz-Run: " + os.environ["GITHUB_RUN_ID"] + "\nFundLenz-Base: " + expected})
    require(pr["user"]["login"] == os.environ["FUNDLENZ_PUBLISHER_LOGIN"], "Unexpected publishing actor; do not merge")
    write(ROOT / "work/publication.json", {"run_id": release["run_id"], "pr_number": pr["number"], "head": commit["sha"],
                                            "base": expected, "merge_complete": False, "deployment_complete": False})
    print("Data-only PR created: " + pr["html_url"] + "; waiting for independent exact-head checks.")


if __name__ == "__main__":
    main()
