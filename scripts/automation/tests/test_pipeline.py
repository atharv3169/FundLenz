"""Adversarial tests use retained official bytes and explicitly fictional mutations."""
import copy
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
import unittest
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import ROOT, dataset_hash, encoded, loads, read, require, safe_path, schema, sha
from acquire import due_sources, validate_url, validate_registry
from adapters import chronology, nav_candidates, parse_nav, holdings_candidate, allowed_paths, build_files
from issues import issue_id, reconcile_issues
from publish import protection_gate, verify_release
from validate import run_status, validate_model
from model_tasks import bounded_call, response_text, packets, ModelContractError, verify_candidate_envelope
from merge import wait_for_checks


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = read(ROOT / "automation/runtime.json")
        cls.india = read(ROOT / "public/data/catalog.json")
        # Mutations are tested against a fixed fictional tuple. The actual
        # catalogue is an evolving published dataset, not an immutable fixture.
        cls.nav_fixture = copy.deepcopy(cls.india)
        cls.nav_fixture["funds"][0]["plans"][0].update(nav=13.5, navDate="2026-10-05")
        cls.raw_nav = (ROOT / "data/sources/navall.txt").read_bytes()
        cls.registry = read(ROOT / "automation/source-registry.json")["sources"]
        cls.source = {"source_id": "fixture-source", "source_url": "https://portal.amfiindia.com/spages/NAVAll.txt",
                      "source_sha256": sha(cls.raw_nav), "checked_at": "2026-10-07T08:00:00Z", "outcome": "checked_changed",
                      "reason": "Fictional test source context", "scope": "test"}
        cls.download = next(d for d in read(ROOT / "data/sources/global/holdings/downloads.json") if d["ticker"] == "IVV")
        cls.raw_holdings = (ROOT / "data/sources/global/holdings" / cls.download["filename"]).read_bytes()
        cls.old_holdings = read(ROOT / "public/data/global/holdings" / (cls.download["id"] + ".json"))
        cls.global_catalogue = {f["id"]: f for f in read(ROOT / "public/data/global/catalog.json")["funds"]}

    def test_strict_json_rejects_duplicate_nan_and_infinity(self):
        for raw in ['{"x":1,"x":2}', '{"x":NaN}', '{"x":Infinity}', '{"x":1e999}']:
            with self.assertRaises(ValueError): loads(raw)

    def test_unsupported_candidate_keys_and_bad_dates(self):
        doc = read(ROOT / "automation/fixtures/empty-candidate.json")
        schema(doc, "candidate")
        for changes in [{"approved": True}, {"completed_at": "2026-02-30T00:00:00Z"}, {"base_dataset_sha256": "invented"}]:
            with self.assertRaises(Exception): schema(dict(doc, **changes), "candidate")

    def test_path_traversal_and_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            for path in ["../x", "/etc/passwd", "a/../../x", "a\\b", "a//b"]:
                with self.assertRaises(ValueError): safe_path(Path(temp), path)
            (Path(temp) / "link").symlink_to("/tmp")
            with self.assertRaises(ValueError): safe_path(Path(temp), "link/anything")

    def test_source_allowlist_redirect_and_private_address(self):
        url = "https://official.example/file"
        public = lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))]
        private = lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]
        validate_url(url, {url}, public)
        with self.assertRaises(ValueError): validate_url("https://other.example/file", {url}, public)
        with self.assertRaises(ValueError): validate_url(url, {url}, private)
        with self.assertRaises(ValueError): validate_url("http://official.example/file", {"http://official.example/file"}, public)

    def test_registry_has_exact_supported_scope(self):
        validate_registry(self.registry)
        self.assertEqual(sum(s["adapter"] == "amfi_nav" for s in self.registry), 1)
        self.assertEqual(sum(s["adapter"] == "ishares_holdings" for s in self.registry), 38)
        self.assertEqual(len({s["url"] for s in self.registry}), len(self.registry))
        self.assertTrue(all(s["approved_redirects"] == [] for s in self.registry))

    def test_malformed_inventory_cannot_become_network_allowlist(self):
        source = copy.deepcopy(self.registry[0]);source["url"] = "https://example.invalid/" + "x" * 3000
        source["id"] = "src-" + sha(source["url"].encode())[:16]
        with self.assertRaises(ValueError): validate_registry([source])

    def test_bounded_schedule_checks_adapters_and_old_discovery_issues(self):
        # Build a bounded fictional queue. The committed audit's number of
        # real unresolved issues can grow independently of this test's budget.
        issue_sources = [s for s in self.registry if s["adapter"] == "monitor"][:5]
        queue = {"issues": [{"source_url": s["url"], "origin": "bootstrap_existing_source_check"}
                            for s in issue_sources]}
        selected, budget, later = due_sources(self.registry, {}, queue, "2026-10-07T08:00:00Z", 64)
        self.assertEqual(len(selected), 64)
        self.assertEqual(sum(s["adapter"] != "monitor" for s in selected), 39)
        self.assertTrue({i["source_url"] for i in queue["issues"]} <= {s["url"] for s in selected})
        state = {s["id"]: {"last_attempt_at": "2026-10-07T08:00:00Z"} for s in selected}
        next_batch, _, not_due = due_sources(self.registry, state, queue, "2026-10-07T09:00:00Z", 64)
        self.assertEqual(len(not_due), 64)
        self.assertFalse({s["id"] for s in selected} & {s["id"] for s in next_batch})

    def test_nav_baseline_exact_identity(self):
        rows = parse_nav(self.raw_nav)
        self.assertEqual(len(rows), self.india["stats"]["planRecords"])
        results = nav_candidates(self.india, self.raw_nav, self.source, self.policy)
        self.assertEqual(len(results), self.india["stats"]["planRecords"])
        self.assertFalse(any(r["decision"] == "accepted" for r in results))

    def mutate_nav(self, nav=None, date=None, identity=None):
        lines = self.raw_nav.decode("utf-8-sig").splitlines()
        code = self.india["funds"][0]["plans"][0]["code"]
        n = next(i for i, line in enumerate(lines) if line.startswith(code + ";"))
        cells = lines[n].split(";")
        if nav is not None: cells[6] = nav
        if date is not None: cells[7] = date
        if identity is not None: cells[1] = identity
        lines[n] = ";".join(cells)
        return code, "\n".join(lines).encode()

    def nav_decision(self, **changes):
        code, raw = self.mutate_nav(**changes)
        return next(u for u in nav_candidates(self.nav_fixture, raw, dict(self.source, source_sha256=sha(raw)), self.policy) if u["unit"] == "nav:" + code)

    def test_new_nav_is_complete_atomic_tuple(self):
        unit = self.nav_decision(nav="13.6", date="06-Oct-2026")
        self.assertEqual(unit["decision"], "accepted")
        self.assertEqual(unit["proposed_value"], {"nav": 13.6, "navDate": "2026-10-06"})

    def test_nav_null_zero_nonfinite_future_and_large_change_blocked(self):
        for value in ["N.A.", "0", "-1", "NaN", "Infinity", "100000000"]:
            self.assertEqual(self.nav_decision(nav=value, date="06-Oct-2026")["decision"], "blocked")
        self.assertEqual(self.nav_decision(nav="13.6", date="08-Oct-2026")["decision"], "blocked")

    def test_identity_change_cannot_reuse_scheme_code(self):
        self.assertEqual(self.nav_decision(identity="INF000000000", date="06-Oct-2026")["decision"], "blocked")

    def test_same_date_disagreement_and_older_correction(self):
        self.assertEqual(self.nav_decision(nav="13.6", date="05-Oct-2026")["decision"], "same_date_conflict")
        self.assertEqual(self.nav_decision(nav="13.6", date="01-Sep-2026")["decision"], "older_snapshot")
        self.assertEqual(chronology("2026-10-06", "2026-10-05", 3, 4), "older_snapshot")

    def test_duplicate_nav_code_and_coverage_collapse(self):
        row = next(line for line in self.raw_nav.splitlines() if line[:1].isdigit())
        with self.assertRaises(ValueError): parse_nav(self.raw_nav + b"\n" + row)
        with self.assertRaises(ValueError): nav_candidates(self.india, b"Scheme Code;Scheme Name\nOpen Ended (x)\nAMC\n1;-;-;X;Direct;Growth;3;01-Oct-2026", self.source, self.policy)

    def holding_candidate(self, raw):
        s = dict(self.source, source_url=self.download["url"], source_sha256=sha(raw))
        return holdings_candidate(self.old_holdings, self.global_catalogue, self.download, raw, s, self.policy)

    def test_whole_official_portfolio_roundtrip(self):
        unit, summary, _, _ = self.holding_candidate(self.raw_holdings)
        self.assertEqual(unit["decision"], "unchanged")
        self.assertEqual(unit["proposed_value"]["holdings"], self.old_holdings["holdings"])
        self.assertAlmostEqual(summary["weightTotalPct"], sum(h["weight"] for h in self.old_holdings["holdings"]), places=7)

    def test_incomplete_holdings_cannot_replace_complete_snapshot(self):
        raw = b"\n".join(self.raw_holdings.splitlines()[:15])
        with self.assertRaises((ValueError, AssertionError, StopIteration)): self.holding_candidate(raw)

    def test_wrong_currency_and_identity_and_future_date(self):
        date_header = next(line for line in self.raw_holdings.splitlines()
                           if line.startswith(b"Fund Holdings as of,"))
        mutations = [
            (b'"USD"', b'"EUR"'),
            (b"iShares Core S&P 500 ETF", b"Other Fund"),
            (date_header, b'Fund Holdings as of,"Dec 31, 2099"'),
        ]
        for old, new in mutations:
            raw = self.raw_holdings.replace(old, new)
            self.assertNotEqual(raw, self.raw_holdings)
            with self.assertRaises((ValueError, AssertionError)): self.holding_candidate(raw)

    def make_state(self):
        return {"sources": {}, "issues": {"schema_version": 1, "updated_at": self.source["checked_at"], "issues": [], "note": "Test fixture."}, "applied_runs": []}

    def acquisition(self, source=None, identifier="fictional-1"):
        return {"run_id": identifier, "completed_at": self.source["checked_at"], "source_checks": [source or self.source]}

    def unit(self, code, outcome):
        return {"unit": "nav:" + code, "source_url": self.source["source_url"], "decision": outcome, "reason": "Fictional unit",
                "previous_verified": {"nav": 1, "navDate": "2026-10-01"}, "proposed_value": {"nav": 2, "navDate": "2026-10-06"}, "previous_snapshot_date": "2026-10-01"}

    def test_recovered_one_of_two_keeps_other_and_history(self):
        state, _ = reconcile_issues(self.make_state(), self.acquisition(), [self.unit("1", "blocked"), self.unit("2", "blocked")], [])
        recovered, resolutions = reconcile_issues(state, self.acquisition(identifier="fictional-2"), [self.unit("1", "accepted"), self.unit("2", "blocked")], [])
        self.assertEqual([i["issue_id"] for i in recovered["issues"]["issues"]], [issue_id("nav:2")])
        self.assertEqual(len(resolutions), 1)
        self.assertEqual(recovered["issues"]["issues"][0]["attempts"], 2)

    def test_more_failures_never_erase_old_issues(self):
        state, _ = reconcile_issues(self.make_state(), self.acquisition(), [self.unit("1", "blocked"), self.unit("2", "blocked")], [])
        current, _ = reconcile_issues(state, self.acquisition(identifier="fictional-2"), [self.unit(str(i), "blocked") for i in range(1, 4)], [])
        self.assertEqual(len(current["issues"]["issues"]), 3)

    def test_skips_and_reruns_do_not_inflate_attempts(self):
        state, _ = reconcile_issues(self.make_state(), self.acquisition(), [self.unit("1", "blocked")], [])
        same, _ = reconcile_issues(state, self.acquisition(), [self.unit("1", "blocked")], [])
        self.assertEqual(same, state)
        skipped, _ = reconcile_issues(state, self.acquisition(dict(self.source, checked_at=None, outcome="deferred"), "fictional-2"), [], [])
        self.assertEqual(skipped["issues"]["issues"], state["issues"]["issues"])

    def test_failure_escalates_on_actual_attempts(self):
        state = self.make_state()
        for i in range(1, 8):
            state, _ = reconcile_issues(state, self.acquisition(identifier="fictional-" + str(i)), [self.unit("1", "blocked")], [])
            if i == 3: self.assertEqual(state["issues"]["issues"][0]["severity"], "warning")
        self.assertEqual(state["issues"]["issues"][0]["severity"], "manual_review")

    def test_production_file_allowlist_excludes_code_and_rules(self):
        for path in ["app/globals.css", "lib/finance.ts", "scripts/automation/validate.py", ".github/workflows/catalogue-daily.yml", "automation/runtime.json", "public/data/../exploit.json"]:
            self.assertNotIn(path, allowed_paths())

    def test_base_race_unprotected_and_missing_gate_block_publication(self):
        base = "1" * 40
        branch = {"commit": {"sha": base}, "protected": True, "protection": {"required_status_checks": {"contexts": [self.policy["required_check"]]}}}
        protection_gate(branch, self.policy, base)
        for candidate, expected in [(dict(branch, protected=False), base), (branch, "2" * 40), (dict(branch, protection={}), base)]:
            with self.assertRaises(ValueError): protection_gate(candidate, self.policy, expected)

    def merge_api(self, states, move_head=False, failed=False):
        policy = self.policy
        class FakeAPI:
            repo = "fixture/repo"
            attempts = 0
            def call(self, path):
                if path.startswith("/pulls/"):
                    self.attempts += 1
                    return {"user": {"login": "publisher"}, "state": "open", "draft": False,
                            "head": {"repo": {"full_name": self.repo}, "ref": "automation/catalogue-fixture",
                                     "sha": "changed" if move_head and self.attempts > 1 else "head"},
                            "base": {"sha": "base", "ref": "main"},
                            "mergeable": states[min(self.attempts - 1, len(states) - 1)] in {"clean", "unstable"},
                            "mergeable_state": states[min(self.attempts - 1, len(states) - 1)]}
                if path == "/branches/main":
                    return {"commit": {"sha": "base"}, "protected": True,
                            "protection": {"required_status_checks": {"contexts": [policy["required_check"]]}}}
                if path == "/branches/main/protection":
                    return {"required_status_checks": {"strict": True}, "enforce_admins": {"enabled": True},
                            "required_pull_request_reviews": {}, "allow_force_pushes": {"enabled": False},
                            "allow_deletions": {"enabled": False}}
                raise AssertionError("Unexpected API mutation/request")
            def all(self, path, key):
                return [{"id": i, "name": name, "app": {"slug": "github-actions"},
                         "status": "completed", "conclusion": "failure" if failed else "success"}
                        for i, name in enumerate([policy["required_check"], "Verify FundLenz reviewed release"], 1)]
        return FakeAPI()

    def test_merge_waits_for_transient_state_then_accepts_exact_head(self):
        waits = []
        api = self.merge_api(["unknown", "blocked", "clean"])
        wait_for_checks(api, 1, self.policy, "head", "base", "publisher", attempts=3, wait=waits.append)
        self.assertEqual(waits, [15, 15])
        self.assertEqual(api.attempts, 3)

    def test_optional_running_merge_job_does_not_deadlock_required_checks(self):
        api = self.merge_api(["unstable"])
        wait_for_checks(api, 1, self.policy, "head", "base", "publisher", attempts=1)
        all_checks = api.all
        api.all = lambda *args: all_checks(*args)[:1]
        with self.assertRaisesRegex(ValueError, "still pending/blocked"):
            wait_for_checks(api, 1, self.policy, "head", "base", "publisher", attempts=1)

    def test_check_reads_use_separate_read_only_credential(self):
        publisher = self.merge_api(["clean"])
        reader = self.merge_api(["clean"])
        def forbidden(*args):
            raise AssertionError("Publishing credential must not read Checks API")
        publisher.all = forbidden
        wait_for_checks(publisher, 1, self.policy, "head", "base", "publisher", checks_api=reader)
        reader.repo = "wrong/repository"
        with self.assertRaisesRegex(ValueError, "reader repository mismatch"):
            wait_for_checks(publisher, 1, self.policy, "head", "base", "publisher", checks_api=reader)

    def test_merge_rechecks_identity_while_waiting(self):
        with self.assertRaisesRegex(ValueError, "head/base moved"):
            wait_for_checks(self.merge_api(["unknown", "clean"], move_head=True), 1, self.policy,
                            "head", "base", "publisher", attempts=3, wait=lambda _: None)

    def test_failed_or_permanently_pending_checks_never_merge(self):
        waits = []
        with self.assertRaisesRegex(ValueError, "check failed"):
            wait_for_checks(self.merge_api(["clean"], failed=True), 1, self.policy,
                            "head", "base", "publisher", attempts=2, wait=waits.append)
        self.assertEqual(waits, [])
        with self.assertRaisesRegex(ValueError, "still pending/blocked"):
            wait_for_checks(self.merge_api(["blocked"]), 1, self.policy,
                            "head", "base", "publisher", attempts=2, wait=waits.append)
        self.assertEqual(waits, [15])

    def test_reports_distinguish_fail_partial_and_no_change(self):
        self.assertEqual(run_status(0, 0, 4, 0, []), "NO_CHANGE")
        self.assertEqual(run_status(1, 0, 4, 0, []), "PASS")
        self.assertEqual(run_status(1, 2, 4, 0, []), "PARTIAL")
        self.assertEqual(run_status(0, 1, 0, 1, []), "FAIL")
        self.assertEqual(run_status(1, 0, 4, 0, ["Malformed model JSON"]), "FAIL")

    def test_publish_hash_tampering_and_extra_files(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp); (p / "sanitized/audit").mkdir(parents=True)
            raw = b'{}\n'; (p / "sanitized/audit/latest.json").write_bytes(raw)
            (p / "release.json").write_bytes(encoded({"files": [{"path": "audit/latest.json", "bytes": len(raw), "sha256": sha(raw)}]}))
            verify_release(p)
            (p / "sanitized/audit/latest.json").write_bytes(b'[]\n')
            with self.assertRaises(ValueError): verify_release(p)
            (p / "sanitized/audit/latest.json").write_bytes(raw)
            (p / "sanitized/extra.txt").write_text("unlisted")
            with self.assertRaises(ValueError): verify_release(p)

    def test_rollback_restores_byte_exact_dataset(self):
        # Reversible overlay trial, never touches production.
        before = dataset_hash()
        changed = dataset_hash(overlay={"public/data/catalog.json": b'{"fictional":true}\n'})
        self.assertNotEqual(before, changed)
        self.assertEqual(dataset_hash(overlay={}), before)

    def test_empty_model_task_and_false_source_claim(self):
        doc = read(ROOT / "automation/fixtures/empty-candidate.json")
        acq = {"run_id": doc["run_id"], "base_dataset_sha256": doc["base_dataset_sha256"]}
        self.assertEqual(validate_model(doc, "reinvestigation", acq, [], {"sources": [], "issues": []}), [])
        forged = copy.deepcopy(doc); forged["source_checks"] = [dict(self.source)]
        with self.assertRaises(Exception): validate_model(forged, "reinvestigation", acq, [], {"sources": [], "issues": []})

    def model_fixture(self):
        u = self.nav_decision(nav="13.6", date="06-Oct-2026")
        doc = read(ROOT / "automation/fixtures/empty-candidate.json")
        doc.update(task_type="fresh_scan", source_checks=[self.source])
        p = {"proposal_id": "fictional", "catalogue": "india", "record_id": u["unit"][4:], "fund_id": self.india["funds"][0]["id"],
             "security_id": None, "atomic_group": u["unit"], "field": "nav", "task_type": "fresh_scan", "issue_id": None,
             "previous_candidate": None, "previous_verified": u["previous_verified"], "previous_verified_snapshot": u["previous_snapshot_date"],
             "new_candidate": u["proposed_value"], "snapshot_date": u["snapshot_date"], "source_url": self.source["source_url"],
             "source_type": "official_nav_feed", "finding": "new_or_changed", "confidence": "high", "reason": "Fictional adversarial test.",
             "evidence": [{"source_url": self.source["source_url"], "source_sha256": u["source_sha256"], "retrieved_at": self.source["checked_at"],
                           "locator": u["locator"], "source_period": u["snapshot_date"], "excerpt": "Fictional mutation of retained bytes."}],
             "publish_recommendation": "candidate_for_validation"}
        doc["source_checks"][0] = dict(self.source, source_sha256=u["source_sha256"])
        doc["proposals"] = [p]
        return doc, u, {"sources": doc["source_checks"], "issues": []}

    def test_model_envelope_requires_exact_trusted_source_ledger(self):
        doc, unit, packet = self.model_fixture()
        envelope = dict(packet, run_id=doc["run_id"],
                        base_dataset_sha256=doc["base_dataset_sha256"],
                        started_at=doc["started_at"], completed_at=doc["completed_at"],
                        output_instructions="Return strict schema.")
        verify_candidate_envelope(doc, envelope, "fresh_scan", self.policy)
        missing = copy.deepcopy(doc)
        missing["source_checks"] = []
        with self.assertRaisesRegex(ValueError, "coverage"):
            verify_candidate_envelope(missing, envelope, "fresh_scan", self.policy)
        changed = copy.deepcopy(doc)
        changed["source_checks"][0]["source_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "trusted source-check"):
            verify_candidate_envelope(changed, envelope, "fresh_scan", self.policy)
        misleading = copy.deepcopy(doc)
        misleading["source_checks"][0]["reason"] = "Model claims this was freshly reviewed."
        with self.assertRaisesRegex(ValueError, "trusted source-check"):
            verify_candidate_envelope(misleading, envelope, "fresh_scan", self.policy)

    def test_incomplete_gemini_output_gets_one_bounded_corrective_retry(self):
        packet = {"output_instructions": "Copy the trusted source ledger."}
        calls = []
        def fix_on_retry(current, task, policy):
            calls.append(current)
            if len(calls) == 1:
                raise ModelContractError("Model source coverage incomplete")
            self.assertIn("CORRECTIVE RETRY", current["output_instructions"])
            self.assertIn("EVERY inputs.sources", current["output_instructions"])
            return {"repaired": True}, {"totalTokenCount": 8}
        output, usage, attempts = bounded_call(packet, "fresh_scan", self.policy,
                                               caller=fix_on_retry, wait=lambda _: None)
        self.assertEqual((output, usage, attempts),
                         ({"repaired": True}, {"totalTokenCount": 8}, 2))
        self.assertEqual(packet["output_instructions"], "Copy the trusted source ledger.")
        def always_invalid(current, task, policy):
            raise ModelContractError("Malformed model response")
        with self.assertRaises(ModelContractError) as failure:
            bounded_call(packet, "fresh_scan", self.policy,
                         caller=always_invalid, wait=lambda _: None)
        self.assertEqual(failure.exception.fundlenz_attempts, 2)

    def test_failed_collector_never_starts_publisher(self):
        workflow = (ROOT / ".github/workflows/catalogue-daily.yml").read_text()
        self.assertIn("    if: needs.collect.result == 'success'", workflow)
        self.assertNotIn("if: always() && needs.collect.result != 'cancelled'", workflow)
        self.assertNotIn("  push:\n    branches: [main]", workflow)
        self.assertIn("  schedule:\n", workflow)
        self.assertIn("  workflow_dispatch:\n", workflow)

    def test_model_false_positive_does_not_override_rule(self):
        doc, u, packet = self.model_fixture()
        doc["proposals"][0]["finding"] = "validator_false_positive"
        result = validate_model(doc, "fresh_scan", doc, [u], packet)
        self.assertEqual(result[0]["decision"], "rule_review")
        self.assertEqual(u["decision"], "blocked")

    def test_model_invented_hash_conflicting_value_and_protected_field(self):
        doc, u, packet = self.model_fixture()
        doc["proposals"][0]["evidence"][0]["source_sha256"] = "0" * 64
        with self.assertRaises(ValueError): validate_model(doc, "fresh_scan", doc, [u], packet)
        for change in [{"new_candidate": {"nav": 999, "navDate": "2026-10-06"}}, {"field": "app/globals.css"}]:
            doc, u, packet = self.model_fixture(); doc["proposals"][0].update(change)
            result = validate_model(doc, "fresh_scan", doc, [u], packet)
            self.assertEqual(result[0]["decision"], "rule_review")
            self.assertEqual(u["decision"], "blocked")

    def test_partial_update_retains_other_plans_and_complete_portfolios(self):
        code, raw = self.mutate_nav(nav="13.6", date="06-Oct-2026")
        s = dict(self.source, source_sha256=sha(raw))
        units = nav_candidates(self.nav_fixture, raw, s, self.policy)
        files = build_files(ROOT, units, {}, {s["source_id"]: raw}, {"completed_at": s["checked_at"]})
        self.assertEqual(set(files), {"public/data/catalog.json", "data/sources/automation/amfi-nav.txt"})
        updated = loads(files["public/data/catalog.json"])
        new_plans = {p["code"]: p for f in updated["funds"] for p in f["plans"]}
        for fund in self.india["funds"]:
            for p in fund["plans"]:
                if p["code"] == code:
                    self.assertEqual(new_plans[code]["nav"], 13.6)
                    self.assertEqual(new_plans[code]["navProvenance"]["sha256"], sha(raw))
                else:
                    self.assertEqual(new_plans[p["code"]], p)
        self.assertEqual(updated["retrievedAt"], self.india["retrievedAt"])

    def test_one_bounded_service_retry_and_no_quota_or_auth_retry(self):
        calls, waits = [], []
        def temporary(*args):
            calls.append(1)
            if len(calls) == 1: raise urllib.error.HTTPError("https://example.invalid", 503, "fixture", {}, None)
            return {}, {}
        _, _, attempts = bounded_call({}, "fresh_scan", self.policy, caller=temporary, wait=waits.append)
        self.assertEqual(attempts, 2)
        self.assertEqual(waits, [15])
        for status in [401, 403, 429, 503]:
            calls.clear(); waits.clear()
            def always_failed(*args):
                calls.append(1)
                raise urllib.error.HTTPError("https://example.invalid", status, "fixture", {}, None)
            with self.assertRaises(urllib.error.HTTPError): bounded_call({}, "fresh_scan", self.policy, caller=always_failed, wait=waits.append)
            self.assertEqual(len(calls), 2 if status == 503 else 1)

    def test_source_parser_issue_resolves_only_when_complete_scope_passes(self):
        broken = self.unit("1", "blocked"); broken["unit"] = "source:" + self.source["source_id"]
        state, _ = reconcile_issues(self.make_state(), self.acquisition(), [broken], [])
        unresolved, _ = reconcile_issues(state, self.acquisition(identifier="fictional-2"), [self.unit("1", "accepted"), self.unit("2", "blocked")], [])
        self.assertTrue(any(i["issue_id"] == issue_id(broken["unit"]) for i in unresolved["issues"]["issues"]))
        resolved, history = reconcile_issues(state, self.acquisition(identifier="fictional-3"), [self.unit("1", "unchanged")], [])
        self.assertFalse(resolved["issues"]["issues"])
        self.assertEqual(len(history), 1)

    def test_next_local_day_is_due_even_if_schedule_runs_earlier(self):
        source = next(s for s in self.registry if s["adapter"] == "amfi_nav")
        state = {source["id"]: {"last_attempt_at": "2026-10-07T09:30:00Z"}}
        selected, _, _ = due_sources([source], state, {"issues": []}, "2026-10-08T03:47:00Z", 64)
        self.assertEqual(selected, [source])

    def test_gemini_signature_metadata_is_not_candidate_data(self):
        body = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "{\"ok\":true}", "thoughtSignature": "opaque-fixture"}]}}]}
        self.assertEqual(loads(response_text(body)), {"ok": True})
        body["candidates"][0]["content"]["parts"].insert(0, {"thought": True, "text": "Non-final fixture text."})
        self.assertEqual(loads(response_text(body)), {"ok": True})
        body["candidates"][0]["finishReason"] = "MAX_TOKENS"
        with self.assertRaises(ValueError): response_text(body)
        body["candidates"][0].update(finishReason="STOP", content={"parts": [{"functionCall": {"name": "never_execute"}}]})
        with self.assertRaises(ValueError): response_text(body)

    def test_investigation_packet_covers_only_assigned_issue_sources(self):
        state = self.make_state()
        state["issues"]["issues"] = [{"issue_id": f"fixture-{i:02}", "source_url": self.source["source_url"],
            "record_id": "nav:" + str(i), "scope": "nav:" + str(i), "previous_candidate": None, "previous_verified": None} for i in range(9)]
        other = dict(self.source, source_id="unused", source_url="https://example.invalid/other", adapter="monitor")
        state["issues"]["issues"].append({"issue_id": "zz-unassigned", "source_url": other["source_url"],
            "record_id": None, "scope": "unassigned", "previous_candidate": None, "previous_verified": None})
        acq = dict(self.acquisition(), previous_state=state, base_dataset_sha256="0" * 64, started_at=self.source["checked_at"],
                   source_checks=[dict(self.source, adapter="amfi_nav"), other])
        packet = packets(acq, [], "reinvestigation", self.policy)
        self.assertEqual(len(packet["issues"]), 8)
        self.assertEqual([s["source_id"] for s in packet["sources"]], [self.source["source_id"]])
        state["investigation_after"] = "fixture-07"
        following = packets(acq, [], "reinvestigation", self.policy)
        self.assertEqual(following["issues"][0]["issue_id"], "fixture-08")

    def test_investigation_rotation_does_not_starve_later_sources(self):
        state = self.make_state()
        sources = [dict(self.source, source_id=f"source-{i:02}", adapter="monitor",
                        source_url=f"https://example.invalid/{i:02}") for i in range(20)]
        state["issues"]["issues"] = [{"issue_id": f"issue-{i:02}", "source_url": s["source_url"],
            "record_id": None, "scope": "monitor", "previous_candidate": None, "previous_verified": None}
            for i, s in enumerate(sources)]
        state["investigation_after"] = "issue-11"
        acq = dict(self.acquisition(), previous_state=state, base_dataset_sha256="0" * 64,
                   started_at=self.source["checked_at"], source_checks=sources)
        packet = packets(acq, [], "reinvestigation", self.policy)
        self.assertEqual([i["issue_id"] for i in packet["issues"]], [f"issue-{i:02}" for i in range(12, 20)])
        self.assertEqual({s["source_id"] for s in packet["sources"]}, {f"source-{i:02}" for i in range(12, 20)})


if __name__ == "__main__":
    unittest.main()
