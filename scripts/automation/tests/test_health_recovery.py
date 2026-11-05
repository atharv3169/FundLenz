"""A published recovery clears old failures without hiding later/overdue timers."""
import datetime as dt
import sys
import os
from unittest import mock
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import health
from health import verify_schedule

class HealthRecoveryTests(unittest.TestCase):
    at = dt.datetime(2026, 11, 4, 12, tzinfo=dt.timezone.utc)
    failed = {'id': 1, 'event': 'schedule', 'head_branch': 'main',
              'created_at': '2026-11-04T03:47:00Z', 'status': 'completed', 'conclusion': 'failure'}
    recovery = {'id': 2, 'run_attempt': 1, 'event': 'workflow_dispatch', 'head_branch': 'main',
                'created_at': '2026-11-04T11:00:00Z', 'status': 'completed', 'conclusion': 'success'}

    def test_only_exact_published_recovery_clears_previous_failure(self):
        runs = [self.failed, self.recovery]
        self.assertEqual(verify_schedule(runs, self.at, '2-1'), 2)
        for run_id in (None, '2-2', '3-1'):
            with self.assertRaises(ValueError): verify_schedule(runs, self.at, run_id)

    def test_invalid_recovery_never_hides_failure(self):
        for change in ({'head_branch': 'feature'}, {'conclusion': 'failure'}, {'status': 'in_progress'},
                       {'created_at': '2026-11-04T01:00:00Z'}, {'created_at': '2026-11-05T11:00:00Z'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                verify_schedule([self.failed, {**self.recovery, **change}], self.at, '2-1')

    def test_recovery_cannot_hide_missing_overdue_or_later_failed_timer(self):
        for runs in ([self.recovery],
                     [{**self.failed, 'created_at': '2026-11-01T03:47:00Z'}, self.recovery],
                     [self.failed, self.recovery, {**self.failed, 'id': 3, 'created_at': '2026-11-04T11:30:00Z'}]):
            with self.assertRaises(ValueError): verify_schedule(runs, self.at, '2-1')

class HealthDeploymentWaitTests(unittest.TestCase):
    def exercise(self, event, failures, success):
        at = dt.datetime.now(dt.timezone.utc)
        run = {'id': 10, 'event': 'schedule', 'head_branch': 'main',
               'created_at': (at - dt.timedelta(minutes=10)).isoformat(),
               'status': 'completed', 'conclusion': 'success'}
        api = mock.Mock()
        api.call.return_value = {'workflow_runs': [run]}
        opener = mock.MagicMock()
        opener.open.return_value.__enter__.return_value.status = 200
        results = [ValueError('Old deployment')] * failures + ([None] if success else [])
        def config(path):
            if path.name == 'release.json': return {'run_id': '10-1'}
            if path.name == 'latest.json': return {'run_id': '10-1', 'status': 'PARTIAL', 'completed_at': at.isoformat()}
            return {'production_url': 'https://fundlenz.com'}
        with mock.patch.dict(os.environ, {'GITHUB_EVENT_NAME': event, 'GITHUB_SHA': 'a' * 40}, clear=True), \
             mock.patch.object(health, 'GitHub', return_value=api), mock.patch.object(health, 'read', side_effect=config), \
             mock.patch.object(health.urllib.request, 'build_opener', return_value=opener), \
             mock.patch.object(health, 'probe_exact_origin', side_effect=results) as probe, \
             mock.patch.object(health, 'verify_public_assets'), mock.patch.object(health, 'verify_redirect'), mock.patch.object(health.time, 'sleep') as sleep, \
             mock.patch.object(health, 'write') as write:
            if success:
                health.main()
                self.assertEqual(write.call_args.args[1]['status'], 'healthy')
            else:
                with self.assertRaises(ValueError): health.main()
                self.assertEqual(write.call_args.args[1]['status'], 'failed')
            self.assertEqual(probe.call_count, failures + int(success))
            self.assertEqual(sleep.call_count, failures if success else failures - 1)

    def test_push_waits_for_exact_live_release(self): self.exercise('push', 3, True)
    def test_push_never_marks_persistent_mismatch_healthy(self): self.exercise('push', 15, False)
    def test_scheduled_watchdog_keeps_short_retry_budget(self): self.exercise('schedule', 3, False)

if __name__ == '__main__': unittest.main()
