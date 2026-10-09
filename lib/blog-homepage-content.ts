import initialContent from "@/content/blog-homepage.json";
import { safeHttpUrl } from "@/lib/blog-rich-document";
import { parseHomepageInsightCards } from "@/lib/blog-insight-cards";

/** Public, editable marketing copy only. This must never include admin secrets or visitor records. */
export const blogHomepageFields = [
  { key: "eyebrow", label: "Small heading above page title", group: "Introduction", max: 80, multiline: false },
  { key: "heroHeading", label: "Main page heading", group: "Introduction", max: 120, multiline: false },
  { key: "heroDescription", label: "Introduction paragraph", group: "Introduction", max: 700, multiline: true },
  { key: "articlesHeading", label: "Article section heading", group: "Articles", max: 90, multiline: false },
  { key: "articlesStatus", label: "Article section status label", group: "Articles", max: 120, multiline: false },
  { key: "articlesEmpty", label: "Message shown when no articles exist", group: "Articles", max: 400, multiline: true },
  { key: "articleSearchPlaceholder", label: "Future article search placeholder", group: "Articles", max: 100, multiline: false },
  { key: "newsletterHeading", label: "Email collection heading", group: "Newsletter box", max: 130, multiline: false },
  { key: "newsletterDescription", label: "Email collection description", group: "Newsletter box", max: 450, multiline: true },
  { key: "newsletterPlaceholder", label: "Email input placeholder", group: "Newsletter box", max: 100, multiline: false },
  { key: "newsletterSubmitLabel", label: "Email submit button", group: "Newsletter box", max: 45, multiline: false },
  { key: "contributionButtonLabel", label: "Contributor popup button", group: "Footer", max: 100, multiline: false },
  { key: "footerDescription", label: "Footer education disclaimer", group: "Footer", max: 220, multiline: true },
  { key: "instagramLead", label: "Instagram text before the link", group: "Footer", max: 120, multiline: false },
  { key: "sideCardsLeft", label: "Left homepage insight cards (managed in Cards tool)", group: "Sidebar cards", max: 3900, multiline: true, optional: true },
  { key: "sideCardsRight", label: "Right homepage insight cards (managed in Cards tool)", group: "Sidebar cards", max: 3900, multiline: true, optional: true },
  { key: "articleMastheadRight", label: "Article header tagline (leave blank to hide)", group: "Article appearance", max: 120, multiline: false, optional: true },
  { key: "socialInstagramUrl", label: "Instagram URL", group: "Social links", max: 500, multiline: false, optional: true, url: true },
  { key: "socialInstagramEnabled", label: "Show Instagram icon", group: "Social links", max: 5, multiline: false, toggle: true },
  { key: "socialFacebookUrl", label: "Facebook URL", group: "Social links", max: 500, multiline: false, optional: true, url: true },
  { key: "socialFacebookEnabled", label: "Show Facebook icon", group: "Social links", max: 5, multiline: false, toggle: true },
  { key: "socialXUrl", label: "X URL", group: "Social links", max: 500, multiline: false, optional: true, url: true },
  { key: "socialXEnabled", label: "Show X icon", group: "Social links", max: 5, multiline: false, toggle: true },
  { key: "socialTikTokUrl", label: "TikTok URL", group: "Social links", max: 500, multiline: false, optional: true, url: true },
  { key: "socialTikTokEnabled", label: "Show TikTok icon", group: "Social links", max: 5, multiline: false, toggle: true },
  { key: "socialLinkedinUrl", label: "LinkedIn URL", group: "Social links", max: 500, multiline: false, optional: true, url: true },
  { key: "socialLinkedinEnabled", label: "Show LinkedIn icon", group: "Social links", max: 5, multiline: false, toggle: true },
] as const;

export type BlogHomepageField = (typeof blogHomepageFields)[number]["key"];
export type BlogHomepageContent = Record<BlogHomepageField, string>;
export const defaultBlogHomepageContent: BlogHomepageContent = initialContent;

/** Fail closed on unknown keys and unexpected types when the admin publisher is wired. */
export function validateBlogHomepageContent(value: unknown): BlogHomepageContent {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid homepage content object.");
  const record = value as Record<string, unknown>;
  const allowed = new Set<string>(blogHomepageFields.map(field => field.key));
  if (Object.keys(record).some(key => !allowed.has(key)))
    throw new Error("Unexpected homepage content field.");
  const result = {} as BlogHomepageContent;
  for (const field of blogHomepageFields) {
    // Existing D1 drafts predate the article masthead and opt-in social URLs.
    const text = record[field.key] ?? ("optional" in field || "toggle" in field ? defaultBlogHomepageContent[field.key] : undefined);
    if (typeof text !== "string" || (!("optional" in field) && text.trim().length === 0) || text.length > field.max ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
      throw new Error("Invalid value for " + field.label + ".");
    }
    if ("toggle" in field && text !== "true" && text !== "false")
      throw new Error("Invalid visibility setting for " + field.label + ".");
    if ("url" in field && text && !safeHttpUrl(text))
      throw new Error("Social profile URL must be HTTPS.");
    result[field.key] = text.trim();
  }
  // This data is JSON but stored as a validated string in the existing D1 homepage row.
  // Never allow direct HTML/CSS or unexpected card fields from a browser request.
  parseHomepageInsightCards(result.sideCardsLeft);
  parseHomepageInsightCards(result.sideCardsRight);
  if (JSON.stringify(result).length > 9800)
    throw new Error("Homepage content exceeds the existing D1 row limit. Shorten the cards.");
  for (const network of ["Instagram", "Facebook", "X", "TikTok", "Linkedin"] as const) {
    if (result[`social${network}Enabled`] === "true" &&
        !safeHttpUrl(result[`social${network}Url`]))
      throw new Error(network + " is visible but does not have a valid HTTPS profile link.");
  }
  // The footer disclaimer must retain an unambiguous educational/investment-risk notice.
  if (!/not investment advice/i.test(result.footerDescription))
    throw new Error("Footer disclaimer must retain 'not investment advice'.");
  // No promise of active email campaigns when only collection is implemented.
  if (/newsletter/i.test(result.newsletterDescription) &&
      /we (are|will be) (sending|emailing) newsletters/i.test(result.newsletterDescription) &&
      !/not currently/i.test(result.newsletterDescription))
    throw new Error("Newsletter wording must not promise unimplemented delivery.");
  return result;
}
