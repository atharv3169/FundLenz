"""Restore the disclosed source snapshot by URL, accepting only matching SHA-256.
Uses the committed source manifest; it does not silently refresh changed files.
"""
from pathlib import Path
import argparse, concurrent.futures, hashlib, json, urllib.request
ROOT = Path(__file__).resolve().parents[2]

def restore(item, directory):
    if item.get('status') != 'downloaded':
        return item
    target = directory / 'downloads' / item['file']
    try:
        if target.exists():
            content = target.read_bytes()
        else:
            request = urllib.request.Request(item['url'], headers={'User-Agent': 'FundLensResearch/2.0'})
            with urllib.request.urlopen(request, timeout=40) as response:
                content = response.read(30_000_001)
        if len(content) > 30_000_000:
            raise ValueError('Source exceeds the 30 MB ingestion limit')
        if hashlib.sha256(content).hexdigest() != item['sha256']:
            raise ValueError('Source checksum differs from the recorded snapshot')
        target.write_bytes(content)
        return item
    except Exception as error:
        return {**item, 'status': 'unavailable', 'reason': str(error)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    (args.directory / 'downloads').mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'data/sources/portfolio-sources.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda item: restore(item, args.directory), manifest))
    (args.directory / 'download-manifest.json').write_text(json.dumps(results, indent=2))
    failures = [x for x in results if x.get('status') != 'downloaded']
    print(json.dumps({'sourceFiles': len(results), 'available': len(results) - len(failures), 'unavailable': failures}, indent=2))
