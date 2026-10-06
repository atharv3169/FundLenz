"""Build a compact, dated global index and lazy-loaded detail buckets.

US registry series are identified by SEC series ID. Contemporary Nasdaq ETF
listings are joined only through the exact current SEC ClassID/ticker mapping.
Issuer share classes use ISIN where available. No fund classification, currency,
price, domicile or manager is inferred from a ticker or a registrant address.
"""
from pathlib import Path
import argparse, json, hashlib, collections, datetime, math

ROOT=Path(__file__).resolve().parents[2]
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False))
def identity(key):return 'g-'+hashlib.sha256(key.encode()).hexdigest()[:16]
def unique(values):return sorted(set(v for v in values if v))
def listing(row):return {'ticker':row['ticker'],'name':row['name'],'exchange':row['exchange'],'date':row['sourceDate'],'sourceId':row['sourceId']}
def base(key,name,market,kind,provider=None,registrant=None):
 return dict(id=identity(key),name=name,market=market,kind=kind,provider=provider,registrant=registrant,tickers=[],isins=[],classCount=0,categories=[],currencies=[],listed=False,enriched=False,asOf=None,sourceIds=[],classes=[],listings=[])

def build(us,issuer,manifest):
 sources=[];details={};ticker_index=collections.defaultdict(list)
 labels={'nasdaq-listed':'Nasdaq-listed ETF symbol directory','nasdaq-other-listed':'Nasdaq other-exchange ETF symbol directory','sec-mutualfund-tickers':'SEC mutual-fund and ETF ticker mappings','sec-series-classes-june-2026':'SEC registered series and classes, June 2026'}
 for s in us['sources']:
  if not s.get('usedForRecords'):continue
  sources.append(dict(id=s['id'],label=labels[s['id']],url=s['url'],asOf=s.get('sourceDate'),retrievedAt=s['retrievedAt'],sha256=s['sha256'],note=s.get('sourceDateBasis','')))
 for s in us['series']:
  f=base('SEC:'+s['seriesId'],s['name'],'United States','Registered fund series',registrant=s['registrant']['name'])
  f.update(cik=s['registrant']['cik'],secSeriesId=s['seriesId'],filingUrl='https://www.sec.gov/edgar/browse/?CIK='+s['registrant']['cik'],asOf=s['sourceDate'])
  f['note']='SEC organization type 30 (open-end fund filer). The registered series can include ETF and other share classes. Registrant means the filing legal entity, not necessarily the investment manager. Current operation and availability are not established by the registry.'
  for c in s['classes']:
   current=[c['currentTicker']] if c.get('currentTicker') else []
   ids=[c['sourceId']]+([c['tickerSourceId']] if c.get('tickerSourceId') else [])
   row=dict(id=c['classId'],name=c['name'],tickers=current,directoryTicker=c.get('directoryTicker'),sourceIds=unique(ids))
   f['classes'].append(row)
   f['listings'].extend(listing(l) for l in c['etfListings'])
   for ticker in current:ticker_index[ticker].append((f,row))
  details[f['id']]=f
 for l in us['standaloneEtfs']:
  f=base('US-LISTING:'+l['ticker'],l['name'],'United States','ETF / ETP listing')
  f.update(asOf=l['sourceDate'],listings=[listing(l)],note='Non-test record explicitly marked ETF in the Nasdaq symbol directory. This label also covers some exchange-traded products and trusts. It could not be safely joined to a June SEC series using the current ticker mapping, so its identity is retained separately.')
  c=dict(id='US-LISTING:'+l['ticker'],name=l['name'],tickers=[l['ticker']],sourceIds=[l['sourceId']])
  f['classes']=[c];ticker_index[l['ticker']].append((f,c));details[f['id']]=f
 issuer_source_ids=set()
 for s in manifest['sources']:
  issuer_source_ids.add(s['id'])
  sources.append(dict(id=s['id'],label=s['label'],url=s['url'],asOf=s.get('asOf'),retrievedAt=s['retrievedAt'],sha256=s['sha256'],note=s.get('notes','')))
 source_map={s['id']:s for s in sources}
 seen_issuer=set();issuer_merges=0
 for r in issuer:
  key='ISIN:'+r['isin'] if r.get('isin') else r['sourceId']+':'+r['sourceRecordId']
  if key in seen_issuer:raise ValueError('Duplicate issuer identity: '+key)
  seen_issuer.add(key)
  matches=ticker_index.get(r.get('ticker'),[]) if r['market']=='United States' else []
  if len(matches)==1:
   f,c=matches[0];issuer_merges+=1
  else:
   f=base(key,r['name'],r['market'],'Issuer share class',provider=r['provider'])
   c=dict(id=r.get('isin') or r.get('apir') or key,name=r['name'],tickers=[r['ticker']] if r.get('ticker') else [],sourceIds=[])
   f['classes']=[c];details[f['id']]=f
   f['note']='An issuer share-class record. Classes with the same fund name may have different currencies, fees or income treatment. The source market identifies the product directory, not investment exposure or investor eligibility. Product names and classifications follow the issuer.'
  f['provider']=r['provider'];f['enriched']=True
  f['asOf']=f['asOf'] or r.get('navDate')
  c['sourceIds']=unique(c['sourceIds']+[r['sourceId']])
  c['productType']=r.get('productType');c['shareClassLabel']=r.get('shareClass');c['apir']=r.get('apir')
  for field in ['isin','currency','domicile','nav','navDate','aum','aumCurrency','aumDate','feePct','feeLabel','distribution','inceptionDate','url','factsheet','assetClass']:
   if r.get(field) is not None:c[field]=r[field]
  # Fee dates are generally not provided independently; retain the observation
  # date without presenting it as an effective date.
  if c.get('feePct') is not None:c['feeObservedAt']=source_map[r['sourceId']]['retrievedAt'][:10]
 index=[]
 for f in details.values():
  f['tickers']=unique(t for c in f['classes'] for t in c['tickers'])
  f['isins']=unique(c.get('isin') for c in f['classes'])
  f['classCount']=len(f['classes']);f['listed']=bool(f['listings'])
  f['categories']=unique(c.get('assetClass') for c in f['classes'])
  f['currencies']=unique(c.get('currency') for c in f['classes'])
  f['productTypes']=unique(c.get('productType') for c in f['classes'])
  if len(f['classes'])==1:
   c=f['classes'][0];f['shareClassLabel']=' · '.join(unique([c.get('shareClassLabel'),c.get('distribution'),c.get('currency')])) or None
  f['sourceIds']=unique([sid for c in f['classes'] for sid in c['sourceIds']]+[l['sourceId'] for l in f['listings']])
  assert all(s in source_map for s in f['sourceIds'])
  for c in f['classes']:
   for field in ['nav','aum','feePct']:
    if c.get(field) is not None:assert math.isfinite(c[field]) and c[field]>=0
   if c.get('nav') is not None:assert c.get('currency') and c.get('navDate')
   if c.get('aum') is not None:assert c.get('aumCurrency') and c.get('aumDate')
  index.append({k:v for k,v in f.items() if k not in ('classes','listings','cik','secSeriesId','filingUrl','note')})
 index.sort(key=lambda f:f['name'].lower())
 stats=dict(records=len(index),registeredSeries=len(us['series']),shareClasses=sum(len(s['classes']) for s in us['series']),etfListings=sum(len(f['listings']) for f in details.values()),standaloneEtfs=len(us['standaloneEtfs']),issuerClasses=len(issuer),issuerRecordsMergedIntoUS=issuer_merges,markets=len(set(f['market'] for f in index)))
 caveats=[
  'The US registry covers SEC organization type 30, dated 1 June 2026. It may include dormant and not-yet-launched series. Insurance separate accounts are excluded, and closed-end funds and private funds are not comprehensively covered.',
  'US ETF coverage includes every non-test ETF-flagged record in the two downloaded Nasdaq symbol directories. Some are exchange-traded trusts or products. Listing evidence is dated separately from registry and ticker-mapping data.',
  'Exact contemporary SEC class identifiers and ticker mappings connect listings to registered series. Unresolved listings stay separate. Historical registry symbols are retained in the detail view, but are not presented as current ticker mappings.',
  'Issuer records represent share classes, not a count of distinct underlying portfolios. Coverage outside the United States is partial. The Europe directory includes UCITS funds and some non-UCITS exchange-traded products.',
  'Fund name themes are text searches, not verified portfolio classifications. Financial details appear only when explicitly supplied; NAVs retain their dates and currencies. Undated or currency-ambiguous net-asset values are omitted.',
  'International holdings are not integrated into the INR portfolio lab. There is no automatic refresh, live price feed, currency conversion, performance ranking or investor-eligibility determination.'
 ]
 result=dict(schemaVersion=1,builtAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),stats=stats,sources=sources,caveats=caveats,funds=index)
 out=ROOT/'public/data/global';write(out/'catalog.json',result)
 buckets=collections.defaultdict(dict)
 for fid,f in details.items():buckets[fid[2:4]][fid]=f
 (out/'details').mkdir(parents=True,exist_ok=True)
 for old in (out/'details').glob('*.json'):old.unlink()
 for key,values in buckets.items():write(out/'details'/(key+'.json'),values)
 coverage={k:v for k,v in result.items() if k!='funds'}
 coverage['recordsBySourceMarket']=dict(collections.Counter(f['market'] for f in index))
 coverage['recordsByKind']=dict(collections.Counter(f['kind'] for f in index))
 coverage['issuerProductTypes']=dict(collections.Counter(r.get('productType','Unknown') for r in issuer))
 write(out/'coverage.json',coverage);write(ROOT/'data/sources/global/coverage.json',coverage)
 print(json.dumps({'stats':stats,'indexBytes':(out/'catalog.json').stat().st_size,'detailBytes':sum(p.stat().st_size for p in (out/'details').glob('*.json'))},indent=2))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--us',type=Path,required=True);p.add_argument('--issuer',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True);args=p.parse_args()
 build(json.loads(args.us.read_text()),json.loads(args.issuer.read_text()),json.loads(args.manifest.read_text()))
