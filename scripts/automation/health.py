"""Independent read-only watchdog. Never calls Gemini or changes production."""
import datetime as dt
import os
import time
import urllib.error
import urllib.request
from common import ROOT, now, read, require, timestamp, write
from deployment import approved_production_origins, probe_exact_origin, safe_probe_problem
from github_api import GitHub, NoRedirect
from schedule_guard import is_automatic_run


def verify_schedule(runs, at):
    scheduled = [r for r in runs if is_automatic_run(r)]
    require(scheduled, "No scheduled catalogue run found")
    latest = max(scheduled, key=lambda r: timestamp(r["created_at"]))
    age = (at - timestamp(latest["created_at"])).total_seconds()
    require(0 <= age <= 36 * 3600, "Daily catalogue schedule is overdue (36-hour limit)")
    if latest["status"] != "completed":
        require(age <= 3600, "Daily catalogue run is stuck")
    else:
        require(latest["conclusion"] == "success", "Latest scheduled catalogue run failed")
    return latest["id"]


def verify_redirect(opener, url, expected):
    try:
        with opener.open(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20):
            raise ValueError("WWW did not redirect")
    except urllib.error.HTTPError as error:
        require(error.code in {301, 308} and error.headers.get("Location") == expected,
                "WWW redirect lost its HTTPS destination, path or query")


def main():
    report = {"checked_at": now(), "status": "failed"}
    try:
        api = GitHub()
        runs = api.call("/actions/workflows/catalogue-daily.yml/runs?branch=main&per_page=100")["workflow_runs"]
        report["daily_run_id"] = verify_schedule(runs, dt.datetime.now(dt.timezone.utc))
        origin = approved_production_origins(read(ROOT / "automation/runtime.json")["production_url"])[0]
        release = read(ROOT / "public/automation-audit/release.json")
        opener = urllib.request.build_opener(NoRedirect())
        # A deployment can briefly overlap the watchdog. Allow bounded propagation
        # retries without turning a mismatched release into a success.
        for attempt in range(3):
            try:
                probe_exact_origin(opener, origin, os.environ["GITHUB_SHA"], release)
                for path in ["/", "/blogpost", "/catalogue-india", "/catalogue-global"]:
                    request = urllib.request.Request(origin + path, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
                    with opener.open(request, timeout=20) as response:
                        require(response.status == 200, "Public page is unavailable")
                for scheme in ["http", "https"]:
                    verify_redirect(opener, scheme + "://www.fundlenz.com/blogpost?health=1",
                                    "https://fundlenz.com/blogpost?health=1")
                break
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
                if attempt == 2:
                    report["probe_category"] = safe_probe_problem(error)
                    raise
                time.sleep(20)
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
