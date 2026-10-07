"""Persistent queue, idempotent attempts and recorded resolutions."""
import copy
from common import ROOT, read, require, sha


def issue_id(unit):
    return "daily-" + sha(unit.encode())[:20]


def reconcile_issues(previous, acquisition, units, model_findings):
    state = copy.deepcopy(previous)
    require(isinstance(state.get("applied_runs"), list), "Invalid persistent run ledger")
    if acquisition["run_id"] in state["applied_runs"]:
        return state, []
    at = acquisition["completed_at"]
    checks = {s["source_url"]: s for s in acquisition["source_checks"]}
    outcomes = {issue_id(u["unit"]): u for u in units}
    issues = {i["issue_id"]: i for i in state["issues"]["issues"]}
    resolutions = []
    reviewed = read(ROOT / "automation/reviewed-resolutions.json")["resolutions"]
    for identifier, issue in list(issues.items()):
        source = checks.get(issue["source_url"])
        if not source or not source["checked_at"]:
            continue  # Skipping never changes attempt counters.
        issue["attempts"] += 1
        issue["last_attempt_at"] = source["checked_at"]
        outcome = outcomes.get(identifier)
        # A generic source failure can resolve when its specific adapter/source
        # recovers, but bootstrap discovery and model rule warnings need evidence.
        recovered = outcome and outcome["decision"] in {"accepted", "unchanged"}
        if identifier == issue_id("source:" + source["source_id"]):
            source_units = [u for u in units if u["source_url"] == source["source_url"]]
            if source_units and all(u["decision"] in {"accepted", "unchanged", "retained_unsupported"} for u in source_units):
                recovered = True
        if issue["reason_code"] == "SOURCE_UNAVAILABLE" and source["outcome"].startswith("checked_"):
            recovered = True
        reviewed_recovery = False
        for approval in reviewed:
            require(set(approval) == {"issue_id", "unit", "source_sha256", "reason", "reviewed_at"}, "Invalid reviewed resolution")
            if approval["issue_id"] == identifier:
                matches = [u for u in units if u["unit"] == approval["unit"] and u["decision"] in {"accepted", "unchanged"}
                           and u["source_sha256"] == approval["source_sha256"]]
                reviewed_recovery = bool(matches)
                if reviewed_recovery: outcome = matches[0]
        if (recovered and issue["reason_code"] != "MODEL_RULE_REVIEW") or reviewed_recovery:
            resolutions.append({"issue_id": identifier, "at": at, "reason": "Reviewed resolution and exact source independently verified." if reviewed_recovery else "Same source/atomic unit independently verified.",
                                "source_url": source["source_url"], "source_sha256": source["source_sha256"],
                                "unit": outcome["unit"] if outcome else None})
            del issues[identifier]
        else:
            issue["consecutive_failures"] += 1
            issue["severity"] = "manual_review" if issue["consecutive_failures"] >= 7 else "warning" if issue["consecutive_failures"] >= 3 else "retry"
            issue["evidence_ref"] = "run:" + acquisition["run_id"] + "/acquisition.json#" + source["source_id"]
            if outcome:
                issue["previous_candidate"] = outcome["proposed_value"]

    def add(unit, source, reason_code, reason, old=None, new=None, date=None):
        identifier = issue_id(unit)
        if identifier in issues:
            return
        issues[identifier] = {"issue_id": identifier, "origin": "daily_validation", "scope": unit[:300],
                              "record_id": unit[:300], "fund_id": None, "security_id": None,
                              "source_url": source["source_url"], "reason_code": reason_code, "reason": reason[:5000],
                              "first_flagged_at": at, "last_attempt_at": source["checked_at"], "attempts": 1,
                              "consecutive_failures": 1, "severity": "retry", "retained_snapshot_date": date,
                              "previous_candidate": new, "previous_verified": old,
                              "evidence_ref": "run:" + acquisition["run_id"] + "/acquisition.json#" + source["source_id"], "status": "open"}
    for source in acquisition["source_checks"]:
        if source["checked_at"] and source["outcome"] == "unavailable":
            add("source:" + source["source_id"], source, "SOURCE_UNAVAILABLE", source["reason"])
    for unit in units:
        if unit["decision"] in {"blocked", "same_date_conflict", "older_snapshot"}:
            add(unit["unit"], checks[unit["source_url"]], "VALIDATION_BLOCKED", unit["reason"],
                unit["previous_verified"], unit["proposed_value"], unit["previous_snapshot_date"])
    for finding in model_findings:
        if finding["decision"] == "rule_review":
            source = checks.get(finding.get("source_url"))
            if source and source["checked_at"]:
                add("model:" + finding["atomic_group"], source, "MODEL_RULE_REVIEW", finding["reason"])
    for source in acquisition["source_checks"]:
        if source["checked_at"]:
            previous_source = state["sources"].get(source["source_id"], {})
            state["sources"][source["source_id"]] = {"last_attempt_at": source["checked_at"], "outcome": source["outcome"],
                                                     "sha256": source["source_sha256"] or previous_source.get("sha256")}
    state["issues"]["issues"] = sorted(issues.values(), key=lambda i: i["issue_id"])
    state["issues"]["updated_at"] = at
    state["applied_runs"] = [*state["applied_runs"], acquisition["run_id"]][-1000:]
    state["last_run_id"] = acquisition["run_id"]
    return state, resolutions
