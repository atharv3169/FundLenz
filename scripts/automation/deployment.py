"""Confirm exact Cloudflare dataset identity after a merge; never infer it."""
import os
import time
import urllib.request
import urllib.error
from common import ROOT, loads, read, require, write
from github_api import GitHub, NoRedirect



def verify_live_catalogue(release, observed, published_metadata=None):
    """Verify deployed release plus the site-visible date of a financial change."""
    require(observed == release, "Deployed release marker does not match this data release")
    if release.get("financial_data_changed"):
        require(isinstance(published_metadata, dict) and
                published_metadata.get("lastCatalogueUpdateDate") == release.get("lastCatalogueUpdateDate") and
                published_metadata.get("lastCatalogueUpdateRunId") == release.get("run_id"),
                "Deployed catalogue date does not match the verified financial release")



def approved_production_origins(configured):
    """Never accept an untrusted URL from the public release marker."""
    known = ["https://fundlenz.atharvsahu711.workers.dev", "https://fundlenz.com"]
    require(configured in known, "Unreviewed production origin")
    return [configured, *[origin for origin in known if origin != configured]]


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
                opener = urllib.request.build_opener(NoRedirect())
                # The workers.dev route can be blocked even if the custom
                # FundLenz domain is serving the deployed Worker correctly.
                # Both are hardcoded owner-controlled origins. Require exact
                # marker and date match on any route; never accept an arbitrary
                # hostname or claim deployment based on build status alone.
                for origin in approved_production_origins(policy["production_url"]):
                    try:
                        url = origin + "/automation-audit/release.json?commit=" + commit
                        with opener.open(urllib.request.Request(url, headers={"Cache-Control": "no-cache"}), timeout=20) as response:
                            observed = loads(response.read(16385))
                        published_metadata = None
                        if release.get("financial_data_changed"):
                            url = origin + "/data/site-metadata.json?commit=" + commit
                            with opener.open(urllib.request.Request(url, headers={"Cache-Control": "no-cache"}), timeout=20) as response:
                                published_metadata = loads(response.read(16385))
                        verify_live_catalogue(release, observed, published_metadata)
                    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError, ValueError):
                        continue
                    report.update(status="confirmed", deployment_complete=True,
                                  dataset_sha256=release["dataset_sha256"],
                                  confirmed_origin=origin, check_url=latest["html_url"])
                    break
                require(report["deployment_complete"],
                        "No approved production origin served the exact financial release")
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
