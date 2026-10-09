"""Protected, exact-base, data-only publisher. Separate job; no Gemini key.

An inactive policy always exits without creating a branch. Enabling the switch
alone is insufficient: protection and the dedicated actor must also verify.
"""
import base64
import os
from common import ROOT, dataset_hash, loads, read, require, safe_path, sha, write
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
    require(release.get("publication_enabled") is True,
            "Audit-only release cannot create a catalogue data PR")


def main():
    policy = read(ROOT / "automation/runtime.json")
    if not (policy["publication_enabled"] and read(ROOT / "automation/policy.json")["publication_enabled"]):
        print("Publication disabled: dry-run evidence only. No branch or PR created.")
        return
    require(os.environ.get("FUNDLENZ_PUBLISHER_LOGIN"), "Dedicated publisher identity not configured")
    require(os.environ.get("FUNDLENZ_PUBLISH_TOKEN"), "Dedicated publisher token not configured")
    api = GitHub(os.environ["FUNDLENZ_PUBLISH_TOKEN"])
    release, files = verify_release(ROOT / "work/result")
    require_publishable_release(release)
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
