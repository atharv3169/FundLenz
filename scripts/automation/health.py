"""Independent read-only watchdog. Never calls Gemini or changes production."""
import datetime as dt
import os
import time
import urllib.error
import urllib.request
from common import ROOT, now, read, require, timestamp, write
from deployment import approved_production_origins, probe_exact_origin, verify_public_assets, safe_probe_problem
from github_api import GitHub, NoRedirect
from schedule_guard import is_automatic_run, attempt_history


def verify_schedule(runs, at, published_run_id=None):
    scheduled = [r for r in runs if is_automatic_run(r)]
    require(scheduled, "No scheduled catalogue run found")
    latest = max(scheduled, key=lambda r: (timestamp(r["created_at"]), r.get("run_attempt", 1)))
    age = (at - timestamp(latest["created_at"])).total_seconds()
    require(0 <= age <= 36 * 3600, "Daily catalogue schedule is overdue (36-hour limit)")
    if latest["status"] != "completed":
        require(age <= 3600, "Daily catalogue run is stuck")
    else:
        if latest["conclusion"] != "success":
            # A successful manual collector alone proves nothing about publication.
            # Only the exact run/attempt recorded by the protected release on main
            # may acknowledge recovery; the live release is still probed below.
            recovered = [r for r in runs if r.get("event") == "workflow_dispatch" and not is_automatic_run(r)
                         and r.get("head_branch") == "main" and r.get("status") == "completed"
                         and r.get("conclusion") == "success"
                         and f"{r['id']}-{r.get('run_attempt', 1)}" == published_run_id
                         and timestamp(latest["created_at"]) <= timestamp(r["created_at"]) <= at]
            require(recovered, "Latest scheduled catalogue run failed without a published recovery")
            return recovered[0]["id"]
    return latest["id"]


def verify_published_audit(audit, release, at):
    """A green trigger or publisher-created PR is not a completed publication."""
    require(audit.get("run_id") == release.get("run_id"), "Published audit/release mismatch")
    require(audit.get("status") in {"PASS", "PARTIAL", "NO_CHANGE"}, "Published audit is unsuccessful")
    age = (at - timestamp(audit["completed_at"])).total_seconds()
    require(0 <= age <= 36 * 3600, "Published catalogue audit is overdue (36-hour limit)")
    return round(age / 3600, 2)


def verify_redirect(opener, url, expected):
    try:
        with opener.open(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20):
            raise ValueError("WWW did not redirect")
    except urllib.error.HTTPError as error:
        require(error.code in {301, 308} and error.headers.get("Location") == expected,
                "WWW redirect lost its HTTPS destination, path or query")


def main():
    report = {"checked_at": now(), "status": "failed"}
    deadline = time.monotonic() + 360
    try:
        api = GitHub()
        runs = api.call("/actions/workflows/catalogue-daily.yml/runs?branch=main&per_page=100")["workflow_runs"]
        release = read(ROOT / "public/automation-audit/release.json")
        runs = attempt_history(api, runs, release["run_id"])
        report["daily_run_id"] = verify_schedule(runs, dt.datetime.now(dt.timezone.utc), release["run_id"])
        report["published_audit_age_hours"] = verify_published_audit(
            read(ROOT / "public/automation-audit/latest.json"), release, dt.datetime.now(dt.timezone.utc))
        origin = approved_production_origins(read(ROOT / "automation/runtime.json")["production_url"])[0]
        opener = urllib.request.build_opener(NoRedirect())
        # A deployment can briefly overlap the watchdog. Allow bounded propagation
        # retries without turning a mismatched release into a success.
        attempts = 15 if os.environ.get("GITHUB_EVENT_NAME") == "push" else 3
        for attempt in range(attempts):
            if time.monotonic() >= deadline:
                raise TimeoutError("Health observation deadline exhausted")
            try:
                probe_exact_origin(opener, origin, os.environ["GITHUB_SHA"], release)
                verify_public_assets(opener, origin, os.environ["GITHUB_SHA"], ROOT)
                for path in ["/", "/blogpost", "/catalogue-india", "/catalogue-global"]:
                    request = urllib.request.Request(origin + path, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
                    with opener.open(request, timeout=20) as response:
                        require(response.status == 200, "Public page is unavailable")
                for scheme in ["http", "https"]:
                    verify_redirect(opener, scheme + "://www.fundlenz.com/blogpost?health=1",
                                    "https://fundlenz.com/blogpost?health=1")
                require(time.monotonic() < deadline, "Health observation exceeded its deadline")
                break
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
                if attempt == attempts - 1 or time.monotonic() >= deadline:
                    report["probe_category"] = safe_probe_problem(error)
                    raise
                time.sleep(min(20, max(0, deadline - time.monotonic())))
        report.update(status="healthy", origin=origin, release_run_id=release["run_id"])
    except Exception as error:
        report["error_type"] = type(error).__name__
        # No API bodies, credentials or model text in diagnostics.
        print("::error::FundLenz health check failed; inspect the watchdog artifact and latest catalogue/deployment runs.")
        raise
    finally:
        write(ROOT / "work/health.json", report)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as stream:
                stream.write("### FundLenz unattended health: " + report["status"] + "\n")


if __name__ == "__main__":
    main()
