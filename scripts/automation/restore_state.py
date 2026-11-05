"""Select the last durable state artifact from this trusted main-branch workflow."""
import os
from common import ROOT, now, read, require, schema, timestamp, write
import re
from github_api import GitHub


def validate_state(state, at):
    require(isinstance(state, dict) and isinstance(state.get("sources"), dict)
            and isinstance(state.get("applied_runs"), list), "Malformed durable state")
    require(len(state["applied_runs"]) <= 1000 and len(set(state["applied_runs"])) == len(state["applied_runs"]),
            "Malformed applied-run ledger")
    schema(state["issues"], "open-issues")
    for source in state["sources"].values():
        require(isinstance(source, dict) and timestamp(source["last_attempt_at"]) <= timestamp(at),
                "Invalid/future durable source attempt")
        require(source.get("sha256") is None or re.fullmatch(r"[a-f0-9]{64}", source["sha256"]),
                "Malformed durable source hash")
    return state


def unpublished_sources(state, committed):
    if not state.get("last_run_id") or state.get("last_run_id") == committed.get("last_run_id"):
        return set()
    # Artifact state can include attempts from failed/audit-only/unmerged runs.
    # Preserve their issue history but don't confuse attempts with publication.
    return {identifier for identifier, value in state["sources"].items()
            if value != committed.get("sources", {}).get(identifier)}


def main():
    api = GitHub()
    history = api.call("/actions/workflows/catalogue-daily.yml/runs?branch=main&per_page=100")
    runs = history["workflow_runs"]
    committed = ROOT / "audit/automation-state.json"
    committed_state = validate_state(read(committed), now()) if committed.exists() else None
    prior = [r for r in runs if str(r["id"]) != os.environ["GITHUB_RUN_ID"] and r["status"] == "completed"
             and r.get("head_branch") == "main" and r["event"] in {"schedule", "workflow_dispatch"}]
    for run in prior:
        require(run["head_repository"]["full_name"] == api.repo, "Untrusted state workflow repository")
        identity = f"{run['id']}-{run.get('run_attempt', 1)}"
        if committed_state and committed_state.get("last_run_id") == identity:
            write(ROOT / "work/state/state.json", committed_state)
            print("Exact published durable state restored from protected Git history.")
            return
        artifacts = api.all(f"/actions/runs/{run['id']}/artifacts", "artifacts")
        matches = [a for a in artifacts if a["name"] == "fundlenz-state"]
        if matches:
            require(len(matches) == 1, "Ambiguous durable state artifacts")
            require(not matches[0]["expired"],
                    "Unpublished state artifact expired; explicit history recovery required")
            with open(os.environ["GITHUB_OUTPUT"], "a") as out:
                out.write(f"run_id={run['id']}\n")
            print("Continuing from durable state run " + str(run["id"]))
            return
        from schedule_guard import collector_consumed_budget
        jobs = api.all(f"/actions/runs/{run['id']}/jobs?filter=all", "jobs")
        require(not any(collector_consumed_budget(job, run) for job in jobs if job.get("name") == "Collect and validate"),
                "Durable state missing for an unpublished collector; explicit history recovery required")
    require(history.get("total_count", len(runs)) < 100,
            "State history truncated without a recoverable artifact; refusing to reset history")
    if committed_state is not None:
        state = committed_state
    else:
        require(not prior, "Earlier runs exist but no durable state was found; refusing to reset issue history")
        state = {"sources": {}, "issues": read(ROOT / "audit/open-issues.json"), "applied_runs": []}
    write(ROOT / "work/state/state.json", state)
    print("Starting from committed audit state.")


if __name__ == "__main__":
    main()
