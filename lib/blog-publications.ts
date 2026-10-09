import { type InsightCard } from "@/lib/blog-insight-cards";
import { isCategory, validateRichDocument, type ArticleAuthor, type RichBlock } from "@/lib/blog-rich-document";

/** Reviewed public articles live in version control. Private D1 drafts are never read here. */
export type PublishedArticle = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: string;
  author: ArticleAuthor;
  blocks: RichBlock[];
  sideCards?: InsightCard[];
};

export const publishedArticles: readonly PublishedArticle[] = [];

export function validatePublishedArticles(articles: readonly PublishedArticle[]): void {
  const slugs = new Set<string>();
  for (const article of articles) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) || slugs.has(article.slug) ||
        !article.title.trim() || article.title.length > 160 ||
        !article.summary.trim() || article.summary.length > 600 || !isCategory(article.category) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(article.publishedAt) ||
        Number.isNaN(Date.parse(article.publishedAt)) ||
        new Date(article.publishedAt).toISOString().slice(0, 10) !== article.publishedAt) {
      throw new Error("Invalid published article metadata.");
    }
    slugs.add(article.slug);
    validateRichDocument({ format: "fundlenz-rich-1", category: article.category,
      blocks: article.blocks, author: article.author, sideCards: article.sideCards });
  }
}

validatePublishedArticles(publishedArticles);

export function searchPublishedArticles(articles: readonly PublishedArticle[], query: string): PublishedArticle[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...articles];
  return articles.filter(article => {
    const searchable = [article.title, article.summary, article.category, article.author.name || "",
      ...article.blocks.flatMap(block => "runs" in block
        ? [block.runs.map(run => run.text).join("")]
        : [block.caption || "", block.alt || ""]),
    ].join(" ").toLocaleLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}
