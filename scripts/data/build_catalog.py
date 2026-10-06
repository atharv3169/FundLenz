"""Build the complete AMFI NAV-feed catalogue without inventing missing metadata.
Run with the bundled Python runtime. Inputs are immutable downloaded source files.
"""
from pathlib import Path
from datetime import datetime, timezone
import json, re, hashlib, collections, argparse
ROOT=Path(__file__).resolve().parents[2]

def clean(s):return re.sub(r'\s+',' ',s).strip()
def key(s):return re.sub(r'[^a-z0-9]','',s.lower())
def source_url(value):
 if not value:return None
 value=clean(value).replace(chr(92),'/')
 if value.startswith('www.'):value='https://'+value
 return value if re.match(r'^https?://[^/ ]+',value) else None
def parse_date(s):
 try:return datetime.strptime(s.strip(),'%d-%b-%Y').strftime('%Y-%m-%d')
 except ValueError:return None

def build(raw_path,directory_path):
 raw=raw_path.read_bytes(); directory=json.loads(directory_path.read_text())
 houses={key(d['mf_name']):d for d in directory}
 groups={};codes=set();errors=[];category='';structure='';amc='';raw_count=0
 for line_number,line in enumerate(raw.decode('utf-8-sig').splitlines(),1):
  line=clean(line)
  if not line:continue
  if re.match(r'^\d+;',line):
   raw_count+=1;c=[clean(x) for x in line.split(';')]
   if len(c)!=8:errors.append({'line':line_number,'reason':'unexpected field count'});continue
   code,isin,reinvest,name,plan,option,nav,date=c
   if code in codes:raise ValueError('Duplicate AMFI scheme code '+code)
   codes.add(code)
   try:nav_value=float(nav);nav_value=nav_value if nav_value>=0 else None
   except ValueError:nav_value=None
   date_iso=parse_date(date)
   digest=hashlib.sha256((amc+'|'+name).encode()).hexdigest()[:16];fid='f-'+digest
   if fid not in groups:
    meta=houses.get(key(amc),{})
    groups[fid]={'id':fid,'name':name,'amc':amc,'amcId':meta.get('mf_id'),'category':category,'structure':structure,'categories':set(),'plans':[],
     'links':{'website':meta.get('amc_website'),'portfolio':meta.get('amc_monthly_portfolio_disclosure'),'factsheet':meta.get('amc_monthly_mf_factsheets'),'annualReport':meta.get('amc_schemewise_annual_report'),'riskometer':meta.get('amc_riskometer_monthly'),'information':meta.get('statement_of_information')},'portfolioId':None}
   f=groups[fid];f['categories'].add(category)
   f['plans'].append({'code':code,'plan':plan or 'Not specified in source','option':option or 'Not specified in source','isin':None if isin=='-' else isin,'reinvestmentIsin':None if reinvest=='-' else reinvest,'nav':nav_value,'navDate':date_iso})
  elif re.search(r'^(?:Open Ended|Close Ended|Closed Ended|Interval).*\(',line):
   structure=line.split('(',1)[0].strip();category=line.split('(',1)[1].rstrip(')').strip()
  elif ';' not in line:amc=line
 if errors:raise ValueError(json.dumps(errors[:20]))
 funds=list(groups.values())
 for f in funds:
  f['links']={k:source_url(v) for k,v in f['links'].items()}
  f['categories']=sorted(f['categories']);f['navDate']=max((p['navDate'] for p in f['plans'] if p['navDate']),default=None)
  f['plans'].sort(key=lambda p:(not ('direct' in p['plan'].lower() and 'growth' in p['option'].lower()),p['navDate'] or '',p['code']),reverse=False)
  f['assetClass']=f['category'].split(' - ',1)[0] if ' - ' in f['category'] else f['category']
 funds.sort(key=lambda f:f['name'].lower())
 nav_date=max(f['navDate'] or '' for f in funds)
 stats={'fundRecords':len(funds),'planRecords':raw_count,'fundHouses':len(set(f['amc'] for f in funds)),'directoryHouses':len(directory),'latestNavDate':nav_date,'plansAtLatestDate':sum(p['navDate']==nav_date for f in funds for p in f['plans'])}
 result={'schemaVersion':1,'retrievedAt':datetime.now(timezone.utc).isoformat(),'source':'https://portal.amfiindia.com/spages/NAVAll.txt','directorySource':'https://www.amfiindia.com/online-center/portfolio-disclosure','sourceSha256':hashlib.sha256(raw).hexdigest(),'stats':stats,'funds':funds,'houses':[{'id':d['mf_id'],'name':d['mf_name'],'company':d.get('amc_name'),'website':d.get('amc_website'),'portfolio':d.get('amc_monthly_portfolio_disclosure'),'factsheet':d.get('amc_monthly_mf_factsheets')} for d in directory]}
 out=ROOT/'public/data/catalog.json';out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 (ROOT/'data/sources/navall.txt').write_bytes(raw)
 (ROOT/'data/sources/amc-directory.json').write_text(json.dumps(directory,indent=2))
 (ROOT/'data/sources/catalog-manifest.json').write_text(json.dumps({k:v for k,v in result.items() if k not in ['funds','houses']},indent=2))
 print(json.dumps({'output':str(out),'bytes':out.stat().st_size,**stats,'unmatchedAMC':[f for f in sorted(set(x['amc'] for x in funds)) if key(f) not in houses]},indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('nav_file',type=Path);p.add_argument('directory_file',type=Path);a=p.parse_args();build(a.nav_file,a.directory_file)
