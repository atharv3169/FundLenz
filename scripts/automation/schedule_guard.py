"""One automatic collector attempt per India-local day; manual recovery stays explicit."""
import datetime as dt
import os
import re
from urllib.parse import quote
from zoneinfo import ZoneInfo
from common import ROOT, read, require, timestamp
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


def attempt_history(api, runs, published_run_id=None):
    """Resolve immutable attempts instead of letting a rerun rewrite history."""
    result = list(runs)
    wanted = set()
    for run in runs:
        latest = run.get("run_attempt", 1)
        require(type(latest) is int and 1 <= latest <= 10, "Ambiguous/excessive run-attempt history")
        if is_automatic_run(run):
            wanted.update((run["id"], attempt) for attempt in range(1, latest))
    if published_run_id:
        match = re.fullmatch(r"([0-9]+)-([0-9]+)", published_run_id)
        require(match, "Invalid published producer attempt")
        wanted.add((int(match[1]), int(match[2])))
    known = {(r["id"], r.get("run_attempt", 1)) for r in runs}
    for identifier, attempt in sorted(wanted - known):
        # Do not fetch old published metadata outside the bounded history window.
        if not any(r["id"] == identifier for r in runs):
            continue
        item = api.call(f"/actions/runs/{identifier}/attempts/{attempt}")
        require(item.get("id") == identifier and item.get("run_attempt") == attempt
                and item.get("path") == ".github/workflows/catalogue-daily.yml"
                and item.get("head_branch") == "main"
                and item.get("head_repository", {}).get("full_name") == api.repo,
                "Immutable attempt identity mismatch")
        result.append(item)
    return result


def collector_consumed_budget(job, run):
    if job.get("conclusion") == "skipped" or not job.get("started_at"):
        return False
    # A completed preflight/checkout failure that never reached source requests
    # may use the backup timer. Never infer this from an incomplete/unknown job.
    steps = job.get("steps", [])
    acquire = next((s for s in steps if s.get("name") == "Acquire approved official sources"), None)
    return not (run.get("status") == "completed" and acquire and acquire.get("conclusion") == "skipped")


def decide(at, runs, jobs_for_run, current_id, repository, published_run_id=None, jobs_for_attempt=None):
    local = at.astimezone(IST)
    require((local.hour, local.minute) >= (9, 17),
            "Automatic trigger arrived before the 09:17 IST collection window; no source or model calls")
    require(len(runs) < 100, "Daily run history exceeds guard budget; inspect before proceeding")
    lookup = (lambda run: jobs_for_attempt(run["id"], run.get("run_attempt", 1))) if jobs_for_attempt else (lambda run: jobs_for_run(run["id"]))
    attempts = []
    for run in runs:
        if str(run["id"]) == str(current_id) or not is_automatic_run(run):
            continue
        require(run.get("head_repository", {}).get("full_name") == repository,
                "Unexpected repository in automatic run history")
        jobs = lookup(run)
        collectors = [job for job in jobs if job.get("name") == COLLECT_JOB_NAME]
        require(len(collectors) <= 1, "Ambiguous collector history")
        for job in collectors:
            if not collector_consumed_budget(job, run):
                continue
            started = timestamp(job["started_at"])
            require(started <= at, "Future collector timestamp")
            if started.astimezone(IST).date() != local.date():
                continue
            attempts.append((started, run, job))
    if attempts:
        started, previous, job = max(attempts, key=lambda item: item[0])
        # Do not let an older success mask a newer failure or active collector.
        if (previous.get("status") == "completed" and previous.get("conclusion") == "success"
                and job.get("conclusion") == "success"):
            return False, f"Automatic collection already completed today in run {previous['id']}; no duplicate calls."
        # The protected release is the authority, not a successful audit-only
        # dispatch. A recovery must follow the failed collector and finish before
        # this decision, with the exact published run attempt and a successful job.
        for recovery in runs:
            if (recovery.get("event") != "workflow_dispatch" or is_automatic_run(recovery)
                    or recovery.get("head_branch") != "main"
                    or recovery.get("head_repository", {}).get("full_name") != repository
                    or recovery.get("status") != "completed" or recovery.get("conclusion") != "success"
                    or f"{recovery['id']}-{recovery.get('run_attempt', 1)}" != published_run_id):
                continue
            created = timestamp(recovery["created_at"])
            if not (previous.get("status") == "completed" and job.get("completed_at")
                    and started <= timestamp(job["completed_at"]) <= created <= at
                    and created.astimezone(IST).date() == local.date()):
                continue
            recovered_jobs = [j for j in lookup(recovery) if j.get("name") == COLLECT_JOB_NAME]
            require(len(recovered_jobs) == 1, "Ambiguous recovery collector history")
            recovered = recovered_jobs[0]
            require(recovered.get("status") == "completed" and recovered.get("conclusion") == "success"
                    and recovered.get("started_at") and recovered.get("completed_at")
                    and created <= timestamp(recovered["started_at"]) <= timestamp(recovered["completed_at"]) <= at,
                    "Published recovery collector is incomplete or invalid")
            return False, f"Today's automatic failure was recovered and published by run {recovery['id']}; no duplicate calls."
        raise ValueError("Today's automatic attempt failed or is incomplete; inspect it and use explicit manual recovery")
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
        published = read(ROOT / "public/automation-audit/release.json")["run_id"]
        runs = attempt_history(api, history["workflow_runs"], published)
        lookup = lambda run_id, attempt: api.all(f"/actions/runs/{run_id}/attempts/{attempt}/jobs", "jobs")
        allowed, reason = decide(at, runs, lambda run_id: api.all(
            f"/actions/runs/{run_id}/jobs?filter=all", "jobs"), os.environ["GITHUB_RUN_ID"], api.repo,
            published, jobs_for_attempt=lookup)
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        out.write("run_collect=" + str(allowed).lower() + "\n")
    print(reason)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as out:
            out.write("### Daily collection decision\n" + reason + "\n")


if __name__ == "__main__":
    main()
