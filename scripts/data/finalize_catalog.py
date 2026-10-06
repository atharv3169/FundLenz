"""Publish a compact source/coverage ledger and remove obsolete aggregate assets."""
from pathlib import Path
import json,collections
from build_catalog import source_url
ROOT=Path(__file__).resolve().parents[2]
c=json.loads((ROOT/'public/data/catalog.json').read_text())
for f in c['funds']:f['links']={k:source_url(v) for k,v in f['links'].items()}
for h in c['houses']:
 for k in ('website','portfolio','factsheet'):h[k]=source_url(h[k])
(ROOT/'public/data/catalog.json').write_text(json.dumps(c,ensure_ascii=False,separators=(',',':')))
sources=json.loads((ROOT/'data/sources/portfolio-sources.json').read_text())
audit=json.loads((ROOT/'data/sources/portfolio-audit.json').read_text())
coverage={'schemaVersion':1,'navSource':c['source'],'navSourceSha256':c['sourceSha256'],'retrievedAt':c['retrievedAt'],'stats':c['stats'],
 'scope':'Complete downloaded AMFI NAV feed, including older records. Fund groups use reported scheme names, not a registry of active products. Holdings coverage is a separately verified subset.',
 'holdingsAcceptance':'Official dated table; explicit units and net assets; classified leaf values reconcile within 0.10 percentage points; unique AMC and scheme-name match or documented abbreviation alias.',
 'unavailableFields':['historical NAV returns','expense ratio','exit load','fund manager','riskometer classification','derivative delta exposure'],
 'fundHouses':[{**h,'fundRecords':sum(f['amcId']==h['id'] for f in c['funds']),'holdingsAvailable':sum(f['amcId']==h['id'] and bool(f['portfolioId']) for f in c['funds'])} for h in c['houses']],
 'sourceFiles':sources,'sheetAudit':audit}
(ROOT/'public/data/coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,separators=(',',':')))
(ROOT/'public/data/portfolios.json').unlink(missing_ok=True)
print(json.dumps(c['stats'],indent=2))
