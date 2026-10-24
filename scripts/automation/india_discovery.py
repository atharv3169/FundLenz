"""Conservative AMFI catalogue growth from the complete official feed."""
import copy
import datetime as dt
import hashlib
import re


def valid_isin(value):
    if not value or not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", value):
        return False
    digits = "".join(str(ord(c) - 55) if c.isalpha() else c for c in value)
    total = 0
    for i, c in enumerate(reversed(digits)):
        n = int(c) * (2 if i % 2 else 1)
        total += n // 10 + n % 10
    return total % 10 == 0


def new_plan_candidates(catalogue, rows, source, decision):
    known = {p["code"] for f in catalogue["funds"] for p in f["plans"]}
    groups = {(f["amc"], f["name"]): f for f in catalogue["funds"]}
    houses = {h["name"]: h for h in catalogue.get("houses", [])}
    isin_owners = {}
    for f in catalogue["funds"]:
        for p in f["plans"]:
            for isin in (p.get("isin"), p.get("reinvestmentIsin")):
                if isin:
                    isin_owners.setdefault(isin, set()).add((f["amc"], f["name"]))
    # Also detect collisions within the newly downloaded feed.
    for row in rows.values():
        for isin in (row.get("isin"), row.get("reinvestmentIsin")):
            if isin:
                isin_owners.setdefault(isin, set()).add((row["amc"], row["name"]))
    results = []
    checked = dt.date.fromisoformat(source["checked_at"][:10])
    for code in sorted(rows.keys() - known):
        row = rows[code]; proposed = None; date = None
        try:
            from decimal import Decimal
            key = (row["amc"], row["name"])
            house = houses.get(row["amc"])
            if not house:
                raise ValueError("New AMC requires a reviewed official-directory entry")
            ids = [v for v in [row["isin"], row["reinvestmentIsin"]] if v]
            if not ids or not all(valid_isin(i) and isin_owners[i] == {key} for i in ids):
                raise ValueError("Missing, invalid or conflicting ISIN identity")
            date = dt.datetime.strptime(row["raw_date"], "%d-%b-%Y").date().isoformat()
            age = (checked - dt.date.fromisoformat(date)).days
            value = Decimal(row["raw_nav"])
            if not 0 <= age <= 14 or not value.is_finite() or not 0 < value < Decimal("1e12"):
                raise ValueError("New plan needs a recent positive finite source NAV")
            if not row["name"] or not row["category"] or not row["structure"]:
                raise ValueError("Missing scheme context")
            fund = groups.get(key)
            fid = fund["id"] if fund else "f-" + hashlib.sha256((row["amc"] + "|" + row["name"]).encode()).hexdigest()[:16]
            if any(f["id"] == fid and (f["amc"], f["name"]) != key for f in catalogue["funds"]):
                raise ValueError("Fund identifier collision")
            plan = {k: row[k] for k in ["code", "plan", "option", "isin", "reinvestmentIsin"]}
            plan.update(nav=float(value), navDate=date,
                        navProvenance={"url": source["source_url"], "sha256": source["source_sha256"],
                                       "checkedAt": source["checked_at"], "locator": "AMFI line " + str(row["line"]), "currency": "INR"})
            proposed = {"fundId": fid, "name": row["name"], "amc": row["amc"], "amcId": house["id"],
                        "category": row["category"], "structure": row["structure"], "plan": plan}
            outcome, reason = "accepted", "New exact AMFI code, known AMC, unambiguous checksum-valid ISIN and recent positive NAV. Holdings are not inferred."
        except (ValueError, ArithmeticError) as error:
            outcome, reason = "blocked", str(error)
        results.append(decision("new_plan:" + code, source, None, proposed, date, None, outcome, reason,
                                "AMFI line " + str(row["line"]) + "; scheme code " + code))
    return results


def append_plans(catalogue, units):
    by_id = {f["id"]: f for f in catalogue["funds"]}
    houses = {h["id"]: h for h in catalogue.get("houses", [])}
    for unit in units:
        p = unit["proposed_value"]; fid = p["fundId"]
        if fid not in by_id:
            house = houses[p["amcId"]]
            fund = {"id": fid, "name": p["name"], "amc": p["amc"], "amcId": p["amcId"],
                    "category": p["category"], "categories": [p["category"]], "structure": p["structure"],
                    "assetClass": p["category"].split(" - ", 1)[0], "plans": [], "portfolioId": None,
                    "links": {"website": house.get("website"), "portfolio": house.get("portfolio"), "factsheet": house.get("factsheet")}}
            catalogue["funds"].append(fund); by_id[fid] = fund
        by_id[fid]["plans"].append(copy.deepcopy(p["plan"]))
    catalogue["funds"].sort(key=lambda f: f["name"].lower())
    catalogue["stats"].update(fundRecords=len(by_id), planRecords=sum(len(f["plans"]) for f in by_id.values()),
                               fundHouses=len({f["amc"] for f in by_id.values()}))
