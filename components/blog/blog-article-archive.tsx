"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { PublishedArticle } from "@/lib/blog-publications";
import { searchPublishedArticles } from "@/lib/blog-publications";
import styles from "@/app/blogpost/page.module.css";

export function BlogArticleArchive({ articles, heading, status, empty }: {
  articles: readonly PublishedArticle[];
  heading: string;
  status: string;
  empty: string;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchPublishedArticles(articles, query), [articles, query]);
  return <section aria-label="Article archive" className={styles.archive}>
    <div className={styles.archiveHeader}>
      <div><h2>{heading}</h2><p>{articles.length ? `${articles.length} published ${articles.length === 1 ? "article" : "articles"}` : status}</p></div>
    </div>
    <label className={styles.archiveSearch}>
      <Search size={18} aria-hidden="true" />
      <span className={styles.visuallyHidden}>Search published articles</span>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Search articles, topics and authors" autoComplete="off" />
      {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear article search">Clear</button>}
    </label>
    {matches.length ? <div className={styles.articleGrid}>
      {matches.map(article => <Link key={article.slug} className={styles.articleCard} href={`/blogpost/${article.slug}`}>
        <span>{article.category} · {new Date(article.publishedAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric", timeZone:"UTC" })}</span>
        <h3>{article.title}</h3><p>{article.summary}</p>
        <small>By {article.author.name || "FundLenz Editorial"} →</small>
      </Link>)}
    </div> : <p role="status" className={styles.empty}>
      {articles.length ? "No articles match your search. Try another title, topic or author." : empty}
    </p>}
  </section>;
}
