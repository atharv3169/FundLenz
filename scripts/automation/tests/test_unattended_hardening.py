"""Fictional fault injection: no network, real credentials, paid calls or production writes."""
import copy
import datetime as dt
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from collections import Counter
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import acquire
import common
import deployment
import github_api
import health
import merge
import model_tasks
import publish
import restore_state


def http_error(code, headers=None):
    return urllib.error.HTTPError('https://example.invalid', code, 'fictional private body', headers or {}, None)


def state_fixture():
    return {'sources': {'first': {'last_attempt_at': '2026-11-04T03:47:00Z', 'sha256': 'a'*64,
                                 'outcome': 'checked_changed'}},
            'issues': {'schema_version': 1, 'updated_at': '2026-11-04T03:48:00Z',
                       'issues': [], 'note': 'Fictional fault fixture'},
            'applied_runs': ['123-1'], 'last_run_id': '123-1'}


class TransportHardeningTests(unittest.TestCase):
    def test_body_bytes_and_slow_drip_are_bounded(self):
        self.assertEqual(common.bounded_read(io.BytesIO(b'abc'), 3, 10, lambda: 0), b'abc')
        with self.assertRaisesRegex(ValueError, 'Oversized'):
            common.bounded_read(io.BytesIO(b'abcd'), 3, 10, lambda: 0)
        clock = [0]
        class Drip:
            def read(self, n): return self.read1(n)
            def read1(self, n):
                clock[0] += 1
                return b'x'
        with self.assertRaises(TimeoutError):
            common.bounded_read(Drip(), 1000, 3, lambda: clock[0])
        self.assertEqual(clock[0], 3)

    def test_deadline_checked_after_eof(self):
        class LateEOF:
            def read(self, _): return b''
        times = iter([0, 11])
        with self.assertRaises(TimeoutError):
            common.bounded_read(LateEOF(), 1, 10, lambda: next(times))

    def test_atomic_state_write_preserves_previous_bytes_on_failure(self):
        with tempfile.TemporaryDirectory() as d:
            target = Path(d)/'state.json'
            common.write(target, {'old': True})
            before = target.read_bytes()
            with mock.patch.object(common.os, 'replace', side_effect=OSError('fictional disk fault')):
                with self.assertRaises(OSError): common.write(target, {'new': True})
            self.assertEqual(target.read_bytes(), before)
            self.assertEqual(list(Path(d).iterdir()), [target])
            common.write(target, {'new': True})
            self.assertEqual(common.read(target), {'new': True})

    def test_cooldowns_are_validated_without_shortening_long_waits(self):
        self.assertEqual(common.retry_after_seconds({'Retry-After': '10'}, 60), 10)
        self.assertEqual(common.retry_after_seconds({'Retry-After': 'Thu, 05 Nov 2026 12:00:30 GMT'}, 60,
                         dt.datetime(2026,11,5,12,tzinfo=dt.timezone.utc).timestamp()), 30)
        for value in ['999999', '-5', 'invalid', 'NaN', 'inf']:
            self.assertIsNone(common.retry_after_seconds({'Retry-After': value}, 60))

    def test_only_object_uploads_and_reads_retry(self):
        for path, method, permitted in [('/git/blobs','POST',True),('/git/trees','POST',True),
                                        ('/git/commits','POST',True),('/actions','GET',True),
                                        ('/git/refs','POST',False),('/pulls','POST',False),('/pulls/1/merge','PUT',False)]:
            opener = mock.Mock()
            opener.open.side_effect = [http_error(503), io.BytesIO(b'{}')]
            with self.subTest(path=path), mock.patch.object(github_api.urllib.request, 'build_opener', return_value=opener), \
                 mock.patch.object(github_api.time, 'sleep'):
                api = github_api.GitHub(token='fictional')
                if permitted: self.assertEqual(api.call(path,method), {})
                else:
                    with self.assertRaises(urllib.error.HTTPError): api.call(path,method)
            self.assertEqual(opener.open.call_count, 2 if permitted else 1)

    def test_short_throttle_retries_and_long_cooldown_fails_closed(self):
        for code in [403,429,503]:
            opener = mock.Mock()
            opener.open.side_effect = [http_error(code, {'Retry-After':'10'}), io.BytesIO(b'{}')]
            with mock.patch.object(github_api.urllib.request,'build_opener',return_value=opener), \
                 mock.patch.object(github_api.time,'sleep') as wait:
                self.assertEqual(github_api.GitHub(token='fictional').call('/actions'), {})
                wait.assert_called_once_with(10)
        opener.open.side_effect = http_error(503, {'Retry-After':'3600'})
        with mock.patch.object(github_api.urllib.request,'build_opener',return_value=opener), \
             mock.patch.object(github_api.time,'sleep') as wait:
            with self.assertRaises(urllib.error.HTTPError): github_api.GitHub(token='fictional').call('/actions')
            wait.assert_not_called()

    def test_malformed_pagination_cannot_be_treated_as_an_empty_list(self):
        api = github_api.GitHub(token='fictional')
        with mock.patch.object(api,'call',return_value={'items':None}):
            with self.assertRaises(ValueError): api.all('/fictional','items')


