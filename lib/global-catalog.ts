import { fetchJSON } from "./fetch-json";

export type GlobalSource = { id: string; label: string; url: string; asOf: string | null; retrievedAt: string; sha256: string; note?: string };
export type GlobalFund = {
  id: string; name: string; market: string; kind: string; provider: string | null;
  registrant: string | null; tickers: string[]; isins: string[]; classCount: number;
  categories: string[]; currencies: string[]; listed: boolean; enriched: boolean;
  asOf: string | null; sourceIds: string[]; productTypes: string[]; shareClassLabel?: string | null;
};
export type GlobalClass = {
  id: string; name: string; tickers: string[]; directoryTicker?: string | null;
  isin?: string | null; currency?: string | null; domicile?: string | null;
  nav?: number | null; navDate?: string | null; aum?: number | null;
  aumCurrency?: string | null; aumDate?: string | null; feePct?: number | null;
  feeLabel?: string | null; feeDate?: string | null; distribution?: string | null;
  inceptionDate?: string | null; url?: string | null; factsheet?: string | null;
  sourceIds: string[]; assetClass?: string | null; productType?: string | null;
  shareClassLabel?: string | null; apir?: string | null; feeObservedAt?: string | null;
};
export type GlobalListing = { ticker: string; name: string; exchange: string; date: string; sourceId: string };
export type GlobalDetail = GlobalFund & {
  classes: GlobalClass[]; listings: GlobalListing[]; cik?: string | null;
  secSeriesId?: string | null; filingUrl?: string | null; note: string;
};
export type GlobalCatalog = {
  schemaVersion: number; builtAt: string; sources: GlobalSource[];
  stats: { records: number; registeredSeries: number; shareClasses: number; etfListings: number; standaloneEtfs: number; issuerClasses: number; markets: number };
  caveats: string[]; funds: GlobalFund[];
};
let catalogPromise: Promise<GlobalCatalog> | undefined;
const buckets = new Map<string, Promise<Record<string, GlobalDetail>>>();
async function getJSON<T>(url: string): Promise<T> {
  return fetchJSON<T>(url, "The international data could not be loaded. Please try again.");
}
export function getGlobalCatalog() {
  return catalogPromise ??= getJSON<GlobalCatalog>("/data/global/catalog.json").catch(e => { catalogPromise = undefined; throw e; });
}
export async function getGlobalDetail(id: string): Promise<GlobalDetail> {
  if (!/^g-[a-f0-9]{16}$/.test(id)) throw new Error("Invalid international fund identifier.");
  const key = id.slice(2, 4);
  if (!buckets.has(key)) buckets.set(key, getJSON<Record<string, GlobalDetail>>(`/data/global/details/${key}.json`).catch(e => { buckets.delete(key); throw e; }));
  const fund = (await buckets.get(key)!)[id];
  if (!fund) throw new Error("This fund is not in the published snapshot.");
  return fund;
}
export const NAME_THEMES: { value: string; label: string; pattern: RegExp }[] = [
  { value: "equity", label: "Equity, stock & index", pattern: /equity|stock|s&p|nasdaq|msci|ftse|russell|dow jones/i },
  { value: "bond", label: "Bonds & fixed income", pattern: /bond|fixed income|treasury|municipal|credit|loan|gilt/i },
  { value: "cash", label: "Money market & cash", pattern: /money market|cash|liquid|overnight|government money|treasury money/i },
  { value: "mixed", label: "Balanced & multi-asset", pattern: /balanced|multi.?asset|allocation|lifestrategy|life strategy|diversified/i },
  { value: "retirement", label: "Target date & retirement", pattern: /retirement|target (?:date|20)|life.?cycle|freedom 20/i },
  { value: "property", label: "Property & infrastructure", pattern: /real estate|reit|property|infrastructure/i },
  { value: "commodity", label: "Gold & commodities", pattern: /gold|silver|commodit|precious|metals|oil|natural gas/i },
  { value: "international", label: "Global & emerging markets", pattern: /world|global|international|emerging|developed|eafe/i },
  { value: "sector", label: "Sectors & themes", pattern: /technology|health|semiconductor|financial|energy|robot|artificial intelligence|innovation|defen[cs]e/i },
  { value: "alternative", label: "Alternative & hedged", pattern: /alternative|hedg|managed futures|long.short|market neutral|absolute return/i },
  { value: "geared", label: "Leveraged & inverse", pattern: /(?:\b[234]x\b|ultra|leverag|inverse|\bbear\b|\bbull\b)/i },
  { value: "digital", label: "Digital assets", pattern: /bitcoin|ether|crypto|blockchain|digital asset/i },
];
// Published snapshot records are immutable; weak keys let replaced snapshots be reclaimed.
const searchText = new WeakMap<GlobalFund, string>();
export function globalSearchText(f: GlobalFund) {
  let text = searchText.get(f);
  if (text === undefined) {
    text = [f.name, f.registrant || "", f.provider || "", ...f.tickers, ...f.isins, ...f.categories].join(" ").toLowerCase();
    searchText.set(f, text);
  }
  return text;
}
export function searchGlobalFunds(funds: GlobalFund[], query: string, market = "", kind = "", theme = "", coverage = "", asset = "", product = "") {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const pattern = NAME_THEMES.find(t => t.value === theme)?.pattern;
  return funds.filter(f => (!market || f.market === market) && (!kind || (kind === "listed" ? f.listed : kind === "registered" ? f.kind === "Registered fund series" : f.kind === "Issuer share class")) && (!pattern || pattern.test(f.name)) && (!coverage || (coverage === "issuer" ? f.enriched : !f.enriched)) && (!asset || f.categories.some(c => c.toLowerCase() === asset)) && (!product || f.productTypes.includes(product)) && terms.every(t => globalSearchText(f).includes(t)));
}
const moneyFormatters = [false, true].map(compact => new Intl.NumberFormat("en-GB", { maximumFractionDigits: compact ? 2 : 4, notation: compact ? "compact" : "standard" }));
export function globalMoney(value: number | null | undefined, currency: string | null | undefined, compact = false) {
  if (value == null || !Number.isFinite(value) || !currency) return "Not supplied";
  return `${currency} ${moneyFormatters[Number(compact)].format(value)}`;
}
