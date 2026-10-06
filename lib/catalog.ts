import type { Dataset, Fund, Holding } from "./finance";
import { fetchJSON } from "./fetch-json";

export type Plan = { code: string; plan: string; option: string; isin: string | null; reinvestmentIsin: string | null; nav: number | null; navDate: string | null };
export type PortfolioSummary = { date: string; aumINR: number; equityPct: number; cashPct: number; otherPct: number; holdingCount: number; derivatives: boolean; description: string | null; benchmark: string | null };
export type CatalogFund = {
  id: string; name: string; amc: string; amcId: string; category: string; structure: string;
  categories: string[]; assetClass: string; navDate: string | null; plans: Plan[];
  portfolioId: string | null; portfolioSummary?: PortfolioSummary;
  links: Record<string, string | null>;
};
export type Catalog = {
  schemaVersion: number; retrievedAt: string; source: string; sourceSha256: string; directorySource: string;
  stats: { fundRecords: number; planRecords: number; fundHouses: number; directoryHouses: number; latestNavDate: string; plansAtLatestDate: number; holdingsFunds: number; holdingsFundHouses: number; holdingsDate: string };
  funds: CatalogFund[]; houses: { id: string; name: string; company: string; website: string; portfolio: string; factsheet: string }[];
};
export type OfficialHolding = Holding & { originalName: string; reportedWeight: number | null; assetClass: string; marketValueINR: number; quantity: number | null; sourceRow: number };
export type OfficialPortfolio = Omit<Fund, "holdings"> & PortfolioSummary & {
  amc: string; sourcePage: string; sourceSheet: string; sourceSha256: string; sourceFile: string;
  holdings: OfficialHolding[]; reconciliationDifferencePct: number; note: string;
};
let catalogPromise: Promise<Catalog> | undefined;
const portfolioPromises = new Map<string, Promise<OfficialPortfolio>>();
async function json<T>(url: string): Promise<T> {
  return fetchJSON<T>(url, "The data could not be loaded. Please try again.");
}
export function getCatalog(): Promise<Catalog> {
  return catalogPromise ??= json<Catalog>("/data/catalog.json").catch(e => { catalogPromise = undefined; throw e; });
}
export function getPortfolio(id: string): Promise<OfficialPortfolio> {
  if (!/^f-[a-f0-9]{16}$/.test(id)) return Promise.reject(new Error("Invalid fund identifier."));
  if (!portfolioPromises.has(id)) portfolioPromises.set(id, json<OfficialPortfolio>(`/data/holdings/${id}.json`).catch(e => { portfolioPromises.delete(id); throw e; }));
  return portfolioPromises.get(id)!;
}
export async function officialDataset(ids: string[]): Promise<Dataset> {
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 20) throw new Error("Select between 1 and 20 fund portfolios.");
  const catalog = await getCatalog();
  if (unique.some(id => !catalog.funds.some(f => f.id === id && f.portfolioId))) throw new Error("Holdings are not available for one of the selected funds.");
  const funds = await Promise.all(unique.map(getPortfolio));
  if (new Set(funds.map(f => f.date)).size !== 1) throw new Error("The selected portfolios do not share a snapshot date.");
  return { mode: "official", currency: "INR", region: "IN", funds, note: "Official AMC monthly disclosures, reconciled to reported net assets. Equity weights use disclosed market values / net assets; original percentages are retained in the catalogue. Holdings reflect their stated month end, not today's trades. Scenarios cover disclosed equities only; debt, derivatives, currency effects and other assets are not modeled." };
}
export function preferredPlan(fund: CatalogFund, plan = "", option = ""): Plan | undefined {
  const planFilter = plan.toLowerCase(), optionFilter = option.toLowerCase();
  let best: Plan | undefined;
  for (const candidate of fund.plans) {
    if ((planFilter && !candidate.plan.toLowerCase().includes(planFilter)) || (optionFilter && !candidate.option.toLowerCase().includes(optionFilter))) continue;
    if (!best || (candidate.navDate || "").localeCompare(best.navDate || "") > 0 ||
      (candidate.navDate || "") === (best.navDate || "") && (
        Number(candidate.plan.toLowerCase().includes("direct")) > Number(best.plan.toLowerCase().includes("direct")) ||
        candidate.plan.toLowerCase().includes("direct") === best.plan.toLowerCase().includes("direct") &&
        Number(candidate.option.toLowerCase().includes("growth")) > Number(best.option.toLowerCase().includes("growth"))
      )) best = candidate;
  }
  return best;
}
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function formatDate(date: string | null | undefined) {
  if (!date) return "Not reported";
  const value = new Date(date);
  return Number.isFinite(value.getTime()) ? dateFormatter.format(value) : "Not reported";
}
export function isOlderNav(date: string | null | undefined, latest: string) {
  return !date || Date.parse(latest) - Date.parse(date) > 7 * 86400000;
}
