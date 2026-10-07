"""Independent deterministic reconciliation; sole producer of publishable files."""
import argparse
import collections
import copy
import os
import urllib.parse
from pathlib import Path
from common import ROOT, dataset_hash, encoded, loads, manifest, read, require, safe_path, schema, sha, timestamp, write
from adapters import allowed_paths, build_files, reconcile
from issues import reconcile_issues


def verify_acquisition(root, run, acquisition):
    require(acquisition["base_dataset_sha256"] == dataset_hash(root), "Production dataset changed; re-acquire/reconcile required")
    registry = {s["id"]: s for s in read(ROOT / "automation/source-registry.json")["sources"]}
    checks = acquisition["source_checks"]
    require(len(checks) == len(registry) and {s["source_id"] for s in checks} == set(registry), "Incomplete/duplicate source ledger")
    start, end = timestamp(acquisition["started_at"]), timestamp(acquisition["completed_at"])
    require(start <= end, "Invalid acquisition chronology")
    schema(acquisition["previous_state"]["issues"], "open-issues")
    raws = {}
    for s in checks:
        approved = registry[s["source_id"]]
        require(s["source_url"] == approved["url"] and s["adapter"] == approved["adapter"] and s["scope"] == approved["scope"], "Unapproved source context")
        if s["checked_at"]:
            require(start <= timestamp(s["checked_at"]) <= end, "Invalid source check time")
        require(s["outcome"] in {"checked_changed", "checked_unchanged", "deferred", "budget_exhausted", "unavailable"}, "Unknown retrieval outcome")
        if s["outcome"].startswith("checked_"):
            require(s["path"] == "sources/" + s["source_id"] + ".bin", "Untrusted source path")
            raw = safe_path(run, s["path"]).read_bytes()
            require(len(raw) == s["bytes"] and sha(raw) == s["source_sha256"], "Source checksum/size mismatch")
            require(s["final_url"] in [urllib.parse.urldefrag(approved["url"])[0], *approved["approved_redirects"]], "Unapproved source redirect")
            raws[s["source_id"]] = raw
        else:
            require(not s.get("path") and s["source_sha256"] is None, "Unexpected bytes for unsuccessful source")
    return raws


def validate_model(document, task, acquisition, units, input_packet):
    schema(document, "candidate")
    require(document["run_id"] == acquisition["run_id"] and document["base_dataset_sha256"] == acquisition["base_dataset_sha256"]
            and document["task_type"] == task, "Candidate is for a different run/base/task")
    supplied = {s["source_id"]: s for s in input_packet["sources"]}
    require(len(document["source_checks"]) == len(supplied), "Model source coverage incomplete")
    require({s["source_id"] for s in document["source_checks"]} == set(supplied), "Unknown/duplicate model source")
    for s in document["source_checks"]:
        require(all(s[k] == supplied[s["source_id"]][k] for k in ["source_url", "checked_at", "source_sha256", "outcome"]), "Model changed retrieval facts")
    by_url = {s["source_url"]: s for s in supplied.values()}
    actual = {u["unit"]: u for u in units}
    issue_ids = {i["issue_id"] for i in input_packet["issues"]}
    require(len(document["proposals"]) <= read(ROOT / "automation/runtime.json")["max_model_proposals"], "Too many model proposals")
    ids, findings = set(), []
    for p in document["proposals"]:
        require(p["proposal_id"] not in ids and p["task_type"] == task, "Duplicate proposal or wrong task")
        ids.add(p["proposal_id"])
        if task == "reinvestigation":
            require(p["issue_id"] in issue_ids, "Unknown investigation issue")
        require(p["source_url"] is None or p["source_url"] in by_url, "Model invented an unsupplied source")
        for evidence in p["evidence"]:
            s = by_url.get(evidence["source_url"])
            require(s and s["source_sha256"] and s["source_sha256"] == evidence["source_sha256"]
                    and s["checked_at"] == evidence["retrieved_at"], "Invented model evidence")
        u = actual.get(p["atomic_group"])
        supported_field = (u and ((u["unit"].startswith("nav:") and p["field"] == "nav"
                                  and p["record_id"] == u["unit"][4:])
                                 or (u["unit"].startswith("holdings:") and p["field"] == "holdings"
                                     and p["record_id"] == u["unit"][9:])))
        finding = {"task": task, "proposal_id": p["proposal_id"], "atomic_group": p["atomic_group"],
                   "source_url": p["source_url"], "finding": p["finding"], "reason": p["reason"], "original_candidate": p}
        if p["finding"] == "validator_false_positive":
            finding["decision"] = "rule_review"
            if u:
                u.update(decision="blocked", reason="Model raised a validator rule review; no automatic exception.")
        elif p["new_candidate"] is None:
            finding["decision"] = "unresolved"
            if u and u["decision"] == "accepted":
                u.update(decision="blocked", reason="Model investigation unresolved for this atomic unit.")
        elif supported_field and p["new_candidate"] == u["proposed_value"] and p["previous_verified"] == u["previous_verified"] \
                and p["snapshot_date"] == u["snapshot_date"] and p["source_url"] == u["source_url"] \
                and any(e["source_sha256"] == u["source_sha256"] and e["source_period"] == u["snapshot_date"] for e in p["evidence"]):
            finding["decision"] = "corroborated_by_adapter"
        else:
            finding["decision"] = "rule_review"
            finding["reason"] = "Unsupported or conflicting proposal; independently verified value required. " + p["reason"]
            if u:
                u.update(decision="blocked", reason="Model and deterministic source interpretation conflict.")
        findings.append(finding)
    return findings


