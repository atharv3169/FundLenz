#!/usr/bin/env python3
"""Offline transfer-integrity check. Does not validate new source candidates."""
import collections
import datetime
import hashlib
import json
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
    manifest = read_json(ROOT / "automation/baseline-manifest.json")
    # Keep the original import manifest immutable. This explicit, reviewed
    # release authorizes only the listed feature changes and added snapshots.
    manual = read_json(ROOT / "automation/manual-releases/global-portfolio-lab.json")
    original = {item["path"]: item for item in manifest["files"]}
    combined = dict(original)
    release_paths = set()
    for item in manual["files"]:
        relative = item["path"]
        assert relative not in release_paths, f"Duplicate manual release path: {relative}"
        release_paths.add(relative)
        assert item["previous_sha256"] == original.get(relative, {}).get("sha256"), relative
        combined[relative] = item
    counts = collections.Counter()
    metadata_import = 'import { catalogueSourceCheckLabel } from "@/lib/site-metadata";\n'
    changed_components = {"components/global-catalog.tsx", "components/fund-catalog.tsx"}
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
        if relative in changed_components:
            text = raw.decode()
            assert text.count(metadata_import) == 1
            assert text.count("Sources checked {catalogueSourceCheckLabel}.") == 1
            # Reverse only the migration's date-label extraction. All other
            # bytes must match the original or explicitly reviewed Site release.
            raw = text.replace(metadata_import, "", 1).replace(
                "Sources checked {catalogueSourceCheckLabel}.",
                "Sources checked 5 October 2026.", 1).encode()
        assert len(raw) == item["bytes"], f"Length changed: {relative}"
        digest = hashlib.sha256(raw).hexdigest()
        assert digest == item["sha256"], f"Content changed: {relative}"
        counts[item["scope"]] += 1
        if item["scope"] == "production_data":
            hashes.append((relative, digest))
    for tree in ["public/data", "automation", "audit"]:
        for path in (ROOT / tree).rglob("*.json"):
            read_json(path)
    release = read_json(ROOT / "audit/release-state.json")
    assert release["source_commit"] == manual["source_commit"]
    assert release["source_site_version"] == manual["source_site_version"]
    digest = hashlib.sha256("".join(p + "\0" + h + "\n" for p, h in sorted(hashes)).encode()).hexdigest()
    assert digest == release["dataset_sha256"]
    policy = read_json(ROOT / "automation/policy.json")
    assert policy["automation_enabled"] is False and policy["publication_enabled"] is False
    assert policy["gemini_repository_write_access"] is False
    assert policy["gemini_tasks"] == ["fresh_scan", "reinvestigation"]
    metadata = read_json(ROOT / "public/data/site-metadata.json")
    date = datetime.date.fromisoformat(metadata["catalogueSourceCheckDate"])
    freshness = read_json(ROOT / "public/data/freshness.json")
    assert date.isoformat() == freshness["completedAt"][:10]
    assert date.isoformat() == "2026-10-05", "Bootstrap must retain the original checked date."
    binding = read_json(ROOT / ".openai/hosting.json")
    assert binding == {"d1": None, "r2": None}, "Export must not retain a live Site binding."
    queue = read_json(ROOT / "audit/open-issues.json")
    ids = [i["issue_id"] for i in queue["issues"]]
    assert len(ids) == len(set(ids)) == 4
    original = {x["url"] for x in freshness["holdingsPeriodChecks"] if x["status"] == "inconclusive"}
    assert {x["source_url"] for x in queue["issues"]} == original
    india = read_json(ROOT / "public/data/catalog.json")
    global_data = read_json(ROOT / "public/data/global/catalog.json")
    securities = read_json(ROOT / "public/data/securities/catalog.json")
    return {"status": "passed", "scope": "original migration plus reviewed manual release; not an automatic source validator",
            "release_files_verified": sum(counts.values()), "files_by_scope": dict(counts),
            "manual_release_files": len(release_paths),
            "dataset_sha256": digest, "metadata_extractions": sorted(changed_components),
            "india_funds": len(india["funds"]), "india_plans": sum(len(f["plans"]) for f in india["funds"]),
            "global_records": len(global_data["funds"]), "security_records": len(securities["records"]),
            "persistent_issues": len(ids)}


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