class StateHardeningTests(unittest.TestCase):
    at = '2026-11-05T03:47:00Z'

    def test_future_or_corrupt_state_is_not_used_as_a_cadence_decision(self):
        original = state_fixture()
        restore_state.validate_state(original, self.at)
        for change in [{'last_attempt_at':'2026-11-06T00:00:00Z'}, {'sha256':'corrupt'}]:
            value = copy.deepcopy(original); value['sources']['first'].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                restore_state.validate_state(value, self.at)
        with self.assertRaises(ValueError):
            restore_state.validate_state(dict(original, applied_runs=['123-1','123-1']), self.at)

    def test_unpublished_weekly_attempt_retries_next_day_only(self):
        committed = state_fixture()
        attempted = copy.deepcopy(committed)
        attempted['last_run_id'] = '124-1'
        attempted['sources']['first']['sha256'] = 'b'*64
        attempted['sources']['second'] = dict(committed['sources']['first'])
        committed['sources']['second'] = dict(committed['sources']['first'])
        pending = restore_state.unpublished_sources(attempted, committed)
        self.assertEqual(pending, {'first'})
        registry = [{'id':i,'url':'https://example.invalid/'+i,'adapter':'ishares_holdings','cadence_hours':168}
                    for i in ['first','second']]
        selected, deferred, later = acquire.due_sources(registry,attempted['sources'],{'issues':[]},self.at,192,
                                                       pending_source_ids=pending)
        self.assertEqual([s['id'] for s in selected], ['first'])
        self.assertEqual([s['id'] for s in later], ['second'])
        selected, _, _ = acquire.due_sources(registry,attempted['sources'],{'issues':[]},'2026-11-04T05:00:00Z',192,
                                            pending_source_ids=pending)
        self.assertEqual(selected, [])
        self.assertEqual(restore_state.unpublished_sources(attempted, attempted), set())

    def test_monitoring_sources_do_not_consume_pending_supported_retry_budget(self):
        registry = [{'id':'first','url':'https://example.invalid/first','adapter':'monitor','cadence_hours':168}]
        result = acquire.due_sources(registry,state_fixture()['sources'],{'issues':[]},self.at,192,pending_source_ids={'first'})
        self.assertEqual(result[0], [])

    def exercise_restore(self, expired=True, published='123-1', total=1):
        value = state_fixture(); value['last_run_id'] = published
        api = mock.Mock(repo='fictional/repo')
        api.call.return_value = {'total_count':total,'workflow_runs':[{'id':123,'run_attempt':1,'status':'completed',
                                      'event':'workflow_dispatch','head_branch':'main',
                                      'head_repository':{'full_name':'fictional/repo'}}]}
        api.all.return_value = [{'name':'fundlenz-state','expired':expired}]
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); common.write(root/'audit/automation-state.json',value)
            output=root/'output'
            with mock.patch.object(restore_state,'ROOT',root), mock.patch.object(restore_state,'GitHub',return_value=api), \
                 mock.patch.dict(os.environ,{'GITHUB_RUN_ID':'999','GITHUB_OUTPUT':str(output)},clear=False):
                restore_state.main()
            return common.read(root/'work/state/state.json') if (root/'work/state/state.json').exists() else output.read_text()

    def test_expired_state_can_fall_back_only_to_exact_committed_attempt(self):
        self.assertEqual(self.exercise_restore(), state_fixture())
        with self.assertRaisesRegex(ValueError,'Unpublished state artifact expired'):
            self.exercise_restore(published='122-1')
        self.assertEqual(self.exercise_restore(expired=False), state_fixture())
        self.assertIn('run_id=123', self.exercise_restore(expired=False,published='122-1'))


class ModelHardeningTests(unittest.TestCase):
    def test_malformed_provider_shapes_are_explicit_contract_errors(self):
        for body in [None, [], {'candidates':{}}, {'candidates':[None]},
                     {'candidates':[{'finishReason':'STOP','content':None}]},
                     {'candidates':[{'finishReason':'STOP','content':{'parts':[None]}}]},
                     {'candidates':[{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'{}'}]}}]}]:
            with self.subTest(body=body), self.assertRaises(ValueError): model_tasks.response_text(body)

    def test_large_issue_context_is_trimmed_reproducibly_not_silently_bypassed(self):
        packet={'sources':[{'source_id':str(i),'source_sha256':'a'*64,'source_url':'https://example.invalid/'+str(i),
                            'excerpt':'x'*700,'excerpt_is_complete_source':False} for i in range(12)],
                'sample_adapter_decisions':[{'fictional':'x'*3000} for _ in range(8)],
                'issues':[{'source_url':'https://example.invalid/0','reason':'x'*5000,
                           'previous_verified':'x'*2500,'previous_candidate':'x'*2500} for _ in range(8)],
                'scope':{'sample_units':8,'issues_in_this_task':8},'output_instructions':'Fictional budget fixture'}
        before=copy.deepcopy(packet)
        policy={'max_model_input_bytes_per_task':45000}
        fitted=model_tasks.fit_packet(packet,'reinvestigation',policy)
        self.assertLessEqual(model_tasks.model_input_bytes(fitted,'reinvestigation'),44000)
        self.assertGreater(len(fitted['sources']),0)
        self.assertEqual(fitted,model_tasks.fit_packet(packet,'reinvestigation',policy))
        self.assertEqual(packet,before)
        self.assertEqual(fitted['scope']['issues_in_this_task'],len(fitted['issues']))
        self.assertFalse(model_tasks.is_no_work_packet(fitted))
        with self.assertRaisesRegex(ValueError,'Minimum honest'):
            model_tasks.fit_packet(packet,'reinvestigation',{'max_model_input_bytes_per_task':1000})

    def test_gemini_service_cooldown_keeps_the_same_call_budget(self):
        policy={'model_retries':3,'model_retry_delay_seconds':60,'model_retry_http_statuses':[503]}
        caller=mock.Mock(side_effect=[http_error(503,{'Retry-After':'120'}), ({}, {})])
        waits=[]
        self.assertEqual(model_tasks.bounded_call({},'fresh_scan',policy,caller,waits.append)[2],2)
        self.assertEqual(waits,[120])
        with self.assertRaises(urllib.error.HTTPError):
            model_tasks.bounded_call({},'fresh_scan',policy,mock.Mock(side_effect=http_error(503,{'Retry-After':'3600'})),waits.append)


