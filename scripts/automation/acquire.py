"""Read-only official-source acquisition. No credentials, model calls or production writes."""
import concurrent.futures
import datetime as dt
import ipaddress
import os
import socket
import math
import re
from zoneinfo import ZoneInfo
import threading
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from common import ROOT, clean_error, dataset_hash, now, read, require, run_id, sha, timestamp, write


class ApprovedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed):
        super().__init__()
        self.allowed = allowed

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl, self.allowed)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def validate_url(url, allowed, resolver=socket.getaddrinfo):
    require(url in allowed, "URL/redirect is not explicitly approved")
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
            and parsed.port in (None, 443) and not parsed.fragment, "HTTPS public source required")
    addresses = resolver(parsed.hostname, 443, type=socket.SOCK_STREAM)
    require(addresses and all(ipaddress.ip_address(x[4][0]).is_global for x in addresses), "Non-public source address")


def validate_registry(registry):
    require(len({s["id"] for s in registry}) == len(registry), "Duplicate source ID")
    require(len({s["url"] for s in registry}) == len(registry), "Duplicate source URL")
    for source in registry:
        url = source["url"]
        require(0 < len(url) <= 3000 and not re.search(r'\s|[<>"{}]', url), "Malformed source URL; quarantine before acquisition")
        require(source["id"] == "src-" + sha(url.encode())[:16], "Source ID/URL mismatch")
        require(source["adapter"] in {"amfi_nav", "ishares_holdings", "monitor"}, "Unreviewed adapter")
        parsed = urllib.parse.urlsplit(url)
        require(parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password, "Invalid official-source URL")


def retrieve(source, policy):
    # A document fragment is a browser anchor, not part of an HTTP request.
    # Preserve it in the evidence URL but validate/fetch the exact network URL.
    request_url = urllib.parse.urldefrag(source["url"])[0]
    allowed = set([request_url, *source.get("approved_redirects", [])])
    validate_url(request_url, allowed)
    opener = urllib.request.build_opener(ApprovedRedirect(allowed))
    request = urllib.request.Request(request_url, headers={
        "User-Agent": "FundLenz/1.0 educational research info@fundlenz.com", "Accept-Encoding": "identity"})
    with opener.open(request, timeout=policy["source_timeout_seconds"]) as response:
        require(response.status == 200, "Unexpected response status")
        require(response.geturl() in allowed, "Unapproved final URL")
        require(response.headers.get("Content-Encoding", "identity") == "identity", "Unexpected compression")
        raw = response.read(policy["max_source_bytes"] + 1)
        require(0 < len(raw) <= policy["max_source_bytes"], "Empty/oversized source")
        if response.headers.get("Content-Length"):
            require(int(response.headers["Content-Length"]) == len(raw), "Truncated source body")
        return raw, response.geturl(), response.headers.get("Content-Type", ""), response.headers.get("Last-Modified")


def due_sources(registry, state, issues, at, limit, force_supported=False):
    issue_urls = {i["source_url"] for i in issues["issues"]}
    due, later = [], []
    for source in registry:
        previous = state.get(source["id"], {})
        last = previous.get("last_attempt_at")
        local = ZoneInfo("Asia/Kolkata")
        elapsed_days = (timestamp(at).astimezone(local).date() - timestamp(last).astimezone(local).date()).days if last else None
        is_due = not last or elapsed_days >= math.ceil(source["cadence_hours"] / 24)
        is_due = is_due or (force_supported and source["adapter"] != "monitor")
        if source["url"] in issue_urls:
            is_due = is_due or not last or elapsed_days >= 1
        (due if is_due else later).append(source)
    # All daily adapters first. Remaining slots rotate fairly by actual attempt time,
    # including unresolved monitoring issues; one broken site cannot starve all others.
    discovery_urls = {i["source_url"] for i in issues["issues"] if i["origin"] == "bootstrap_existing_source_check"}
    due.sort(key=lambda s: (0 if s["adapter"] != "monitor" else 1 if s["url"] in discovery_urls else 2,
                            state.get(s["id"], {}).get("last_attempt_at", ""), s["id"]))
    return due[:limit], due[limit:], later


def main():
    out = ROOT / "work/run"
    out.mkdir(parents=True, exist_ok=True)
    policy = read(ROOT / "automation/runtime.json")
    registry = read(ROOT / "automation/source-registry.json")["sources"]
    validate_registry(registry)
    state_path = ROOT / "work/state/state.json"
    state = read(state_path) if state_path.exists() else {"sources": {}, "issues": read(ROOT / "audit/open-issues.json"), "applied_runs": []}
    started = now()
    selected, budget, later = due_sources(registry, state["sources"], state["issues"], started, policy["max_sources_per_run"],
                                        os.environ.get("FUNDLENZ_FORCE_SUPPORTED") == "true")
    host_locks = {urllib.parse.urlsplit(s["url"]).hostname: threading.Lock() for s in selected}
    byte_lock, used = threading.Lock(), [0]

    def one(source):
        checked = now()
        entry = {"source_id": source["id"], "source_url": source["url"], "adapter": source["adapter"],
                 "checked_at": checked, "scope": source["scope"], "outcome": "unavailable", "source_sha256": None}
        try:
            with host_locks[urllib.parse.urlsplit(source["url"]).hostname]:
                raw, final, content_type, modified = retrieve(source, policy)
            with byte_lock:
                require(used[0] + len(raw) <= policy["max_run_source_bytes"], "Run byte budget exhausted")
                used[0] += len(raw)
            digest = sha(raw)
            path = "sources/" + source["id"] + ".bin"
            (out / path).parent.mkdir(exist_ok=True)
            (out / path).write_bytes(raw)
            previous = state["sources"].get(source["id"], {})
            entry.update(outcome="checked_unchanged" if digest == previous.get("sha256") else "checked_changed",
                         source_sha256=digest, path=path, bytes=len(raw), final_url=final,
                         content_type=content_type, http_last_modified=modified,
                         reason="Retrieved complete bytes; content change alone does not verify financial values.")
        except Exception as error:
            entry["reason"] = "Source not verified: " + clean_error(error)
            if isinstance(error, urllib.error.HTTPError):
                entry["http_status"] = error.code
        return entry

    with concurrent.futures.ThreadPoolExecutor(max_workers=policy["source_workers"]) as pool:
        results = list(pool.map(one, selected))
    for sources, outcome, reason in [(budget, "budget_exhausted", "Due but deferred by source-request budget."),
                                      (later, "deferred", "Not due under source cadence.")]:
        results.extend({"source_id": s["id"], "source_url": s["url"], "adapter": s["adapter"],
                        "checked_at": None, "scope": s["scope"], "outcome": outcome,
                        "source_sha256": None, "reason": reason} for s in sources)
    packet = {"schema_version": 1, "run_id": run_id(), "base_commit": os.environ.get("GITHUB_SHA", "local"),
              "base_dataset_sha256": dataset_hash(), "started_at": started, "completed_at": now(),
              "source_checks": results, "previous_state": state, "bytes_downloaded": used[0]}
    write(out / "acquisition.json", packet)
    print(f"Source checks: {len(selected)} attempted, {len(budget)} budget-deferred, {len(later)} not due; {used[0]} bytes.")


if __name__ == "__main__":
    main()
