"""One automatic collector attempt per India-local day; manual recovery stays explicit."""
import datetime as dt
import os
from urllib.parse import quote
from zoneinfo import ZoneInfo
from common import read, require, timestamp
from github_api import GitHub

EXTERNAL_RUN_NAME = "FundLenz daily catalogue (external scheduler)"
COLLECT_JOB_NAME = "Collect and validate"
IST = ZoneInfo("Asia/Kolkata")


def true(value):
    return value is True or value == "true"


def is_automatic_run(run):
    return run.get("head_branch") == "main" and (
        run.get("event") == "schedule" or
        (run.get("event") == "workflow_dispatch" and run.get("display_title") == EXTERNAL_RUN_NAME)
    )


def automatic_request(event_name, inputs, ref):
    automatic = event_name == "schedule" or true(inputs.get("automated_daily"))
    if automatic:
        require(ref == "refs/heads/main", "Automatic collection requires main")
        require(not true(inputs.get("force_supported_sources")), "Automatic runs cannot force sources")
        if event_name != "schedule":
            require(event_name == "workflow_dispatch" and true(inputs.get("publish_validated_data")),
                    "External daily dispatch requires explicit publication opt-in")
    return automatic


def decide(at, runs, jobs_for_run, current_id, repository):
    local = at.astimezone(IST)
    require((local.hour, local.minute) >= (9, 17),
            "Automatic trigger arrived before the 09:17 IST collection window; no source or model calls")
    require(len(runs) < 100, "Daily run history exceeds guard budget; inspect before proceeding")
    for run in runs:
        if str(run["id"]) == str(current_id) or not is_automatic_run(run):
            continue
        require(run.get("head_repository", {}).get("full_name") == repository,
                "Unexpected repository in automatic run history")
        jobs = jobs_for_run(run["id"])
        collectors = [job for job in jobs if job.get("name") == COLLECT_JOB_NAME]
        require(len(collectors) <= 1, "Ambiguous collector history")
        for job in collectors:
            if job.get("conclusion") == "skipped" or not job.get("started_at"):
                continue
            started = timestamp(job["started_at"])
            require(started <= at, "Future collector timestamp")
            if started.astimezone(IST).date() != local.date():
                continue
            # Workflow-level concurrency serializes the native and external
            # triggers. A failed/cancelled attempt is not silently retried with
            # another model budget. Operators retain the ordinary manual path.
            require(run.get("status") == "completed" and run.get("conclusion") == "success"
                    and job.get("conclusion") == "success",
                    "Today's automatic attempt failed or is incomplete; inspect it and use explicit manual recovery")
            return False, f"Automatic collection already completed today in run {run['id']}; no duplicate calls."
    return True, "First automatic collector attempt for this India-local day."


def main():
    event = read(os.environ["GITHUB_EVENT_PATH"])
    inputs = event.get("inputs") or {}
    automatic = automatic_request(os.environ["GITHUB_EVENT_NAME"], inputs, os.environ["GITHUB_REF"])
    allowed, reason = True, "Ordinary manual dispatch; existing audit-only/publication opt-in is unchanged."
    if automatic:
        require(os.environ.get("GITHUB_RUN_ATTEMPT", "1") == "1",
                "Do not rerun automatic attempts; use an explicit manual recovery dispatch")
        api = GitHub()
        at = dt.datetime.now(dt.timezone.utc)
        # Include runs created yesterday whose collector started today after a
        # long queue. Fail closed instead of silently truncating a busy history.
        since = quote(">=" + (at - dt.timedelta(hours=48)).isoformat(), safe="")
        history = api.call("/actions/workflows/catalogue-daily.yml/runs?branch=main&per_page=100&created=" + since)
        require(isinstance(history.get("total_count"), int) and history["total_count"] < 100,
                "Daily run history is incomplete; inspect before proceeding")
        runs = history["workflow_runs"]
        allowed, reason = decide(at, runs, lambda run_id: api.all(
            f"/actions/runs/{run_id}/jobs?filter=latest", "jobs"), os.environ["GITHUB_RUN_ID"], api.repo)
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        out.write("run_collect=" + str(allowed).lower() + "\n")
    print(reason)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as out:
            out.write("### Daily collection decision\n" + reason + "\n")


if __name__ == "__main__":
    main()
