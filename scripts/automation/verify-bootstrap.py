#!/usr/bin/env python3
"""Offline transfer-integrity check. Does not validate new source candidates."""
import collections
import datetime
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    def reject_constant(value):
        raise ValueError(f"Non-finite JSON constant: {value}")
    return json.loads(path.read_text(), object_pairs_hook=strict_object,
                      parse_constant=reject_constant)


def verify():
    sys.path.insert(0, str(ROOT / "scripts/automation"))
    from adapters import allowed_paths
    from common import dataset_hash
    mutable = allowed_paths(ROOT)
    manifest = read_json(ROOT / "automation/baseline-manifest.json")
    combined = {item["path"]: item for item in manifest["files"]}
    assert len(combined) == len(manifest["files"]), "Duplicate manifest paths"
    counts = collections.Counter()
    hashes = []
    seen = set()
    for item in combined.values():
        relative = item["path"]
        assert relative not in seen, f"Duplicate manifest entry: {relative}"
        seen.add(relative)
        path = ROOT / relative
        assert not path.is_symlink() and path.is_file(), f"Missing/unsafe file: {relative}"
        assert path.resolve().is_relative_to(ROOT), f"Escaping path: {relative}"
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if relative not in mutable:
            assert len(raw) == item["bytes"], f"Length changed: {relative}"
            assert digest == item["sha256"], f"Content changed: {relative}"
        counts[item["scope"]] += 1
        if item["scope"] == "production_data":
            hashes.append((relative, digest))
    for tree in ["public/data", "automation", "audit"]:
        for path in (ROOT / tree).rglob("*.json"):
            read_json(path)
    release = read_json(ROOT / "audit/release-state.json")
    assert release["source_commit"] == manifest["source_commit"]
    assert release["source_site_version"] == manifest["source_site_version"]
    digest = hashlib.sha256("".join(p + "\0" + h + "\n" for p, h in sorted(hashes)).encode()).hexdigest()
    if digest != release["dataset_sha256"]:
        deployed = read_json(ROOT / "public/automation-audit/release.json")
        assert dataset_hash(ROOT) == deployed["dataset_sha256"], "Unidentified production dataset"
    policy = read_json(ROOT / "automation/policy.json")
    runtime = read_json(ROOT / "automation/runtime.json")
    assert policy["publication_enabled"] == runtime["publication_enabled"]
    assert policy["gemini_repository_write_access"] is False
    assert policy["gemini_tasks"] == ["fresh_scan", "reinvestigation"]
    metadata = read_json(ROOT / "public/data/site-metadata.json")
    date = datetime.date.fromisoformat(metadata["catalogueSourceCheckDate"])
    freshness = read_json(ROOT / "public/data/freshness.json")
    assert date.isoformat() == freshness["completedAt"][:10]
    assert date.isoformat() == "2026-10-05", "Bootstrap must retain the original checked date."
    queue = read_json(ROOT / "audit/open-issues.json")
    ids = [i["issue_id"] for i in queue["issues"]]
    assert len(ids) == len(set(ids))
    original = {x["url"] for x in freshness["holdingsPeriodChecks"] if x["status"] == "inconclusive"}
    if not (ROOT / "audit/automation-state.json").exists():
        assert len(ids) == 4 and {x["source_url"] for x in queue["issues"]} == original
    india = read_json(ROOT / "public/data/catalog.json")
    global_data = read_json(ROOT / "public/data/global/catalog.json")
    securities = read_json(ROOT / "public/data/securities/catalog.json")
    return {"status": "passed", "scope": "immutable reviewed files plus dataset identity; automatic changes additionally require source replay and data gate",
            "release_files_verified": sum(counts.values()), "files_by_scope": dict(counts),
            "dataset_sha256": digest,
            "india_funds": len(india["funds"]), "india_plans": sum(len(f["plans"]) for f in india["funds"]),
            "global_records": len(global_data["funds"]), "security_records": len(securities["records"]),
            "persistent_issues": len(ids)}


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
