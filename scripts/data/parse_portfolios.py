"""Conservative extraction of official monthly disclosure workbooks.
A sheet is accepted only when it has explicit instrument/ISIN/NAV columns, a
matching snapshot date, positive reported net assets and reconciled leaf rows.
Original percentage weights and row numbers remain attached to each holding.
"""
from pathlib import Path
import json,re,io,zipfile,hashlib,math,collections,argparse,unicodedata,warnings
import pandas as pd
warnings.filterwarnings('ignore',category=UserWarning)
ROOT=Path(__file__).resolve().parents[2]
DATE='2026-08-31'
def txt(v):
 if v is None:return ''
 try:
  if pd.isna(v):return ''
 except Exception:pass
 return re.sub(r'\s+',' ',str(v)).strip()
def norm(v):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',txt(v)).lower().replace('&','and'))
def num(v):
 if isinstance(v,(int,float)) and math.isfinite(v):return float(v)
 s=txt(v).replace(',','').replace('%','').replace('(','-').replace(')','')
 try:x=float(s);return x if math.isfinite(x) else None
 except ValueError:return None

def workbooks(path):
 b=path.read_bytes()
 if b[:2]==b'PK':
  z=zipfile.ZipFile(io.BytesIO(b))
  if '[Content_Types].xml' not in z.namelist():
   for name in z.namelist():
    if name.lower().endswith(('.xls','.xlsx')) and not name.startswith('__MACOSX'):yield name,z.read(name)
   return
 yield path.name,b

def statement_blocks(df,source):
 # UTI publishes a single worksheet with explicit scheme STARTS/ENDS markers.
 # Preserve original row offsets and require a scheme title inside each block.
 if source['amc']=='UTI Mutual Fund':
  starts=[i for i in range(len(df)) if re.match(r'^SCHEME CODE.*STARTS$',txt(df.iloc[i,0]))]
  if starts:
   for start,end in zip(starts,starts[1:]+[len(df)]):
    block=df.iloc[start:end].reset_index(drop=True)
    title=next((re.sub(r'^SCHEME:\s*','',txt(v),flags=re.I) for v in block.iloc[:8,0] if re.match(r'^SCHEME:',txt(v),re.I)),None)
    if title:yield block,{**source,'statementTitleOverride':title,'rowOffset':start,'utiBlock':True}
   return
 yield df,source

