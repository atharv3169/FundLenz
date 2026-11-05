"""Attach a trusted result to the exact PR head; reconcile lost check replies."""
import os
from common import ROOT, read
from github_api import GitHub
from publish import reconcile_write


def record_result(api, state, job_status, run_id):
    pr = api.call(f"/pulls/{state['number']}")
    success = (job_status == 'success' and pr['head']['sha'] == state['head']
               and pr['base']['sha'] == state['base'])
    request = {'name': 'FundLenz data gate', 'head_sha': state['head'], 'status': 'completed',
               'conclusion': 'success' if success else 'failure',
               'details_url': f'https://github.com/{api.repo}/actions/runs/{run_id}',
               'output': {'title': 'Source replay and data-only diff' if state.get('automated') else 'Ordinary reviewed-code route',
                          'summary': 'Trusted base code validates the exact candidate head. Automated data requires source replay and finance regression checks. Code changes use release integrity and normal review.'}}

    # GitHub canonicalises details_url to its check-run URL. It is display
    # metadata, not authority; exact head/app/result remain mandatory.
    def matches(check):
        return (isinstance(check, dict) and check.get('app', {}).get('slug') == 'github-actions'
                and all(check.get(k) == request[k] for k in ('name','head_sha','status','conclusion')))

    def observe():
        checks = api.all('/commits/' + state['head'] + '/check-runs', 'check_runs')
        exact = [check for check in checks if matches(check)]
        return max(exact, key=lambda check: check['id']) if exact else None

    return reconcile_write(lambda: api.call('/check-runs', 'POST', request), observe, matches)


def main():
    record_result(GitHub(), read(ROOT / 'work/pr.json'), os.environ.get('GATE_JOB_STATUS'), os.environ['GITHUB_RUN_ID'])


if __name__ == '__main__':
    main()
