"""Service-outage recovery stays bounded and never bypasses validation."""
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from model_tasks import bounded_call, ModelContractError

class GeminiRecoveryTests(unittest.TestCase):
    policy = {'model_retries': 3, 'model_retry_delay_seconds': 60,
              'model_retry_http_statuses': [500, 502, 503, 504]}

    @staticmethod
    def error(status=503):
        return urllib.error.HTTPError('https://example.invalid', status, 'private provider body', {}, None)

    def test_service_recovers_after_three_failures(self):
        caller = mock.Mock(side_effect=[self.error(), self.error(), self.error(), ({'valid': True}, {})])
        delays, events = [], []
        with mock.patch('builtins.print') as output:
            result = bounded_call({}, 'fresh_scan', self.policy, caller, delays.append, events)
        self.assertEqual(result, ({'valid': True}, {}, 4))
        self.assertEqual(delays, [60, 120, 240])
        self.assertEqual([e['http_status'] for e in events], [503, 503, 503])
        self.assertNotIn('private provider body', str(output.call_args_list))
        self.assertNotIn('example.invalid', str(output.call_args_list))

    def test_persistent_outage_stops_at_four_calls(self):
        for error in (self.error(), TimeoutError(), ConnectionError(), urllib.error.URLError('fixture')):
            caller, delays = mock.Mock(side_effect=error), []
            with self.subTest(error=type(error).__name__), self.assertRaises(type(error)) as failure:
                bounded_call({}, 'fresh_scan', self.policy, caller, delays.append)
            self.assertEqual(caller.call_count, 4)
            self.assertEqual(failure.exception.fundlenz_attempts, 4)
            self.assertEqual(delays, [60, 120, 240])

    def test_auth_and_quota_never_retry_after_outage(self):
        for status in (400, 401, 403, 429):
            caller = mock.Mock(side_effect=[self.error(), self.error(status)])
            with self.assertRaises(urllib.error.HTTPError) as failure:
                bounded_call({}, 'fresh_scan', self.policy, caller, lambda _: None)
            self.assertEqual(caller.call_count, 2)
            self.assertEqual(failure.exception.code, status)

    def test_contract_and_service_failures_share_budget(self):
        packet = {'output_instructions': 'Keep all metadata unchanged.'}
        caller = mock.Mock(side_effect=[ModelContractError('fixture'), TimeoutError(), self.error(), ({}, {})])
        delays = []
        self.assertEqual(bounded_call(packet, 'fresh_scan', self.policy, caller, delays.append)[2], 4)
        self.assertEqual(delays, [120, 240])
        self.assertEqual(packet['output_instructions'], 'Keep all metadata unchanged.')
        self.assertIn('CORRECTIVE RETRY', caller.call_args.args[0]['output_instructions'])
        caller = mock.Mock(side_effect=ModelContractError('fixture'))
        with self.assertRaises(ModelContractError):
            bounded_call(packet, 'fresh_scan', self.policy, caller, lambda _: None)
        self.assertEqual(caller.call_count, 2)

if __name__ == '__main__': unittest.main()
