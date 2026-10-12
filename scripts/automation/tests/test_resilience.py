"""Fault injection for unattended transport and watchdog limits."""
import datetime as dt
import io
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import github_api
import health
import model_tasks


class ResilienceTests(unittest.TestCase):
    def test_github_get_recovers_but_mutations_never_replay(self):
        for method, expected in [("GET", 2), ("POST", 1)]:
            opener = mock.Mock()
            opener.open.side_effect = [urllib.error.HTTPError('https://api.github.com', 503, 'temporary', {}, None), io.BytesIO(b'{}')]
            with mock.patch.object(github_api.urllib.request, 'build_opener', return_value=opener), mock.patch.object(github_api.time, 'sleep'):
                api = github_api.GitHub(token='fictional')
                if method == 'GET': self.assertEqual(api.call('/actions', method), {})
                else:
                    with self.assertRaises(urllib.error.HTTPError): api.call('/actions', method)
            self.assertEqual(opener.open.call_count, expected)

    def test_github_retry_cap_and_permanent_errors(self):
        for status, count in [(504, 3), (401, 1), (403, 1), (429, 1)]:
            opener = mock.Mock()
            opener.open.side_effect = urllib.error.HTTPError('https://api.github.com', status, 'failure', {}, None)
            with mock.patch.object(github_api.urllib.request, 'build_opener', return_value=opener), mock.patch.object(github_api.time, 'sleep'):
                with self.assertRaises(urllib.error.HTTPError): github_api.GitHub(token='fictional').call('/actions')
            self.assertEqual(opener.open.call_count, count)

    def test_model_network_retry_keeps_existing_two_attempt_budget(self):
        policy = {'model_retries': 1, 'model_retry_delay_seconds': 15}
        caller = mock.Mock(side_effect=[TimeoutError(), ({}, {})])
        self.assertEqual(model_tasks.bounded_call({}, 'fresh_scan', policy, caller, lambda _: None)[2], 2)
        caller = mock.Mock(side_effect=TimeoutError())
        with self.assertRaises(TimeoutError) as caught:
            model_tasks.bounded_call({}, 'fresh_scan', policy, caller, lambda _: None)
        self.assertEqual(caller.call_count, 2)
        self.assertEqual(caught.exception.fundlenz_attempts, 2)

    def test_watchdog_catches_missed_failed_and_stuck_schedules(self):
        at = dt.datetime(2026, 10, 12, 12, tzinfo=dt.timezone.utc)
        good = {'id': 12, 'event': 'schedule', 'head_branch': 'main', 'created_at': '2026-10-12T03:47:00Z', 'status': 'completed', 'conclusion': 'success'}
        self.assertEqual(health.verify_schedule([good], at), 12)
        for runs in [[], [{**good, 'event':'workflow_dispatch'}], [{**good, 'created_at':'2026-10-10T03:47:00Z'}], [{**good, 'conclusion':'failure'}], [{**good, 'status':'in_progress'}]]:
            with self.assertRaises(ValueError): health.verify_schedule(runs, at)

    def test_redirect_must_preserve_exact_path_query_and_https(self):
        expected = 'https://fundlenz.com/blogpost?health=1'
        for target, code, valid in [(expected,301,True), (expected,308,True), ('https://fundlenz.com/',301,False), (expected,302,False)]:
            opener = mock.Mock()
            opener.open.side_effect = urllib.error.HTTPError('https://www.fundlenz.com', code, 'redirect', {'Location':target}, None)
            if valid: health.verify_redirect(opener, 'https://www.fundlenz.com/blogpost?health=1', expected)
            else:
                with self.assertRaises(ValueError): health.verify_redirect(opener, 'https://www.fundlenz.com/blogpost?health=1', expected)


if __name__ == '__main__': unittest.main()
