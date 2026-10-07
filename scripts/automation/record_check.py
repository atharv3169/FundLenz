"""Attach a trusted pull_request_target result to the exact PR head."""
import os
from common import ROOT, read, require
from github_api import GitHub

api = GitHub()
state = read(ROOT / "work/pr.json")
pr = api.call(f"/pulls/{state['number']}")
success = os.environ.get("GATE_JOB_STATUS") == "success" and pr["head"]["sha"] == state["head"] and pr["base"]["sha"] == state["base"]
api.call("/check-runs", "POST", {"name": "FundLenz data gate", "head_sha": state["head"], "status": "completed",
         "conclusion": "success" if success else "failure",
         "details_url": f"https://github.com/{api.repo}/actions/runs/{os.environ['GITHUB_RUN_ID']}",
         "output": {"title": "Source replay and data-only diff" if state.get("automated") else "Ordinary reviewed-code route",
                    "summary": "Trusted base code validates the exact candidate head. Automated data requires source replay and finance regression checks. Code changes use release integrity and normal review."}})
