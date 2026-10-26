"""Recreate retained public source archives only when every original hash matches."""
import concurrent.futures
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import socket
import urllib.parse
import urllib.request
import zipfile

ROOT = Path.cwd()
TRANSFER = ROOT / '_catalogue-transfer'
recipe = json.loads((TRANSFER / 'source-recipe.json').read_text())
assert recipe['schema'] == 1 and len(recipe['sources']) == 85 and len(recipe['archives']) == 7
CACHE = TRANSFER / 'source-cache'
CACHE.mkdir(exist_ok=True)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def validate_url(url):
    p = urllib.parse.urlsplit(url)
    assert p.scheme == 'https' and p.hostname and p.port in (None, 443)
    assert not p.username and not p.password
    addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
    assert addresses and all(ipaddress.ip_address(a[4][0]).is_global for a in addresses)

class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def retrieve(source):
    assert re.fullmatch(r'[a-f0-9]{64}', source['sha256'])
    assert 0 < source['bytes'] <= 64 * 1024 * 1024
    target = CACHE / source['sha256']
    try:
        if target.exists() and digest(target.read_bytes()) == source['sha256']:
            return source['file'], 'verified'
        validate_url(source['url'])
        request = urllib.request.Request(source['url'], headers={
            'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'})
        opener = urllib.request.build_opener(PublicRedirect())
        with opener.open(request, timeout=30) as response:
            raw = response.read(source['bytes'] + 1)
        if len(raw) != source['bytes'] or digest(raw) != source['sha256']:
            return source['file'], 'source_bytes_changed_or_incomplete'
        target.write_bytes(raw)
        return source['file'], 'verified'
    except Exception as error:
        return source['file'], type(error).__name__

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = dict(pool.map(retrieve, recipe['sources']))
sources = {s['file']: s for s in recipe['sources']}
archives = []
for archive in recipe['archives']:
    assert re.fullmatch(r'september-2026-0[1-7]\.zip', archive['file'])
    assert archive['path'] == 'data/sources/india-disclosures/' + archive['file']
    if not all(results.get(name) == 'verified' for name in archive['members']):
        archives.append({'file': archive['file'], 'status': 'missing_original_source'})
        continue
    target = ROOT / archive['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.reconstructed')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in archive['members']:
            assert Path(name).name == name
            source = sources[name]
            raw = (CACHE / source['sha256']).read_bytes()
            assert len(raw) == source['bytes'] and digest(raw) == source['sha256']
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 30, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, raw)
    raw = temporary.read_bytes()
    git_sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    if len(raw) == archive['bytes'] and digest(raw) == archive['sha256'] and git_sha == archive['git_sha']:
        temporary.replace(target)
        archives.append({'file': archive['file'], 'status': 'verified', 'git_sha': git_sha})
    else:
        temporary.unlink()
        archives.append({'file': archive['file'], 'status': 'archive_encoding_differs'})
report = {'sources': results, 'archives': archives}
(TRANSFER / 'source-status.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'verified_sources': sum(s == 'verified' for s in results.values()),
                  'total_sources': len(results), 'archives': archives}))
