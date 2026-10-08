import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { BlogPaper } from "@/components/blog/blog-paper";
import { BlogSiteFooter, BlogSiteHeader } from "@/components/blog/blog-site-chrome";
import { publishedArticles } from "@/lib/blog-publications";
import styles from "../page.module.css";

export function generateStaticParams() {
  return publishedArticles.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = publishedArticles.find(item => item.slug === slug);
  return article ? { title: `${article.title} | FundLenz`, description: article.summary } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = publishedArticles.find(item => item.slug === slug);
  if (!article) notFound();
  const host = (await headers()).get("host")?.toLowerCase();
  const publishedUrl = host && ["fundlenz.com", "www.fundlenz.com", "fundlenz.atharvsahu711.workers.dev"].includes(host)
    ? `https://${host}/blogpost/${article.slug}` : undefined;
  return <div className={styles.shell}>
    <BlogSiteHeader/>
    <main className={styles.articlePage}>
      <BlogPaper title={article.title} summary={article.summary} category={article.category}
        blocks={article.blocks} authorProfile={article.author}
        updatedAt={Date.parse(article.publishedAt) / 1000}
        publishedUrl={publishedUrl}
        related={publishedArticles.filter(item => item.slug !== article.slug).slice(0, 5).map(item => ({
          id: item.slug, title: item.title, category: item.category, url: `/blogpost/${item.slug}`,
        }))}/>
    </main>
    <BlogSiteFooter/>
  </div>;
}
