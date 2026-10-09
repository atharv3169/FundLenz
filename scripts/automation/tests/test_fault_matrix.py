"""Offline fault-injection matrix: synthetic failures, no remote calls or data writes.

This suite intentionally varies recovery paths and dates. It must run from a
PR without Gemini secrets or GitHub write credentials.
"""
import copy
import datetime as dt
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acquire import due_sources
from common import ROOT, dataset_hash, encoded, loads, manifest, read, sha
from issues import issue_id, reconcile_issues
from model_tasks import ModelContractError, bounded_call, is_no_work_packet, trusted_no_work_candidate
from publish import verify_release
from validate import stage_catalogue_update_date


class FaultMatrix(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = read(ROOT / "automation/runtime.json")

    def test_provider_error_codes_never_exceed_bounded_budget(self):
        count = 0
        # 5xx is transient under the reviewed policy; auth/quota/syntax is not.
        for code in [400, 401, 403, 404, 408, 409, 425, 429,
                     500, 502, 503, 504]:
            calls, delays = [], []
            def broken(*_):
                calls.append(code)
                raise urllib.error.HTTPError("https://example.invalid", code, "fixture", {}, None)
            with self.subTest(code=code), self.assertRaises(urllib.error.HTTPError):
                bounded_call({"output_instructions": "fixture"}, "fresh_scan",
                             self.policy, caller=broken, wait=delays.append)
            expected = 2 if code in self.policy["model_retry_http_statuses"] else 1
            self.assertEqual(len(calls), expected)
            self.assertLessEqual(len(delays), 1)
            count += 1
        self.assertEqual(count, 12)

    def test_mixed_service_and_contract_failures_stay_bounded(self):
        patterns = [
            ["contract", "http"], ["http", "contract"],
            ["contract", "contract"], ["http", "http"],
        ]
        for pattern in patterns:
            calls = []
            def scripted(*_):
                error = pattern[len(calls)]
                calls.append(error)
                if error == "contract":
                    raise ModelContractError("Fictional schema failure")
                raise urllib.error.HTTPError("https://example.invalid", 503, "fixture", {}, None)
            with self.subTest(pattern=pattern), self.assertRaises(Exception):
                bounded_call({"output_instructions": "fixture"}, "reinvestigation",
                             self.policy, caller=scripted, wait=lambda _: None)
            self.assertEqual(calls, pattern)

    def test_fairness_in_108_sources_across_multiple_scheduled_days(self):
        sources = [{
            "id": f"fictional-{i:03}",
            "url": f"https://unittest.example/fund-{i:03}",
            "adapter": "monitor",
            "cadence_hours": 24,
        } for i in range(108)]
        state = {}
        history = set()
        for day in range(1, 8):
            now = f"2026-10-{day:02}T08:00:00Z"
            selected, deferred, later = due_sources(sources, state, {"issues": []}, now, 19)
            self.assertLessEqual(len(selected), 19)
            self.assertEqual(len(selected) + len(deferred) + len(later), 108)
            for source in selected:
                history.add(source["id"])
                state[source["id"]] = {"last_attempt_at": now}
        # 108 / 19 rounds up to six, leaving ample time for retries.
        self.assertEqual(len(history), 108)
        self.assertEqual(len(state), 108)

    def test_issue_resolutions_are_idempotent_across_four_runs(self):
        url = "https://unittest.example/nav"
        start = {"sources": {}, "issues": {"schema_version": 1, "updated_at":
                 "2026-10-01T00:00:00Z", "issues": [], "note": "fixture"}, "applied_runs": []}
        unit = {"unit": "nav:fixture", "source_url": url, "decision": "blocked",
                "reason": "Fictional check", "previous_verified": {"nav": 8},
                "proposed_value": {"nav": 9}, "previous_snapshot_date": "2026-10-01"}
        state = start
        for day in [2, 3, 4]:
            at = f"2026-10-{day:02}T08:00:00Z"
            acquisition = {"run_id": f"run-{day}", "completed_at": at,
                           "source_checks": [{"source_id": "fixture", "source_url": url,
                           "outcome": "checked_changed", "checked_at": at, "source_sha256": "a" * 64}]}
            state, changes = reconcile_issues(state, acquisition, [unit], [])
            self.assertEqual(changes, [])
            same_state, repeated = reconcile_issues(state, acquisition, [unit], [])
            self.assertEqual(same_state, state)
            self.assertFalse(repeated)
        self.assertEqual(len(state["issues"]["issues"]), 1)
        self.assertEqual(state["issues"]["issues"][0]["attempts"], 3)
        unit = dict(unit, decision="unchanged")
        final = {"run_id": "run-5", "completed_at": "2026-10-05T08:00:00Z",
                 "source_checks": [{"source_id": "fixture", "source_url": url,
                                   "outcome": "checked_unchanged", "checked_at":
                                   "2026-10-05T08:00:00Z", "source_sha256": "a" * 64}]}
        state, resolved = reconcile_issues(state, final, [unit], [])
        self.assertEqual(len(resolved), 1)
        self.assertFalse(state["issues"]["issues"])

    def test_no_work_candidate_requires_absent_evidence_across_variants(self):
        for task in ["fresh_scan", "reinvestigation"]:
            packet = {"run_id": "fixture", "task_type": task,
                      "base_dataset_sha256": "a" * 64,
                      "started_at": "2026-10-09T05:00:00Z",
                      "completed_at": "2026-10-09T05:01:00Z",
                      "sources": [], "issues": [], "sample_adapter_decisions": []}
            candidate = trusted_no_work_candidate(packet)
            self.assertEqual(candidate["proposals"], [])
            self.assertEqual(candidate["source_checks"], [])
            for key in ["sources", "issues", "sample_adapter_decisions"]:
                corrupted = copy.deepcopy(packet)
                corrupted[key] = ["unresolved evidence"]
                self.assertFalse(is_no_work_packet(corrupted))
                with self.assertRaises(ValueError):
                    trusted_no_work_candidate(corrupted)

    def test_one_genuine_change_uses_ist_date_even_across_utc_boundary(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dest = root / "public/data/site-metadata.json"
            dest.parent.mkdir(parents=True)
            dest.write_bytes(encoded({"schemaVersion": 1,
                "catalogueSourceCheckDate": "2026-10-05"}))
            dates = [
                ("2026-10-09T18:29:59Z", "2026-10-09"),
                ("2026-10-09T18:30:00Z", "2026-10-10"),
                ("2026-10-09T20:00:00Z", "2026-10-10"),
            ]
            for i, (timestamp, expected) in enumerate(dates):
                files = {"public/data/catalog.json": b'{"test":true}\n'}
                date = stage_catalogue_update_date(root, files,
                    {"run_id": f"test-{i}", "completed_at": timestamp})
                self.assertEqual(date, expected)
                self.assertEqual(loads(files["public/data/site-metadata.json"])["lastCatalogueUpdateDate"], expected)
                # Every test must be isolated; source baseline is never mutated.
                self.assertNotIn("lastCatalogueUpdateDate", loads(dest.read_bytes()))

    def test_date_only_release_cannot_forge_financial_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            metadata = read(ROOT / "public/data/site-metadata.json")
            metadata.update(lastCatalogueUpdateDate="2026-10-09",
                            lastCatalogueUpdateRunId="fake-date-only")
            build_info = read(ROOT / "public/build-info.json")
            build_info["lastCatalogueUpdateDate"] = "2026-10-09"
            # Put the *unchanged exact bytes* of the catalogue in the release
            # to try and fool the financial-change declaration.
            overlay = {
                "public/data/catalog.json": (ROOT / "public/data/catalog.json").read_bytes(),
                "public/data/site-metadata.json": encoded(metadata),
                "public/build-info.json": encoded(build_info),
            }
            digest = dataset_hash(ROOT, overlay)
            files = dict(overlay)
            files["public/automation-audit/release.json"] = encoded({
                "schema_version": 1, "run_id": "fake-date-only",
                "dataset_sha256": digest, "financial_data_changed": True,
                "lastCatalogueUpdateDate": "2026-10-09"})
            for key, raw in files.items():
                to = p / "sanitized" / key
                to.parent.mkdir(parents=True, exist_ok=True)
                to.write_bytes(raw)
            (p / "release.json").write_bytes(encoded({
                "run_id": "fake-date-only",
                "base_dataset_sha256": dataset_hash(ROOT),
                "candidate_dataset_sha256": digest, "files": manifest(files),
                "data_changes": True}))
            with self.assertRaisesRegex(ValueError, "incorrectly declares financial data changes"):
                verify_release(p)


if __name__ == "__main__":
    unittest.main()
