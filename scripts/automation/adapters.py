"""Trusted financial adapters. Each decision carries actual old/new values.

The model never supplies production numbers to these adapters. Unsupported
fields, new identities and lifecycle changes stay blocked for adapter review.
"""
import copy
import datetime as dt
import importlib.util
import math
import re
from decimal import Decimal
from common import ROOT, encoded, read, require, sha

spec = importlib.util.spec_from_file_location("global_builder", ROOT / "scripts/data/build_global_holdings.py")
global_builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(global_builder)


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def chronology(old_date, new_date, old_value, new_value):
    dt.date.fromisoformat(new_date)
    if old_date and new_date < old_date:
        return "older_snapshot"
    if new_date == old_date:
        return "unchanged" if old_value == new_value else "same_date_conflict"
    return "accepted"


def decision(unit, source, old, new, date, previous_date, outcome, reason, locator):
    return {"unit": unit, "source_id": source["source_id"], "source_url": source["source_url"],
            "source_sha256": source["source_sha256"], "checked_at": source["checked_at"],
            "snapshot_date": date, "previous_snapshot_date": previous_date,
            "previous_verified": old, "proposed_value": new, "decision": outcome,
            "reason": reason, "locator": locator, "producer": "trusted_source_adapter"}


def parse_nav(raw):
    text = raw.decode("utf-8-sig")
    require("Scheme Code;" in text and "Scheme Name" in text, "Unrecognized AMFI header")
    rows, amc, category = {}, "", ""
    for line_number, original in enumerate(text.splitlines(), 1):
        line = clean(original)
        if not line:
            continue
        if re.match(r"^\d+;", line):
            cells = [clean(c) for c in line.split(";")]
            require(len(cells) == 8 and amc and category, "Incomplete AMFI row/context")
            code, isin, reinvest, name, plan, option, value, date = cells
            require(code not in rows, "Duplicate AMFI code")
            rows[code] = {"code": code, "isin": None if isin == "-" else isin,
                          "reinvestmentIsin": None if reinvest == "-" else reinvest,
                          "name": name, "amc": amc, "plan": plan or "Not specified in source",
                          "option": option or "Not specified in source", "raw_nav": value,
                          "raw_date": date, "line": line_number}
        elif re.search(r"^(?:Open Ended|Close Ended|Closed Ended|Interval).*\(", line):
            category = line
        elif ";" not in line:
            amc = line
    require(rows, "Empty AMFI feed")
    return rows


def nav_candidates(catalogue, raw, source, policy):
    rows = parse_nav(raw)
    known = {p["code"]: (f, p) for f in catalogue["funds"] for p in f["plans"]}
    require(len(rows.keys() & known.keys()) >= len(known) * 0.5, "AMFI coverage collapse; retain entire feed")
    decisions = []
    for code, (fund, plan) in known.items():
        row = rows.get(code)
        old = {"nav": plan["nav"], "navDate": plan["navDate"]}
        if row is None:
            decisions.append(decision("nav:" + code, source, old, None, None, plan["navDate"],
                                      "blocked", "Source omits existing plan; no deletion inferred.", "AMFI scheme code " + code))
            continue
        proposed, date, outcome, reason = None, None, "blocked", ""
        try:
            require(all(row[k] == plan[k] for k in ["isin", "reinvestmentIsin", "plan", "option"])
                    and row["name"] == fund["name"] and row["amc"] == fund["amc"], "Exact scheme identity changed")
            numeric = Decimal(row["raw_nav"])
            require(numeric.is_finite() and numeric >= 0, "NAV must be finite and nonnegative")
            date = dt.datetime.strptime(row["raw_date"], "%d-%b-%Y").date().isoformat()
            require(date <= source["checked_at"][:10], "Future NAV date")
            proposed = {"nav": float(numeric), "navDate": date}
            require(math.isfinite(proposed["nav"]), "NAV outside finite float range")
            outcome = chronology(plan["navDate"], date, old["nav"], proposed["nav"])
            if outcome == "accepted":
                require(numeric > 0, "A new NAV must be positive; retain previous value")
                require(row["isin"] or row["reinvestmentIsin"], "No persistent ISIN for automatic identity verification")
            if outcome == "unchanged" and numeric == 0:
                outcome = "retained_unsupported"
            if outcome == "accepted" and plan["nav"] and plan["nav"] > 0:
                require(abs(proposed["nav"] / plan["nav"] - 1) <= policy["nav_max_relative_change"],
                        "NAV change exceeds review threshold; this is a warning, not evidence of error")
            reason = {"accepted": "Exact identity, source row, positive NAV and newer field date verified.",
                      "unchanged": "Same source date and NAV.", "older_snapshot": "Retained newer verified NAV.",
                      "retained_unsupported": "Historical zero NAV retained byte-for-byte; not a newly accepted positive valuation.",
                      "same_date_conflict": "Same date differs from retained value; independent review required."}[outcome]
        except (ValueError, ArithmeticError) as error:
            outcome, reason = "blocked", str(error)
        decisions.append(decision("nav:" + code, source, old, proposed, date, plan["navDate"], outcome, reason,
                                  "AMFI line " + str(row["line"]) + "; scheme code " + code))
    new_codes = sorted(rows.keys() - known.keys())
    if new_codes:
        decisions.append(decision("nav:new-identities", source, None, new_codes, None, None, "blocked",
                                  "New identities require a reviewed catalogue adapter; no automatic creation.", "AMFI scheme codes"))
    return decisions


