"""Retain an honest failure artifact even if an earlier runner stage crashed."""
from common import ROOT, now, read, write

result = ROOT / "work/result"
if not (result / "report.json").exists():
    state = ROOT / "work/state/state.json"
    value = read(state) if state.exists() else {"sources": {}, "issues": read(ROOT / "audit/open-issues.json"), "applied_runs": []}
    write(result / "state.json", value)
    write(result / "report.json", {"schema_version": 1, "report_kind": "runner_failure", "completed_at": now(),
                                  "status": "FAIL", "validation_passed": False, "merge_complete": False, "deployment_complete": False,
                                  "reason": "A stage failed before a complete daily report could be validated. Production and previous issue state retained; see job logs and any acquisition artifact for attempted scope."})
    (result / "summary.md").write_text("### FundLenz: FAIL\n\nRunner stopped before validation completed. Production was retained. Download the audit artifact for diagnostics.\n")
