"""Scheduling regression cases: duplicate costs, failed attempts and local-day boundaries."""
import datetime as dt
import sys
import os
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import health
import schedule_guard as guard

REPO = "atharv3169/FundLenz"
AT = dt.datetime.fromisoformat("2026-10-15T04:30:00+00:00")


def run(**changes):
    return {"id": 10, "event": "schedule", "head_branch": "main", "status": "completed",
            "conclusion": "success", "created_at": "2026-10-15T03:47:00Z",
            "head_repository": {"full_name": REPO}, **changes}


def collector(**changes):
    return {"name": guard.COLLECT_JOB_NAME, "started_at": "2026-10-15T03:47:20Z",
            "status": "completed", "conclusion": "success", **changes}


class ScheduleGuardTests(unittest.TestCase):
    def decide(self, runs, jobs=None, at=AT):
        lookup = mock.Mock(return_value=[collector()] if jobs is None else jobs)
        result = guard.decide(at, runs, lookup, 20, REPO)
        return result, lookup

    def test_first_automatic_attempt_and_current_run(self):
        self.assertTrue(self.decide([])[0][0])
        self.assertTrue(self.decide([run(id=20)])[0][0])

    def test_completed_native_and_external_runs_prevent_duplicates(self):
        for item in [run(), run(event="workflow_dispatch", display_title=guard.EXTERNAL_RUN_NAME)]:
            self.assertFalse(self.decide([item])[0][0])

    def test_manual_audits_and_other_branches_do_not_consume_daily_slot(self):
        for item in [run(event="workflow_dispatch"), run(head_branch="feature"), run(event="push")]:
            result, lookup = self.decide([item])
            self.assertTrue(result[0])
            lookup.assert_not_called()

    def test_failed_cancelled_or_running_attempt_requires_manual_recovery(self):
        for item in [run(conclusion="failure"), run(conclusion="cancelled"), run(status="in_progress", conclusion=None)]:
            with self.assertRaisesRegex(ValueError, "manual recovery"):
                self.decide([item])
        with self.assertRaises(ValueError):
            self.decide([run()], [collector(conclusion="failure")])

    def test_guard_only_skips_are_not_evidence_of_collection(self):
        self.assertTrue(self.decide([run()], [collector(conclusion="skipped")])[0][0])
        self.assertTrue(self.decide([run()], [collector(started_at=None)])[0][0])
        self.assertTrue(self.decide([run()], [dict(name="Guard automatic daily collection")])[0][0])

    def test_actual_collector_day_not_creation_day_controls_budget(self):
        self.assertFalse(self.decide([run(created_at="2026-10-14T20:00:00Z")])[0][0])
        self.assertTrue(self.decide([run()], [collector(started_at="2026-10-14T03:47:20Z")])[0][0])
        # IST crosses to 15 October at 18:30 UTC on 14 October.
        self.assertFalse(self.decide([run()], [collector(started_at="2026-10-14T19:00:00Z")])[0][0])

    def test_before_window_future_times_ambiguous_and_incomplete_history_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "before"):
            self.decide([], at=dt.datetime.fromisoformat("2026-10-15T03:46:59+00:00"))
        for items, jobs in [([run()] * 100, None), ([run(head_repository={"full_name":"wrong/repo"})], None),
                            ([run()], [collector(), collector()]),
                            ([run()], [collector(started_at="2026-10-16T03:47:20Z")])]:
            with self.assertRaises(ValueError): self.decide(items, jobs)

    def test_manual_default_and_automatic_opt_in_validation(self):
        self.assertFalse(guard.automatic_request("workflow_dispatch", {}, "refs/heads/main"))
        self.assertTrue(guard.automatic_request("schedule", {}, "refs/heads/main"))
        self.assertTrue(guard.automatic_request("workflow_dispatch", {
            "automated_daily":"true", "publish_validated_data":"true", "force_supported_sources":"false",
        }, "refs/heads/main"))
        for event, inputs, ref in [
            ("schedule", {}, "refs/heads/feature"),
            ("workflow_dispatch", {"automated_daily":True}, "refs/heads/main"),
            ("workflow_dispatch", {"automated_daily":True, "publish_validated_data":True,
                                   "force_supported_sources":True}, "refs/heads/main"),
            ("push", {"automated_daily":True, "publish_validated_data":True}, "refs/heads/main"),
        ]:
            with self.assertRaises(ValueError): guard.automatic_request(event, inputs, ref)

    def test_health_accepts_external_runs_but_not_manual_audits(self):
        external = run(event="workflow_dispatch", display_title=guard.EXTERNAL_RUN_NAME)
        self.assertEqual(health.verify_schedule([external], AT), 10)
        for item in [run(event="workflow_dispatch"), {**external, "conclusion":"failure"},
                     {**external, "created_at":"2026-10-12T03:47:00Z"}]:
            with self.assertRaises(ValueError): health.verify_schedule([item], AT)

    def test_manual_entrypoint_needs_no_api_and_automatic_reruns_are_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            event = Path(directory) / "event.json"
            output = Path(directory) / "output"
            event.write_text(json.dumps({"inputs":{}}))
            environment = {"GITHUB_EVENT_PATH":str(event), "GITHUB_OUTPUT":str(output),
                           "GITHUB_EVENT_NAME":"workflow_dispatch", "GITHUB_REF":"refs/heads/main"}
            with mock.patch.dict(os.environ, environment, clear=True), mock.patch.object(guard,"GitHub") as api:
                guard.main()
                api.assert_not_called()
                self.assertEqual(output.read_text(),"run_collect=true\n")
            environment.update(GITHUB_EVENT_NAME="schedule",GITHUB_RUN_ATTEMPT="2")
            with mock.patch.dict(os.environ, environment, clear=True), mock.patch.object(guard,"GitHub") as api:
                with self.assertRaisesRegex(ValueError,"Do not rerun"):
                    guard.main()
                api.assert_not_called()


if __name__ == "__main__":
    unittest.main()
