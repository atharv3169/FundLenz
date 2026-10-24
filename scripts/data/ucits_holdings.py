"""Full iShares European CSV adapter; weights are never normalized or invented.

The file endpoint is bound to a reviewed issuer product ID and ISIN. Unlike the
US format, this CSV does not identify its fund or reporting currency in a header.
It supplies portfolio weights; unlabeled market values are not published.
"""
import csv
import datetime as dt
from decimal import Decimal
import hashlib
import io
import json
import re
from urllib.parse import urlsplit

CLASSES = {"Equity", "Cash", "Money Market", "Fixed Income", "Futures", "FX", "Forwards",
           "Cash Collateral and Margins", "Swaps", "Other Derivatives", "Other", "Alternatives"}


def parse_ucits(raw, download, catalogue):
    assert hashlib.sha256(raw).hexdigest() == download["sha256"], "Source checksum mismatch"
    assert raw.endswith((b"\n\n", b"\r\n\r\n")), "Missing issuer end separator; possible truncation"
    url = urlsplit(download["url"])
    assert url.scheme == "https" and url.hostname == "www.ishares.com" and not url.query, "Unapproved issuer endpoint"
    assert re.fullmatch(r"/uk/individual/en/products/" + re.escape(download["productId"]) + r"/[a-z0-9+%-]+/latest-holdings\.csv", url.path), "Product endpoint identity mismatch"
    fund = catalogue[download["id"]]
    assert download["isin"] in fund["isins"] and fund["provider"] == "iShares" and "Ireland" in fund.get("domiciles", []), "ISIN does not match reviewed catalogue identity"
    assert download["url"] == download["sourcePage"].rstrip("/") + "/latest-holdings.csv", "Source page/endpoint mismatch"
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
    position = next(i for i, row in enumerate(rows) if "Asset Class" in row and "Weight (%)" in row)
    date_row = next(row for row in rows[:position] if row and row[0] == "Fund Holdings as of")
    date = dt.datetime.strptime(date_row[1], "%d/%b/%Y").date().isoformat()
    assert date <= download["checkedAt"][:10], "Future holdings date"
    header = rows[position]
    assert len(header) == len(set(header)), "Duplicate column"
    assert {"Ticker", "Name", "Sector", "Asset Class", "Weight (%)", "Exchange", "Market Currency"} <= set(header), "Incomplete holdings header"
    grouped = {}; count = 0
    for row_number, row in enumerate(rows[position + 1:], position + 2):
        if not row or not any(c.strip() for c in row):
            continue
        assert len(row) == len(header), "Malformed holdings row"
        item = dict(zip(header, row))
        assert item["Asset Class"] in CLASSES, "Unsupported asset class or second table"
        weight = Decimal(item["Weight (%)"].replace(",", ""))
        assert weight.is_finite() and -100 <= weight <= 100, "Invalid weight"
        assert item["Name"].strip(), "Missing security name"
        typ = "equity" if item["Asset Class"] == "Equity" else "cash" if item["Asset Class"] in {"Cash", "Money Market"} else "other"
        assert typ != "equity" or weight >= 0, "Short equity requires a different model"
        if typ == "cash" and weight < 0: typ = "other"
        isin = item.get("ISIN")
        if typ == "equity":
            key = ["ISIN", isin] if isin and re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", isin) else ["ISHARES", item["Ticker"], item["Name"], item["Exchange"], item["Market Currency"]]
            assert key[0] == "ISIN" or all(v not in {"", "-"} for v in [key[1], key[-1]]), "Missing equity identity"
            hid = "GL-EQUITY:" + hashlib.sha256(json.dumps(key, separators=(",", ":")).encode()).hexdigest()[:24]
        else:
            hid = download["id"] + ":row-" + str(row_number)
        holding = dict(id=hid, name=item["Name"], sector=item["Sector"] or "Unknown", type=typ,
                       weight=weight, assetClass=item["Asset Class"], sourceRow=row_number, sourceRows=[row_number],
                       ticker=item["Ticker"], exchange=item["Exchange"], marketCurrency=item["Market Currency"], isin=isin)
        if hid in grouped:
            old = grouped[hid]
            assert (old["name"], old["sector"], old["type"]) == (holding["name"], holding["sector"], holding["type"]), "Conflicting identity"
            old["weight"] += weight; old["sourceRows"].append(row_number)
        else:
            grouped[hid] = holding
        count += 1
    assert grouped, "No holdings"
    total = sum(h["weight"] for h in grouped.values())
    assert abs(total - 100) <= Decimal("0.5"), "Published weights outside 99.5–100.5%; retained without rescaling"
    totals = {typ: float(sum(h["weight"] for h in grouped.values() if h["type"] == typ)) for typ in ["equity", "cash", "other"]}
    for h in grouped.values(): h["weight"] = float(h["weight"])
    note = ("Complete issuer CSV from the exact reviewed product-ID endpoint, linked to its issuer ISIN. Published weights are retained without rescaling. "
            "The source does not explicitly label its reporting currency, so market values are omitted. USD is the currency for your entered holding values only. "
            "The file is a dated holdings disclosure, not proof of current dealing availability. Equity identities use an explicit ISIN when supplied, otherwise the exact issuer ticker/name/exchange/market-currency tuple. "
            "Bonds, derivatives and currency hedges remain in totals but are excluded from equity scenarios; economic overlap can be understated when issuer identifiers differ.")
    portfolio = dict(id=download["id"], portfolioId="ishares:" + download["productId"], name=fund["name"],
                     category=" / ".join(fund["categories"]) or "Issuer portfolio", date=date,
                     source=download["url"], sourcePage=download["sourcePage"], sourceSha256=download["sha256"],
                     scenarioScope="disclosed_equities_only", currency="USD", holdings=list(grouped.values()), note=note,
                     sourceFormat="ishares_ucits_csv", domicile="Ireland", shareClassISIN=download["isin"])
    summary = dict(id=portfolio["id"], name=portfolio["name"], ticker=download.get("ticker") or download["isin"], aliases=[],
                   date=date, currency="USD", holdingCount=len(grouped), equityPct=totals["equity"], cashPct=totals["cash"],
                   otherPct=totals["other"], weightTotalPct=float(total), source=download["url"],
                   sourcePage=download["sourcePage"], sourceSha256=download["sha256"], domicile="Ireland", isin=download["isin"])
    report = dict(id=portfolio["id"], ticker=summary["ticker"], sourceLeafRows=count, publishedRows=len(grouped),
                  aggregatedRows=count-len(grouped), date=date, weightTotalPct=float(total), sha256=download["sha256"])
    return portfolio, summary, report
