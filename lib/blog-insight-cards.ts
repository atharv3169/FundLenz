/** Validated, text-only FundLenz Insight cards. No raw HTML, CSS or URL sinks. */
export type InsightCardSize = "compact" | "standard" | "large";
export type InsightCard = {
  id: string; eyebrow: string; title: string; description: string; footer: string;
  size: InsightCardSize;
};
export const defaultArticleInsightCards: readonly InsightCard[] = [{
  id: "fundlenz-insights", eyebrow: "FUNDLENZ INSIGHTS",
  title: "Understand the market. Not just the headlines.",
  description: "Research, explainers, and data-led perspectives on investing.",
  footer: "Independent education · No investment recommendations",
  size: "standard",
}];

const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const disallowed = /[<>]/;
export function validateInsightCards(input: unknown, maxCards = 8): InsightCard[] {
  if (!Array.isArray(input) || input.length > maxCards) throw Error("Too many insight cards.");
  const result: InsightCard[] = [];
  const ids = new Set<string>();
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Invalid insight card.");
    const card = value as Record<string, unknown>;
    const allowed = ["id","eyebrow","title","description","footer","size"];
    if (Object.keys(card).some(k => !allowed.includes(k)))
      throw Error("Unexpected insight card field.");
    if (typeof card.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(card.id) || ids.has(card.id))
      throw Error("Invalid or duplicate card identifier.");
    ids.add(card.id);
    for (const [key,max] of [["eyebrow",55],["title",145],["description",350],["footer",175]] as const) {
      const text = card[key];
      if (typeof text !== "string" || (key === "title" && !text.trim()) ||
          text.length > max || controls.test(text) || disallowed.test(text))
        throw Error("Invalid insight card " + key + ".");
    }
    if (!["compact","standard","large"].includes(String(card.size)))
      throw Error("Invalid insight card size.");
    result.push({
      id: card.id, eyebrow: card.eyebrow as string, title: card.title as string,
      description: card.description as string, footer: card.footer as string,
      size: card.size as InsightCardSize,
    });
  }
  return result;
}

export function parseHomepageInsightCards(json: string): InsightCard[] {
  if (json.length > 3900) throw Error("Homepage insight cards exceed storage size.");
  return validateInsightCards(JSON.parse(json), 5);
}
export function encodeHomepageInsightCards(cards: readonly InsightCard[]): string {
  const encoded = JSON.stringify(validateInsightCards(cards, 5));
  if (encoded.length > 3900) throw Error("Shorten the card text before saving (maximum 3,900 characters per side).");
  return encoded;
}