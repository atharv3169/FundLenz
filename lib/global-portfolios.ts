import { fetchJSON } from "./fetch-json";
import type { Dataset, Fund, Holding } from "./finance";

export type GlobalPortfolioSummary = {
  id: string; name: string; ticker: string; aliases: string[];
  date: string; currency: "USD"; holdingCount: number;
  equityPct: number; cashPct: number; otherPct: number; weightTotalPct: number;
  source: string; sourcePage: string; sourceSha256: string;
};
export type GlobalPortfolio = Omit<Fund, "holdings"> & {
  currency: "USD"; sourcePage: string; note: string;
  holdings: (Holding & { assetClass: string; sourceRow: number; marketValue?: number })[];
};
export type GlobalHoldingsIndex = {
  schemaVersion: number; checkedAt: string; note: string;
  portfolios: Record<string, GlobalPortfolioSummary>;
};
let indexPromise: Promise<GlobalHoldingsIndex> | undefined;
const portfolios = new Map<string, Promise<GlobalPortfolio>>();

export function getGlobalHoldingsIndex() {
  return indexPromise ??= fetchJSON<GlobalHoldingsIndex>("/data/global/holdings-index.json", "Portfolio availability could not be loaded. Please retry.")
    .catch(error => { indexPromise = undefined; throw error; });
}

export function globalSelection(ids: string[], index: GlobalHoldingsIndex): string[] {
  const mapped = ids.map(id => index.portfolios[id]?.id || Object.values(index.portfolios).find(p => p.aliases.includes(id))?.id);
  return [...new Set(mapped.filter((id): id is string => !!id))].slice(0, 20);
}

export function getGlobalPortfolio(id: string): Promise<GlobalPortfolio> {
  if (!/^g-[a-f0-9]{16}$/.test(id)) return Promise.reject(new Error("Invalid international portfolio identifier."));
  if (!portfolios.has(id)) portfolios.set(id, (async () => {
    const index = await getGlobalHoldingsIndex(), summary = index.portfolios[id];
    if (!summary) throw new Error("Verified holdings are not available for this international fund.");
    const fund = await fetchJSON<GlobalPortfolio>(`/data/global/holdings/${id}.json`, "The international portfolio could not be loaded. Please retry.");
    if (fund.id !== id || fund.date !== summary.date || fund.currency !== summary.currency || fund.sourceSha256 !== summary.sourceSha256 || fund.holdings.length !== summary.holdingCount) {
      throw new Error("The portfolio and catalogue refer to different snapshots. Reload the page and try again.");
    }
    return fund;
  })().catch(error => { portfolios.delete(id); throw error; }));
  return portfolios.get(id)!;
}

export async function globalDataset(ids: string[]): Promise<Dataset> {
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length) throw new Error("Select 1–20 distinct portfolios.");
  const funds = await Promise.all(ids.map(getGlobalPortfolio));
  if (funds.some(f => f.currency !== "USD")) throw new Error("Enter holding values in one supported currency; automatic currency conversion is not available.");
  const mixedDates = new Set(funds.map(f => f.date)).size > 1;
  return { mode: "official", currency: "USD", region: "GLOBAL", funds,
    note: `Official issuer holdings with published weights retained, including rounding and signed non-equity balances. Enter every holding value in USD; no currency conversion is performed. ${mixedDates ? "These funds have different disclosure dates; this is a comparison of dated snapshots, not a single-date portfolio. " : ""}Equity identities are matched conservatively using issuer security identifiers. Bond, derivative and currency risks are not modeled by the equity scenarios. See each fund's source and snapshot date.` };
}
