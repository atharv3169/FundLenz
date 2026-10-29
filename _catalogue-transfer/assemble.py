"""Restore the exact reviewed candidate from checksum-verified small packets."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path.cwd()
TRANSFER = ROOT / '_catalogue-transfer'
EXPECTED_COMMIT = 'b3c2b0c8a47e85882772b1e0431ba4e2834f5ecd'
EXPECTED_TREE = 'a66d0d7da7082189c7ebc5dadf2c5b16cc3f8220'
DESTINATION = 'refs/heads/catalogue-expansion-assembled-20261027'
ready = json.loads((TRANSFER / 'ready.json').read_text())
assert ready['schema'] == 1 and ready['source_commit'] == EXPECTED_COMMIT
assert ready['source_tree'] == EXPECTED_TREE
work = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'fundlenz-packet-assembly'
work.mkdir(exist_ok=True)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def reconstruct(stream):
    description = ready['streams'][stream]
    assert 0 < description['count'] <= 2000 and 0 < description['bytes'] <= 128 * 1024 * 1024
    parts = sorted((TRANSFER / (stream + '-parts')).glob('*.part'))
    assert len(parts) == description['count'], (stream, 'packet count')
    target = work / stream
    total = 0
    hasher = hashlib.sha256()
    with target.open('wb') as output:
        for index, part in enumerate(parts):
            match = re.fullmatch(r'(\d{5})-([a-f0-9]{64})\.part', part.name)
            assert match and int(match[1]) == index
            raw = part.read_bytes()
            assert 0 < len(raw) <= 49152 and digest(raw) == match[2], part.name
            output.write(raw)
            hasher.update(raw)
            total += len(raw)
    assert total == description['bytes'] and hasher.hexdigest() == description['sha256'], stream
    return target

source_archive = reconstruct('sources')
recipe = json.loads((TRANSFER / 'source-recipe.json').read_text())
sources = {s['sha256']: s for s in recipe['sources']}
cache = TRANSFER / 'source-cache'
cache.mkdir(exist_ok=True)
with zipfile.ZipFile(source_archive) as z:
    assert len(z.namelist()) == len(set(z.namelist())) == 13
    for info in z.infolist():
        assert info.filename in sources
        expected = sources[info.filename]
        assert info.file_size == expected['bytes'] <= 64 * 1024 * 1024
        raw = z.read(info)
        assert digest(raw) == info.filename
        (cache / info.filename).write_bytes(raw)

# This reuses already-verified cached bytes. No changed remote source can pass.
subprocess.run(['python3', str(TRANSFER / 'restore_sources.py')], check=True)
report = json.loads((TRANSFER / 'source-status.json').read_text())
assert len(report['archives']) == 7 and all(a['status'] == 'verified' for a in report['archives'])
for archive in recipe['archives']:
    assert archive['path'] == 'data/sources/india-disclosures/' + archive['file']
    actual = subprocess.check_output(['git', 'hash-object', '-w', '--', archive['path']]).decode().strip()
    assert actual == archive['git_sha']

pack = reconstruct('release')
with pack.open('rb') as source:
    subprocess.run(['git', 'index-pack', '--stdin', '--strict'], stdin=source, check=True)
tree = subprocess.check_output(['git', 'rev-parse', EXPECTED_COMMIT + '^{tree}']).decode().strip()
assert tree == EXPECTED_TREE
subprocess.run(['git', 'fsck', '--full', '--no-dangling'], check=True)
existing = subprocess.check_output(['git', 'ls-remote', 'origin', DESTINATION]).decode().strip()
if existing:
    assert existing.split()[0] == EXPECTED_COMMIT, 'Destination branch changed; refusing overwrite'
else:
    subprocess.run(['git', 'push', 'origin', EXPECTED_COMMIT + ':' + DESTINATION], check=True)
remote = subprocess.check_output(['git', 'ls-remote', 'origin', DESTINATION]).decode().split()[0]
assert remote == EXPECTED_COMMIT
result = {'status': 'verified', 'commit': EXPECTED_COMMIT, 'tree': EXPECTED_TREE,
          'branch': DESTINATION, 'archives_verified': 7,
          'packet_count': sum(s['count'] for s in ready['streams'].values())}
print(json.dumps(result))
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write('### Exact catalogue transfer verified\n\n' + json.dumps(result, indent=2) + '\n')
