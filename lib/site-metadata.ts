import metadata from "@/public/data/site-metadata.json";

// A checked date is distinct from every record's NAV/holdings snapshot date.
// The trusted updater may advance it only after the matching source checks.
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const dates = metadata as { catalogueSourceCheckDate: string; lastCatalogueUpdateDate?: string };

// This baseline is not overwritten by later verified data revisions.
export const catalogueSourceCheckLabel = dateFormatter.format(
  new Date(`${dates.catalogueSourceCheckDate}T00:00:00Z`),
);

// New verified source-backed data releases update this field atomically.
// No value means that a separate, verified publication date isn't recorded yet.
export const catalogueUpdateLabel = dates.lastCatalogueUpdateDate
  ? dateFormatter.format(new Date(`${dates.lastCatalogueUpdateDate}T00:00:00Z`))
  : null;
