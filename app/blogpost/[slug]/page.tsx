import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { BlogPaper } from "@/components/blog/blog-paper";
import { BlogSiteFooter, BlogSiteHeader } from "@/components/blog/blog-site-chrome";
import { readPublished } from "@/lib/blog-publication-store";
import { readPublicHomepageCopy } from "@/lib/blog-public-homepage";
import type { BlogAdminDatabase } from "@/lib/blog-admin-state";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

async function fetchArticle(slug: string) {
  const db = (env as unknown as { BLOG_ADMIN_DB?: BlogAdminDatabase }).BLOG_ADMIN_DB;
  return (await readPublished(db, slug))[0] || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  const requestHost = (await headers()).get("host")?.toLowerCase();
  const onPublicDomain = requestHost === "fundlenz.com";
  return article ? {
    title: article.title + " | FundLenz",
    description: article.summary,
    alternates: onPublicDomain ? { canonical: "https://fundlenz.com/blogpost/" + article.slug } : undefined,
    robots: { index: onPublicDomain, follow: onPublicDomain },
  } : { robots: { index: false } };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();
  const db = (env as unknown as { BLOG_ADMIN_DB?: BlogAdminDatabase }).BLOG_ADMIN_DB;
  const related = (await readPublished(db)).filter(item => item.slug !== article.slug).slice(0, 5);
  const host = (await headers()).get("host")?.toLowerCase();
  const publishedCopy = await readPublicHomepageCopy(host || null, db);
  const publishedUrl = host && ["fundlenz.com", "www.fundlenz.com", "fundlenz.atharvsahu711.workers.dev"].includes(host)
    ? "https://" + host + "/blogpost/" + article.slug : undefined;
  return <div className={styles.shell}>
    <BlogSiteHeader/>
    <main className={styles.articlePage}>
      <Link href="/blogpost" className={styles.backToBlog} aria-label="Back to FundLenz blog">
        <span aria-hidden="true">←</span> Back to blog
      </Link>
      <BlogPaper title={article.title} summary={article.summary} category={article.category}
        blocks={article.blocks} authorProfile={article.author} branding={publishedCopy}
        sideCards={article.sideCards}
        updatedAt={Date.parse(article.publishedAt) / 1000}
        publishedUrl={publishedUrl}
        related={related.map(item => ({
          id: item.slug, title: item.title, category: item.category, url: "/blogpost/" + item.slug,
        }))}/>
    </main>
    <BlogSiteFooter copy={publishedCopy}/>
  </div>;
}