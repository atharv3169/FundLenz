"""A published recovery clears old failures without hiding later/overdue timers."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
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

if __name__ == '__main__': unittest.main()
