"""Build the portfolio-lab bridge from complete, retained issuer disclosures.

No live network calls. Rejects unmatched identity, corrupt input, malformed rows,
non-finite values and rounded weight totals outside 99.5–100.5%. Never rescales.
"""
import collections
import csv
import datetime
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/sources/global/holdings"
OUT = ROOT / "public/data/global"
ALLOWED = {"Equity", "Cash", "Money Market", "Fixed Income", "Futures", "FX", "Forwards", "Cash Collateral and Margins"}

def number(value):
    result = Decimal(value.replace(",", "").strip())
    if not result.is_finite():
        raise ValueError("Non-finite source number")
    return result

def canonical(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())

def parse(download, catalogue):
    raw = (BASE / download["filename"]).read_bytes()
    return parse_bytes(raw, download, catalogue)

def parse_bytes(raw, download, catalogue):
    """Pure adapter shared by the offline builder and isolated daily validator."""
    assert hashlib.sha256(raw).hexdigest() == download["sha256"], "Source checksum mismatch"
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
    position = next(i for i, row in enumerate(rows) if "Asset Class" in row and "Weight (%)" in row)
    assert canonical(rows[0][0]) == canonical(download["name"]), "Source fund name does not match the catalogue"
    date_row = next(row for row in rows[:position] if row and row[0] == "Fund Holdings as of")
    date = datetime.datetime.strptime(date_row[1], "%b %d, %Y").date().isoformat()
    assert date <= download["checkedAt"][:10], "Future source date"
    fund = catalogue[download["id"]]
    assert download["ticker"] in fund["tickers"] and fund["market"] == download["market"], "Unmatched catalogue identity"
    header = rows[position]
    assert len(header) == len(set(header)), "Duplicate source column"
    parsed = []
    for row_number, row in enumerate(rows[position + 1:], position + 2):
        if not row or not any(cell.strip() for cell in row) or len(row) == 1:
            continue  # Blank separator or issuer legal footer, never a holding.
        assert len(row) == len(header), f"Malformed holding row {row_number}"
        item = dict(zip(header, row))
        if not item.get("Asset Class"):
            raise ValueError(f"Missing asset class on row {row_number}")
        assert item["Asset Class"] in ALLOWED, "Unsupported asset class"
        weight, market_value = number(item["Weight (%)"]), number(item["Market Value"])
        assert -100 <= weight <= 100, "Implausible published weight"
        assert item["Name"].strip(), "Unnamed holding"
        assert item.get("Currency") == "USD", "Only USD reporting files are supported"
        typ = "equity" if item["Asset Class"] == "Equity" else "cash" if item["Asset Class"] in {"Cash", "Money Market"} else "other"
        assert typ != "equity" or weight >= 0, "Short equity requires a different analysis model"
        # Use an exact issuer identity tuple, never ticker alone across countries.
        # Distinct names/venues/currencies stay distinct; no ADR or class look-through.
        if typ == "equity":
            identifier = item.get("ISIN")
            key = ["ISIN", identifier] if identifier and re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", identifier) else ["ISHARES", item.get("Ticker", ""), item["Name"], item.get("Exchange", ""), item.get("Market Currency", "")]
            assert key[0] == "ISIN" or key[-1] not in {"", "-"}, "Missing equity currency"
            hid = "GL-EQUITY:" + hashlib.sha256(json.dumps(key, separators=(",", ":")).encode()).hexdigest()[:24]
        else:
            hid = f"{download['id']}:row-{row_number}"
        parsed.append({"id": hid, "name": item["Name"], "sector": item["Sector"] or "Unknown", "type": typ,
                       "weight": weight, "marketValue": market_value, "assetClass": item["Asset Class"],
                       "sourceRow": row_number, "sourceRows": [row_number], "ticker": item.get("Ticker", ""),
                       "exchange": item.get("Exchange", ""), "marketCurrency": item.get("Market Currency", ""),
                       "isin": item.get("ISIN")})
    assert parsed, "No holdings"
    total = sum(h["weight"] for h in parsed)
    assert abs(total - 100) <= Decimal("0.5"), f"Published weights total {total}% (outside 99.5–100.5%); no normalization applied"
    grouped = {}
    for holding in parsed:
        old = grouped.get(holding["id"])
        if old:
            assert (old["name"], old["type"], old["sector"]) == (holding["name"], holding["type"], holding["sector"]), "Identity conflict"
            old["weight"] += holding["weight"]
            old["marketValue"] += holding["marketValue"]
            old["sourceRows"] += holding["sourceRows"]
        else:
            grouped[holding["id"]] = dict(holding)
    holdings = list(grouped.values())
    totals = {kind: float(sum(h["weight"] for h in holdings if h["type"] == kind)) for kind in ["equity", "cash", "other"]}
    for h in holdings:
        h["weight"], h["marketValue"] = float(h["weight"]), float(h["marketValue"])
    asset = "Equity ETF" if totals["equity"] > 50 else "Fixed income / cash ETF"
    note = ("Full issuer holdings file; published two-decimal weights are preserved without renormalization. "
            "Totals within 0.5 percentage points of 100 are accepted as a rounding tolerance, not proof of NAV reconciliation. "
            "Issuer investment-book values may differ from accounting NAV. Exact repeated equity identities are aggregated, with original row numbers retained. "
            "Cross-fund identity matching uses an issuer ISIN when supplied, otherwise the exact ticker, name, exchange and market currency; "
            "different names or listings remain separate and may understate economic overlap. Cash, bonds, collateral and derivatives are retained. "
            "Scenarios model disclosed equities only and exclude bond, derivative and exchange-rate changes.")
    portfolio = {"id": download["id"], "portfolioId": "ishares:" + re.search(r"/products/(\d+)/", download["sourcePage"])[1],
                 "name": download["name"] + " (" + download["ticker"] + ")", "category": asset, "date": date,
                 "source": download["url"], "sourcePage": download["sourcePage"], "sourceSha256": download["sha256"],
                 "scenarioScope": "disclosed_equities_only", "currency": "USD", "holdings": holdings, "note": note}
    summary = {"id": portfolio["id"], "name": portfolio["name"], "ticker": download["ticker"],
               "aliases": ["us-" + download["ticker"]] if download["ticker"] in {"IVV", "IWB", "IWF"} else [],
               "date": date, "currency": "USD", "holdingCount": len(holdings), "equityPct": totals["equity"],
               "cashPct": totals["cash"], "otherPct": totals["other"], "weightTotalPct": float(total),
               "source": download["url"], "sourcePage": download["sourcePage"], "sourceSha256": download["sha256"]}
    report = {"id": portfolio["id"], "ticker": download["ticker"], "sourceLeafRows": len(parsed), "publishedRows": len(holdings),
              "aggregatedRows": len(parsed) - len(holdings), "date": date, "weightTotalPct": float(total), "sha256": download["sha256"]}
    return portfolio, summary, report

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")