def holdings_candidate(old, catalogue, download, raw, source, policy):
    require(raw.endswith((b"\n\n", b"\r\n\r\n")), "Issuer CSV end-of-file separator absent; possible truncation")
    desc = dict(download, sha256=source["source_sha256"], checkedAt=source["checked_at"], bytes=len(raw), status="downloaded")
    portfolio, summary, report = global_builder.parse_bytes(raw, desc, catalogue)
    require(len(portfolio["holdings"]) >= len(old["holdings"]) * policy["holdings_min_row_ratio"],
            "Holding-row count fell by over half; source completeness needs review")
    outcome = chronology(old["date"], portfolio["date"], old["holdings"], portfolio["holdings"])
    change = decision("holdings:" + old["id"], source, old, portfolio, portfolio["date"], old["date"], outcome,
                      "Complete issuer snapshot, exact fund identity, reporting currency and unscaled weights checked.",
                      "Full CSV leaf rows; sourceRow/sourceRows in each position")
    return change, summary, report, desc


def reconcile(root, acquisition, policy, raw_sources):
    """Produce source-derived units; no file writes or model decisions here."""
    india = read(root / "public/data/catalog.json")
    catalogue = {f["id"]: f for f in read(root / "public/data/global/catalog.json")["funds"]}
    downloads = read(root / "data/sources/global/holdings/downloads.json")
    by_url = {d["url"]: d for d in downloads if d["status"] == "downloaded"}
    registry = {s["id"]: s for s in read(ROOT / "automation/source-registry.json")["sources"]}
    units, extras = [], {}
    for source in acquisition["source_checks"]:
        if source["source_id"] not in raw_sources or source["adapter"] == "monitor":
            continue
        raw = raw_sources[source["source_id"]]
        try:
            if source["adapter"] == "amfi_nav":
                units.extend(nav_candidates(india, raw, source, policy))
            elif source["adapter"] == "ishares_holdings":
                download = by_url[source["source_url"]]
                old = read(root / "public/data/global/holdings" / (download["id"] + ".json"))
                change, summary, report, desc = holdings_candidate(old, catalogue, download, raw, source, policy)
                units.append(change)
                extras[change["unit"]] = (summary, report, desc)
            else:
                raise ValueError("Unsupported adapter")
        except (ValueError, AssertionError, KeyError, StopIteration, UnicodeError, ArithmeticError) as error:
            units.append(decision("source:" + source["source_id"], source, None, None, None, None,
                                  "blocked", "Adapter rejected input: " + str(error)[:500], "complete source"))
    # Require stable classifications across all resulting portfolios. A conflicting
    # candidate is held whole; no individual row is silently removed or rewritten.
    old_identities = {}
    for path in sorted((root / "public/data/global/holdings").glob("*.json")):
        for h in read(path)["holdings"]:
            if h["type"] == "equity":
                key = (h["name"], h["sector"])
                require(h["id"] not in old_identities or old_identities[h["id"]] == key, "Base identity conflict")
                old_identities[h["id"]] = key
    for unit in units:
        if unit["decision"] == "accepted" and unit["unit"].startswith("holdings:"):
            for h in unit["proposed_value"]["holdings"]:
                if h["type"] == "equity" and h["id"] in old_identities and old_identities[h["id"]] != (h["name"], h["sector"]):
                    unit.update(decision="blocked", reason="Cross-fund identity/classification change requires joint review.")
                    break
            if unit["decision"] == "accepted":
                old_identities.update({h["id"]: (h["name"], h["sector"]) for h in unit["proposed_value"]["holdings"] if h["type"] == "equity"})
    return units, extras


