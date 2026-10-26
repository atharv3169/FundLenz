"""Import the full CBI UCITS register, preserving umbrella/sub-fund identity.

The PDF's stated entity count must reconcile before output is written. Registry
presence does not establish current dealing availability or holdings coverage.
"""
import argparse
from collections import Counter
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def parse_register(text):
    rows = []
    pattern = r"^(.+?)\s{2,}(\d{1,2}[- ][A-Za-z]{3}[- ]\d{2,4})(?:\s{2,}(.*))?$"
    for page_number, page in enumerate(text.split("\f"), 1):
        lines = page.splitlines()
        header = next((l for l in lines if l.startswith("Name of UCITS")), None)
        if not header:
            continue
        column = header.index("Authorisation")
        for line in lines[lines.index(header) + 1:]:
            if line.startswith(("Run Date:", "Total number")):
                continue
            match = re.match(pattern, line.strip())
            if match:
                name, date, rest = match.groups()
                parent = " " in date
                parsed = dt.datetime.strptime(date, "%d %b %Y" if parent else "%d-%b-%y").date().isoformat()
                rows.append(dict(name=name.strip(), authorisationDate=parsed, parent=parent,
                                 page=page_number, children=[]))
            elif line[:column].strip():
                if not rows:
                    raise ValueError("Unattached wrapped fund name")
                rows[-1]["name"] += " " + line[:column].strip()
    parents = []; current = None
    for row in rows:
        if row["parent"]:
            parents.append(row); current = row
        else:
            if current is None: raise ValueError("Sub-fund without umbrella")
            current["children"].append(row)
    expected_parents = int(re.search(r"Total number of authorised UCITS:\s*(\d+)", text)[1])
    expected_funds = int(re.search(r"Total number of authorised UCITS including sub-funds:\s*(\d+)", text)[1])
    # Display every dated registry row. Umbrella entries are not added to
    # the source's separately reported inclusive fund count.
    funds = [(row, parent) for parent in parents for row in [parent, *parent["children"]]]
    if len(parents) != expected_parents or not len(rows) - len(parents) <= expected_funds <= len(rows):
        raise ValueError(f"Incomplete register: {len(parents)}/{expected_parents} entities; {len(funds)}/{expected_funds} funds")
    return funds


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def import_register(directory, root=ROOT):
    metadata = next(x for x in json.loads((directory / "cbi-manifest.json").read_text()) if x.get("label", "").startswith("Authorised UCITS,"))
    pdf = directory / metadata["file"]
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != metadata["sha256"]:
        raise ValueError("CBI source checksum mismatch")
    text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"]).decode()
    funds = parse_register(text)
    as_of = dt.datetime.strptime(re.search(r"Run Date:\s*(\d+ [A-Za-z]+ \d{4})", text)[1], "%d %B %Y").date().isoformat()
    source_id = "cbi-ucits-register"
    catalog_path = root / "public/data/global/catalog.json"; catalog = json.loads(catalog_path.read_text())
    buckets = {p.stem: json.loads(p.read_text()) for p in (root / "public/data/global/details").glob("*.json")}
    catalog["funds"] = [f for f in catalog["funds"] if source_id not in f["sourceIds"]]
    for bucket in buckets.values():
        for fid in list(bucket):
            if source_id in bucket[fid]["sourceIds"]: del bucket[fid]
    seen = set()
    for row, parent in funds:
        key = "CBI-UCITS:" + parent["name"] + "|" + row["name"] + "|" + row["authorisationDate"]
        fid = "g-" + hashlib.sha256(key.encode()).hexdigest()[:16]
        if fid in seen: raise ValueError("Duplicate registry identity")
        if row["authorisationDate"] > as_of: raise ValueError("Future register authorisation")
        seen.add(fid)
        record = dict(id=fid, name=row["name"], market="Ireland", kind="Registered UCITS entity" if row is parent else "Registered UCITS sub-fund",
                      provider=None, registrant=parent["name"] if row is not parent else None,
                      tickers=[], isins=[], classCount=0, categories=[], currencies=[], listed=False, enriched=False,
                      asOf=as_of, sourceIds=[source_id], productTypes=["UCITS"], domiciles=["Ireland"],
                      authorisationDate=row["authorisationDate"], shareClassLabel=None)
        catalog["funds"].append(record)
        detail = dict(record, classes=[], listings=[], filingUrl=metadata["url"], sourcePage=row["page"],
                      note="Listed in the Central Bank of Ireland UCITS register on " + as_of +
                      ". This is a registry entry, not a share class; umbrella entities and sub-funds are shown separately. Registration does not confirm current dealing, investor eligibility or a complete holdings disclosure. Issuer share classes can also appear separately in this catalogue.")
        buckets.setdefault(fid[2:4], {})[fid] = detail
    # Expose issuer-supplied domicile in the searchable index as well.
    for f in catalog["funds"]:
        detail = buckets[f["id"][2:4]][f["id"]]
        f["domiciles"] = sorted(set(f.get("domiciles", []) + [c["domicile"] for c in detail["classes"] if c.get("domicile")]))
        detail["domiciles"] = f["domiciles"]
    catalog["sources"] = [s for s in catalog["sources"] if s["id"] != source_id]
    catalog["sources"].append(dict(id=source_id, label="Central Bank of Ireland authorised UCITS register", url=metadata["url"],
                                    asOf=as_of, retrievedAt=metadata["retrievedAt"], sha256=metadata["sha256"],
                                    note="All dated PDF entries, including umbrella entities. The 557 parent entities reconcile to the source; its separately reported 6,349 fund total is not the number of displayed rows."))
    catalog["funds"].sort(key=lambda f: f["name"].lower())
    catalog["stats"].update(records=len(catalog["funds"]), irishRegistryEntries=len(funds), irishReportedFundCount=int(re.search(r"Total number of authorised UCITS including sub-funds:\s*(\d+)", text)[1]), markets=len({f["market"] for f in catalog["funds"]}))
    catalog["builtAt"] = metadata["retrievedAt"]
    catalog["caveats"] = [s for s in catalog["caveats"] if not s.startswith("International holdings are not integrated")]
    catalog["caveats"].append("Irish registry funds and issuer share classes are different record types and can overlap; counts are not unique active investments. Holdings analysis is available only for independently validated disclosures.")
    write(catalog_path, catalog)
    coverage_path = root / "public/data/global/coverage.json"
    coverage = json.loads(coverage_path.read_text())
    coverage.update({key: value for key, value in catalog.items() if key != "funds"})
    coverage["recordsBySourceMarket"] = dict(Counter(f["market"] for f in catalog["funds"]))
    coverage["recordsByKind"] = dict(Counter(f["kind"] for f in catalog["funds"]))
    write(coverage_path, coverage)
    for key, bucket in buckets.items(): write(root / "public/data/global/details" / (key + ".json"), bucket)
    print(json.dumps(dict(irishRegistryEntries=len(funds), totalRecords=len(catalog["funds"]))))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("directory", type=Path)
    import_register(parser.parse_args().directory)