def main():
    downloads = json.loads((BASE / "downloads.json").read_text())
    catalogue = {f["id"]: f for f in json.loads((OUT / "catalog.json").read_text())["funds"]}
    summaries, reports, rejected, portfolios = {}, [], [], []
    identities = {}
    for download in downloads:
        try:
            assert download["status"] == "downloaded", download.get("reason", "Source unavailable")
            portfolio, summary, report = parse(download, catalogue)
            candidate_identities = {}
            for h in portfolio["holdings"]:
                if h["type"] == "equity":
                    identity = (h["name"], h["sector"])
                    assert h["id"] not in identities or identities[h["id"]] == identity, "Cross-fund classification conflict"
                    candidate_identities[h["id"]] = identity
            identities.update(candidate_identities)
            portfolios.append(portfolio); summaries[portfolio["id"]] = summary; reports.append(report)
        except (AssertionError, ValueError, StopIteration, KeyError) as error:
            rejected.append({"id": download["id"], "ticker": download["ticker"], "reason": str(error) or "Source format validation failed"})
    assert len(portfolios) >= 3, "Insufficient verified portfolios; keep last published files"
    index = {"schemaVersion": 1, "checkedAt": max(d["checkedAt"] for d in downloads),
             "note": "USD holding values only. Published issuer weights are dated snapshots; no prices or currency conversion are inferred.", "portfolios": summaries}
    for portfolio in portfolios:
        write(OUT / "holdings" / (portfolio["id"] + ".json"), portfolio)
    for path in (OUT / "holdings").glob("g-*.json"):
        if path.stem not in summaries:
            path.unlink()
    write(OUT / "holdings-index.json", index)
    validation = {"schemaVersion": 1, "checkedAt": index["checkedAt"], "accepted": reports, "rejected": rejected,
                  "weightTolerancePercentagePoints": 0.5, "normalizationApplied": False,
                  "issuerDirectorySource": "https://www.ishares.com/us/products/etf-investments",
                  "issuerDirectorySha256": hashlib.sha256((BASE / "ishares-us-products.html").read_bytes()).hexdigest()}
    write(BASE / "validation.json", validation)
    write(OUT / "holdings-coverage.json", validation)
    print(json.dumps({"accepted": len(portfolios), "holdings": sum(len(p["holdings"]) for p in portfolios), "rejected": rejected}, indent=2))

if __name__ == "__main__":
    main()
