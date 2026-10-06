from pathlib import Path
import json, datetime, math, collections, re, argparse, hashlib
parser=argparse.ArgumentParser(description='Normalize retained issuer snapshots without making network requests.')
parser.add_argument('source_directory',type=Path)
P=parser.parse_args().source_directory
raw_manifest=json.loads((P/'issuer-downloads.json').read_text())
for filename in ['ishares-uk-screener.json','vanguard-au-funds.json']:
    meta=next(x for x in raw_manifest if x.get('file')==filename and x.get('status')==200)
    if hashlib.sha256((P/filename).read_bytes()).hexdigest()!=meta['sha256']:raise ValueError('Source checksum mismatch: '+filename)

def clean(x):
    if x is None:return None
    if isinstance(x,str):
        x=x.strip()
        if not x or x in ['-','--']:return None
    return x

def val(x):
    x=x.get('r') if isinstance(x,dict) else x
    try:
        if x is None:return None
        n=float(x)
        return n if math.isfinite(n) else None
    except (ValueError,TypeError):return None

def date(x):
    x=x.get('r') if isinstance(x,dict) else x
    for fmt in ['%Y%m%d','%d/%m/%Y','%Y-%m-%d']:
        try:return datetime.datetime.strptime(str(x),fmt).date().isoformat()
        except (ValueError,TypeError):pass
    return None

def compact(row):return {k:v for k,v in row.items() if v is not None and v!=''}

records=[]
for source in json.loads((P/'ishares-uk-screener.json').read_text()).values():
    typ=source.get('productType')
    name=source['fundName'].strip()
    prod='Mutual Fund' if typ=='BLK_MUTUAL_FUND_DATA' else ('ETP' if typ=='ETP' else ('ETC' if ' ETC' in name else 'ETF'))
    feeField='onGoingCharges' if prod=='Mutual Fund' else 'ter'
    row=dict(name=name,ticker=clean(source.get('localExchangeTicker')),isin=clean(source.get('isin')),provider='iShares',market='Europe / UCITS',productType=prod,assetClass=clean(source.get('aladdinAssetClass')),currency=clean(source.get('seriesBaseCurrencyCode')),domicile=clean(source.get('domicile')),feePct=val(source.get(feeField)),feeLabel='Ongoing Charges Figure' if prod=='Mutual Fund' else 'Total Expense Ratio',distribution=clean(source.get('useOfProfits')),inceptionDate=date(source.get('inceptionDate')),url='https://www.ishares.com'+source['productPageUrl'] if source.get('productPageUrl','').startswith('/') else clean(source.get('productPageUrl')),sourceId='ishares-uk-screener',sourceRecordId=str(source['portfolioId']),sourceProductType=typ,shareClass=clean(source.get('investorClassName')))
    nd=date(source.get('navAmountAsOf'));nav=val(source.get('navAmount'))
    if nav is not None and nd:row.update(nav=nav,navDate=nd)
    # totalFundSizeInMillions has a date but no fund currency. Deliberately omit.
    # totalNetAssets has an explicit USD label but no separate date. Deliberately omit.
    records.append(compact(row))

if (P/'vanguard-au-funds.json').exists():
    for source in json.loads((P/'vanguard-au-funds.json').read_text())['data']:
        listing=source.get('listings') or {};identifiers=listing.get('identifiers') or []
        ids={x['altIdCode']:x.get('altIdValue') for x in identifiers if not x.get('altIdEndDate') or x['altIdEndDate']>='2026-10-04'}
        ts=source.get('tradingSymbols') or {};typ='ETF' if source['productType']=='etf' else 'Mutual Fund'
        row=dict(name=source['fundName'],ticker=clean(ts.get('TICKER') or ids.get('ASX')),isin=ids.get('ISIN'),apir=clean(ts.get('APIR')),provider='Vanguard',market='Australia',productType=typ,assetClass=clean(source.get('assetClass')),currency=clean(listing.get('fundCurrency')),feePct=val(source.get('managementFeePercent')),feeLabel='Investment management costs',inceptionDate=date(source.get('inceptionDate')),url='https://www.vanguard.com.au/personal/invest-with-us/products',sourceId='vanguard-au-funds',sourceRecordId=source['portId'],shareClass=clean(source.get('fundShareClass')))
        records.append(compact(row))

(P/'issuer-records.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
sources=[]
for sid,filename,label,landing,notes in [
    ('ishares-uk-screener','ishares-uk-screener.json','iShares UK public fund screener','https://www.ishares.com/uk/individual/en/products/product-list','1,417 unique ISIN share classes. Currency is explicitly share-class currency. AUM is omitted because dated fund size has no currency; undated USD net assets are also omitted. Names retained, outer whitespace trimmed. Fees are source percentage points, not fractions. ETF/ETC/ETP types follow source product type and product name.'),
    ('vanguard-au-funds','vanguard-au-funds.json','Vanguard Australia public product list','https://www.vanguard.com.au/personal/invest-with-us/products','80 public product records. ETF ISIN and currency from dated active exchange identifiers/listing. No NAV or net assets supplied in this list. Mutual funds retain APIR identifiers. Fee is explicitly investment management costs, not a total expense ratio.')
]:
    match=next((x for x in raw_manifest if x.get('file')==filename and x.get('status')==200),None)
    if match:sources.append(dict(id=sid,label=label,landingUrl=landing,records=sum(x['sourceId']==sid for x in records),notes=notes,**{k:v for k,v in match.items() if k!='peek'}))
manifest=dict(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),totalRecords=len(records),byMarket=dict(collections.Counter(x['market'] for x in records)),byProductType=dict(collections.Counter(x['productType'] for x in records)),fieldCoverage={k:sum(k in x for x in records) for k in ['isin','ticker','nav','navDate','aum','aumDate','feePct','currency','domicile']},sources=sources)
(P/'issuer-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({k:v for k,v in manifest.items() if k!='sources'},indent=2))
