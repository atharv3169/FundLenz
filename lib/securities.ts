import { fetchJSON } from "./fetch-json";

export type Security = { id: string; name: string; type: string; symbol?: string; isin?: string; cusip?: string; exchange?: string; country?: string; currency?: string; maturity?: string; coupon?: number; asOf: string; sourceIds: string[]; sector?: string; note?: string };
export type SecuritySource = { id: string; label?: string; url: string; asOf: string; sha256: string };
export type Securities = { checkedAt: string; asOf?: string; sources: SecuritySource[]; records: Security[]; notes?: string[] };
let cached: Promise<Securities> | undefined;
export function getSecurities(): Promise<Securities> {
  return cached ??= fetchJSON<Securities>("/data/securities/catalog.json", "The securities catalogue could not be loaded.").catch(e => { cached = undefined; throw e; });
}
const searchText = new WeakMap<Security, string>();
function securitySearchText(record: Security) {
  let text = searchText.get(record);
  if (text === undefined) {
    text = [record.name, record.symbol, record.isin, record.cusip, record.exchange, record.country, record.sector].filter(Boolean).join(" ").toLowerCase();
    searchText.set(record, text);
  }
  return text;
}
export function searchSecurities(records: Security[], query = "", type = "", country = "", currency = "") {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(r => (!type || r.type === type) && (!country || r.country === country) && (!currency || r.currency === currency) && words.every(w => securitySearchText(r).includes(w)));
}
