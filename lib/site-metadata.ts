import metadata from "@/public/data/site-metadata.json";

// A checked date is distinct from every record's NAV/holdings snapshot date.
// The trusted updater may advance it only after the matching source checks.
export const catalogueSourceCheckLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${metadata.catalogueSourceCheckDate}T00:00:00Z`));