def run_status(accepted, blocked, checked, incomplete, critical):
    if critical or (blocked and not accepted and not checked):
        return "FAIL"
    if blocked or incomplete:
        return "PARTIAL" if accepted or checked else "FAIL"
    return "PASS" if accepted else "NO_CHANGE"


def validate(root, run, output):
    acquisition = read(run / "acquisition.json")
    policy = read(ROOT / "automation/runtime.json")
    raws = verify_acquisition(root, run, acquisition)
    units, extras = reconcile(root, acquisition, policy, raws)
    findings, model_results, critical = [], [], []
    completed_at = acquisition["completed_at"]
    investigation_after = acquisition["previous_state"].get("investigation_after", "")
    for task in ["fresh_scan", "reinvestigation"]:
        status_path = run / (task + "-status.json")
        status = read(status_path) if status_path.exists() else {"status": "failed", "error_type": "TaskMissing"}
        if status.get("completed_at"):
            completed_at = max(completed_at, status["completed_at"], key=timestamp)
        try:
            require(status["status"] == "completed", "Model task failed/unavailable")
            # Reconstruct model input from trusted bytes, not an artifact's proposed context.
            from model_tasks import packets
            packet = packets(acquisition, units, task, policy, run)
            findings.extend(validate_model(read(run / (task + ".json")), task, acquisition, units, packet))
            model_results.append({"task": task, "status": "validated", "usage": status.get("usage", {}), "attempts": status.get("attempts", 1)})
            if task == "reinvestigation" and packet["issues"]:
                investigation_after = packet["issues"][-1]["issue_id"]
        except Exception as error:
            details = {"task": task, "status": "failed", "error_type": status.get("error_type") or type(error).__name__, "http_status": status.get("http_status")}
            if hasattr(error, "schema_path"):
                details["schema_path"] = list(error.schema_path)
                details["instance_path"] = list(error.path)
            elif isinstance(error, ValueError):
                details["validation_reason"] = str(error)[:300]
            model_results.append(details)
            critical.append(task + " did not pass the independent response contract.")
    state, resolutions = reconcile_issues(acquisition["previous_state"], acquisition, units, findings)
    state["investigation_after"] = investigation_after
    state["issues"]["updated_at"] = completed_at
    schema(state["issues"], "open-issues")
    # No partial file emission if either required task is malformed/unavailable.
    # All source-derived decisions remain in the report for diagnosis.
    files = build_files(root, units, extras, raws, acquisition) if not critical else {}
    if any(p.startswith("public/data/") for p in files):
        build_info = read(root / "public/build-info.json")
        build_info.update(datasetSha256=dataset_hash(root, files), automaticDataUpdates=policy["publication_enabled"],
                          release="catalogue-" + acquisition["run_id"])
        files["public/build-info.json"] = encoded(build_info)
    counts = collections.Counter(u["decision"] for u in units)
    checks = collections.Counter(s["outcome"] for s in acquisition["source_checks"])
    blockers = counts["blocked"] + counts["same_date_conflict"] + len(state["issues"]["issues"])
    incomplete = checks["unavailable"] + checks["budget_exhausted"]
    report = {"schema_version": 1, "report_kind": "daily", "run_id": acquisition["run_id"],
              "started_at": acquisition["started_at"], "completed_at": completed_at,
              "base_commit": acquisition["base_commit"], "base_dataset_sha256": acquisition["base_dataset_sha256"],
              "candidate_dataset_sha256": dataset_hash(root, files), "mode": policy["mode"],
              "status": run_status(len(files), blockers, checks["checked_changed"] + checks["checked_unchanged"], incomplete, critical),
              "validation_passed": not critical, "publication_eligible": bool(files) and not critical,
              "publication_enabled": policy["publication_enabled"], "merge_complete": False, "deployment_complete": False,
              "source_counts": dict(checks), "unit_counts": dict(counts), "source_checks": acquisition["source_checks"],
              "model_tasks": model_results, "model_findings": findings, "changes": units, "resolutions": resolutions,
              "open_issue_count": len(state["issues"]["issues"]), "critical_errors": critical,
              "coverage": {"automatic_adapters": ["AMFI existing-plan NAV tuples", "38 existing iShares complete portfolios"],
                           "monitoring_only": "Other Indian holdings, fund/share-class directories and stock/bond reference records. No lifecycle updates or inferred prices/yields.",
                           "retained_example": "US example file retains its previous common-period snapshot; global ETF portfolios update independently.",
                           "model_scope": "Bounded excerpts and sample units; deterministic adapters inspect complete supported files."}}
    schema(report, "daily-audit")
    write(output / "report.json", report)
    write(output / "state.json", state)
    summary = {k: report[k] for k in ["schema_version", "report_kind", "run_id", "completed_at", "status", "base_dataset_sha256",
                                     "candidate_dataset_sha256", "source_counts", "unit_counts", "open_issue_count", "coverage"]}
    summary.update(mode=policy["mode"], merge_complete=False, deployment_complete=False,
                   details="Full report and original source bytes are retained in this GitHub Actions run's fundlenz-audit artifact.")
    # Audit-only publication is allowed through the same protected PR gate. These
    # fields never relabel the site-wide source-check date or imply a deployment.
    files.update({"audit/latest.json": encoded(report), "audit/open-issues.json": encoded(state["issues"]),
                  "audit/automation-state.json": encoded(state), "public/automation-audit/latest.json": encoded(summary),
                  "public/automation-audit/release.json": encoded({"schema_version": 1, "run_id": acquisition["run_id"],
                      "base_commit": acquisition["base_commit"], "dataset_sha256": report["candidate_dataset_sha256"]})})
    for relative, raw in files.items():
        require(relative in allowed_paths(root), "Protected/unapproved publication path")
        path = safe_path(output / "sanitized", relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    release = {"schema_version": 1, "run_id": acquisition["run_id"], "base_commit": acquisition["base_commit"],
               "base_dataset_sha256": acquisition["base_dataset_sha256"], "candidate_dataset_sha256": report["candidate_dataset_sha256"],
               "files": manifest(files), "data_changes": any(p.startswith("public/data/") for p in files),
               "publication_enabled": policy["publication_enabled"]}
    write(output / "release.json", release)
    summary_text = (f"### FundLenz daily check: {report['status']}\n\n"
                    f"Mode: **{policy['mode']}**. Financial production files have not been published by this job.\n\n"
                    f"Source checks: `{dict(checks)}`. Unit decisions: `{dict(counts)}`. Open issues: {report['open_issue_count']}.\n\n"
                    f"Model tasks: `{model_results}`.\n\nDownload **fundlenz-audit** for full source, candidate, decision and issue records. "
                    "Unsupported sources are monitoring-only; no claim of a full-catalogue financial refresh.\n")
    (output / "summary.md").write_text(summary_text)
    print(summary_text)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--run", type=Path, default=ROOT / "work/run")
    parser.add_argument("--output", type=Path, default=ROOT / "work/result")
    args = parser.parse_args()
    validate(args.root.resolve(), args.run.resolve(), args.output.resolve())
