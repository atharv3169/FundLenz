"""Offline deployment confirmation tests. No actual HTTP/GitHub writes."""
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import deployment


class DeploymentConfirmationTests(unittest.TestCase):
    SHA = "a" * 64
    COMMIT = "f" * 40
    HOST = "https://fundlenz.atharvsahu711.workers.dev"

    def marker(self, changed=False):
        return {"schema_version": 1, "run_id": "fictional-run",
                "dataset_sha256": self.SHA,
                "financial_data_changed": changed,
                "lastCatalogueUpdateDate": "2026-10-09" if changed else None}

    def temp_repo(self, d, marker):
        root = Path(d)
        (root / "public/automation-audit").mkdir(parents=True)
        (root / "automation").mkdir()
        (root / "public/automation-audit/release.json").write_text(json.dumps(marker))
        (root / "automation/runtime.json").write_text(json.dumps({"production_url": self.HOST}))
        return root

    def test_strict_classification(self):
        self.assertFalse(deployment.requires_financial_confirmation(self.marker(), self.SHA))
        self.assertTrue(deployment.requires_financial_confirmation(self.marker(True), self.SHA))
        for fields in [{"financial_data_changed": "false"}, {"financial_data_changed": 0},
                       {"financial_data_changed": None}, {"dataset_sha256": "b"*64},
                       {"schema_version": 2}, {"run_id": ""}]:
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                deployment.requires_financial_confirmation({**self.marker(), **fields}, self.SHA)
        with self.assertRaises(ValueError):
            deployment.requires_financial_confirmation(
                {**self.marker(True), "lastCatalogueUpdateDate": None}, self.SHA)

    def test_audit_only_does_not_contact_network_or_claim_deployment(self):
        with tempfile.TemporaryDirectory() as d:
            root = self.temp_repo(d, self.marker())
            with mock.patch.object(deployment, "ROOT", root), \
                 mock.patch.object(deployment, "dataset_hash", return_value=self.SHA), \
                 mock.patch.object(deployment, "GitHub", side_effect=AssertionError("unexpected API")), \
                 mock.patch.object(deployment.urllib.request, "build_opener",
                                   side_effect=AssertionError("unexpected live probe")), \
                 mock.patch.dict(os.environ, {"GITHUB_SHA": self.COMMIT}, clear=False):
                deployment.main()
            report = json.loads((root/"work/deployment.json").read_text())
            self.assertEqual(report["status"], "audit_only_no_financial_changes")
            self.assertIs(report["deployment_complete"], False)
            self.assertNotIn("confirmed_origin", report)

    def test_exact_marker_and_fund_date_required(self):
        marker = self.marker(True)
        class Opener:
            def __init__(self, release, metadata):
                self.release, self.metadata = release, metadata
                self.requests = []
            def open(self, req, timeout):
                self.requests.append(req.full_url)
                result = self.metadata if "site-metadata.json" in req.full_url else self.release
                return io.BytesIO(json.dumps(result).encode())
        good_date = {"lastCatalogueUpdateDate":"2026-10-09",
                     "lastCatalogueUpdateRunId":"fictional-run"}
        opener = Opener(marker, good_date)
        deployment.probe_exact_origin(opener, self.HOST, self.COMMIT, marker)
        self.assertEqual(len(opener.requests), 2)
        self.assertTrue(all("commit="+self.COMMIT in u for u in opener.requests))
        with self.assertRaisesRegex(ValueError, "catalogue date"):
            deployment.probe_exact_origin(Opener(marker,
                {**good_date, "lastCatalogueUpdateRunId":"wrong"}),
                self.HOST, self.COMMIT, marker)
        with self.assertRaisesRegex(ValueError, "release marker"):
            deployment.probe_exact_origin(Opener({**marker, "dataset_sha256":"b"*64},
                good_date), self.HOST, self.COMMIT, marker)

    def exercise_live(self, opener, expect_failure=False):
        marker = self.marker(True)
        class FakeAPI:
            def all(self, *_):
                return [{"name": "Workers Builds: fundlenz", "id": 42, "status":"completed",
                         "conclusion":"success", "html_url":"https://github.com/example/build"}]
        clock = [0.0]
        with tempfile.TemporaryDirectory() as d:
            root = self.temp_repo(d, marker)
            with mock.patch.object(deployment, "ROOT", root), \
                 mock.patch.object(deployment, "dataset_hash", return_value=self.SHA), \
                 mock.patch.object(deployment, "GitHub", return_value=FakeAPI()), \
                 mock.patch.object(deployment.urllib.request,"build_opener",return_value=opener), \
                 mock.patch.object(deployment.time,"monotonic",side_effect=lambda:clock[0]), \
                 mock.patch.object(deployment.time,"sleep",
                     side_effect=lambda sec:clock.__setitem__(0,clock[0]+sec)), \
                 mock.patch.dict(os.environ, {"GITHUB_SHA":self.COMMIT},clear=False):
                if expect_failure:
                    with self.assertRaisesRegex(ValueError,"not confirmed"):
                        deployment.main()
                else:
                    deployment.main()
            report = json.loads((root/"work/deployment.json").read_text())
            return report, clock[0]

    def test_404_is_retried_until_real_publication(self):
        marker = self.marker(True)
        class EventuallyLive:
            calls = 0
            def open(self, req, timeout):
                self.calls += 1
                if self.calls <= 4:
                    raise urllib.error.HTTPError(req.full_url,404,"awaiting deployment",{},None)
                data = {"lastCatalogueUpdateDate":"2026-10-09",
                        "lastCatalogueUpdateRunId":"fictional-run"} \
                    if "site-metadata.json" in req.full_url else marker
                return io.BytesIO(json.dumps(data).encode())
        report, elapsed = self.exercise_live(EventuallyLive())
        self.assertEqual(report["status"],"confirmed")
        self.assertTrue(report["deployment_complete"])
        self.assertEqual(report["confirmed_origin"],self.HOST)
        self.assertGreater(elapsed,0)

    def test_unreachable_real_release_remains_unconfirmed(self):
        class Unreachable:
            def open(self, req, timeout):
                raise urllib.error.HTTPError(req.full_url,403,"refused",{},None)
        report, elapsed = self.exercise_live(Unreachable(),expect_failure=True)
        self.assertEqual(report["status"],"failed_or_unconfirmed")
        self.assertFalse(report["deployment_complete"])
        self.assertEqual(set(report["probe_categories"].values()),{"http_403"})
        self.assertGreaterEqual(elapsed,600)


if __name__ == "__main__":
    unittest.main()
