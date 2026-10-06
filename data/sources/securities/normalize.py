"""Reproduce reference securities from pinned official raw downloads; no quote/FX inference."""
import csv,json,hashlib,datetime,re,collections,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
D=json.loads((ROOT/'downloads.json').read_text()); sources=[]; records=[]; audits=[]; bonds={}; conflicts=[]; exclusions=[]
def date(s):
 if not s or s=='-':return None
 for f in ('%b %d, %Y','%d/%b/%Y','%Y-%m-%d'):
  try:return datetime.datetime.strptime(s,f).date().isoformat()
  except ValueError:pass
 raise ValueError('Unrecognized date '+s)
def isin_ok(s):
 if not re.fullmatch(r'[A-Z]{2}[A-Z0-9]{9}[0-9]',s):return False
 ns=''.join(str(ord(c)-55) if c.isalpha() else c for c in s)
 vals=[int(c)*(2 if i%2 else 1) for i,c in enumerate(reversed(ns))]
 return sum(v//10+v%10 for v in vals)%10==0

def cusip_ok(s):
 if not re.fullmatch(r'[A-Z0-9]{8}[0-9]',s):return False
 vals=[]
 for i,c in enumerate(s[:-1]):
  v=int(c) if c.isdigit() else ord(c)-55;v*=2 if i%2 else 1;vals.append(v//10+v%10)
 return (10-sum(vals)%10)%10==int(s[-1])

def listed_type(name):
 n=name.lower()
 if re.search(r'\bwarrants?\b',n):return 'Warrant'
 if re.search(r'\brights?\b',n):return 'Right'
 if re.search(r'preferred|preference|\bpfd\b|depositary shares.*(?:%|series)',n):return 'Preferred stock'
 if re.search(r'\bunits?\b',n) and not re.search(r'beneficial interest',n):return 'Unit'
 if re.search(r'\bnotes?\b|\bdebentures?\b|\bbonds?\b|\betn\b',n):return 'Listed debt'
 # Closed-end fund shares must not inflate individual-company stock counts.
 if re.search(r'\bfund\b|\bportfolio\b|\betf\b|\bnextshares\b',n):return 'Listed fund'
 if re.search(r'\btrust(?:,? inc\.?)?(?: \(the\))?(?: -)? (?:common|shares of)',n):return 'Trust share'
 if re.search(r'american depositary|american depository|\badrs?\b|\badss?\b',n):return 'ADR'
 if re.search(r'common stock|ordinary share|common share|common unit|capital stock|shares of beneficial interest',n):return 'Stock'
 return 'Other listed security'
for src in D:
 p=ROOT/'raw'/src['path'];raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==src['sha256']
 src=dict(src);src['label']={'nasdaqlisted':'Nasdaq listed securities directory','otherlisted':'Nasdaq other-listed securities directory'}.get(src['id'],'iShares '+src['id']+' disclosed holdings')
 if src['id'] in ('nasdaqlisted','otherlisted'):
  text=raw.decode('utf-8-sig');m=re.search(r'File Creation Time:\s*(\d{8})',text);assert m
  asof=datetime.datetime.strptime(m[1],'%m%d%Y').date().isoformat();src['asOf']=asof;src['kind']='exchange-directory';sources.append(src)
  rows=list(csv.DictReader(text.splitlines(),delimiter='|'));counts=collections.Counter()
  for r in rows:
   if r.get('Test Issue')!='N':counts['excludedTestOrFooter']+=1;continue
   if r.get('ETF')!='N':counts['excludedETF']+=1;continue
   name=r['Security Name'].strip(); typ=listed_type(name);symbol=r.get('Symbol') or r.get('ACT Symbol');assert symbol
   ex='NASDAQ' if src['id']=='nasdaqlisted' else {'N':'NYSE','A':'NYSE American','P':'NYSE Arca','Z':'Cboe BZX','V':'IEX'}.get(r['Exchange'],r['Exchange'])
   # Identifies a current exchange listing, never an inferred issuer country/currency.
   records.append({'id':'listing:'+ex+':'+symbol,'name':name,'type':typ,'symbol':symbol,'exchange':ex,'listingMarket':'United States','sourceId':src['id'],'sourceIds':[src['id']],'asOf':asof,'identityBasis':'exchange-and-symbol','classificationBasis':'security-name text; source ETF/test flags'})
   counts[typ]+=1
  audits.append({'sourceId':src['id'],'asOf':asof,'counts':dict(counts)});continue
  
 text=raw.decode('utf-8-sig'); rows=list(csv.reader(text.splitlines())); h=next(i for i,r in enumerate(rows) if 'Asset Class' in r and 'Name' in r); header=rows[h];asof=date(next(r[1] for r in rows[:h] if r and r[0]=='Fund Holdings as of'));src['asOf']=asof;src['kind']='issuer-holdings';src['fundName']=rows[0][0];sources.append(src)
 counts=collections.Counter()
 for rowno,row in enumerate(rows[h+1:],h+2):
  if len(row)!=len(header):continue
  r=dict(zip(header,row));counts['leafRows']+=1
  if r['Asset Class']!='Fixed Income':counts['excludedNonBondRows']+=1;continue
  if re.search(r'\bTBA\b',r['Name'],re.I):counts['excludedTBA']+=1;continue
  isin=r['ISIN'].strip();cusip=r['CUSIP'].strip()
  if isin not in ('','-') and not isin_ok(isin):
   exclusions.append({'source':src['id'],'row':rowno,'name':r['Name'],'reason':'Invalid ISIN checksum','isin':isin});counts['excludedInvalidISIN']+=1;continue
  if isin_ok(isin):key='isin:'+isin
  elif cusip_ok(cusip):key='cusip:'+cusip
  else:
   exclusions.append({'source':src['id'],'row':rowno,'name':r['Name'],'reason':'No stable ISIN or CUSIP'});counts['excludedNoIdentity']+=1;continue
  entry={'id':key,'name':r['Name'],'type':'Bond','sector':r['Sector'],'country':r['Location'],'currency':r['Market Currency'],'sourceId':src['id'],'sourceIds':[src['id']],'asOf':asof,'heldBy':[src['id']],'identityBasis':'ISIN' if key.startswith('isin:') else 'CUSIP','coupon':float(r['Coupon (%)'].replace(',','')),'maturity':date(r['Maturity'])}
  if isin_ok(isin):entry['isin']=isin
  if cusip_ok(cusip):entry['cusip']=cusip
  if entry['maturity'] is None:del entry['maturity']
  assert 0<=entry['coupon']<=100
  assert entry['currency'] and entry['currency']!='-'
  counts['identifiedBondRows']+=1
  if key in bonds:
   previous=bonds[key]
   for field in ['coupon','maturity','currency','country']:
    if previous.get(field)!=entry.get(field):conflicts.append({'id':key,'field':field,'old':previous.get(field),'new':entry.get(field),'source':src['id']})
   if entry['name']!=previous['name']:
    previous.setdefault('alternateNames',[])
    if entry['name'] not in previous['alternateNames']:previous['alternateNames'].append(entry['name'])
   if src['id'] not in previous['sourceIds']:previous['sourceIds'].append(src['id']);previous['heldBy'].append(src['id'])
   counts['duplicateBondRows']+=1
  else:bonds[key]=entry
 audits.append({'sourceId':src['id'],'asOf':asof,'counts':dict(counts)})
# Conflicting metadata is withheld, not silently selected across files.
for c in conflicts:
 bonds[c['id']].pop(c['field'],None)
 bonds[c['id']].setdefault('metadataConflicts',[]).append(c)
records+=list(bonds.values());records.sort(key=lambda r:(r['type'],r['name'],r['id']))
assert len({r['id'] for r in records})==len(records)
notes=['Reference directory, not live prices, trading availability or recommendations.','Stock listings are US exchange listings; issuer domicile and quote currency are not inferred. Type is classified from security-name text and may require issuer verification.','Bonds are individual fixed-income securities disclosed in the five named iShares portfolios, not a comprehensive exchange listing or complete bond market. Agency MBS and securitized instruments are included and identified by issuer sectors.','Cash, FX, forwards, TBA positions, money-market fund units and equity positions are excluded from the bond universe.','Bond identity uses checksum-valid ISIN or disclosed CUSIP; unidentified rows and invalid ISINs are excluded. Same ISIN/CUSIP is merged across source funds.','Coupon is the issuer-disclosed rounded percentage as of the snapshot, not yield, guaranteed return or necessarily contractual full precision. Floating coupons may reset; maturities can be legal final dates.','No market value, fund weight, price, yield, FX conversion or credit rating is presented as a security quote.','A directory listing or portfolio holding does not establish retail access or suitability. Disclosed holdings with a maturity earlier than the snapshot are retained; these may reflect unsettled or defaulted positions and are not represented as active new investments.']
output={'schemaVersion':1,'title':'FundLenz securities reference catalogue','asOf':max(s['asOf'] for s in sources),'checkedAt':max(s['checkedAt'] for s in sources),'sources':sources,'notes':notes,'records':records}
audit={'recordCount':len(records),'countsByType':dict(collections.Counter(r['type'] for r in records)),'bondCountries':dict(collections.Counter(r['country'] for r in records if r['type']=='Bond' and 'country' in r)),'bondSectors':dict(collections.Counter(r['sector'] for r in records if r['type']=='Bond')),'sourceAudits':audits,'excluded':exclusions,'metadataConflicts':conflicts,'uniqueIds':True,'sourceChecksumsVerified':True,'bondISINChecksumVerified':True,'bondCUSIPChecksumVerified':True,'maturityBeforeSnapshotRows':sum(r.get('maturity','9999')<r['asOf'] for r in bonds.values())}
(ROOT/'securities.json').write_text(json.dumps(output,separators=(',',':'),ensure_ascii=False)+'\n');(ROOT/'audit.json').write_text(json.dumps(audit,indent=2)+'\n');print(json.dumps({k:audit[k] for k in ('recordCount','countsByType')},indent=2));print('conflicts',len(conflicts),'exclusions',len(exclusions),'countries',len(audit['bondCountries']))
