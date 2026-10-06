"""Discover dated portfolio spreadsheets from downloaded official AMC pages.
Only source URLs present in those pages are used. Query file names alone do not
establish a portfolio date; each downloaded workbook is checked separately.
"""
from pathlib import Path
import json,re,html,urllib.parse,urllib.request,concurrent.futures,hashlib,argparse
from html.parser import HTMLParser
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.current=None;self.text=''
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='a':self.current=a.get('href');self.text=''
 def handle_data(self,d):
  if self.current:self.text+=d
 def handle_endtag(self,t):
  if t=='a' and self.current:self.links.append((self.current,self.text));self.current=None

def discover(root):
 directory=json.loads((root/'amc-directory.json').read_text()); all_files=[]
 for d in directory:
  path=root/'amc-pages'/(d['mf_id']+'.html')
  if (root/'amc-pages'/(d['mf_id']+'-new.html')).exists():path=root/'amc-pages'/(d['mf_id']+'-new.html')
  if not path.exists():continue
  text=html.unescape(path.read_text(errors='replace')).replace('\\/','/').replace('\\u002F','/')
  parser=Links();parser.feed(text)
  direct=re.findall(r'(?:https?://|/)[^\r\n<>"\\\']+?\.(?:xlsx?|zip)(?:\?[^\r\n<>"\\\']*)?',text,re.I)
  all_links=dict(parser.links)
  for u in direct:all_links.setdefault(u,'')
  selected=[]
  for url,label in all_links.items():
   desc=urllib.parse.unquote(url)+' '+label
   if not re.search(r'\.(?:xlsx?|zip)(?:[?]|$)',url,re.I):continue
   if not re.search(r'(?:aug(?:ust)?[^/]{0,24}(?:2026|26)(?:\D|$)|2026[^/]{0,24}aug|2026[-_]?08|31[-_]?08[-_]?2026)',desc,re.I):continue
   if not re.search(r'portfolio|holdings|monthend|portf|all funds',desc,re.I) and not (d['mf_id']=='9' and 'Monthly' in desc) and not (d['mf_id']=='79' and '/MP-' in desc) and not (d['mf_id']=='85' and 'Small_Cap_Fund_August_2026' in desc):continue
   if re.search(r'overlap|15[-_a-z]*(?:aug|08)|fortnight|transaction|risk|dashboard|performance|aum|debt.fortnight',urllib.parse.unquote(urllib.parse.urlsplit(url).path.rsplit('/',1)[-1]),re.I):continue
   full=urllib.parse.quote(urllib.parse.urljoin(d['amc_monthly_portfolio_disclosure'],url).strip(),safe=':/?&=%#@+')
   selected.append({'amc':d['mf_name'],'amcId':d['mf_id'],'url':full,'sourcePage':d['amc_monthly_portfolio_disclosure'],'label':label.strip()})
  # A consolidated workbook already contains all individual portfolio sheets.
  if d['mf_name']=='PPFAS Mutual Fund':selected=[x for x in selected if 'PPFAS_Monthly' in x['url'] and '/PPFAS_' in x['url']]
  all_files.extend(selected)
 extra=root/'extra-disclosures.json'
 if extra.exists():all_files.extend(json.loads(extra.read_text()))
 return list({x['url']:x for x in all_files}.values())
def download_one(item,root):
 ext=Path(urllib.parse.urlsplit(item['url']).path).suffix or '.bin';name=item['amcId']+'-'+hashlib.sha256(item['url'].encode()).hexdigest()[:12]+ext
 dest=root/'downloads'/name;dest.parent.mkdir(exist_ok=True)
 try:
  if not dest.exists():
   req=urllib.request.Request(item['url'],headers={'User-Agent':'Mozilla/5.0 (compatible; FundLensResearch/1.0)'})
   with urllib.request.urlopen(req,timeout=35) as r:b=r.read(30_000_000)
   dest.write_bytes(b)
  else:b=dest.read_bytes()
  return {**item,'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'status':'downloaded'}
 except Exception as e:return {**item,'status':'unavailable','reason':str(e)}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('--download',action='store_true');a=p.parse_args();files=discover(a.directory)
 (a.directory/'discovered-portfolios.json').write_text(json.dumps(files,indent=2));print('Discovered',len(files),'files for',len(set(x['amc'] for x in files)),'AMCs',flush=True)
 if a.download:
  results=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
   for r in pool.map(lambda x:download_one(x,a.directory),files):
    results.append(r);print(json.dumps({k:r[k] for k in ['amc','status','file','bytes'] if k in r}),flush=True)
  (a.directory/'download-manifest.json').write_text(json.dumps(results,indent=2))
