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

    def test_large_raw_blob_and_strict_size_cap(self):
        raw = b'x' * (34 * 1024 * 1024)
        opener = mock.Mock()
        opener.open.return_value = io.BytesIO(raw)
        with mock.patch.object(github_api.urllib.request, 'build_opener', return_value=opener):
            api = github_api.GitHub(token='fictional')
            self.assertEqual(api.call('/git/blobs/' + 'a' * 40, raw_limit=len(raw)), raw)
            self.assertEqual(opener.open.call_args.args[0].get_header('Accept'), 'application/vnd.github.raw+json')
            opener.open.return_value = io.BytesIO(b'1234')
            with self.assertRaisesRegex(ValueError, 'Oversized'):
                api.call('/git/blobs/' + 'a' * 40, raw_limit=3)
            for path, limit in [('/contents/a', 4), ('/git/blobs/' + 'a' * 40, 101 * 1024 * 1024)]:
                with self.assertRaises(ValueError): api.call(path, raw_limit=limit)

    def test_gate_rejects_wrong_bytes_size_and_symlinks(self):
        from pr_gate import verify_blob
        api = mock.Mock()
        api.call.return_value = b'abc'
        entry = {'mode': '100644', 'type': 'blob', 'size': 3, 'sha': 'a' * 40}
        verify_blob(api, entry, b'abc')
        api.call.assert_called_once_with('/git/blobs/' + 'a' * 40, raw_limit=3)
        with self.assertRaisesRegex(ValueError, 'bytes differ'): verify_blob(api, entry, b'abd')
        for patch in ({'mode': '120000'}, {'type': 'tree'}, {'size': 4}):
            with self.assertRaises(ValueError): verify_blob(api, {**entry, **patch}, b'abc')

    def test_audit_index_keeps_all_decisions_and_binds_original_values(self):
        from common import ROOT, read, encoded, sha
        from validate import compact_audit
        report = read(ROOT / 'audit/latest.json')
        # Keep the fixture independent of whether production already contains
        # an audit index from a previous successful publication.
        report['changes'] = [{'unit': 'portfolio/test', 'decision': 'accepted',
                              'previous_verified': {'rows': ['old' * 10000]},
                              'proposed_value': {'rows': ['new' * 10000]}}]
        original = encoded(report)
        index = compact_audit(report)
        self.assertEqual(encoded(report), original)
        self.assertEqual(index['coverage']['full_report']['sha256'], sha(original))
        self.assertEqual(len(index['changes']), len(report['changes']))
        for before, after in zip(report['changes'], index['changes']):
            for key, value in before.items():
                if key in ('previous_verified', 'proposed_value'):
                    self.assertNotIn(key, after)
                    self.assertEqual(after[key + '_evidence'], {'sha256': sha(encoded(value)), 'bytes': len(encoded(value))})
                else: self.assertEqual(after[key], value)
        self.assertLess(len(encoded(index)), len(original))

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