class PublicationServer:
    repo='fictional/repo'
    base='a'*40
    tree='b'*40
    head='c'*40
    def __init__(self):
        self.ref=None; self.pr=None; self.count=Counter(); self.lose=set(); self.corrupt=False
        self.protection={'required_status_checks':{'strict':True},'enforce_admins':{'enabled':True},
                         'required_pull_request_reviews':{},'allow_force_pushes':{'enabled':False},'allow_deletions':{'enabled':False}}
    def call(self,path,method='GET',data=None):
        self.count[(method,path)]+=1
        if path.startswith('/git/ref/heads/'):
            if self.ref is None: raise http_error(404)
            return copy.deepcopy(self.ref)
        if path=='/branches/main':
            return {'protected':True,'commit':{'sha':self.head if self.pr and self.pr.get('merged_at') else self.base},
                    'protection':{'required_status_checks':{'contexts':['FundLenz data gate']}}}
        if path=='/branches/main/protection': return copy.deepcopy(self.protection)
        if path=='/git/commits/'+self.base: return {'tree':{'sha':'d'*40}}
        if path=='/git/commits/'+self.head:
            return {'sha':self.head,'tree':{'sha':'e'*40 if self.corrupt else self.tree},'parents':[{'sha':self.base}]}
        if path=='/git/blobs':
            import base64
            return {'sha':publish.git_blob_sha(base64.b64decode(data['content']))}
        if path=='/git/trees': return {'sha':self.tree}
        if path=='/git/commits': return {'sha':self.head,'author':{'name':'fictional'},'committer':{'name':'fictional'}}
        if path=='/git/refs':
            self.ref={'object':{'sha':data['sha'],'type':'commit'}}
            if path in self.lose:
                self.lose.remove(path); raise TimeoutError('fictional lost acknowledgement')
            return copy.deepcopy(self.ref)
        if path=='/pulls' and method=='POST':
            self.pr={'number':1,'html_url':'https://example.invalid/pr/1','user':{'login':'publisher'},'state':'open','draft':False,
                     'head':{'sha':self.head,'repo':{'full_name':self.repo}},'base':{'ref':'main'}}
            if path in self.lose:
                self.lose.remove(path); raise TimeoutError('fictional lost acknowledgement')
            return copy.deepcopy(self.pr)
        raise AssertionError((path,method))
    def all(self,path):
        if path.startswith('/pulls?'): return [copy.deepcopy(self.pr)] if self.pr else []
        raise AssertionError(path)


