import csv, json, hashlib, collections, pathlib, datetime
from decimal import Decimal
BASE=pathlib.Path(__file__).parent
SPECS=[('IVV','239726','ishares-core-sp-500-etf','US large-cap blend ETF'),('IWB','239707','ishares-russell-1000-etf','US large- and mid-cap blend ETF'),('IWF','239706','ishares-russell-1000-growth-etf','US large- and mid-cap growth ETF')]
funds=[]; reports=[]; identities=collections.defaultdict(set)
for ticker,pid,slug,category in SPECS:
 rawpath=BASE/f'{ticker}-holdings.csv'; raw=rawpath.read_bytes(); sha=hashlib.sha256(raw).hexdigest(); s=raw.decode('utf-8-sig')
 pre=list(csv.reader(s[:s.index('Ticker,Name')].splitlines())); assert pre[1][0]=='Fund Holdings as of'
 date=datetime.datetime.strptime(pre[1][1],'%b %d, %Y').date().isoformat()
 reader=csv.DictReader(s[s.index('Ticker,Name'):].splitlines())
 rows=[r for r in reader if r.get('Asset Class')]
 assert len({r['Ticker'] for r in rows})==len(rows)
 assert all(r['Ticker'] not in ('','-') for r in rows)
 def num(x):return Decimal(x.replace(',',''))
 weightsum=sum(num(r['Weight (%)']) for r in rows)
 assert abs(weightsum-100)<=Decimal('.10')
 holdings=[]
 for r in rows:
  a=r['Asset Class']; typ='equity' if a=='Equity' else ('cash' if a in ('Cash','Money Market') else 'other')
  if typ=='equity':
   identities[r['Ticker']].add((r['Name'],r['Sector'],r['Exchange'],r['Market Currency']))
   identity='US-EQUITY:'+r['Ticker']
  else: identity=f'US-{ticker}-{a.upper().replace(" ","-")}:'+r['Ticker']
  holdings.append({'id':identity,'name':r['Name'],'type':typ,'sector':r['Sector'],'weight':float(num(r['Weight (%)'])),'ticker':r['Ticker'],'exchange':r['Exchange'],'assetClass':a,'marketValue':float(num(r['Market Value'])),'notionalValue':float(num(r['Notional Value'])),'currency':r['Currency']})
 url='https://www.ishares.com/us/products/'+pid+'/'+slug
 note=f'Complete issuer holdings as of {date}. Weights preserve the issuer’s two-decimal Weight (%) field without renormalization; totals may differ from 100% through rounding. Market values are disclosed USD values. Equity identities use issuer ticker, with matching names, sectors, exchange and currency verified across these three same-date files; no ISINs are supplied by this export. Share-class ticker suffixes remain distinct. Cash, money-market, collateral and futures rows are retained; scenarios model disclosed equities only, without derivative look-through.'
 funds.append({'id':'us-'+ticker,'portfolioId':pid,'name':pre[0][0]+' ('+ticker+')','category':category,'date':date,'source':url+'/latest-holdings.csv','sourcePage':url,'sourceSha256':sha,'scenarioScope':'disclosed_equities_only','holdings':holdings,'note':note,'weightBasis':'issuer_disclosed_percent_rounded_2dp','currency':'USD','region':'US'})
 reports.append({'fundId':'us-'+ticker,'sourcePage':url,'sourceUrl':url+'/latest-holdings.csv','rawFile':rawpath.name,'sha256':sha,'holdingsDate':date,'retrievedDate':'2026-10-05','completeLeafRows':len(rows),'equityRows':sum(r['type']=='equity' for r in holdings),'classificationCounts':dict(collections.Counter(r['type'] for r in holdings)),'issuerAssetClassCounts':dict(collections.Counter(r['Asset Class'] for r in rows)),'totalWeightPercent':float(weightsum),'equityWeightPercent':float(sum(num(r['Weight (%)']) for r in rows if r['Asset Class']=='Equity')),'marketValueTotalUSD':float(sum(num(r['Market Value']) for r in rows)),'negativeMarketValueRows':sum(num(r['Market Value'])<0 for r in rows),'negativeWeightRows':sum(num(r['Weight (%)'])<0 for r in rows),'zeroWeightRows':sum(num(r['Weight (%)'])==0 for r in rows),'duplicateTickerRows':0,'missingTickers':0,'aggregateRowsIncluded':0,'weightTreatment':'Preserved issuer Weight (%) exactly. No normalization or invented residual holdings.','netAssetsDenominator':'Not used: public product page net assets is a different date from this holdings snapshot.'})
assert all(len(v)==1 for v in identities.values()), 'cross-fund ticker identity conflict'
assert len({f['date'] for f in funds})==1
dataset={'mode':'official','currency':'USD','region':'US','funds':funds,'note':note}
manifest={'schemaVersion':1,'description':'Official same-date US ETF example for FundLenz','mode':'official','holdingsDate':date,'funds':reports,'securityIdentityMethod':'US-EQUITY:<issuer ticker>. Cross-fund name, sector, exchange, and market currency exact match required. No inferred ISIN mapping. Ticker matching applies only to this same-date, same-issuer US fund universe.','crossFundIdentityConflicts':0,'uniqueEquityIdentities':len(identities),'classification':'Equity -> equity; Cash and Money Market -> cash; Cash Collateral and Margins and Futures -> other. Other rows remain available for disclosure and are excluded from equity scenarios.','sectorMethod':'Exact issuer sectors preserved; all repeated security identities have identical sectors.','validation':['Every leaf holding retained including zero-weight and non-equity rows.','All dates equal '+date+'.','All three fund weight totals within 0.10 percentage point of 100.','No aggregate holdings duplicated.','Quoted comma-separated market values parsed with Python CSV and Decimal.','Signed cash balances are preserved; scenarios hold cash unchanged.','No synthetic holdings, derived residual weights, or normalization.'],'rejectedCandidate':{'ticker':'ITOT','reason':'Complete source had rounded Weight (%) sum 98.44% and ambiguous duplicate/missing tickers; not used in default example.'}}
(BASE/'us-example-data.json').write_text(json.dumps(dataset,indent=2)+'\n')
(BASE/'us-example-validation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'funds':reports,'uniqueEquityIdentities':len(identities)},indent=2))
