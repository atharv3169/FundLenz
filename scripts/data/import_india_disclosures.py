"""Replay downloaded official workbooks, retaining every last verified portfolio.

Source dates and hashes are required. Matching is exact within the AMC, with
explicit aliases only. A failed or missing sheet never removes old holdings.
"""
import argparse
import collections
import hashlib
import io
import json
from pathlib import Path
import re

import pandas as pd
from parse_portfolios import parse_sheet, statement_blocks, workbooks, norm

ROOT = Path(__file__).resolve().parents[2]


def names(value):
    # AMFI itself reports some renamed schemes with an explicit former name.
    result = {norm(value), norm(value.split("(", 1)[0])}
    for previous in re.findall(r"\((?:erstwhile|formerly(?: known as)?)\s+([^)]*)\)", value, re.I):
        result.add(norm(previous.strip(' -:"')))
    return result


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def import_disclosures(directory, root=ROOT, reparse=False):
    manifest = json.loads((directory / "download-manifest.json").read_text())
    catalog = json.loads((root / "public/data/catalog.json").read_text())
    aliases = json.loads((root / "data/sources/fund-aliases.json").read_text())
    funds = catalog["funds"]
    retained = {f["id"]: json.loads((root / "public/data/holdings" / (f["id"] + ".json")).read_text())
                for f in funds if f["portfolioId"]}
    candidates = collections.defaultdict(list); audit = []; seen = set()
    for source in manifest:
        if source.get("status") != "downloaded" or source["sha256"] in seen:
            continue
        seen.add(source["sha256"])
        path = directory / "downloads" / source["file"]
        if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("Source checksum mismatch: " + source["file"])
        for member, raw in workbooks(path):
            try:
                book = pd.ExcelFile(io.BytesIO(raw))
                for sheet in book.sheet_names:
                    if re.search(r"^index$|^content", sheet, re.I):
                        continue
                    blocks = statement_blocks(pd.read_excel(book, sheet_name=sheet, header=None), {**source, "archiveMember": member})
                    for block, block_source in blocks:
                        try:
                            portfolio, reason = parse_sheet(block, sheet, block_source)
                            if not portfolio:
                                raise ValueError(reason)
                            title = portfolio["statementTitle"]
                            alias = aliases.get(source["amc"] + "|" + title)
                            matches = [f for f in funds if f["amc"] == source["amc"] and
                                       (norm(title) in names(f["name"]) or (alias and alias == f["name"]))]
                            if len(matches) != 1:
                                raise ValueError("No unique exact AMC/scheme match: " + title)
                            fund = matches[0]
                            portfolio.update(id=fund["id"], portfolioId=fund["id"], name=fund["name"],
                                             category=fund["category"], scenarioScope="disclosed_equities_only")
                            candidates[fund["id"]].append(portfolio)
                            audit.append(dict(file=source["file"], sheet=sheet, id=fund["id"], date=portfolio["date"], status="parsed"))
                        except (ValueError, KeyError, AssertionError) as error:
                            audit.append(dict(file=source["file"], sheet=sheet, status="retained", reason=str(error)))
            except (ValueError, KeyError, OSError) as error:
                audit.append(dict(file=source["file"], member=member, status="retained", reason=str(error)))
    accepted = []
    for fid, values in candidates.items():
        latest = max(p["date"] for p in values)
        newest = [p for p in values if p["date"] == latest]
        signatures = {json.dumps([(h["id"], h["type"], h["marketValueINR"]) for h in p["holdings"]]) for p in newest}
        if len(signatures) != 1:
            audit.append(dict(id=fid, status="retained", reason="Conflicting complete statements for one date")); continue
        if fid in retained and latest <= retained[fid]["date"]:
            old = retained[fid]
            keys = ["id", "type", "weight", "marketValueINR", "quantity", "sourceRow"]
            same_financial = old["date"] == latest and old["sourceSha256"] == newest[0]["sourceSha256"] and old["aumINR"] == newest[0]["aumINR"] and [[h[k] for k in keys] for h in old["holdings"]] == [[h[k] for k in keys] for h in newest[0]["holdings"]]
            if not (reparse and same_financial):
                continue
        retained[fid] = newest[0]; accepted.append(fid)
    # Preserve existing canonical labels and original names. New source labels
    # cannot fragment stock identities or change older portfolios silently.
    identities = {}
    for fid, portfolio in retained.items():
        if fid in accepted:
            continue
        for h in portfolio["holdings"]:
            if h["type"] == "equity": identities.setdefault(h["id"], (h["name"], h["sector"]))
    for fid in sorted(accepted):
        portfolio = retained[fid]
        for h in portfolio["holdings"]:
            if h["type"] == "equity":
                h["name"], h["sector"] = identities.setdefault(h["id"], (h["name"], h["sector"]))
        portfolio["holdingCount"] = len(portfolio["holdings"])
        for typ in ["equity", "cash", "other"]:
            portfolio[typ + "Pct"] = sum(h["weight"] for h in portfolio["holdings"] if h["type"] == typ)
        write(root / "public/data/holdings" / (fid + ".json"), portfolio)
    for fund in funds:
        if fund["id"] in retained:
            p = retained[fund["id"]]; fund["portfolioId"] = p["id"]
            fund["portfolioSummary"] = {k: p[k] for k in ["date", "aumINR", "equityPct", "cashPct", "otherPct", "holdingCount", "derivatives", "description", "benchmark"]}
    dates = sorted({p["date"] for p in retained.values()})
    catalog["stats"].update(holdingsFunds=len(retained), holdingsFundHouses=len({p["amc"] for p in retained.values()}),
                            holdingsDate=dates[-1], holdingsOldestDate=dates[0], holdingsDates=dates)
    write(root / "public/data/catalog.json", catalog)
    report = dict(accepted=len(accepted), total=len(retained), dates=dates,
                  byAMC=dict(collections.Counter(p["amc"] for p in retained.values())), sheets=audit)
    write(root / "data/sources/india-disclosures/import-report.json", report)
    print(json.dumps({k: v for k, v in report.items() if k != "sheets"}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("directory", type=Path); parser.add_argument("--reparse", action="store_true")
    args=parser.parse_args(); import_disclosures(args.directory, reparse=args.reparse)
