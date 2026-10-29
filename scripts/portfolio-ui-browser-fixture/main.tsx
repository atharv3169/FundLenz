import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectsDrawer } from "../../components/projects-drawer";
import { SectorExposureGroup } from "../../components/sector-exposure-group";
import type { Exposure } from "../../lib/finance";

const stocks: Exposure[] = Array.from({ length: 1300 }, (_, i) => ({
  id: `S-${i}`, name: `Security ${i}`, sector: i < 1100 ? "Technology" : "Healthcare",
  weight: .0002, value: 20, funds: 1,
}));
function Fixture() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  return <div id="ui-harness">
    <select aria-label="Filter by sector" id="filter" value={filter} onChange={e => setFilter(e.target.value)}>
      <option>All</option><option>Healthcare</option>
    </select>
    <input aria-label="Search holdings" id="search" value={search} onChange={e => setSearch(e.target.value)} />
    <output id="table-state">{filter}:{search}</output>
    <SectorExposureGroup sector={{ name: "Technology", weight: .22, value: 22000 }}
      stocks={stocks} color="#087f8c" money={v => "$" + v.toFixed(0)} />
    <SectorExposureGroup sector={{ name: "Healthcare", weight: .04, value: 4000 }}
      stocks={stocks} color="#3c65cf" money={v => "$" + v.toFixed(0)} />
    <ProjectsDrawer />
  </div>;
}
// Keep the fixture mounted when a navigation Link is clicked; React still receives onClick.
document.addEventListener("click", e => {
  if ((e.target as HTMLElement).closest("#ui-harness a")) e.preventDefault();
}, true);
createRoot(document.getElementById("root")!).render(<Fixture />);
