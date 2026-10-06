#!/usr/bin/env python3
"""Normalize downloaded public SEC/Nasdaq files using only Python's stdlib.

Run: python normalize_us_funds.py [--input-dir DIR] [--output-dir DIR]
No requests are made. Input SHA-256 values are verified against the download
metadata. The same inputs and script produce byte-identical output files.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path


SOURCE_IDS = {
    "sec-series-classes-2026.csv": "sec-series-classes-june-2026",
    "sec-mutualfund-tickers.json": "sec-mutualfund-tickers",
    "nasdaqlisted.txt": "nasdaq-listed",
    "otherlisted.txt": "nasdaq-other-listed",
    "sec-directory-page.html": "sec-series-documentation",
    "nasdaq-definitions.html": "nasdaq-symbol-definitions",
    "mfundslist.txt": "nasdaq-mfunds-unavailable",
}
EXCHANGES = {
    "A": "NYSE American", "N": "NYSE", "P": "NYSE Arca",
    "Z": "Cboe BZX", "V": "IEX", "Q": "Nasdaq",
}
DIRECTORY_STATUS = "registered_directory_record_current_operation_unverified"
STRUCTURE_RULES = {
    "mixed_etf_and_mutual_fund_classes":
        "At least one class has a confirmed Nasdaq ETF listing through the "
        "current SEC ticker feed, and a different class has a five-character "
        "ticker ending X. Mutual-fund class type is inferred from that symbol "
        "convention, not a fresh prospectus review.",
    "listed_etf_with_other_unclassified_classes":
        "At least one class has a confirmed ETF listing; other registered "
        "classes have no confirmed ETF listing and no mutual-fund ticker evidence.",
    "listed_etf_classes_only_in_directory":
        "Every class present in the June SEC directory has a confirmed ETF "
        "listing. This does not establish the absence of later share classes.",
    "mutual_fund_classes_inferred":
        "No confirmed ETF listing is joined; at least one five-character "
        "ticker ending X indicates a mutual-fund share class.",
    "open_end_series_type_unverified":
        "SEC organization type 30 is established; current trading format is "
        "not established by these sources.",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input-dir", type=Path, default=Path(__file__).resolve().parent)
    ap.add_argument("--output-dir", type=Path)
    args = ap.parse_args()
    base = args.input_dir.resolve()
    out = (args.output_dir or base).resolve()
    out.mkdir(parents=True, exist_ok=True)

    source_metadata = json.loads((base / "download-sources.json").read_text())
    source_metadata.append(json.loads((base / "sec-series-source.json").read_text()))
    sources = {}
    for meta in source_metadata:
        filename = meta["path"]
        path = base / filename
        actual_hash = sha256(path)
        if actual_hash != meta["sha256"]:
            raise ValueError(f"Source checksum mismatch: {filename}")
        if path.stat().st_size != meta["bytes"]:
            raise ValueError(f"Source size mismatch: {filename}")
        source_id = SOURCE_IDS[filename]
        source = {"id": source_id, "url": meta["url"], "path": filename,
                  "retrievedAt": meta["retrievedAt"], "sha256": actual_hash,
                  "bytes": meta["bytes"], "lastModified": meta.get("lastModified"),
                  "sourceDate": meta.get("sourceDate"),
                  "sourceDateBasis": "SEC page states Updated 6/1/26" if meta.get("sourceDate") else None,
                  "usedForRecords": filename in {
                      "sec-series-classes-2026.csv", "sec-mutualfund-tickers.json",
                      "nasdaqlisted.txt", "otherlisted.txt"}}
        if filename == "sec-mutualfund-tickers.json" and source["lastModified"]:
            source["sourceDate"] = parsedate_to_datetime(source["lastModified"]).date().isoformat()
            source["sourceDateBasis"] = "HTTP Last-Modified; not a per-record effective date"
        if filename == "mfundslist.txt":
            title = re.search(r"<title>(.*?)</title>", path.read_text(), re.S | re.I)
            source["excludedReason"] = (
                "Downloaded response is HTML titled " + (title.group(1).strip() if title else "unknown")
                + "; it is not a mutual-fund symbol directory and contributes no records."
            )
        sources[source_id] = source

    sec_source = sources["sec-series-classes-june-2026"]
    ticker_source = sources["sec-mutualfund-tickers"]
    with (base / sec_source["path"]).open(encoding="utf-8-sig", newline="") as handle:
        raw_sec = list(csv.DictReader(handle))
    org_counts = Counter(row["Entity Org Type"].strip() for row in raw_sec)
    series_by_id = {}
    classes_by_id = {}
    csv_ticker_classes = defaultdict(set)
    duplicate_class_rows = 0
    for row_number, row in enumerate(raw_sec, 2):
        if row["Entity Org Type"].strip() != "30":
            continue
        row = {key: (value or "").strip() for key, value in row.items()}
        sid, cid, cik = row["Series ID"], row["Class ID"], row["CIK Number"].zfill(10)
        if not re.fullmatch(r"S\d{9}", sid) or not re.fullmatch(r"C\d{9}", cid):
            raise ValueError(f"Invalid SEC identifier on CSV row {row_number}")
        registrant = {"cik": cik, "name": row["Entity Name"],
                      "reportingFileNumbers": [row["Reporting File Number"]]}
        if sid not in series_by_id:
            series_by_id[sid] = {
                "id": f"US-SEC-{sid}", "seriesId": sid, "name": row["Series Name"],
                "market": "US", "entityOrgType": "30", "registrant": registrant,
                "manager": None, "status": DIRECTORY_STATUS,
                "sourceId": sec_source["id"], "sourceUrl": sec_source["url"],
                "sourceDate": sec_source["sourceDate"], "classes": [],
            }
        series = series_by_id[sid]
        if (series["name"], series["registrant"]["cik"], series["registrant"]["name"]) != (
                row["Series Name"], cik, row["Entity Name"]):
            raise ValueError(f"Conflicting SEC series identity for {sid}")
        if row["Reporting File Number"] not in series["registrant"]["reportingFileNumbers"]:
            series["registrant"]["reportingFileNumbers"].append(row["Reporting File Number"])
        if cid in classes_by_id:
            if classes_by_id[cid]["seriesId"] != sid or classes_by_id[cid]["name"] != row["Class Name"]:
                raise ValueError(f"Conflicting SEC class identity for {cid}")
            duplicate_class_rows += 1
            continue
        ticker = row["Class Ticker"] or None
        cl = {
            "classId": cid, "seriesId": sid, "name": row["Class Name"],
            "directoryTicker": ticker, "currentTicker": None,
            "tickers": [], "tickerObservations": [], "classType": "unclassified",
            "sourceId": sec_source["id"], "sourceUrl": sec_source["url"],
            "sourceDate": sec_source["sourceDate"], "sourceRowNumber": row_number,
            "etfListings": [],
        }
        if ticker:
            cl["tickerObservations"].append({"ticker": ticker, "sourceId": sec_source["id"]})
            csv_ticker_classes[ticker].add(cid)
        classes_by_id[cid] = cl
        series["classes"].append(cl)

    ticker_file = json.loads((base / ticker_source["path"]).read_text())
    tickers_by_symbol = defaultdict(list)
    tickers_by_class = defaultdict(list)
    raw_ticker_records = []
    seen_ticker_rows = set()
    duplicate_ticker_rows = 0
    ticker_mismatches = []
    unmatched_ticker_records = []
    ticker_changed_count = 0
    matched_class_ids = set()
    for row_number, values in enumerate(ticker_file["data"], 1):
        row = dict(zip(ticker_file["fields"], values))
        record = {"cik": str(row["cik"]).zfill(10), "seriesId": row["seriesId"],
                  "classId": row["classId"], "ticker": row["symbol"].strip(),
                  "sourceId": ticker_source["id"], "sourceUrl": ticker_source["url"],
                  "sourceDate": ticker_source["sourceDate"], "sourceDataRowNumber": row_number}
        key = tuple(record[k] for k in ("cik", "seriesId", "classId", "ticker"))
        if key in seen_ticker_rows:
            duplicate_ticker_rows += 1
            continue
        seen_ticker_rows.add(key)
        raw_ticker_records.append(record)
        if record["ticker"]:
            tickers_by_symbol[record["ticker"]].append(record)
        tickers_by_class[record["classId"]].append(record)
        cl = classes_by_id.get(record["classId"])
        if cl is None:
            unmatched_ticker_records.append({**record, "reason": "class_absent_from_june_org30_snapshot"})
            continue
        series = series_by_id[cl["seriesId"]]
        if record["seriesId"] != cl["seriesId"] or record["cik"] != series["registrant"]["cik"]:
            ticker_mismatches.append(record)
            continue
        if cl["currentTicker"] not in (None, record["ticker"]):
            raise ValueError(f"Multiple current tickers for class {cl['classId']}")
        cl["currentTicker"] = record["ticker"] or None
        if record["ticker"]:
            cl["tickerObservations"].append({"ticker": record["ticker"], "sourceId": ticker_source["id"]})
        matched_class_ids.add(cl["classId"])
        ticker_changed_count += cl["directoryTicker"] != cl["currentTicker"]
    if ticker_mismatches:
        raise ValueError(f"{len(ticker_mismatches)} SEC ticker class/series/CIK conflicts")

    listing_counts = {}
    listings_by_ticker = {}
    duplicate_listing_rows = 0
    for filename in ("nasdaqlisted.txt", "otherlisted.txt"):
        source = sources[SOURCE_IDS[filename]]
        raw_text = (base / filename).read_text(encoding="utf-8-sig")
        stamp = re.search(r"File Creation Time:\s*(\d{8})(\d{2}):(\d{2})", raw_text)
        if not stamp:
            raise ValueError(f"No Nasdaq file creation time in {filename}")
        created = datetime.strptime("".join(stamp.groups()), "%m%d%Y%H%M")
        source["sourceDate"] = created.date().isoformat()
        source["sourceDateBasis"] = "File Creation Time footer"
        source["fileCreationTime"] = created.isoformat()
        source["fileCreationTimeZone"] = "unspecified in downloaded file"
        reader = csv.DictReader(io.StringIO(raw_text), delimiter="|")
        listing_counts[source["id"]] = Counter()
        for row_number, row in enumerate(reader, 2):
            symbol_field = "Symbol" if filename == "nasdaqlisted.txt" else "ACT Symbol"
            ticker = (row.get(symbol_field) or "").strip()
            if ticker.startswith("File Creation Time:"):
                listing_counts[source["id"]]["footerRowsExcluded"] += 1
                continue
            listing_counts[source["id"]]["securityRows"] += 1
            if row.get("ETF") != "Y" or row.get("Test Issue") != "N":
                listing_counts[source["id"]]["notExplicitNonTestEtfExcluded"] += 1
                continue
            listing_counts[source["id"]]["includedEtfRows"] += 1
            exchange_code = "Q" if filename == "nasdaqlisted.txt" else row["Exchange"]
            listing = {
                "id": f"US-NASDAQ-DIRECTORY-{ticker}", "ticker": ticker,
                "name": row["Security Name"].strip(), "exchangeCode": exchange_code,
                "exchange": EXCHANGES.get(exchange_code, exchange_code),
                "directoryType": "nasdaq_etf_flagged_listing",
                "etfFlag": "Y", "testIssueFlag": "N",
                "status": "listed_in_source_snapshot",
                "sourceId": source["id"], "sourceUrl": source["url"],
                "sourceDate": source["sourceDate"], "sourceRowNumber": row_number,
            }
            if filename == "otherlisted.txt":
                listing["cqsSymbol"] = row.get("CQS Symbol")
                listing["nasdaqSymbol"] = row.get("NASDAQ Symbol")
            else:
                listing["marketCategory"] = row.get("Market Category")
            if ticker in listings_by_ticker:
                if listings_by_ticker[ticker]["name"] != listing["name"]:
                    raise ValueError(f"Conflicting Nasdaq ETF names for {ticker}")
                duplicate_listing_rows += 1
                continue
            listings_by_ticker[ticker] = listing

    standalone_etfs = []
    join_counts = Counter()
    for ticker, listing in sorted(listings_by_ticker.items()):
        candidates = tickers_by_symbol.get(ticker, [])
        if len(candidates) == 1 and candidates[0]["classId"] in matched_class_ids:
            candidate = candidates[0]
            cl = classes_by_id[candidate["classId"]]
            listing["match"] = {
                "method": "exact_ticker_to_current_sec_ticker_then_exact_class_id",
                "seriesId": cl["seriesId"], "classId": cl["classId"],
                "secTickerSourceId": ticker_source["id"],
                "secTickerSourceUrl": ticker_source["url"],
            }
            cl["etfListings"].append(listing)
            join_counts["matchedEtfListings"] += 1
        else:
            reason = (
                "ambiguous_current_sec_ticker" if len(candidates) > 1 else
                "current_sec_class_absent_from_june_org30_snapshot" if candidates else
                "no_exact_current_sec_ticker_match"
            )
            listing["match"] = {"method": "unresolved", "reason": reason}
            listing["secTickerReferences"] = candidates
            # These are retained ONLY for audit. Reused tickers make them unsafe
            # to merge automatically without a current SEC class identity.
            listing["olderDirectoryCandidates"] = [
                {"classId": cid, "seriesId": classes_by_id[cid]["seriesId"],
                 "seriesName": series_by_id[classes_by_id[cid]["seriesId"]]["name"],
                 "sourceId": sec_source["id"], "sourceUrl": sec_source["url"],
                 "sourceDate": sec_source["sourceDate"], "notUsedForJoin": True}
                for cid in sorted(csv_ticker_classes.get(ticker, []))
            ]
            listing["registrant"] = None
            listing["manager"] = None
            standalone_etfs.append(listing)
            join_counts[reason] += 1

    structure_counts = Counter()
    class_type_counts = Counter()
    for sid, series in sorted(series_by_id.items()):
        series["classes"].sort(key=lambda cl: cl["classId"])
        series["registrant"]["reportingFileNumbers"].sort()
        for cl in series["classes"]:
            preferred_ticker = cl["currentTicker"] or cl["directoryTicker"]
            cl["tickers"] = [preferred_ticker] if preferred_ticker else []
            cl["tickerSourceId"] = (
                ticker_source["id"] if cl["currentTicker"] else
                sec_source["id"] if cl["directoryTicker"] else None)
            if cl["etfListings"]:
                cl["classType"] = "listed_etf_class"
            elif preferred_ticker and re.fullmatch(r"[A-Z0-9]{4}X", preferred_ticker):
                cl["classType"] = "mutual_fund_class_inferred_from_ticker"
            class_type_counts[cl["classType"]] += 1
        class_types = Counter(cl["classType"] for cl in series["classes"])
        if class_types["listed_etf_class"]:
            if class_types["mutual_fund_class_inferred_from_ticker"]:
                structure = "mixed_etf_and_mutual_fund_classes"
            elif class_types["unclassified"]:
                structure = "listed_etf_with_other_unclassified_classes"
            else:
                structure = "listed_etf_classes_only_in_directory"
        elif class_types["mutual_fund_class_inferred_from_ticker"]:
            structure = "mutual_fund_classes_inferred"
        else:
            structure = "open_end_series_type_unverified"
        series["shareClassStructure"] = structure
        series["shareClassStructureIsInferred"] = "mutual_fund" in structure
        structure_counts[structure] += 1
        series["classCount"] = len(series["classes"])
        series["listedEtfClassCount"] = class_types["listed_etf_class"]
        series["inferredMutualFundClassCount"] = class_types["mutual_fund_class_inferred_from_ticker"]
        series["unclassifiedClassCount"] = class_types["unclassified"]
        series["tickers"] = sorted({t for cl in series["classes"] for t in cl["tickers"]})
        series["listedEtfTickers"] = sorted({listing["ticker"] for cl in series["classes"] for listing in cl["etfListings"]})

    counts = {
        "secCsvRowsIncludingBlankMetadataRows": len(raw_sec),
        "secCsvRowsByEntityOrgType": dict(sorted(org_counts.items())),
        "includedOrg30RawClassRows": org_counts["30"],
        "deduplicatedSeries": len(series_by_id),
        "deduplicatedClasses": len(classes_by_id),
        "deduplicatedRegistrantCiks": len({s["registrant"]["cik"] for s in series_by_id.values()}),
        "duplicateSecClassRowsRemoved": duplicate_class_rows,
        "currentSecTickerRawRows": len(ticker_file["data"]),
        "currentSecTickerUniqueRows": len(raw_ticker_records),
        "duplicateSecTickerRowsRemoved": duplicate_ticker_rows,
        "currentSecTickerRecordsWithBlankSymbol": sum(not r["ticker"] for r in raw_ticker_records),
        "classesMatchedByExactClassIdAndValidatedSeriesCik": len(matched_class_ids),
        "currentSecTickerRowsOutsideJuneOrg30Snapshot": len(unmatched_ticker_records),
        "matchedClassesWithTickerDifferentFromJuneIncludingFormerBlank": ticker_changed_count,
        "currentSecTickerSymbolCollisions": sum(len(v) > 1 for v in tickers_by_symbol.values()),
        "nasdaqDirectoryCounts": {k: dict(v) for k, v in sorted(listing_counts.items())},
        "deduplicatedEtfFlaggedListings": len(listings_by_ticker),
        "duplicateEtfListingRowsRemoved": duplicate_listing_rows,
        "etfJoinCounts": dict(sorted(join_counts.items())),
        "standaloneEtfFlaggedListings": len(standalone_etfs),
        "standaloneListingsWithOlderDirectoryCandidatesNotJoined": sum(bool(x["olderDirectoryCandidates"]) for x in standalone_etfs),
        "seriesWithConfirmedEtfListing": sum(bool(s["listedEtfTickers"]) for s in series_by_id.values()),
        "seriesByShareClassStructure": dict(sorted(structure_counts.items())),
        "classesByType": dict(sorted(class_type_counts.items())),
    }
    caveats = [
        "SEC organization type 30 identifies Form N-1A open-end fund filers. "
        "Types 31, 32 and 33 are insurance separate accounts and are excluded.",
        "The SEC series/classes source is dated June 1, 2026. SEC states that "
        "its directory can contain not-yet-launched or ceased series/classes. "
        "No directory record is represented as currently operating merely "
        "because it appears in the file.",
        "SEC Entity Name is preserved as registrant, not relabeled as manager "
        "or brand. Manager is unknown (null) in these sources.",
        "Nasdaq records require literal ETF=Y and Test Issue=N. This directory "
        "flag is not proof of a particular legal structure: standalone records "
        "can include exchange-traded products outside the June org30 universe.",
        "Nasdaq listings are from their October 2, 2026 file-creation footer; "
        "the SEC ticker feed has September 30, 2026 HTTP Last-Modified. These "
        "source dates differ from the June SEC series snapshot. Retrieval "
        "timestamps, raw hashes and original URLs are preserved independently.",
        "ETF joins use exact current SEC ticker symbols followed by exact "
        "ClassID with SeriesID and CIK validation. No fuzzy names are joined. "
        "Older CSV-only symbols are audit candidates, not automatic joins, "
        "because symbols can be reused by unrelated funds.",
        "Mixed ETF/mutual-fund structures are identified when an ETF listing "
        "is confirmed and another class has a five-character ticker ending X. "
        "The mutual-fund class label is explicitly inferred; blank/unrecognized "
        "classes remain unclassified. Current availability is not implied.",
        "Nasdaq mfundslist download returned a Page Not Available HTML page "
        "and contributes no records.",
        "Standalone ETF listings are separate listing records, not additional "
        "confirmed SEC fund series. Do not sum both collections as a verified "
        "count of distinct funds; unresolved matches or multiple share classes "
        "may still exist.",
    ]
    dataset = {
        "schemaVersion": "1.0.0", "market": "US",
        "description": "SEC org30 registered series/classes with separately dated Nasdaq ETF listing evidence",
        "downloadsRetrievedThrough": max(s["retrievedAt"] for s in sources.values()),
        "sources": [sources[k] for k in sorted(sources)],
        "counts": counts, "caveats": caveats,
        "shareClassStructureDefinitions": STRUCTURE_RULES,
        "series": [series_by_id[k] for k in sorted(series_by_id)],
        "standaloneEtfs": standalone_etfs,
        "unmatchedSecTickerRecords": sorted(unmatched_ticker_records, key=lambda x: (x["seriesId"], x["classId"], x["ticker"])),
    }
    dataset_path = out / "us-funds-normalized.json"
    write_json(dataset_path, dataset)
    manifest = {
        "schemaVersion": dataset["schemaVersion"],
        "script": {"path": Path(__file__).name, "sha256": sha256(Path(__file__)),
                   "command": "python normalize_us_funds.py", "dependencies": "Python 3.9+ standard library only"},
        "output": {"path": dataset_path.name, "bytes": dataset_path.stat().st_size,
                   "sha256": sha256(dataset_path)},
        "sources": dataset["sources"], "counts": counts,
        "shareClassStructureDefinitions": STRUCTURE_RULES, "caveats": caveats,
        "recordSchema": {
            "seriesKey": "series[].seriesId (SEC Series ID)",
            "classKey": "series[].classes[].classId (SEC Class ID)",
            "registrant": "series[].registrant = {cik, name, reportingFileNumbers}; manager is null",
            "preferredTickers": "classes[].tickers uses current SEC feed if exact ClassID match, otherwise June directory ticker",
            "tickerHistory": "classes[].tickerObservations records both source observations; sources[].id resolves exact URLs and raw hashes",
            "confirmedEtfListings": "series[].classes[].etfListings[] contains full listing source URL/date and exact match identity",
            "unresolvedEtfListings": "standaloneEtfs[]; olderDirectoryCandidates are explicitly not used for joins",
            "unmatchedCurrentSecTickers": "unmatchedSecTickerRecords[] retains identifiers without asserting org30 membership",
        },
        "sampleSeriesIds": {
            "mixed": next((s["seriesId"] for s in dataset["series"] if s["shareClassStructure"] == "mixed_etf_and_mutual_fund_classes"), None),
            "etf": next((s["seriesId"] for s in dataset["series"] if s["shareClassStructure"] == "listed_etf_classes_only_in_directory"), None),
            "mutual": next((s["seriesId"] for s in dataset["series"] if s["shareClassStructure"] == "mutual_fund_classes_inferred"), None),
        },
    }
    (out / "us-funds-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": manifest["output"], "counts": counts, "sampleSeriesIds": manifest["sampleSeriesIds"]}, indent=2))


if __name__ == "__main__":
    main()