class PublicationHardeningTests(unittest.TestCase):
    def exercise(self,server):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(publish,'ROOT',Path(d)):
            return publish.publish_candidate(server,{'run_id':'123-1','base_commit':server.base},
                                             {'audit/latest.json':b'fictional verified bytes'},
                                             {'required_check':'FundLenz data gate'},'publisher')

    def test_repeated_publication_reuses_the_exact_branch_and_pr(self):
        server=PublicationServer()
        first=self.exercise(server); second=self.exercise(server)
        self.assertEqual(first,second)
        for path in ['/git/refs','/pulls','/git/commits','/git/blobs']:
            self.assertEqual(server.count[('POST',path)],1)

    def test_lost_ref_and_pr_acknowledgements_do_not_duplicate_writes(self):
        server=PublicationServer();server.lose={'/git/refs','/pulls'}
        result=self.exercise(server)
        self.assertEqual(result['pr_number'],1)
        self.assertEqual(server.count[('POST','/pulls')],1)
        self.assertEqual(server.count[('POST','/git/refs')],1)

    def test_changed_existing_tree_or_wrong_publisher_is_never_overwritten(self):
        server=PublicationServer();self.exercise(server);server.corrupt=True
        with self.assertRaisesRegex(ValueError,'Existing publication differs'):self.exercise(server)
        server.corrupt=False;server.pr['user']['login']='intruder'
        with self.assertRaisesRegex(ValueError,'identity/head mismatch'):self.exercise(server)
        self.assertEqual(server.count[('POST','/pulls')],1)
        self.assertEqual(server.count[('POST','/git/refs')],1)

    def test_merged_publication_is_recognised_and_closed_unmerged_is_not_reopened(self):
        server=PublicationServer();self.exercise(server)
        server.pr.update(state='closed',merged_at='2026-11-05T12:00:00Z',merge_commit_sha='f'*40)
        self.assertTrue(self.exercise(server)['merge_complete'])
        server.pr['merged_at']=None
        with self.assertRaisesRegex(ValueError,'closed without merging'):self.exercise(server)
        self.assertEqual(server.count[('POST','/pulls')],1)

    def test_visible_write_recovery_is_bounded_and_does_not_retry_auth(self):
        for error,count in [(TimeoutError(),3),(http_error(401),1),(http_error(403),1)]:
            create=mock.Mock(side_effect=error)
            with self.subTest(error=type(error).__name__), self.assertRaises(type(error)):
                publish.reconcile_write(create,lambda:None,lambda _:True)
            self.assertEqual(create.call_count,count)
        with self.assertRaisesRegex(ValueError,'conflicts'):
            publish.reconcile_write(mock.Mock(side_effect=TimeoutError()),lambda:{'wrong':True},lambda _:False)

    def test_failed_validation_cannot_publish_even_when_opted_in(self):
        for artifact in [{'publication_enabled':True}, {'publication_enabled':True,'validation_passed':False},
                         {'publication_enabled':True,'validation_passed':1}, {'publication_enabled':False,'validation_passed':True}]:
            with self.subTest(artifact=artifact), self.assertRaises(ValueError): publish.require_publishable_release(artifact)


class MergeHardeningTests(unittest.TestCase):
    def test_lost_merge_response_is_reconciled_without_a_second_merge(self):
        done=[False];calls=[]
        api=mock.Mock(repo='fictional/repo')
        def call(path,method='GET',data=None):
            calls.append((path,method))
            if method=='PUT': done[0]=True;raise TimeoutError('fictional lost response')
            return {'merged':done[0],'user':{'login':'publisher'},'head':{'sha':'head','repo':{'full_name':api.repo}},
                    'base':{'ref':'main'},'merge_commit_sha':'f'*40}
        api.call.side_effect=call
        with mock.patch.object(merge,'ready_to_merge',return_value=True), mock.patch.object(merge,'assert_release_date_current'):
            result=merge.merge_checked(api,api,1,{},'head','base','publisher',attempts=3,wait=lambda _:None)
        self.assertEqual(result['sha'],'f'*40)
        self.assertEqual(sum(method=='PUT' for _,method in calls),1)

    def test_pending_merge_is_bounded_and_never_forced(self):
        api=mock.Mock();api.call.return_value={'merged':False}
        waits=[]
        with mock.patch.object(merge,'ready_to_merge',return_value=False), self.assertRaisesRegex(ValueError,'deadline'):
            merge.merge_checked(api,api,1,{},'head','base','publisher',attempts=3,wait=waits.append)
        self.assertEqual(waits,[15,15])
        self.assertTrue(all(len(call.args)==1 for call in api.call.call_args_list))

    def test_extra_protected_context_waits_and_uses_latest_result(self):
        api=mock.Mock(repo='fictional/repo')
        api.call.side_effect=lambda path: {'user':{'login':'publisher'},'state':'open','draft':False,
             'head':{'sha':'head','ref':'automation/catalogue-123-1','repo':{'full_name':api.repo}},
             'base':{'sha':'base','ref':'main'},'mergeable':True} if path.startswith('/pulls/') else {
             'commit':{'sha':'base'},'protected':True,'protection':{'required_status_checks':{'contexts':['FundLenz data gate','Extra']}}}
        checks=[{'id':i,'name':n,'status':'completed','conclusion':'success','app':{'slug':'github-actions'}}
                for i,n in enumerate(['FundLenz data gate','Verify FundLenz reviewed release'],1)]
        extra={'id':3,'name':'Extra','status':'in_progress','conclusion':None,'app':{'id':99}}
        api.all.side_effect=lambda path,key: checks+[extra] if key=='check_runs' else []
        with mock.patch.object(merge,'strict_protection',return_value={'required_status_checks':{'checks':[{'context':'Extra','app_id':99}]}}):
            self.assertFalse(merge.ready_to_merge(api,1,{'required_check':'FundLenz data gate'},'head','base','publisher'))
            extra.update(status='completed',conclusion='success')
            self.assertTrue(merge.ready_to_merge(api,1,{'required_check':'FundLenz data gate'},'head','base','publisher'))
            checks.append(dict(extra,id=4,conclusion='failure'))
            with self.assertRaises(ValueError):merge.ready_to_merge(api,1,{'required_check':'FundLenz data gate'},'head','base','publisher')


