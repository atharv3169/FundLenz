"""Read-only stale-checkout check before source requests and before paid review."""
import os
import re
from common import ROOT, require, write
from github_api import GitHub


def verify_main_base(api, expected):
    require(re.fullmatch(r"[0-9a-f]{40}", expected), "Invalid collector base")
    require(api.call('/branches/main')['commit']['sha'] == expected,
            "Queued collector base is stale; use a fresh main dispatch before spending request/model budget")


def main():
    require(os.environ.get('GITHUB_RUN_ATTEMPT', '1') == '1',
            'Collection reruns require a fresh main dispatch; preserve the original artifact and model budget')
    expected = os.environ['GITHUB_SHA']
    stage = os.environ['FUNDLENZ_PREFLIGHT_STAGE']
    require(stage in {'before_sources', 'before_model'}, 'Invalid preflight stage')
    verify_main_base(GitHub(), expected)
    write(ROOT / 'work' / (stage + '.json'), {'stage': stage, 'base_commit': expected, 'status': 'passed'})
    print('Protected source base is current: ' + stage)


if __name__ == '__main__':
    main()
