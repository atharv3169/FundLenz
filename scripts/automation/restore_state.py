"""Select the last durable state artifact from this trusted main-branch workflow."""
import os
from common import ROOT, read, require, write
from github_api import GitHub


def main():
    api = GitHub()
    runs = api.call("/actions/workflows/catalogue-daily.yml/runs?branch=main&per_page=50")["workflow_runs"]
    prior = [r for r in runs if str(r["id"]) != os.environ["GITHUB_RUN_ID"] and r["status"] == "completed"
             and r["event"] in {"push", "schedule", "workflow_dispatch"}]
    for run in prior:
        require(run["head_repository"]["full_name"] == api.repo, "Untrusted state workflow repository")
        artifacts = api.all(f"/actions/runs/{run['id']}/artifacts", "artifacts")
        matches = [a for a in artifacts if a["name"] == "fundlenz-state"]
        if matches:
            require(len(matches) == 1 and not matches[0]["expired"], "Latest state artifact expired; restore from Git history before resuming")
            with open(os.environ["GITHUB_OUTPUT"], "a") as out:
                out.write(f"run_id={run['id']}\n")
            print("Continuing from durable state run " + str(run["id"]))
            return
    committed = ROOT / "audit/automation-state.json"
    if committed.exists():
        state = read(committed)
    else:
        require(not prior, "Earlier runs exist but no durable state was found; refusing to reset issue history")
        state = {"sources": {}, "issues": read(ROOT / "audit/open-issues.json"), "applied_runs": []}
    write(ROOT / "work/state/state.json", state)
    print("Starting from committed audit state.")


if __name__ == "__main__":
    main()
