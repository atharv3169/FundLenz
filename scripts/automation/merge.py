"""Merge only the exact head of an independently checked automated data PR."""
import os
from common import ROOT, read, require, write
from github_api import GitHub
from publish import protection_gate, strict_protection


def main():
    policy = read(ROOT / "automation/runtime.json")
    require(policy["publication_enabled"], "Publication remains disabled")
    api = GitHub(os.environ.get("FUNDLENZ_PUBLISH_TOKEN"))
    number = int(os.environ["PR_NUMBER"])
    pr = api.call(f"/pulls/{number}")
    require(pr["user"]["login"] == os.environ.get("FUNDLENZ_PUBLISHER_LOGIN"), "Wrong publisher identity")
    require(pr["head"]["repo"]["full_name"] == api.repo and pr["head"]["ref"].startswith("automation/catalogue-"), "Wrong PR source")
    require(pr["state"] == "open" and not pr["draft"], "PR is not mergeable")
    require(pr["head"]["sha"] == os.environ["VALIDATED_HEAD"], "PR head moved; do not merge")
    protection_gate(api.call("/branches/main"), policy, os.environ["VALIDATED_BASE"])
    strict_protection(api)
    checks = api.all("/commits/" + pr["head"]["sha"] + "/check-runs", "check_runs")
    gate = [c for c in checks if c["name"] == policy["required_check"] and c.get("app", {}).get("slug") == "github-actions"]
    require(gate and max(gate, key=lambda c: c["id"])["conclusion"] == "success", "Required exact-head check has not passed")
    require(pr.get("mergeable_state") == "clean", "Required repository checks/protection are not satisfied")
    result = api.call(f"/pulls/{number}/merge", "PUT", {"sha": pr["head"]["sha"], "merge_method": "squash"})
    require(result.get("merged"), "GitHub declined merge")
    write(ROOT / "work/merge.json", {"pr_number": number, "merge_complete": True, "commit": result["sha"], "deployment_complete": False})
    print("Validated data PR merged; deployment must be confirmed separately.")


if __name__ == "__main__":
    main()
