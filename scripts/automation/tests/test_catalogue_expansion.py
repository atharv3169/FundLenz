"""Source admission and whole-file safety regressions for catalogue expansion."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import ROOT, read
from adapters import decision, parse_nav
from india_discovery import valid_isin, new_plan_candidates, append_plans
from acquire import due_sources
from ucits_holdings import parse_ucits


class ExpansionTests(unittest.TestCase):
    def setUp(self):
        self.catalogue = read(ROOT / 'public/data/catalog.json')
        self.rows = parse_nav((ROOT / 'data/sources/india-disclosures/amfi-discovery-2026-10-22.txt').read_bytes())
        self.source = dict(source_id='fixture', source_url='https://portal.amfiindia.com/spages/NAVAll.txt', source_sha256='a'*64, checked_at='2026-10-23T00:00:00Z')
        self.row = next(r for r in self.rows.values() if valid_isin(r['isin']) and r['raw_date']=='22-Oct-2026')
        self.empty = dict(self.catalogue, funds=[], stats={})

    def proposals(self, row=None, catalog=None):
        r=row or self.row
        return new_plan_candidates(catalog or self.empty, {r['code']:r}, self.source, decision)

    def test_new_identity_is_source_derived_and_never_implies_holdings(self):
        unit=self.proposals()[0]
        self.assertEqual(unit['decision'],'accepted')
        cat=copy.deepcopy(self.empty);append_plans(cat,[unit])
        self.assertEqual(cat['funds'][0]['plans'][0]['code'], self.row['code'])
        self.assertIsNone(cat['funds'][0]['portfolioId'])
        self.assertEqual(cat['stats']['planRecords'],1)
        self.assertEqual(self.proposals(catalog=cat),[])

    def test_new_identity_requires_known_amc_and_checksum(self):
        for changes in [dict(amc='Fictional unknown AMC'), dict(isin='INF000000000',reinvestmentIsin=None),dict(isin=None,reinvestmentIsin=None)]:
            self.assertEqual(self.proposals(dict(self.row,**changes))[0]['decision'],'blocked')

    def test_new_identity_requires_recent_positive_nav(self):
        for changes in [dict(raw_nav='NaN'),dict(raw_nav='0'),dict(raw_nav='-1'),dict(raw_date='01-Oct-2026'),dict(raw_date='24-Oct-2026')]:
            self.assertEqual(self.proposals(dict(self.row,**changes))[0]['decision'],'blocked')

    def test_isin_cannot_migrate_to_another_scheme(self):
        existing=dict(self.row,code='different-code',name='Conflicting scheme')
        units=new_plan_candidates(self.empty,{self.row['code']:self.row,'different-code':existing},self.source,decision)
        self.assertTrue(all(u['decision']=='blocked' for u in units))

    def test_daily_nav_precedes_large_unchecked_weekly_queue(self):
        registry=read(ROOT/'automation/source-registry.json')['sources']
        selected,_,_=due_sources(registry,{},dict(issues=[]),'2026-10-23T03:47:00Z',64)
        self.assertTrue(any(s['adapter']=='amfi_nav' for s in selected))
        self.assertTrue(all(s in selected for s in registry if s['adapter']!='monitor' and s['cadence_hours']==24))

    def ucits(self):
        d=next(d for d in read(ROOT/'data/sources/global/holdings/downloads.json') if d.get('format')=='ishares_ucits_csv')
        raw=(ROOT/'data/sources/global/holdings'/d['filename']).read_bytes()
        cat={f['id']:f for f in read(ROOT/'public/data/global/catalog.json')['funds']}
        return raw,d,cat

    def test_ucits_exact_replay_preserves_weights_without_market_values(self):
        raw,d,cat=self.ucits();p,s,r=parse_ucits(raw,d,cat)
        old=read(ROOT/'public/data/global/holdings'/(d['id']+'.json'))
        self.assertEqual(p,old)
        self.assertTrue(all('marketValue' not in h for h in p['holdings']))
        self.assertAlmostEqual(sum(h['weight'] for h in p['holdings']),s['weightTotalPct'])
        self.assertEqual(r['sourceLeafRows'],sum(len(h['sourceRows']) for h in p['holdings']))

    def test_ucits_wrong_identity_date_truncation_and_hash_fail(self):
        raw,d,cat=self.ucits()
        for changes in [dict(sha256='0'*64),dict(isin='IE0000000000'),dict(productId='000000'),dict(checkedAt='2000-01-01T00:00:00Z')]:
            with self.assertRaises((AssertionError,ValueError)):parse_ucits(raw,dict(d,**changes),cat)
        for changed in [raw.rstrip(),raw+b'broken,row\n\n',raw+b'non-empty unexplained footer\n\n']:
            with self.assertRaises((AssertionError,ValueError)):parse_ucits(changed,dict(d,sha256=hashlib.sha256(changed).hexdigest()),cat)

if __name__=='__main__':unittest.main()
