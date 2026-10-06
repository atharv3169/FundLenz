import { validateAmounts, validateScenario, type Dataset, type Amounts, type Scenario } from "./finance";
import { datasetCSV, importCSV } from "./import";
import { DEMO } from "./demo";
import { loadOfficialDataset } from "./portfolios";
export function createSession(data: Dataset, amounts: Amounts, scenario: Scenario, exampleAmounts: boolean) {
  return data.mode === "official"
    ? { version: 3, mode: data.mode, currency: data.currency || "INR", funds: data.funds.map(f => ({ id: f.id, date: f.date, sourceSha256: f.sourceSha256 })), amounts, scenario, exampleAmounts }
    : { version: 1, mode: data.mode, csv: datasetCSV(data), amounts, scenario, exampleAmounts };
}
export async function restoreSession(text: string) {
  if (text.length > 2_000_000) throw new Error("Use a session smaller than 2 MB.");
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid FundLenz session.");
  let data: Dataset;
  if ((parsed.version === 2 || parsed.version === 3) && parsed.mode === "official") {
    if (!Array.isArray(parsed.funds) || parsed.funds.some((f: { id?: unknown }) => typeof f?.id !== "string")) throw new Error("Invalid official session.");
    data = await loadOfficialDataset(parsed.funds.map((f: { id: string }) => f.id));
    if (parsed.version === 3 && parsed.currency !== data.currency) throw new Error("The saved currency does not match these portfolios.");
    if (data.funds.some(f => !parsed.funds.some((s: { id: string; date: string; sourceSha256: string }) => s.id === f.id && s.date === f.date && s.sourceSha256 === f.sourceSha256))) throw new Error("This session refers to a different source snapshot. Restore its original data to reproduce the analysis.");
  } else {
    if (parsed.version !== 1 || typeof parsed.csv !== "string") throw new Error("Unsupported FundLenz session.");
    data = importCSV(parsed.csv);
    if (parsed.mode === "demo" && datasetCSV(data) === datasetCSV(DEMO)) data = DEMO;
  }
  return { data, amounts: validateAmounts(data.funds, parsed.amounts), scenario: validateScenario(parsed.scenario, data.funds), exampleAmounts: parsed.exampleAmounts === true };
}
