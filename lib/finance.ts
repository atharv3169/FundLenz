export type Holding = { id: string; name: string; sector: string; type: "equity" | "cash" | "other"; weight: number };
export type Fund = { id: string; portfolioId: string; name: string; category: string; date: string; source: string; holdings: Holding[]; scenarioScope?: "disclosed_equities_only"; sourceSha256?: string; derivatives?: boolean };
export type Dataset = { mode: "demo" | "imported" | "official"; funds: Fund[]; note: string; currency?: "USD" | "INR"; region?: "US" | "IN" | "GLOBAL" };
export type Amounts = Record<string, number>;
export type Scenario = { broad: number; sector: string; sectorShock: number; stock: string; stockShock: number };
export type Exposure = { id: string; name: string; sector: string; weight: number; value: number; funds: number };
export type Analysis = { total: number; weights: Amounts; equity: number; cash: number; other: number; otherGross: number; partialModel: boolean; missing: number; stocks: Exposure[]; sectors: { name: string; weight: number; value: number }[]; hhi: number | null; effective: number | null; top5: number; invested: number };
export const DEFAULT_SCENARIO: Scenario = { broad: 0, sector: "Sector 1", sectorShock: -20, stock: "", stockShock: -30 };
export const COLORS = ["#087f8c", "#3c65cf", "#79a897", "#bd8b45", "#7764b2", "#7196bc", "#b66f8a", "#668477"];
export function analyze(funds: Fund[], amounts: Amounts): Analysis {
  const total = funds.reduce((s, f) => s + (amounts[f.id] || 0), 0);
  const weights: Amounts = {}, securities = new Map<string, Exposure>();
  let equity = 0, cash = 0, other = 0, otherGross = 0, missing = 0, partialModel = false;
  for (const fund of funds) {
    const a = total > 0 ? (amounts[fund.id] || 0) / total : 0;
    weights[fund.id] = a;
    if (a > 0 && (fund.scenarioScope === "disclosed_equities_only" || fund.derivatives)) partialModel = true;
    missing += a * Math.max(0, 1 - fund.holdings.reduce((s, h) => s + h.weight / 100, 0));
    for (const h of fund.holdings) {
      const w = a * h.weight / 100;
      if (h.type === "cash") cash += w;
      else if (h.type === "other") { other += w; otherGross += Math.abs(w); }
      else {
        equity += w;
        if (w > 0) {
          const row = securities.get(h.id) || { id: h.id, name: h.name, sector: h.sector || "Unknown", weight: 0, value: 0, funds: 0 };
          row.weight += w; row.value += w * total; row.funds += 1;
          securities.set(h.id, row);
        }
      }
    }
  }
  const stocks = [...securities.values()].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const sectorMap = new Map<string, number>();
  stocks.forEach(s => sectorMap.set(s.sector, (sectorMap.get(s.sector) || 0) + s.weight));
  const sectors = [...sectorMap].map(([name, weight]) => ({ name, weight, value: total * weight })).sort((a, b) => b.weight - a.weight);
  const hhi = equity > 0 ? stocks.reduce((s, h) => s + (h.weight / equity) ** 2, 0) : null;
  return { total, weights, equity, cash, other, otherGross, partialModel, missing, stocks, sectors, hhi, effective: hhi ? 1 / hhi : null, top5: stocks.slice(0, 5).reduce((s, h) => s + h.weight, 0), invested: funds.filter(f => (amounts[f.id] || 0) > 0).length };
}
export function overlap(a: Fund, b: Fund): number | null {
  const ea = a.holdings.filter(h => h.type === "equity"), eb = b.holdings.filter(h => h.type === "equity");
  const ta = ea.reduce((s, h) => s + h.weight, 0), tb = eb.reduce((s, h) => s + h.weight, 0);
  if (!ta || !tb) return null;
  const wb = new Map(eb.map(h => [h.id, h.weight / tb]));
  return ea.reduce((s, h) => s + Math.min(h.weight / ta, wb.get(h.id) || 0), 0);
}
export function stress(a: Analysis, scenario: Scenario) {
  const contributions = a.stocks.map(s => {
    const shock = scenario.stock === s.id ? scenario.stockShock : scenario.sector === s.sector ? scenario.sectorShock : scenario.broad;
    return { ...s, shock, impact: s.weight * shock / 100, impactValue: s.value * shock / 100 };
  }).sort((a, b) => a.impact - b.impact);
  const impact = contributions.reduce((s, c) => s + c.impact, 0);
  return { contributions, impact, value: a.total * impact, modeled: a.equity + a.cash, partial: a.partialModel || a.otherGross + a.missing > 1e-8, endValue: a.total * (1 + impact) };
}
export function allocationSearch(funds: Fund[], amounts: Amounts, maxTurnover: number) {
  const base = analyze(funds, amounts);
  if (!base.total || !base.equity) return null;
  const n = funds.length, initial = funds.map(f => base.weights[f.id]), current = [...initial];
  const eq = funds.map(f => f.holdings.filter(h => h.type === "equity").reduce((s, h) => s + h.weight / 100, 0));
  const vectors = funds.map(f => new Map(f.holdings.filter(h => h.type === "equity").map(h => [h.id, h.weight / 100])));
  const gram = vectors.map(x => vectors.map(y => [...x].reduce((s, [id, w]) => s + w * (y.get(id) || 0), 0)));
  const scoreWeights = (w: number[]) => w.reduce((s, wi, i) => s + w.reduce((t, wj, j) => t + wi * wj * gram[i][j], 0), 0) / (base.equity ** 2);
  const turnover = (w: number[]) => w.reduce((s, v, i) => s + Math.abs(v - initial[i]), 0) / 2;
  const asAmounts = (w: number[]) => Object.fromEntries(funds.map((f, i) => [f.id, w[i] * base.total]));
  let best = base.hhi!, checked = 1;
  // Feasible directions keep category totals and equity exposure unchanged.
  // Unequal-equity funds need a three-fund move; an arbitrary pair would alter E.
  const directions: number[][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (funds[i].category !== funds[j].category) continue;
    if (Math.abs(eq[i] - eq[j]) < 1e-10) {
      const d = Array(n).fill(0); d[i] = -1; d[j] = 1; directions.push(d);
    }
    for (let k = j + 1; k < n; k++) {
      if (funds[k].category !== funds[i].category) continue;
      const d = Array(n).fill(0); d[i] = eq[j] - eq[k]; d[j] = eq[k] - eq[i]; d[k] = eq[i] - eq[j];
      const scale = Math.max(...d.map(Math.abs));
      if (scale > 1e-10) directions.push(d.map(x => x / scale));
    }
  }
  for (const step of [0.04, 0.01, 0.0025]) {
    for (let round = 0; round < 150; round++) {
      let move: number[] | null = null, score = best;
      for (const direction of directions) for (const sign of [-1, 1]) {
        const next = current.map((v, i) => v + sign * step * direction[i]);
        if (next.some(v => v < -1e-10)) continue;
        // Remove floating-point negative zero without permitting a short allocation.
        for (let i = 0; i < n; i++) if (next[i] < 0) next[i] = 0;
        if (turnover(next) > maxTurnover + 1e-9) continue;
        checked++;
        const hhi = scoreWeights(next);
        if (hhi < score - 1e-10) { score = hhi; move = next; }
      }
      if (!move) break;
      current.splice(0, current.length, ...move); best = score;
    }
  }
  return { amounts: asAmounts(current), turnover: turnover(current), checked, improvement: base.hhi! - best, step: 0.0025 };
}
export function validateAmounts(funds: Fund[], value: unknown): Amounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Allocation must map fund IDs to amounts.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(id => !funds.some(f => f.id === id))) throw new Error("The allocation contains an unknown fund ID.");
  return Object.fromEntries(funds.map(f => {
    const n = raw[f.id] ?? 0;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e12) throw new Error("Amounts must be finite values between 0 and 1 trillion in the dataset currency.");
    return [f.id, n];
  }));
}
export function validateScenario(value: unknown, funds: Fund[]): Scenario {
  const v = value as Scenario;
  if (!v || [v.broad, v.sectorShock, v.stockShock].some(n => typeof n !== "number" || !Number.isFinite(n) || n < -100 || n > 100)) throw new Error("Scenario shocks must be numbers from −100 to +100 percent.");
  if (typeof v.stock !== "string" || typeof v.sector !== "string") throw new Error("Select valid scenario targets.");
  if (v.stock && !funds.some(f => f.holdings.some(h => h.type === "equity" && h.id === v.stock))) throw new Error("Unknown stock target.");
  if (v.sector && !funds.some(f => f.holdings.some(h => h.type === "equity" && h.sector === v.sector))) throw new Error("Unknown sector target.");
  return { broad: v.broad, sector: v.sector, sectorShock: v.sectorShock, stock: v.stock, stockShock: v.stockShock };
}
