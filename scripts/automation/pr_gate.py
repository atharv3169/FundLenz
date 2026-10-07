"""Read PR data as bytes; never check out or execute a PR's code."""
import argparse
import os
import re
from common import ROOT, read, require, sha, write
from github_api import GitHub
from publish import verify_release


def prepare(api, number):
    pr = api.call(f"/pulls/{number}")
    if not pr["head"]["ref"].startswith("automation/catalogue-"):
        write(ROOT / "work/pr.json", {"number": number, "base": pr["base"]["sha"], "head": pr["head"]["sha"], "automated": False})
        print("Ordinary code PR: this data-only gate does not grant updater publication.")
        return
    expected_actor = os.environ.get("FUNDLENZ_PUBLISHER_LOGIN")
    require(expected_actor and pr["user"]["login"] == expected_actor, "Wrong publisher identity")
    require(pr["head"]["repo"]["full_name"] == api.repo and pr["base"]["ref"] == "main", "Wrong PR repository/base")
    match = re.search(r"^FundLenz-Run: ([0-9]+)$", pr.get("body") or "", re.M)
    require(match, "Missing immutable daily run reference")
    run = api.call("/actions/runs/" + match[1])
    require(run["path"] == ".github/workflows/catalogue-daily.yml" and run["head_branch"] == "main"
            and run["head_repository"]["full_name"] == api.repo and run["event"] in {"schedule", "workflow_dispatch", "push"}, "Untrusted artifact producer")
    require(run["head_sha"] == pr["base"]["sha"] == os.environ["TRUSTED_BASE"], "Candidate base is stale")
    jobs = api.all(f"/actions/runs/{run['id']}/jobs", "jobs")
    require(any(j["name"] == "Collect and validate" and j["conclusion"] in {"success", "failure"} for j in jobs), "Producer job is incomplete")
    write(ROOT / "work/pr.json", {"number": number, "base": pr["base"]["sha"], "head": pr["head"]["sha"], "run_id": str(run["id"]), "actor": expected_actor, "automated": True})
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        out.write("run_id=" + str(run["id"]) + "\nhead=" + pr["head"]["sha"] + "\nbase=" + pr["base"]["sha"] + "\n")


def check(api):
    state = read(ROOT / "work/pr.json")
    pr = api.call(f"/pulls/{state['number']}")
    require(pr["head"]["sha"] == state["head"] and pr["base"]["sha"] == state["base"], "PR moved during validation")
    require(api.call("/branches/main")["commit"]["sha"] == state["base"], "Main changed during validation")
    from validate import validate
    validate(ROOT, ROOT / "work/run", ROOT / "work/pr-replay")
    release, files = verify_release(ROOT / "work/pr-replay")
    supplied, _ = verify_release(ROOT / "work/result")
    require(release == supplied and release["base_commit"] == state["base"], "Artifact replay mismatch")
    changed = api.all(f"/pulls/{state['number']}/files")
    require(len(changed) == pr["changed_files"], "Truncated PR diff")
    # Identical bytes occasionally produce no Git diff; calculate exact expected set.
    expected = {p: raw for p, raw in files.items() if not (ROOT / p).exists() or (ROOT / p).read_bytes() != raw}
    require({f["filename"] for f in changed} == set(expected), "PR changes files outside sanitized output")
    import base64
    tree = api.call("/git/trees/" + state["head"] + "?recursive=1")
    require(not tree.get("truncated"), "Truncated tree")
    entries = {e["path"]: e for e in tree["tree"]}
    for f in changed:
        require(f["status"] in {"added", "modified"} and entries[f["filename"]]["mode"] == "100644", "Deletion, rename or symlink forbidden")
        blob = api.call("/git/blobs/" + entries[f["filename"]]["sha"])
        require(blob["encoding"] == "base64", "Unexpected blob encoding")
        require(base64.b64decode(blob["content"]) == expected[f["filename"]], "PR bytes differ from replayed output")
    # Overlay only reproduced data for source/finance regressions in a later step.
    for path, raw in expected.items():
        if path.startswith(("public/data/", "data/sources/")):
            target = ROOT / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print("Exact PR head reproduces trusted source validation; all changed paths and bytes verified.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "check"])
    args = parser.parse_args()
    api = GitHub()
    if args.mode == "prepare":
        prepare(api, int(os.environ["PR_NUMBER"]))
    else:
        check(api)
