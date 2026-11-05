"""Model observations cannot overwrite runner-owned provenance (Nov 5 regression)."""
import copy
import json
import sys
import unittest
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import ROOT, read
from model_tasks import candidate_from_review, verify_candidate_envelope, call_model, ModelContractError


class ModelReviewTests(unittest.TestCase):
    def setUp(self):
        self.policy = read(ROOT / 'automation/runtime.json')
        self.packet = {k: v for k, v in read(ROOT / 'automation/fixtures/empty-candidate.json').items()
                       if k not in {'schema_version', 'source_checks', 'proposals', 'summary'}}
        self.packet.update(sources=[{
            'source_id': 'src-fixture', 'source_sha256': 'a' * 64,
            'source_url': 'https://example.invalid/disclosure.csv',
            'checked_at': self.packet['completed_at'], 'outcome': 'checked_changed',
            'reason': 'Retrieved complete bytes; content change alone does not verify financial values.',
            'scope': 'Fictional test disclosure', 'excerpt': 'Fictional test data'}])
        self.review = {'reviewed_sources': [{'source_id': 'src-fixture', 'source_sha256': 'a' * 64}],
                       'proposals': [], 'summary': 'One bounded excerpt reviewed; no supported correction.'}

    def convert(self, review=None):
        return candidate_from_review(self.review if review is None else review, self.packet, 'reinvestigation', self.policy)

    def test_nov5_rewritten_reason_cannot_enter_trusted_ledger(self):
        original = copy.deepcopy(self.packet)
        candidate = self.convert()
        candidate['source_checks'][0]['reason'] = 'Complete Irish issuer portfolio; exact reviewed product ID and ISIN; published weights only'
        with self.assertRaisesRegex(ValueError, 'trusted source-check ledger'):
            verify_candidate_envelope(candidate, self.packet, 'reinvestigation', self.policy)
        candidate = self.convert()
        self.assertEqual(candidate['source_checks'][0]['reason'], original['sources'][0]['reason'])
        self.assertEqual(self.packet, original)
        candidate['source_checks'][0]['reason'] = 'mutated'
        self.assertEqual(self.packet, original)

    def test_exact_complete_source_binding_required(self):
        variants = [[], self.review['reviewed_sources'] * 2,
                    [{'source_id': 'wrong', 'source_sha256': 'a' * 64}],
                    [{'source_id': 'src-fixture', 'source_sha256': 'b' * 64}],
                    [{'source_id': 'src-fixture', 'source_sha256': None}]]
        for rows in variants:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                self.convert(dict(self.review, reviewed_sources=rows))

    def test_bookkeeping_extra_keys_and_old_protocol_rejected(self):
        for key in ['source_checks', 'run_id', 'started_at', 'completed_at', 'base_dataset_sha256', 'task_type']:
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.convert(dict(self.review, **{key: 'invented'}))
        with self.assertRaises(ValueError):
            self.convert(self.convert())
        with self.assertRaises(ValueError):
            self.convert(dict(self.review, reviewed_sources=[dict(self.review['reviewed_sources'][0], reason='invented')]))

    def test_invalid_proposals_and_summary_never_repaired(self):
        for change in [{'proposals': [{'new_candidate': 42}]}, {'proposals': [None] * 9}, {'summary': ''}, {'summary': None}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.convert(dict(self.review, **change))

    def test_packet_task_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, 'task mismatch'):
            candidate_from_review(self.review, self.packet, 'fresh_scan', self.policy)

    def test_multiple_sources_may_return_in_any_order(self):
        self.packet['sources'].append(dict(self.packet['sources'][0], source_id='src-second', source_sha256='b' * 64))
        self.review['reviewed_sources'].insert(0, {'source_id': 'src-second', 'source_sha256': 'b' * 64})
        candidate = self.convert()
        self.assertEqual([s['source_id'] for s in candidate['source_checks']], ['src-fixture', 'src-second'])

    def test_transport_uses_review_contract_and_invalid_response_retries(self):
        body = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(self.review)}]}}]}
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(body).encode()
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.dict('os.environ', {'GEMINI_API_KEY': 'fictional-test-key'}), \
             mock.patch('model_tasks.urllib.request.build_opener', return_value=opener), \
             mock.patch('model_tasks.write'), mock.patch.object(Path, 'write_text'):
            result, _ = call_model(self.packet, 'reinvestigation', self.policy)
            self.assertEqual(result, self.convert())
            payload = json.loads(opener.open.call_args.args[0].data)
            user = json.loads(payload['contents'][0]['parts'][0]['text'])
            self.assertIn('review_schema', user)
            self.assertNotIn('candidate_schema', user)
            body['candidates'][0]['content']['parts'][0]['text'] = '{"proposals": []}'
            response.__enter__.return_value.read.return_value = json.dumps(body).encode()
            with self.assertRaises(ModelContractError):
                call_model(self.packet, 'reinvestigation', self.policy)


if __name__ == '__main__':
    unittest.main()
