"""Fetch the explicit official-source inventory; never overwrite a failed snapshot.

Run manually before build_global_holdings.py. No credentials or model are used.
"""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/sources/global/holdings"

def fetch(spec):
    result = dict(spec, checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    try:
        with urllib.request.urlopen(spec["url"], timeout=40) as response:
            raw = response.read(12_000_001)
            if len(raw) > 12_000_000:
                raise ValueError("Source exceeds the 12 MB download bound")
            if b"Weight (%)" not in raw or b"Asset Class" not in raw or b"<html" in raw[:500].lower():
                raise ValueError("Response is not a full holdings CSV")
            result.update(status="downloaded", bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
            (BASE / spec["filename"]).write_bytes(raw)
    except Exception as error:
        result.update(status="unavailable", reason=str(error))
    return result

if __name__ == "__main__":
    specs = json.loads((BASE / "sources.json").read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(fetch, specs))
    (BASE / "downloads.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps({"downloaded": sum(r["status"] == "downloaded" for r in results),
                      "unavailable": [{"ticker": r["ticker"], "reason": r.get("reason")} for r in results if r["status"] != "downloaded"]}))
