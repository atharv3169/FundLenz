import initialContent from "@/content/blog-homepage.json";

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
    const text = record[field.key];
    if (typeof text !== "string" || text.trim().length === 0 || text.length > field.max ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
      throw new Error("Invalid value for " + field.label + ".");
    }
    result[field.key] = text.trim();
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
