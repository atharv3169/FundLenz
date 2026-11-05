"""A delayed backup must recognise a published recovery without extra model calls."""
import copy
import datetime as dt
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import schedule_guard as guard


class ScheduleRecoveryTests(unittest.TestCase):
    repo = 'atharv3169/FundLenz'
    at = dt.datetime.fromisoformat('2026-11-05T11:37:00+00:00')

    def setUp(self):
        self.failed = {'id': 1, 'event': 'workflow_dispatch', 'display_title': guard.EXTERNAL_RUN_NAME,
                       'head_branch': 'main', 'head_repository': {'full_name': self.repo},
                       'status': 'completed', 'conclusion': 'failure', 'created_at': '2026-11-05T03:47:32Z'}
        self.recovery = dict(self.failed, id=2, display_title='FundLenz daily catalogue',
                             conclusion='success', run_attempt=1, created_at='2026-11-05T05:04:24Z')
        self.jobs = {1: [{'name': guard.COLLECT_JOB_NAME, 'status': 'completed', 'conclusion': 'failure',
                         'started_at': '2026-11-05T03:47:50Z', 'completed_at': '2026-11-05T03:51:50Z'}],
                     2: [{'name': guard.COLLECT_JOB_NAME, 'status': 'completed', 'conclusion': 'success',
                         'started_at': '2026-11-05T05:04:50Z', 'completed_at': '2026-11-05T05:06:24Z'}]}

    def decide(self, published='2-1', extra=None):
        return guard.decide(self.at, [self.recovery, self.failed, *(extra or [])],
                            self.jobs.__getitem__, 99, self.repo, published)

    def test_nov5_delayed_backup_skips_after_exact_published_recovery(self):
        allowed, reason = self.decide()
        self.assertFalse(allowed)
        self.assertIn('recovered and published by run 2', reason)

    def test_audit_only_missing_or_wrong_attempt_cannot_clear_failure(self):
        for published in [None, 'another-1', '2-2', '']:
            with self.subTest(published=published), self.assertRaisesRegex(ValueError, 'manual recovery'):
                self.decide(published)

    def test_untrusted_or_incomplete_recovery_cannot_clear_failure(self):
        original = copy.deepcopy(self.recovery)
        for changes in [{'status': 'in_progress'}, {'conclusion': 'failure'}, {'head_branch': 'feature'},
                        {'head_repository': {'full_name': 'other/repo'}}, {'event': 'push'}]:
            self.recovery = dict(original, **changes)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.decide()

    def test_older_next_day_and_future_recoveries_do_not_clear_failure(self):
        for when in ['2026-11-04T05:04:24Z', '2026-11-05T03:48:00Z', '2026-11-05T12:00:00Z', '2026-11-06T05:04:24Z']:
            self.recovery['created_at'] = when
            with self.subTest(when=when), self.assertRaises(ValueError):
                self.decide()

    def test_running_automatic_attempt_never_disappears(self):
        self.failed.update(status='in_progress', conclusion=None)
        with self.assertRaises(ValueError):
            self.decide()

    def test_recovery_job_must_be_complete_successful_and_unambiguous(self):
        original = copy.deepcopy(self.jobs[2][0])
        for changes in [{'status': 'in_progress'}, {'conclusion': 'skipped'}, {'completed_at': None},
                        {'completed_at': '2026-11-05T12:00:00Z'}, {'started_at': '2026-11-05T03:47:00Z'}]:
            self.jobs[2] = [dict(original, **changes)]
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.decide()
        for jobs in [[], [original, original]]:
            self.jobs[2] = jobs
            with self.assertRaises(ValueError): self.decide()

    def test_newer_real_failure_wins_even_with_unsorted_history(self):
        later = dict(self.failed, id=3, created_at='2026-11-05T10:00:00Z')
        self.jobs[3] = [dict(self.jobs[1][0], started_at='2026-11-05T10:00:30Z', completed_at='2026-11-05T10:04:00Z')]
        with self.assertRaises(ValueError): self.decide(extra=[later])
        self.failed['conclusion'] = 'success'
        self.jobs[1][0]['conclusion'] = 'success'
        with self.assertRaises(ValueError): self.decide(extra=[later])

    def test_guard_only_failure_does_not_consume_another_collection_budget(self):
        later = dict(self.failed, id=3, event='schedule', created_at='2026-11-05T10:00:00Z')
        self.jobs[3] = [dict(self.jobs[1][0], conclusion='skipped')]
        self.assertFalse(self.decide(extra=[later])[0])

    def test_main_reads_protected_release_and_writes_skip(self):
        api = mock.Mock(repo=self.repo)
        api.call.return_value = {'total_count': 2, 'workflow_runs': [self.failed, self.recovery]}
        api.all.side_effect = lambda path, key: self.jobs[int(path.split('/')[3])]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'output'
            env = {'GITHUB_EVENT_PATH': '/event.json', 'GITHUB_OUTPUT': str(output), 'GITHUB_EVENT_NAME': 'schedule',
                   'GITHUB_REF': 'refs/heads/main', 'GITHUB_RUN_ID': '99'}
            with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(guard, 'GitHub', return_value=api), \
                 mock.patch.object(guard, 'read', side_effect=[{'inputs': {}}, {'run_id': '2-1'}]), \
                 mock.patch.object(guard.dt, 'datetime', wraps=dt.datetime) as clock:
                clock.now.return_value = self.at
                guard.main()
            self.assertEqual(output.read_text(), 'run_collect=false\n')


if __name__ == '__main__':
    unittest.main()