class HostingHardeningTests(unittest.TestCase):
    def test_green_trigger_does_not_hide_overdue_or_mismatched_published_audit(self):
        at=dt.datetime(2026,11,5,12,tzinfo=dt.timezone.utc)
        audit={'run_id':'123-1','completed_at':'2026-11-05T10:00:00Z','status':'PARTIAL'}
        self.assertEqual(health.verify_published_audit(audit,{'run_id':'123-1'},at),2)
        for changes in [{'run_id':'wrong'},{'status':'FAIL'},{'completed_at':'2026-11-03T10:00:00Z'},
                        {'completed_at':'2026-11-06T10:00:00Z'}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                health.verify_published_audit(dict(audit,**changes),{'run_id':'123-1'},at)

    def test_actual_cdn_data_must_match_even_if_release_marker_would_match(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            files={'public/data/catalog.json':b'fictional nav bytes','public/data/global/holdings-index.json':b'fictional index'}
            units=[]
            for i in range(4):
                files[f'public/data/global/holdings/fixture-{i}.json']=f'fictional portfolio {i}'.encode()
                units.append({'unit':f'holdings:fixture-{i}','decision':'accepted'})
            for path,raw in files.items():
                target=root/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            common.write(root/'audit/latest.json',{'changes':units})
            requested=[];stale=[False]
            class Opener:
                def open(self,req,timeout):
                    from urllib.parse import urlsplit
                    path='public'+urlsplit(req.full_url).path;requested.append(path)
                    return io.BytesIO(b'old bytes' if stale[0] and path.endswith('catalog.json') else files[path])
            deployment.verify_public_assets(Opener(),'https://example.invalid','a'*40,root)
            self.assertEqual(len(requested),5)
            self.assertNotIn('public/data/global/holdings/fixture-1.json',requested)
            stale[0]=True
            with self.assertRaisesRegex(ValueError,'Served financial asset'):
                deployment.verify_public_assets(Opener(),'https://example.invalid','a'*40,root)


class SecondReviewTests(unittest.TestCase):
    def test_preflight_stops_stale_base_before_any_paid_request(self):
        from preflight import verify_main_base
        api=mock.Mock();api.call.return_value={'commit':{'sha':'a'*40}}
        verify_main_base(api,'a'*40)
        with self.assertRaisesRegex(ValueError,'stale'):verify_main_base(api,'b'*40)
        with self.assertRaises(ValueError):verify_main_base(api,'invalid')

    def test_failed_preflight_can_use_backup_but_started_acquisition_cannot(self):
        from schedule_guard import collector_consumed_budget
        run={'status':'completed'}
        job={'name':'Collect and validate','started_at':'2026-11-05T03:47:00Z','conclusion':'failure',
             'steps':[{'name':'Acquire approved official sources','conclusion':'skipped'}]}
        self.assertFalse(collector_consumed_budget(job,run))
        self.assertTrue(collector_consumed_budget(job,{'status':'in_progress'}))
        job['steps'][0]['conclusion']='failure'
        self.assertTrue(collector_consumed_budget(job,run))
        job['steps']=[]
        self.assertTrue(collector_consumed_budget(job,run))

    def test_missing_unpublished_state_must_not_reset_issue_history(self):
        value=state_fixture();value['last_run_id']='122-1'
        api=mock.Mock(repo='fictional/repo')
        api.call.return_value={'total_count':1,'workflow_runs':[{'id':123,'run_attempt':1,'status':'completed',
                           'event':'workflow_dispatch','head_branch':'main','head_repository':{'full_name':api.repo}}]}
        api.all.side_effect=lambda path,key: [] if key=='artifacts' else [
            {'name':'Collect and validate','started_at':'2026-11-04T03:47:00Z','conclusion':'failure'}]
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);common.write(root/'audit/automation-state.json',value)
            with mock.patch.object(restore_state,'ROOT',root),mock.patch.object(restore_state,'GitHub',return_value=api), \
                 mock.patch.dict(os.environ,{'GITHUB_RUN_ID':'999','GITHUB_OUTPUT':str(root/'output')},clear=False):
                with self.assertRaisesRegex(ValueError,'Durable state missing'):restore_state.main()
            self.assertFalse((root/'work/state/state.json').exists())

    def test_legacy_status_cannot_override_another_missing_required_check(self):
        api=mock.Mock(repo='fictional/repo')
        api.call.side_effect=lambda path: {'user':{'login':'publisher'},'state':'open','draft':False,
             'head':{'sha':'head','ref':'automation/catalogue-123-1','repo':{'full_name':api.repo}},
             'base':{'sha':'base','ref':'main'},'mergeable':True} if path.startswith('/pulls/') else {
             'commit':{'sha':'base'},'protected':True,'protection':{'required_status_checks':{'contexts':['FundLenz data gate','Legacy A','Legacy B']}}}
        checks=[{'id':1,'name':'FundLenz data gate','status':'completed','conclusion':'success','app':{'slug':'github-actions'}}]
        statuses=[{'id':3,'context':'Legacy A','state':'success'},{'id':4,'context':'Legacy B','state':'success'}]
        api.all.side_effect=lambda path,key: checks if key=='check_runs' else statuses
        with mock.patch.object(merge,'strict_protection',return_value={'required_status_checks':{}}):
            self.assertFalse(merge.ready_to_merge(api,1,{'required_check':'FundLenz data gate'},'head','base','publisher'))
            checks.append(dict(checks[0],id=2,name='Verify FundLenz reviewed release'))
            self.assertTrue(merge.ready_to_merge(api,1,{'required_check':'FundLenz data gate'},'head','base','publisher'))
            statuses[-1]['state']='pending'
            self.assertFalse(merge.ready_to_merge(api,1,{'required_check':'FundLenz data gate'},'head','base','publisher'))

    def test_unexpected_success_reply_is_not_accepted_as_publication(self):
        with self.assertRaisesRegex(ValueError,'unexpected identity'):
            publish.reconcile_write(lambda:{'wrong':True},lambda:None,lambda _:False)

    def test_new_malformed_issuer_shapes_block_only_the_affected_source(self):
        import adapters,csv
        source={'source_id':'fixture','source_url':'https://example.invalid/file.csv','adapter':'ishares_holdings',
                'checked_at':'2026-11-05T03:47:00Z','source_sha256':common.sha(b'\n\n')}
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for path,value in [('public/data/catalog.json',{'funds':[]}),('public/data/global/catalog.json',{'funds':[]}),
                               ('public/data/global/holdings/fixture.json',{'id':'fixture','date':'2026-11-01','holdings':[]}),
                               ('data/sources/global/holdings/downloads.json',[{'id':'fixture','url':source['source_url'],'status':'downloaded'}])]:
                common.write(root/path,value)
            for error in [IndexError('missing cell'),TypeError('wrong shape'),csv.Error('oversized CSV cell')]:
                with self.subTest(error=type(error).__name__),mock.patch.object(adapters.global_builder,'parse_bytes',side_effect=error):
                    units,_=adapters.reconcile(root,{'source_checks':[source]},common.read(common.ROOT/'automation/runtime.json'),{'fixture':b'\n\n'})
                self.assertEqual(len(units),1)
                self.assertEqual(units[0]['decision'],'blocked')
                self.assertIsNone(units[0]['proposed_value'])
            for value in [float('inf'),float('nan')]:
                malformed=({'holdings':[{'weight':100,'marketValue':value}]},{},{})
                with mock.patch.object(adapters.global_builder,'parse_bytes',return_value=malformed):
                    units,_=adapters.reconcile(root,{'source_checks':[source]},common.read(common.ROOT/'automation/runtime.json'),{'fixture':b'\n\n'})
                self.assertEqual(units[0]['decision'],'blocked')
                self.assertIsNone(units[0]['proposed_value'])

    def test_indian_nav_validation_uses_india_day_near_utc_midnight(self):
        import adapters
        catalogue={'funds':[{'name':'Fictional Fund','amc':'Fictional AMC','plans':[
            {'code':'1','nav':10,'navDate':'2026-11-04','isin':'FICTIONAL','reinvestmentIsin':None,'plan':'Direct','option':'Growth'}]}]}
        rows={'1':{'name':'Fictional Fund','amc':'Fictional AMC','raw_nav':'10.1','raw_date':'05-Nov-2026',
                   'isin':'FICTIONAL','reinvestmentIsin':None,'plan':'Direct','option':'Growth','line':1}}
        source={'source_id':'fixture','source_url':'https://example.invalid/nav','source_sha256':'a'*64,
                'checked_at':'2026-11-04T19:00:00Z'}
        with mock.patch.object(adapters,'parse_nav',return_value=rows):
            units=adapters.nav_candidates(catalogue,b'fictional',source,{'nav_max_relative_change':0.5})
        self.assertEqual(units[0]['decision'],'accepted')
        self.assertEqual(units[0]['snapshot_date'],'2026-11-05')


class CrossStageSimulations(unittest.TestCase):
    def test_625_mixed_provider_sequences_keep_budget_and_fail_closed(self):
        import itertools
        policy={'model_retries':3,'model_retry_delay_seconds':60,'model_retry_http_statuses':[500,502,503,504]}
        sequences=0
        with mock.patch('builtins.print'):
            for sequence in itertools.product(['ok','503','timeout','contract','auth'],repeat=4):
                calls=[];waits=[]
                def provider(*_):
                    event=sequence[len(calls)];calls.append(event)
                    if event=='ok':return {'genuine':True},{}
                    if event=='503':raise http_error(503)
                    if event=='timeout':raise TimeoutError()
                    if event=='contract':raise model_tasks.ModelContractError('fictional malformed response')
                    raise http_error(401)
                try:
                    result=model_tasks.bounded_call({'output_instructions':'fictional'},'fresh_scan',policy,provider,waits.append)
                    self.assertEqual(calls[-1],'ok')
                    self.assertTrue(result[0]['genuine'])
                except (urllib.error.HTTPError, TimeoutError, model_tasks.ModelContractError):
                    self.assertNotEqual(calls[-1],'ok')
                self.assertLessEqual(len(calls),4)
                self.assertLessEqual(calls.count('contract'),2)
                self.assertLessEqual(sum(waits),420)
                self.assertLessEqual(max(waits,default=0),240)
                if 'auth' in calls:self.assertEqual(calls[-1],'auth')
                sequences+=1
        self.assertEqual(sequences,625)

    def test_32_repeated_upload_and_acknowledgement_scenarios(self):
        import itertools
        scenarios=0
        for lost_ref,lost_pr,repeats,already_merged in itertools.product([False,True],[False,True],range(4),[False,True]):
            server=PublicationServer();server.lose={path for path,lost in [('/git/refs',lost_ref),('/pulls',lost_pr)] if lost}
            with tempfile.TemporaryDirectory() as d,mock.patch.object(publish,'ROOT',Path(d)):
                def run():
                    return publish.publish_candidate(server,{'run_id':'123-1','base_commit':server.base},
                              {'audit/latest.json':b'fictional exact bytes'},{'required_check':'FundLenz data gate'},'publisher')
                result=run()
                if already_merged:server.pr.update(state='closed',merged_at='2026-11-05T12:00:00Z',merge_commit_sha='f'*40)
                for _ in range(repeats):
                    result=run()
                    self.assertEqual(result['merge_complete'],already_merged)
                for path in ['/git/refs','/pulls','/git/commits','/git/blobs']:
                    self.assertEqual(server.count[('POST',path)],1)
                self.assertEqual(result['pr_number'],1)
            scenarios+=1
        # 2 lost-ref states x 2 lost-PR states x 4 repeat counts x 2 merge states.
        self.assertEqual(scenarios,32)

class FrozenReviewContextTests(unittest.TestCase):
    def test_task_a_findings_cannot_change_task_b_replay_packet(self):
        import validate
        state=state_fixture();state['sources']={};state['applied_runs']=[]
        acquisition={'run_id':'123-1','started_at':'2026-11-05T03:47:00Z','completed_at':'2026-11-05T03:48:00Z',
                     'base_commit':'a'*40,'base_dataset_sha256':'b'*64,'previous_state':state,'source_checks':[]}
        unit={'unit':'nav:fixture','decision':'accepted','previous_verified':10,'proposed_value':11}
        def packet(acq,units,task,policy,run):return {'unit_decision':units[0]['decision'],'issues':[]}
        observed=[]
        def review(document,task,acq,units,context):
            observed.append((task,context['unit_decision']))
            if task=='fresh_scan':units[0]['decision']='blocked'
            self.assertEqual(context['unit_decision'],'accepted')
            return []
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);run=root/'work/run';out=root/'work/result'
            common.write(run/'acquisition.json',acquisition)
            common.write(root/'public/data/site-metadata.json',{'lastCatalogueUpdateDate':'2026-11-04'})
            for task in ['fresh_scan','reinvestigation']:
                common.write(run/(task+'-status.json'),{'status':'completed'})
                common.write(run/(task+'.json'),{})
            allowed={'audit/latest.json','audit/open-issues.json','audit/automation-state.json',
                     'public/automation-audit/latest.json','public/automation-audit/release.json'}
            with mock.patch.object(validate,'verify_acquisition',return_value={}), \
                 mock.patch.object(validate,'reconcile',return_value=([unit],{})), \
                 mock.patch.object(model_tasks,'packets',side_effect=packet), \
                 mock.patch.object(validate,'validate_model',side_effect=review), \
                 mock.patch.object(validate,'reconcile_issues',return_value=(state,[])), \
                 mock.patch.object(validate,'build_files',return_value={}), \
                 mock.patch.object(validate,'schema'),mock.patch.object(validate,'allowed_paths',return_value=allowed), \
                 mock.patch.object(validate,'dataset_hash',return_value='b'*64),mock.patch('builtins.print'):
                report=validate.validate(root,run,out)
            self.assertTrue(report['validation_passed'])
            self.assertEqual(observed,[('fresh_scan','accepted'),('reinvestigation','accepted')])