def parse_sheet(df,sheet,source):
 rows=df.values.tolist();header=None;cols={};
 for i,row in enumerate(rows[:30]):
  ss=[txt(v).lower() for v in row]
  ic=next((j for j,v in enumerate(ss) if v=='isin' or v.startswith('isin ')),None)
  nc=next((j for j,v in enumerate(ss) if ('name' in v and ('instrument' in v or 'issuer' in v or 'security' in v))),None)
  wc=next((j for j,v in enumerate(ss) if ('%' in v or 'percent' in v) and ('nav' in v or 'asset' in v or 'aum' in v)),None)
  mc=next((j for j,v in enumerate(ss) if ('value' in v and ('market' in v or 'fair' in v)) or 'mkt val' in v),None)
  if None not in (ic,nc,wc,mc):
   cols={'isin':ic,'name':nc,'weight':wc,'value':mc,'sector':next((j for j,v in enumerate(ss) if 'industry' in v or 'rating' in v),None),'quantity':next((j for j,v in enumerate(ss) if 'quantity' in v),None)};header=i;break
 if header is None:return None,'no supported instrument table'
 top=' | '.join(dict.fromkeys(txt(v) for r in rows[:header] for v in r if txt(v)))
 if not (re.search(r'(?:31(?:st)?[- /]*(?:aug(?:ust)?)[- ,]*(?:2026|26)|aug(?:ust)?\s*31[, ]*2026|2026-08-31|31[-/.]08[-/.](?:2026|26)|FOR AUGUST 2026)',top,re.I)):
  return None,'snapshot date not confirmed'
 title_candidates=[]
 for row in rows[:header]:
  for v in row:
   s=txt(v)
   s=re.sub(r'^MONTHLY PORTFOLIO STATEMENT OF (.*?) (?:AS ON|FOR AUGUST) .*$',r'\1',s,flags=re.I)
   if re.search(r'fund|bees|scheme|etf|\bfof\b|\bfmp\b',s,re.I) and not re.search('portfolio statement|mutual fund$|scheme name|inception|monthly portfolio',s,re.I) and len(s)>10:title_candidates.append(s)
 if not title_candidates:return None,'fund title not found'
 name=source.get('statementTitleOverride') or title_candidates[0]
 grand_index=None;grand=None;grand_weight=None
 for i,row in enumerate(rows[header+1:],header+1):
  label=' '.join(txt(v) for v in row[:cols['value']] if txt(v))
  is_uti_total=source.get('utiBlock') and norm(label)==norm('TOTAL : '+name)
  if re.search(r'grand[ _]*total|^net assets$|^total net assets$',label,re.I) or is_uti_total:
   v=num(row[cols['value']]);w=num(row[cols['weight']])
   if is_uti_total and w is None:w=100 # Explicit % TO NAV columns; validated against each reported leaf weight below.
   if v and v>0:grand_index=i;grand=v;grand_weight=w;break
 if grand_index is None:return None,'reported grand total missing'
 if grand_weight is None or not (abs(grand_weight-1)<1e-5 or abs(grand_weight-100)<.05):return None,'grand total percentage ambiguous'
 multiplier=100 if grand_weight<1.01 else 1
 unit_header=txt(rows[header][cols['value']]).lower()
 if source.get('utiBlock') and re.search(r'Market value in Lacs',top,re.I):unit_header+=' in lacs'
 unit=100000 if re.search('lac|lakh',unit_header) else 10000000 if 'crore' in unit_header else 1 if re.search('rs|₹|inr',unit_header) else None
 if unit is None:return None,'market value unit unknown'
 section='Unclassified';holdings=[];unclassified=[];seen=collections.defaultdict(int)
 for i in range(header+1,grand_index):
  row=rows[i];label=txt(row[cols['name']]);isin=txt(row[cols['isin']]);val=num(row[cols['value']]);reported=num(row[cols['weight']]);whole=' '.join(dict.fromkeys(txt(v) for v in row[:cols['value']] if txt(v)))
  if source.get('utiBlock'):isin=re.sub(r'^[*$\s]+','',isin)
  if val is None:
   # Headings may be in the ISIN column rather than the instrument column.
   heading=label or whole
   if not heading:continue
   if re.search('equity|debt|money market|treps|repo|cash|mutual fund|reit|invit|preference|derivative|gold|silver|net current|net receiv',heading,re.I) and not re.search('subtotal|sub total|total|listed|unlisted|awaiting',heading,re.I):section=heading
   continue
  if not label:
   if re.search('net current|net receiv|net payab|cash|treps',whole,re.I):label=whole
   else:continue
  if re.search(r'(?:^| )total(?:$| )',label,re.I) and not re.fullmatch(r'[A-Z]{2}[A-Z0-9]{9}[0-9]',isin):continue
  if re.match(r'^(?:sub\s*-?\s*total|total|grand total|net assets)\b',label,re.I):continue
  if re.search(r'^\(?[a-z0-9]\)?[.)]?\s*(?:listed|unlisted|privately|awaiting)',label,re.I):continue
  if abs(val)<1e-10 and (reported is None or abs(reported)<1e-10):continue
  valid_isin=bool(re.fullmatch(r'[A-Z]{2}[A-Z0-9]{9}[0-9]',isin))
  is_adjustment=bool(re.search(r'net current|net receiv|net payab|other current|receivables|payables|cash and|cash balance|cash &|margin|treps|reverse repo|repo repo|triparty',label,re.I))
  if not valid_isin and not is_adjustment:
   # Precious metals and derivative positions can lack standard ISINs.
   if not re.search(r'gold|silver|futur|option|treasury|margin|cash|treps|repo|cds|swap',label+' '+section,re.I):
    unclassified.append({'row':i+1,'label':label,'value':val});continue
  if re.search(r'equity',section,re.I) and valid_isin and not isin.startswith('INF') and not re.search('derivative|future|option|preference|reit|invit|exchange traded|\betf\b',section+' '+label,re.I):kind='equity'
  elif not re.search(r'net current|net receiv|net payab',label,re.I) and (re.search(r'^cash\b|^treps\b|^reverse repo|tri.?party repo',label,re.I) or re.search(r'^treps\b|^reverse repo|^cash',section,re.I)):kind='cash'
  else:kind='other'
  if val<0:kind='other'
  sector=txt(row[cols['sector']]) if cols['sector'] is not None else ''
  if kind!='equity':sector='Other assets' if kind=='other' else 'Cash & equivalents'
  if not sector:sector='Unknown'
  security_id=isin if valid_isin else 'NONSEC-'+hashlib.sha256((source['amc']+'|'+sheet+'|'+label+'|'+str(i)).encode()).hexdigest()[:12]
  quantity=num(row[cols['quantity']]) if cols['quantity'] is not None else None
  holdings.append({'id':security_id,'name':label,'originalName':label,'type':kind,'assetClass':section,'sector':sector,'weight':val/grand*100,'reportedWeight':reported*multiplier if reported is not None else None,'marketValueINR':val*unit,'quantity':quantity,'sourceRow':i+1})
 if not holdings:return None,'no supported holdings'
 if source.get('utiBlock') and any(h['reportedWeight'] is not None and abs(h['reportedWeight']-h['weight'])>.02 for h in holdings):return None,'UTI reported leaf percentages differ from calculated NAV weights'
 total=sum(h['marketValueINR'] for h in holdings)/unit
 difference=grand-total;difference_pct=difference/grand*100
 if abs(difference_pct)>.10:return None,f'leaf rows differ from net assets by {difference_pct:.5f}% ({len(unclassified)} unclassified rows)'
 # Keep disclosed ISIN totals additive if several genuine lots occur.
 merged={}
 for h in holdings:
  k=(h['id'],h['type'])
  if k not in merged:merged[k]=h
  else:
   a=merged[k];a['weight']+=h['weight'];a['marketValueINR']+=h['marketValueINR'];a['quantity']=(a['quantity'] or 0)+(h['quantity'] or 0)
   a['reportedWeight']=(a['reportedWeight'] or 0)+(h['reportedWeight'] or 0);a['sourceRows']=a.get('sourceRows',[a['sourceRow']])+[h['sourceRow']]
 holdings=list(merged.values())
 # Derivative tables are often outside the NAV-accounting table. Detect active
 # position rows, rather than mistaking standard 'Nil' template headings for use.
 derivative=False
 for i,row in enumerate(rows):
  s=' '.join(txt(v) for v in row)
  if re.search(r'future|option|swap',s,re.I):
   if i<=grand_index and any(h['sourceRow']==i+1 and abs(h['weight'])>1e-8 for h in holdings):derivative=True
   if re.search(r'exposure.*(?:future|option)|(?:future|option).*exposure',s,re.I) and not re.search(r'\bnil\b|\bzero\b',s,re.I):
    nums=[num(v) for v in row if num(v) is not None];derivative=derivative or any(abs(v)>1e-7 for v in nums)
  if re.search(r'\b(?:[A-Z0-9]+\s+)?(?:[A-Z]{3}[- ]?2026|FUTSTK|FUTIDX)\b',s) and i>grand_index and any((num(v) or 0)<0 for v in row):derivative=True
 title=name.split('(',1)[0].split('\n',1)[0].strip();title=re.split(r'\s+-\s+(?:An |A |an |a )',title)[0]
 subtitle=name[len(title):].strip(' -()')
 benchmark=None
 for row in rows:
  for j,v in enumerate(row):
   s=txt(v)
   if re.match(r'^benchmark(?: name)?\s*[-:]',s,re.I):benchmark=re.sub(r'^benchmark(?: name)?\s*[-:]\s*','',s,flags=re.I)
   elif s.lower() in ('benchmark','benchmark name') and j+1<len(row) and txt(row[j+1]):benchmark=txt(row[j+1])
 note='Weights calculated from disclosed instrument market values divided by reported net assets; original disclosed percentage weights are retained.'
 if abs(difference_pct)>1e-7:note+=f' Unreconciled difference: {difference_pct:.6f}% of net assets.'
 if re.search(r'FOR AUGUST 2026',top,re.I):note+=' The source specifies August 2026; its reporting month is represented by the month-end date.'
 if derivative:note+=' Derivative exposure is disclosed and is excluded from the price-shock model.'
 if source.get('rowOffset'):
  for h in holdings:
   h['sourceRow']+=source['rowOffset']
   if h.get('sourceRows'):h['sourceRows']=[r+source['rowOffset'] for r in h['sourceRows']]
  note+=' Source row numbers refer to the original consolidated worksheet.'
 return {'statementTitle':title,'description':subtitle[:600] or None,'amc':source['amc'],'date':DATE,'source':source['url'],'sourcePage':source['sourcePage'],'sourceSheet':sheet,'sourceFile':source.get('archiveMember',source['file']),'sourceSha256':source['sha256'],'aumINR':grand*unit,'benchmark':benchmark,'holdings':holdings,'derivatives':derivative,'reconciliationDifferencePct':difference_pct,'weightBasis':'disclosed_market_value_over_reported_net_assets','note':note},None

