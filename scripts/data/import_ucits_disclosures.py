"""Admit complete Irish issuer CSVs at exact, already reviewed share-class IDs.

Retain original bytes and validation outcomes; do not enable rejected portfolios.
Re-running this importer never removes a previously verified portfolio.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import shutil
from ucits_holdings import parse_ucits
from build_global_holdings import write

ROOT = Path(__file__).resolve().parents[2]


def import_disclosures(directory, root=ROOT):
    base = root / 'data/sources/global/holdings'; out = root / 'public/data/global'
    catalog = {f['id']: f for f in json.loads((out / 'catalog.json').read_text())['funds']}
    by_isin = collections.defaultdict(list)
    for f in catalog.values():
        for isin in f['isins']: by_isin[isin].append(f)
    downloads = json.loads((base / 'downloads.json').read_text())
    index = json.loads((out / 'holdings-index.json').read_text())
    coverage = json.loads((out / 'holdings-coverage.json').read_text())
    identities = {}
    for fid in index['portfolios']:
        for h in json.loads((out / 'holdings' / (fid+'.json')).read_text())['holdings']:
            if h['type'] == 'equity': identities[h['id']] = (h['name'], h['sector'])
    audit = []; added = 0
    for source in json.loads((directory / 'ucits-downloads.json').read_text()):
        d = dict(source)
        try:
            if d['status'] != 'downloaded': raise ValueError(d.get('reason', 'Unavailable source'))
            matches = [f for f in by_isin[d['isin']] if f['provider'] == 'iShares' and 'Ireland' in f.get('domiciles', [])]
            if len(matches) != 1: raise ValueError('No unique reviewed Irish issuer ISIN')
            fund = matches[0]
            detail = json.loads((out / 'details' / (fund['id'][2:4]+'.json')).read_text())[fund['id']]
            if not any(c.get('isin') == d['isin'] and c.get('url') == d['sourcePage'] for c in detail['classes']):
                raise ValueError('Product URL differs from the reviewed ISIN source')
            if d['finalUrl'] != d['url']: raise ValueError('Unreviewed redirect')
            d.update(id=fund['id'], filename='UCITS_'+d['productId']+'.csv', format='ishares_ucits_csv', market=fund['market'])
            if d.get('ticker') in {'', '-', None}: d['ticker'] = d['isin']
            raw = (directory / 'ucits' / d['file']).read_bytes()
            portfolio, summary, report = parse_ucits(raw, d, catalog)
            for h in portfolio['holdings']:
                if h['type'] == 'equity' and h['id'] in identities and identities[h['id']] != (h['name'], h['sector']):
                    raise ValueError('Cross-fund classification conflict')
            old = index['portfolios'].get(d['id'])
            if old and old['date'] >= portfolio['date']:
                audit.append(dict(productId=d['productId'], id=d['id'], status='retained', reason='Already verified same or newer snapshot')); continue
            identities.update({h['id']: (h['name'], h['sector']) for h in portfolio['holdings'] if h['type']=='equity'})
            shutil.copyfile(directory / 'ucits' / d['file'], base / d['filename'])
            write(out / 'holdings' / (d['id']+'.json'), portfolio)
            downloads = [x for x in downloads if x['id'] != d['id']] + [d]
            index['portfolios'][d['id']] = summary
            coverage['accepted'] = [x for x in coverage['accepted'] if x['id'] != d['id']] + [report]
            audit.append(dict(productId=d['productId'], status='accepted', **report)); added += 1
        except (AssertionError, ValueError, KeyError, StopIteration, ArithmeticError) as error:
            audit.append(dict(productId=d['productId'], isin=d['isin'], source=d['url'], status='rejected', reason=str(error) or 'Unsupported complete-file format'))
    recovered=[r for r in coverage['rejected'] if r['id'] in index['portfolios']]
    coverage['resolvedRejections']=coverage.get('resolvedRejections',[])+recovered
    coverage['rejected']=[r for r in coverage['rejected'] if r['id'] not in index['portfolios']]
    index['checkedAt'] = max(d['checkedAt'] for d in downloads if d['status']=='downloaded')
    coverage['checkedAt'] = index['checkedAt']
    index['note'] = 'US and Irish-domiciled issuer holdings. Enter your holding values in USD. Source dates vary; no prices, dealing status or currency conversion are inferred.'
    write(base / 'downloads.json', downloads); write(out / 'holdings-index.json', index); write(out / 'holdings-coverage.json', coverage)
    write(base / 'ucits-import-report.json', dict(added=added, total=len(index['portfolios']), outcomes=audit))
    print(json.dumps(dict(added=added, total=len(index['portfolios']), outcomes=dict(collections.Counter(a['status'] for a in audit)), reasons=dict(collections.Counter(a.get('reason') for a in audit if a['status']=='rejected'))), indent=2))


if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('directory', type=Path); import_disclosures(p.parse_args().directory)