class ConnectionDiagnosticTests(unittest.TestCase):
    def test_connection_probe_reports_no_schedule_change_instead_of_disabled_automation(self):
        import importlib.util
        spec=importlib.util.spec_from_file_location('connection_diagnostic',common.ROOT/'scripts/automation/test-gemini-connection.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        raw=json.dumps({'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'{"status":"ok","check":"fundlenz"}'}]}}]}).encode()
        result=module.validate_response(raw)
        self.assertFalse(result['schedule_modified'])
        self.assertNotIn('scheduled_updates_enabled',result)
        with self.assertRaises(module.ConnectionCheckError):module.validate_response(b'[]')


class ImmutableAttemptTests(unittest.TestCase):
    def automatic(self,attempt,status='failure'):
        import schedule_guard
        return {'id':1,'run_attempt':attempt,'event':'workflow_dispatch','display_title':schedule_guard.EXTERNAL_RUN_NAME,
                'path':'.github/workflows/catalogue-daily.yml','head_branch':'main',
                'head_repository':{'full_name':'fictional/repo'},'created_at':'2026-11-05T03:47:00Z',
                'status':'completed','conclusion':status}

    def test_original_attempt_proof_is_resolved_when_latest_rerun_differs(self):
        import schedule_guard
        api=mock.Mock(repo='fictional/repo');api.call.return_value=self.automatic(1,'success')
        runs=schedule_guard.attempt_history(api,[self.automatic(2)],'1-1')
        self.assertEqual(len(runs),2)
        api.call.assert_called_once_with('/actions/runs/1/attempts/1')
        self.assertEqual(runs[-1]['run_attempt'],1)

    def test_wrong_immutable_attempt_identity_fails_closed(self):
        import schedule_guard
        for change in [{'id':9},{'run_attempt':3},{'path':'other.yml'},{'head_branch':'feature'}]:
            api=mock.Mock(repo='fictional/repo');api.call.return_value=dict(self.automatic(1,'success'),**change)
            with self.subTest(change=change),self.assertRaises(ValueError):
                schedule_guard.attempt_history(api,[self.automatic(2)],'1-1')

    def test_preflight_rerun_does_not_erase_the_original_daily_budget(self):
        import schedule_guard
        first=self.automatic(1,'success');second=self.automatic(2)
        job={'name':'Collect and validate','started_at':'2026-11-05T03:47:20Z','completed_at':'2026-11-05T03:50:00Z',
             'status':'completed','conclusion':'success','steps':[{'name':'Acquire approved official sources','conclusion':'success'}]}
        skipped=dict(job,conclusion='failure',steps=[{'name':'Acquire approved official sources','conclusion':'skipped'}])
        lookup=lambda run,attempt:[job if attempt==1 else skipped]
        at=dt.datetime(2026,11,5,12,tzinfo=dt.timezone.utc)
        result=schedule_guard.decide(at,[second,first],lambda _:[],99,'fictional/repo','1-1',jobs_for_attempt=lookup)
        self.assertFalse(result[0])
        skipped['steps'][0]['conclusion']='failure'
        skipped['started_at']='2026-11-05T04:00:00Z'
        with self.assertRaises(ValueError):
            schedule_guard.decide(at,[second,first],lambda _:[],99,'fictional/repo','1-1',jobs_for_attempt=lookup)

    def test_collect_rerun_is_refused_before_network_or_paid_calls(self):
        import preflight
        with mock.patch.dict(os.environ,{'GITHUB_RUN_ATTEMPT':'2'},clear=True),mock.patch.object(preflight,'GitHub') as api:
            with self.assertRaisesRegex(ValueError,'fresh main dispatch'):preflight.main()
            api.assert_not_called()

    def test_pr_gate_reads_the_original_successful_collection_attempt(self):
        import pr_gate
        api=mock.Mock(repo='fictional/repo');base='a'*40
        def call(path):
            if path=='/pulls/7':return {'head':{'ref':'automation/catalogue-123-1','repo':{'full_name':api.repo},'sha':'b'*40},
                'base':{'sha':base,'ref':'main'},'user':{'login':'publisher'},
                'body':'FundLenz-Run: 123\nFundLenz-Attempt: 1\nFundLenz-Base: '+base}
            if path=='/actions/runs/123':return {'id':123,'path':'.github/workflows/catalogue-daily.yml','head_branch':'main',
                'head_repository':{'full_name':api.repo},'head_sha':base,'event':'workflow_dispatch','run_attempt':2}
            if path=='/actions/runs/123/attempts/1':return {'id':123,'head_sha':base,'run_attempt':1}
            raise AssertionError(path)
        api.call.side_effect=call
        api.all.return_value=[{'name':'Collect and validate','status':'completed','conclusion':'success','run_attempt':1}]
        with tempfile.TemporaryDirectory() as d,mock.patch.dict(os.environ,{'TRUSTED_BASE':base,
            'FUNDLENZ_PUBLISHER_LOGIN':'publisher','GITHUB_OUTPUT':str(Path(d)/'output')},clear=False), \
            mock.patch.object(pr_gate,'write') as write,mock.patch('builtins.print'):
            pr_gate.prepare(api,7)
            self.assertEqual(write.call_args.args[1]['producer_attempt'],1)
            api.all.assert_called_once_with('/actions/runs/123/attempts/1/jobs','jobs')


class RequiredCheckAcknowledgementTests(unittest.TestCase):
    def exercise(self,moved=False):
        import record_check
        api=mock.Mock(repo='fictional/repo');created=[]
        def call(path,method='GET',data=None):
            if path=='/pulls/7':return {'head':{'sha':'changed' if moved else 'head'},'base':{'sha':'base'}}
            if path=='/check-runs':
                created.append(dict(data,id=1,app={'slug':'github-actions'}))
                created[-1]['details_url']='https://github.com/fictional/repo/runs/987'
                raise TimeoutError('fictional lost check acknowledgement')
            raise AssertionError(path)
        api.call.side_effect=call;api.all.side_effect=lambda *_:created
        result=record_check.record_result(api,{'number':7,'head':'head','base':'base','automated':True},'success',123)
        self.assertEqual(len(created),1)
        return result

    def test_lost_required_check_reply_is_observed_without_duplicate_creation(self):
        self.assertEqual(self.exercise()['conclusion'],'success')

    def test_head_race_never_records_a_green_check_for_the_changed_head(self):
        result=self.exercise(moved=True)
        self.assertEqual(result['head_sha'],'head')
        self.assertEqual(result['conclusion'],'failure')


if __name__ == '__main__':
    unittest.main()
