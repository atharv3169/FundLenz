"""Offline replay of every newly published Indian statement and Irish CSV."""
import hashlib
import argparse
import json
from pathlib import Path
import shutil
import tempfile
import zipfile
from import_india_disclosures import import_disclosures
from ucits_holdings import parse_ucits

ROOT = Path(__file__).resolve().parents[2]
def read(p):return json.loads(p.read_text())
def digest(raw):return hashlib.sha256(raw).hexdigest()

def verify(report_path=None):
    from parse_portfolios import confirms_date
    assert confirms_date('Monthly Portfolio as on September 30,2026', '2026-09-30')
    assert confirms_date('Portfolio for September 2026', '2026-09-30')
    assert not confirms_date('Portfolio as on August 31,2026', '2026-09-30')
    assert not confirms_date('Portfolio as on September 29,2026', '2026-09-29')
    base=ROOT/'data/sources/india-disclosures' 
    manifest=read(base/'download-manifest.json'); hashes={s['sha256'] for s in manifest}
    expected={p.stem:read(p) for p in (ROOT/'public/data/holdings').glob('*.json') if read(p)['sourceSha256'] in hashes}
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp);directory=root/'input';(directory/'downloads').mkdir(parents=True)
        for arc in read(base/'archives.json'):
            raw=(base/arc['file']).read_bytes();assert digest(raw)==arc['sha256']
            with zipfile.ZipFile(base/arc['file']) as z:
                for name in z.namelist():
                    assert Path(name).name==name
                    (directory/'downloads'/name).write_bytes(z.read(name))
        shutil.copyfile(base/'download-manifest.json',directory/'download-manifest.json')
        for s in manifest:assert digest((directory/'downloads'/s['file']).read_bytes())==s['sha256']
        (root/'data/sources').mkdir(parents=True);shutil.copyfile(ROOT/'data/sources/fund-aliases.json',root/'data/sources/fund-aliases.json')
        (root/'public/data/holdings').mkdir(parents=True)
        catalog=read(ROOT/'public/data/catalog.json')
        for f in catalog['funds']:
            if f['id'] in expected:f['portfolioId']=None;f.pop('portfolioSummary',None)
            elif f['portfolioId']:shutil.copyfile(ROOT/'public/data/holdings'/(f['id']+'.json'),root/'public/data/holdings'/(f['id']+'.json'))
        (root/'public/data/catalog.json').write_text(json.dumps(catalog))
        import_disclosures(directory,root)
        for fid,old in expected.items():
            new=read(root/'public/data/holdings'/(fid+'.json'))
            for key in ['date','sourceSha256','aumINR','equityPct','cashPct','otherPct','reconciliationDifferencePct']:
                assert new[key]==old[key],(fid,key)
            keys=['id','type','weight','marketValueINR','quantity','sourceRow','originalName','reportedWeight']
            assert len(new['holdings'])==len(old['holdings']),fid
            for left,right in zip(new['holdings'],old['holdings']):
                for key in keys:assert left[key]==right[key],(fid,key,left[key],right[key])
        report=read(root/'data/sources/india-disclosures/import-report.json')
    catalogue={f['id']:f for f in read(ROOT/'public/data/global/catalog.json')['funds']};count=0
    for d in read(ROOT/'data/sources/global/holdings/downloads.json'):
        if d.get('format')!='ishares_ucits_csv':continue
        raw=(ROOT/'data/sources/global/holdings'/d['filename']).read_bytes()
        p,_,_=parse_ucits(raw,d,catalogue)
        assert p==read(ROOT/'public/data/global/holdings'/(d['id']+'.json')),d['id'];count+=1
    if report_path:
        report['replayVerified']=True
        report_path.write_text(json.dumps(report,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps(dict(indianStatementsReplayed=len(expected),irishPortfoliosReplayed=count,status='passed')))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--report',type=Path)
    verify(parser.parse_args().report)
