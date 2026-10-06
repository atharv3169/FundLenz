import { officialDataset } from "./catalog";
import { fetchJSON } from "./fetch-json";
import type { Dataset } from "./finance";
let example: Promise<Dataset> | undefined;
export function getUSExample(): Promise<Dataset> {
  return example ??= fetchJSON<Dataset>("/data/us-example.json", "The US example could not be loaded. Please retry.").catch(e => { example = undefined; throw e; });
}
export async function loadOfficialDataset(ids: string[]): Promise<Dataset> {
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length) throw new Error("Select 1–20 distinct portfolios.");
  if (ids.every(id => /^f-[a-f0-9]{16}$/.test(id))) return officialDataset(ids);
  if (!ids.every(id => /^us-[A-Z]+$/.test(id))) throw new Error("Use portfolios from one supported market and currency; currency conversion is not available.");
  const data = await getUSExample();
  const funds = ids.map(id => data.funds.find(f => f.id === id));
  if (funds.some(f => !f)) throw new Error("Verified holdings are not available for one of these US funds.");
  return { ...data, funds: funds as Dataset["funds"] };
}
