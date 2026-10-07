"""Confirm exact Cloudflare dataset identity after a merge; never infer it."""
import os
import time
import urllib.request
from common import ROOT, loads, read, require, write
from github_api import GitHub, NoRedirect


def main():
    api = GitHub()
    commit = os.environ["GITHUB_SHA"]
    release_path = ROOT / "public/automation-audit/release.json"
    if not release_path.exists():
        print("No automated financial release in this commit; existing website deployment remains separate.")
        return
    release = read(release_path)
    policy = read(ROOT / "automation/runtime.json")
    report = {"commit": commit, "run_id": release["run_id"], "deployment_complete": False, "status": "pending"}
    deadline = time.monotonic() + 600
    try:
        while time.monotonic() < deadline:
            checks = api.all("/commits/" + commit + "/check-runs", "check_runs")
            builds = [c for c in checks if c["name"] == "Workers Builds: fundlenz"]
            latest = max(builds, key=lambda c: c["id"]) if builds else None
            if latest and latest["status"] == "completed":
                require(latest["conclusion"] == "success", "Cloudflare deployment check failed")
                url = policy["production_url"] + "/automation-audit/release.json?commit=" + commit
                with urllib.request.build_opener(NoRedirect()).open(url, timeout=20) as response:
                    observed = loads(response.read(16385))
                require(observed == release, "Deployed release marker does not match this data release")
                report.update(status="confirmed", deployment_complete=True, dataset_sha256=release["dataset_sha256"], check_url=latest["html_url"])
                break
            time.sleep(15)
        require(report["deployment_complete"], "Deployment confirmation timed out")
    except Exception as error:
        report.update(status="failed_or_unconfirmed", error_type=type(error).__name__)
        raise
    finally:
        write(ROOT / "work/deployment.json", report)
        print("Deployment status: " + report["status"])


if __name__ == "__main__":
    main()
