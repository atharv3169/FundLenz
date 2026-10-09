"""Confirm an exact published *financial* dataset; never confuse audits with deployments.

A successful scheduled source/Gemini audit may publish an audit ledger without
changing a single fund record. Those commits must not be reported as failed
financial deployments. For real financial releases, require both the Cloudflare
build and the exact publicly served dataset/date, with bounded propagation
retries. A build success alone is never sufficient evidence.
"""
import os
import re
import time
import urllib.request
import urllib.error
from common import ROOT, dataset_hash, loads, read, require, write
from github_api import GitHub, NoRedirect


def verify_live_catalogue(release, observed, published_metadata=None):
    """Verify the exact published release and (when changed) its site-visible date."""
    require(observed == release, "Deployed release marker does not match this data release")
    if release.get("financial_data_changed"):
        require(isinstance(published_metadata, dict) and
                published_metadata.get("lastCatalogueUpdateDate") == release.get("lastCatalogueUpdateDate") and
                published_metadata.get("lastCatalogueUpdateRunId") == release.get("run_id"),
                "Deployed catalogue date does not match the verified financial release")


def requires_financial_confirmation(release, actual_dataset_sha256):
    """Reject inconsistent markers before either declaring an audit or probing live."""
    require(isinstance(release, dict) and release.get("schema_version") == 1,
            "Unrecognized public release marker")
    require(type(release.get("financial_data_changed")) is bool,
            "Missing/invalid financial-change declaration")
    require(isinstance(release.get("run_id"), str) and release["run_id"],
            "Missing financial release run ID")
    require(re.fullmatch(r"[a-f0-9]{64}", release.get("dataset_sha256", "")) and
            release["dataset_sha256"] == actual_dataset_sha256,
            "Release marker does not match checked-out financial dataset")
    if release["financial_data_changed"]:
        require(isinstance(release.get("lastCatalogueUpdateDate"), str) and
                re.fullmatch(r"\d{4}-\d{2}-\d{2}", release["lastCatalogueUpdateDate"]),
                "Financial release has no verified catalogue update date")
    return release["financial_data_changed"]


def approved_production_origins(configured):
    """Never accept an untrusted URL from the public release marker."""
    known = ["https://fundlenz.atharvsahu711.workers.dev", "https://fundlenz.com"]
    require(configured in known, "Unreviewed production origin")
    return [configured, *[origin for origin in known if origin != configured]]


def probe_exact_origin(opener, origin, commit, release):
    """Query a vetted host; reject redirects, stale bytes, or a mismatched date."""
    url = origin + "/automation-audit/release.json?commit=" + commit
    with opener.open(urllib.request.Request(url, headers={"Cache-Control": "no-cache"}),
                     timeout=20) as response:
        observed = loads(response.read(16385))
    metadata = None
    if release["financial_data_changed"]:
        url = origin + "/data/site-metadata.json?commit=" + commit
        with opener.open(urllib.request.Request(url, headers={"Cache-Control": "no-cache"}),
                         timeout=20) as response:
            metadata = loads(response.read(16385))
    verify_live_catalogue(release, observed, metadata)


def safe_probe_problem(error):
    """Only record a bounded diagnostic category; never reveal response bodies."""
    if isinstance(error, urllib.error.HTTPError):
        return "http_" + str(error.code)
    if isinstance(error, (urllib.error.URLError, TimeoutError, OSError)):
        return "network_or_timeout"
    return "marker_or_date_mismatch"


def main():
    commit = os.environ["GITHUB_SHA"]
    release_path = ROOT / "public/automation-audit/release.json"
    if not release_path.exists():
        print("No automation release marker; no financial release to confirm.")
        return
    release = read(release_path)
    # Check bytes before classifying a release as 'audit only' to prevent a
    # misleading false flag from concealing a changed financial dataset.
    needs_live = requires_financial_confirmation(release, dataset_hash(ROOT))
    report = {"commit": commit, "run_id": release["run_id"],
              "deployment_complete": False, "status": "pending"}

    if not needs_live:
        report.update(status="audit_only_no_financial_changes",
                      details="Financial dataset unchanged; live financial deployment not required.")
        write(ROOT / "work/deployment.json", report)
        print("Audit-only update: no verified financial bytes changed. "
              "No financial deployment is claimed or required.")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
                summary.write("### FundLenz: audit-only release\n"
                              "No changed financial data or new catalogue date. "
                              "Live financial deployment confirmation: not applicable.\n")
        return

    policy = read(ROOT / "automation/runtime.json")
    origins = approved_production_origins(policy["production_url"])
    api = GitHub()
    opener = urllib.request.build_opener(NoRedirect())
    deadline = time.monotonic() + 600
    errors = {}
    try:
        while time.monotonic() < deadline:
            checks = api.all("/commits/" + commit + "/check-runs", "check_runs")
            builds = [c for c in checks if c["name"] == "Workers Builds: fundlenz"]
            latest = max(builds, key=lambda c: c["id"]) if builds else None
            if latest and latest["status"] == "completed":
                require(latest["conclusion"] == "success", "Cloudflare deployment check failed")
                for origin in origins:
                    try:
                        probe_exact_origin(opener, origin, commit, release)
                    except (urllib.error.HTTPError, urllib.error.URLError,
                            TimeoutError, OSError, ValueError) as error:
                        errors[origin] = safe_probe_problem(error)
                        continue
                    report.update(status="confirmed", deployment_complete=True,
                                  dataset_sha256=release["dataset_sha256"],
                                  confirmed_origin=origin, check_url=latest["html_url"])
                    break
                if report["deployment_complete"]:
                    break
                # Cloudflare Workers asset propagation and caching may lag the
                # successful build check. Continue probing until the deadline,
                # never silently equating build green with served data green.
            remaining = deadline - time.monotonic()
            if remaining > 0:
                time.sleep(min(15, remaining))
        if not report["deployment_complete"]:
            # Error categories only; no request/response bodies or secrets.
            report["probe_categories"] = errors
        require(report["deployment_complete"],
                "Exact financial release not confirmed on an approved origin within the deadline")
    except Exception as error:
        report.update(status="failed_or_unconfirmed", error_type=type(error).__name__)
        raise
    finally:
        write(ROOT / "work/deployment.json", report)
        print("Financial deployment status: " + report["status"])


if __name__ == "__main__":
    main()