def build_files(root, units, extras, raw_sources, acquisition):
    """Rebuild only explicit adapter-owned paths from independently accepted units."""
    files = {}
    accepted = [u for u in units if u["decision"] == "accepted"]
    nav = {u["unit"][4:]: u for u in accepted if u["unit"].startswith("nav:")}
    if nav:
        catalog = read(root / "public/data/catalog.json")
        for fund in catalog["funds"]:
            for plan in fund["plans"]:
                if plan["code"] in nav:
                    u = nav[plan["code"]]
                    plan.update(u["proposed_value"])
                    plan["navProvenance"] = {"url": u["source_url"], "sha256": u["source_sha256"],
                                             "checkedAt": u["checked_at"], "locator": u["locator"], "currency": "INR"}
            fund["navDate"] = max((p["navDate"] for p in fund["plans"] if p["navDate"]), default=None)
        latest = max(f["navDate"] or "" for f in catalog["funds"])
        catalog["stats"].update(latestNavDate=latest, plansAtLatestDate=sum(p["navDate"] == latest for f in catalog["funds"] for p in f["plans"]))
        # Existing sourceSha256/retrievedAt still describe the original directory
        # import. Individual NAV tuples have their own actual source provenance.
        files["public/data/catalog.json"] = encoded(catalog)
        u = next(iter(nav.values()))
        files["data/sources/automation/amfi-nav.txt"] = raw_sources[u["source_id"]]
    holdings = [u for u in accepted if u["unit"].startswith("holdings:")]
    if holdings:
        index = read(root / "public/data/global/holdings-index.json")
        coverage = read(root / "public/data/global/holdings-coverage.json")
        downloads = read(root / "data/sources/global/holdings/downloads.json")
        for u in holdings:
            p = u["proposed_value"]
            summary, report, desc = extras[u["unit"]]
            files["public/data/global/holdings/" + p["id"] + ".json"] = encoded(p)
            files["data/sources/global/holdings/" + desc["filename"]] = raw_sources[u["source_id"]]
            index["portfolios"][p["id"]] = summary
            coverage["accepted"] = [report if r["id"] == p["id"] else r for r in coverage["accepted"]]
            downloads = [desc if d["id"] == p["id"] else d for d in downloads]
        index["checkedAt"] = acquisition["completed_at"]
        index["note"] = "Per-fund dates and source hashes identify retained or newly verified complete snapshots; this is a partial source check."
        coverage["checkedAt"] = acquisition["completed_at"]
        for path, value in [("public/data/global/holdings-index.json", index), ("public/data/global/holdings-coverage.json", coverage),
                            ("data/sources/global/holdings/downloads.json", downloads)]:
            files[path] = encoded(value)
    return {p: raw for p, raw in files.items() if not (root / p).exists() or (root / p).read_bytes() != raw}


def allowed_paths(root=ROOT):
    downloads = read(root / "data/sources/global/holdings/downloads.json")
    paths = {"public/data/catalog.json", "public/data/global/holdings-index.json", "public/data/global/holdings-coverage.json",
             "data/sources/global/holdings/downloads.json", "data/sources/automation/amfi-nav.txt", "audit/latest.json",
             "audit/open-issues.json", "audit/automation-state.json", "public/automation-audit/latest.json", "public/automation-audit/release.json",
             "public/build-info.json"}
    for d in downloads:
        if d["status"] == "downloaded":
            require(re.fullmatch(r"[A-Z0-9_-]+\.csv", d["filename"]), "Unsafe source filename")
            paths.add("data/sources/global/holdings/" + d["filename"])
            paths.add("public/data/global/holdings/" + d["id"] + ".json")
    return paths
