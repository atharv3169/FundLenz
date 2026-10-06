import type { Dataset, Fund } from "./finance";
export const HEADERS = ["fund_id", "portfolio_id", "fund_name", "category", "as_of_date", "security_id", "security_name", "asset_type", "sector", "weight_pct_nav", "source_url"];
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[\t\r\n]/.test(s) || /^\s*[=+@]/.test(s) || (/^\s*-/.test(s) && !Number.isFinite(Number(s)))) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
export function toCSV(rows: unknown[][]) { return rows.map(r => r.map(csvCell).join(",")).join("\r\n"); }
export function datasetCSV(data: Dataset) {
  return toCSV([[...HEADERS, "currency"], ...data.funds.flatMap(f => f.holdings.map(h => [f.id, f.portfolioId, f.name, f.category, f.date, h.id, h.name, h.type, h.sector, h.weight, f.source, data.currency || "INR"]))]);
}
export function parseCSV(text: string): string[][] {
  if (text.length > 2_000_000) throw new Error("Use a CSV smaller than 2 MB.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closedQuote = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (closedQuote) throw new Error("Invalid quoting in the CSV.");
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) { quoted = false; closedQuote = true; }
      else if (cell === "") quoted = true;
      else throw new Error("Invalid quoting in the CSV.");
    } else if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; closedQuote = false; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; closedQuote = false;
    } else if (closedQuote && !/\s/.test(c)) throw new Error("Unexpected text after a quoted CSV field.");
    else cell += c;
  }
  if (quoted) throw new Error("A quoted CSV field is not closed.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function importCSV(text: string): Dataset {
  const rows = parseCSV(text), header = rows.shift();
  if (!header || new Set(header).size !== header.length || HEADERS.some(h => !header.includes(h))) throw new Error("The CSV needs the column names in the downloadable template.");
  if (!rows.length || rows.length > 10000) throw new Error("The CSV must contain between 1 and 10,000 holding rows.");
  const columns = new Map(header.map((key, index) => [key, index]));
  const holdingIds = new Map<string, Set<string>>();
  let currency: "USD" | "INR" | undefined;
  const funds = new Map<string, Fund>(), dates = new Set<string>(), securities = new Map<string, string>(), portfolios = new Map<string, string>();
  rows.forEach((r, i) => {
    const get = (key: string) => r[columns.get(key) ?? -1] ?? "";
    const fail = (message: string): never => { throw new Error(`Row ${i + 2}: ${message}`); };
    if (r.length !== header.length) fail("the number of columns does not match the header.");
    for (const k of HEADERS.filter(k => k !== "source_url" && k !== "sector")) if (!get(k)) fail(`${k} is required.`);
    if (r.some(v => v.length > 500)) fail("a field exceeds 500 characters.");
    const rowCurrency = header.includes("currency") ? get("currency").toUpperCase() : "INR";
    if (rowCurrency !== "USD" && rowCurrency !== "INR") fail("currency must be USD or INR.");
    if (currency && currency !== rowCurrency) fail("mixed currencies are unsupported; no currency conversion is performed.");
    currency = rowCurrency as "USD" | "INR";
    const id = get("fund_id"), portfolioId = get("portfolio_id"), date = get("as_of_date"), source = get("source_url");
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(id) || !/^[A-Za-z0-9_.-]{1,64}$/.test(portfolioId) || [id, portfolioId].some(v => ["__proto__", "constructor", "prototype"].includes(v))) fail("use simple letters, numbers, hyphens or underscores for fund and portfolio IDs.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail("as_of_date must be a valid YYYY-MM-DD date.");
    if (source) { try { const url = new URL(source); if (!["https:", "http:"].includes(url.protocol)) fail("source_url must begin with https:// or http://."); } catch { fail("source_url must be a valid web address."); } }
    dates.add(date);
    if (portfolios.has(portfolioId) && portfolios.get(portfolioId) !== id) fail("the underlying portfolio is already present under another fund ID. Combine amounts for plans of the same scheme.");
    portfolios.set(portfolioId, id);
    const name = get("fund_name"), category = get("category");
    const f = funds.get(id) || { id, portfolioId, name, category, date, source, holdings: [] };
    if (f.name !== name || f.category !== category || f.portfolioId !== portfolioId || f.source !== source || f.date !== date) fail("fund metadata must be identical across its rows.");
    const type = get("asset_type");
    if (!["equity", "cash", "other"].includes(type)) fail("asset_type must be equity, cash or other. Short positions and derivatives are unsupported.");
    const weight = Number(get("weight_pct_nav"));
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) fail("weight_pct_nav must be a percentage from 0 to 100 (8 means 8%).");
    const securityId = get("security_id"), securityName = get("security_name"), sector = get("sector") || "Unknown";
    const ids = holdingIds.get(id) || new Set<string>();
    if (ids.has(securityId)) fail("duplicate security ID within a fund; remove subtotals and aggregate genuine duplicates first.");
    ids.add(securityId); holdingIds.set(id, ids);
    const metadata = [securityName, type, sector].join("\u0000");
    if (securities.has(securityId) && securities.get(securityId) !== metadata) fail("the same security ID has conflicting names, asset types or sectors.");
    securities.set(securityId, metadata);
    f.holdings.push({ id: securityId, name: securityName, type: type as "equity" | "cash" | "other", sector, weight });
    funds.set(id, f);
  });
  if (dates.size !== 1) throw new Error("Use one common portfolio snapshot date across all funds.");
  if (funds.size > 20) throw new Error("This prototype supports up to 20 underlying fund portfolios.");
  for (const f of funds.values()) {
    const sum = f.holdings.reduce((s, h) => s + h.weight, 0);
    if (sum > 100.0000001) throw new Error(`${f.name}: weights total ${sum.toFixed(4)}%, above 100%. Reconcile with the disclosure before importing; weights are never silently rescaled.`);
    if (sum === 0) throw new Error(`${f.name}: at least one positive holding weight is required.`);
  }
  return { mode: "imported", currency, funds: [...funds.values()], note: "User-imported snapshot. Source links and data accuracy have not been independently verified by FundLenz." };
}
