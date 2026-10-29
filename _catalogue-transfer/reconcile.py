import json,subprocess,sys,hashlib
from pathlib import Path
sys.path.insert(0,'scripts/automation')
from common import encoded,dataset_hash
root=Path.cwd()
def get(ref,p):return json.loads(subprocess.check_output(['git','show',ref+':'+p]))
def put(p,d):Path(p).write_bytes(encoded(d))
conflicts=subprocess.check_output(['git','diff','--name-only','--diff-filter=U']).decode().splitlines()
for p in conflicts:put(p,get('HEAD',p))
p='public/data/catalog.json';d=get('HEAD',p);latest=get('github/main',p);plans={x['code']:x for f in latest['funds'] for x in f['plans']}
count=0
for f in d['funds']:
 for x in f['plans']:
  if x['code'] in plans:
   y=plans[x['code']];assert x['isin']==y['isin'];x.update({k:y[k] for k in ['nav','navDate','navProvenance'] if k in y});count+=1
 f['navDate']=max((x['navDate'] for x in f['plans'] if x['navDate']),default=None)
assert count==len(plans)
latestdate=max(f['navDate'] or '' for f in d['funds']);d['stats'].update(latestNavDate=latestdate,plansAtLatestDate=sum(x['navDate']==latestdate for f in d['funds'] for x in f['plans']));put(p,d)
for p,key in [('data/sources/global/holdings/downloads.json',None),('public/data/global/holdings-coverage.json','accepted')]:
 d=get('HEAD',p);n=get('github/main',p);new={x['id']:x for x in (n[key] if key else n) if x['id'] in get('github/main','public/data/global/holdings-index.json')['portfolios']}
 if key:d[key]=[new.get(x['id'],x) for x in d[key]];d['checkedAt']=n['checkedAt']
 else:d=[new.get(x['id'],x) for x in d]
 put(p,d)
p='public/data/global/holdings-index.json';d=get('HEAD',p);n=get('github/main',p);d['portfolios'].update(n['portfolios']);d['checkedAt']=n['checkedAt'];put(p,d)
base=subprocess.check_output(['git','rev-parse','github/main']).decode().strip();run='manual-catalogue-expansion-2026-10-29'
p='public/data/site-metadata.json';d=get('HEAD',p);d.update(lastCatalogueUpdateDate='2026-10-29',lastCatalogueUpdateRunId=run);put(p,d)
h=dataset_hash(root)
p='public/automation-audit/release.json';d=get('HEAD',p);d.update(base_commit=base,dataset_sha256=h,lastCatalogueUpdateDate='2026-10-29',run_id=run);put(p,d)
p='public/build-info.json';d=get('HEAD',p);d.update(datasetSha256=h,lastCatalogueUpdateDate='2026-10-29',release=run);put(p,d)
doc=Path('docs/catalogue-expansion-2026-10.md');text=doc.read_text().replace('24 October through PR #60','29 October through PR #65');doc.write_text(text)
p='automation/manual-releases/catalogue-expansion-2026-10.json';d=get('HEAD',p);d.update(base_commit=base,dataset_sha256=h);d['coverage']['india']=json.loads(Path('public/data/catalog.json').read_text())['stats']
for item in d['files']:
 b=Path(item['path']).read_bytes();item.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
put(p,d)
manifest_path=Path('automation/baseline-manifest.json');manifest=json.loads(manifest_path.read_text())
for item in manifest['files']:
 if item['path'] in [p,'docs/catalogue-expansion-2026-10.md']:
  b=Path(item['path']).read_bytes();item.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
manifest_path.write_bytes(encoded(manifest))
subprocess.run(['git','add',*conflicts,p,str(manifest_path),'docs/catalogue-expansion-2026-10.md'],check=True)
print({'preserved_latest_plans':count,'global_portfolios':len(n['portfolios']),'dataset':h,'base':base})