def main(root):
 manifest=json.loads((root/'download-manifest.json').read_text());catalog=json.loads((ROOT/'public/data/catalog.json').read_text());funds=catalog['funds'];by_amc=collections.defaultdict(list)
 for f in funds:by_amc[f['amc']].append(f)
 parsed=[];audit=[];seen=set()
 for source in manifest:
  if source.get('status')!='downloaded':continue
  if source['sha256'] in seen:continue
  seen.add(source['sha256'])
  path=root/'downloads'/source['file']
  try:
   for member,b in workbooks(path):
    try:x=pd.ExcelFile(io.BytesIO(b))
    except Exception as e:audit.append({'file':source['file'],'member':member,'status':'not parsed','reason':str(e)[:120]});continue
    for sheet in x.sheet_names:
     if re.search(r'^index$|^content',sheet,re.I):continue
     try:blocks=statement_blocks(pd.read_excel(x,sheet_name=sheet,header=None),{**source,'archiveMember':member})
     except Exception as e:audit.append({'file':source['file'],'sheet':sheet,'status':'not parsed','reason':str(e)[:160]});continue
     for block,block_source in blocks:
      try:p,reason=parse_sheet(block,sheet,block_source)
      except Exception as e:p=None;reason=str(e)[:160]
      if p:
       parsed.append(p);audit.append({'file':source['file'],'sheet':sheet,'name':p['statementTitle'],'status':'parsed','differencePct':p['reconciliationDifferencePct']})
      else:audit.append({'file':source['file'],'sheet':sheet,'name':block_source.get('statementTitleOverride'),'status':'not parsed','reason':reason})
  except Exception as e:audit.append({'file':source['file'],'status':'not parsed','reason':str(e)[:160]})
 print('Parsed',len(parsed),'sheets',flush=True)
 # Match only a unique exact normalized scheme name; reviewed aliases are explicit.
 aliases_path=ROOT/'data/sources/fund-aliases.json';aliases=json.loads(aliases_path.read_text()) if aliases_path.exists() else {}
 matched={};unmatched=[]
 for p in parsed:
  title=p['statementTitle'];n=norm(title);alias=aliases.get(p['amc']+'|'+title)
  candidates=[f for f in by_amc[p['amc']] if norm(f['name'])==n or (alias and f['name']==alias)]
  if len(candidates)!=1:unmatched.append({'amc':p['amc'],'title':title,'file':p['sourceFile'],'sheet':p['sourceSheet']});continue
  f=candidates[0];fid=f['id'];p['id']=fid;p['portfolioId']=fid;p['name']=f['name'];p['category']=f['category']
  if fid not in matched or len(p['holdings'])>len(matched[fid]['holdings']):matched[fid]=p
 # One identity/sector label per equity ISIN. Use the modal disclosed label and
 # retain the original on each position, never fuzzy-match different ISINs.
 names=collections.defaultdict(collections.Counter);sectors=collections.defaultdict(collections.Counter)
 for p in matched.values():
  for h in p['holdings']:
   if h['type']=='equity':names[h['id']][h['name']]+=1;sectors[h['id']][h['sector']]+=1
 for p in matched.values():
  for h in p['holdings']:
   if h['type']=='equity':h['name']=names[h['id']].most_common(1)[0][0];h['sector']=sectors[h['id']].most_common(1)[0][0]
  p['holdingCount']=len(p['holdings'])
  p['equityPct']=sum(h['weight'] for h in p['holdings'] if h['type']=='equity')
  p['cashPct']=sum(h['weight'] for h in p['holdings'] if h['type']=='cash')
  p['otherPct']=sum(h['weight'] for h in p['holdings'] if h['type']=='other')
 for f in funds:
  p=matched.get(f['id']);f['portfolioId']=p['id'] if p else None
  f.pop('portfolioSummary',None)
  if p:f['portfolioSummary']={'date':p['date'],'aumINR':p['aumINR'],'equityPct':p['equityPct'],'cashPct':p['cashPct'],'otherPct':p['otherPct'],'holdingCount':len(p['holdings']),'derivatives':p['derivatives'],'description':p['description'],'benchmark':p['benchmark']}
 outdir=ROOT/'public/data/holdings';outdir.mkdir(exist_ok=True)
 for old in outdir.glob('*.json'):old.unlink()
 for fid,p in matched.items():
  p['scenarioScope']='disclosed_equities_only'
  (outdir/(fid+'.json')).write_text(json.dumps(p,ensure_ascii=False,separators=(',',':')))
 catalog['stats']['holdingsFunds']=len(matched);catalog['stats']['holdingsFundHouses']=len(set(p['amc'] for p in matched.values()));catalog['stats']['holdingsDate']=DATE
 (ROOT/'public/data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
 (ROOT/'data/sources/parsed-portfolios.json').write_text(json.dumps({'schemaVersion':1,'date':DATE,'portfolios':matched},ensure_ascii=False,separators=(',',':')))
 (root/'parsed-sheets.json').write_text(json.dumps(parsed,ensure_ascii=False))
 (ROOT/'data/sources/portfolio-audit.json').write_text(json.dumps(audit,indent=2))
 (ROOT/'data/sources/unmatched-portfolios.json').write_text(json.dumps(unmatched,indent=2))
 (ROOT/'data/sources/portfolio-sources.json').write_text(json.dumps(manifest,indent=2))
 print(json.dumps({'parsed':len(parsed),'matched':len(matched),'unmatched':len(unmatched),'byAMC':dict(collections.Counter(p['amc'] for p in matched.values())),'unparsedReasons':collections.Counter(a.get('reason') for a in audit if a['status']!='parsed').most_common(12)},indent=2),flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args();main(args.directory)
