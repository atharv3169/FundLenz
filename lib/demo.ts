import type { Dataset, Holding } from "./finance";
const names: Record<string, [string, string]> = {
  X: ["Example Bank X", "Sector 1"], Y: ["Example Finance Y", "Sector 1"],
  Z: ["Example Industries Z", "Sector 2"], W: ["Example Manufacturing W", "Sector 2"],
  E: ["Example Technology E", "Technology"], F: ["Example Software F", "Technology"],
  G: ["Example Healthcare G", "Healthcare"], H: ["Example Consumer H", "Consumer"],
  I: ["Example Healthcare I", "Healthcare"], J: ["Example Consumer J", "Consumer"],
};
function holdings(pairs: [string, number][]): Holding[] {
  return [...pairs.map(([id, weight]) => ({ id, name: names[id][0], sector: names[id][1], type: "equity" as const, weight })), { id: "CASH", name: "Cash", sector: "Cash", type: "cash", weight: 10 }];
}
export const DEMO: Dataset = {
  mode: "demo", note: "Fictional portfolios created to demonstrate and independently check the calculations. These are not investable schemes or observed market data.",
  funds: [
    { id: "A", portfolioId: "A", name: "Example Large Cap A", category: "Large cap", date: "2026-08-31", source: "", holdings: holdings([["X", 8], ["Y", 42], ["Z", 40]]) },
    { id: "B", portfolioId: "B", name: "Example Mid Cap B", category: "Mid cap", date: "2026-08-31", source: "", holdings: holdings([["X", 6], ["Y", 24], ["W", 60]]) },
    { id: "C", portfolioId: "C", name: "Example Mid Cap C", category: "Mid cap", date: "2026-08-31", source: "", holdings: holdings([["Z", 45], ["W", 45]]) },
    { id: "D", portfolioId: "D", name: "Example Small Cap D", category: "Small cap", date: "2026-08-31", source: "", holdings: holdings([["E", 25], ["F", 25], ["G", 25], ["H", 15]]) },
    { id: "E", portfolioId: "E", name: "Example Small Cap E", category: "Small cap", date: "2026-08-31", source: "", holdings: holdings([["E", 10], ["F", 10], ["I", 30], ["J", 40]]) },
  ]
};
export const DEMO_AMOUNTS = { A: 40000, B: 60000, C: 0, D: 0, E: 0 };
