import type { Metadata } from "next";
import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { ContributionButton, NewsletterBox } from "@/components/blog/visitor-forms";
import styles from "./page.module.css";
import { BlogSiteHeader, BlogSiteFooter } from "@/components/blog/blog-site-chrome";
import { readStagingHomepageCopy } from "@/lib/blog-staging-homepage";
import type { BlogAdminDatabase } from "@/lib/blog-admin-state";

export const metadata: Metadata = {
  title: "FundLenz Blog | Independent financial research",
  description: "Financial research, educational articles and community contributions from FundLenz.",
};

export const dynamic = "force-dynamic";

export default async function BlogHomePage() {
  // On the private staging host, render the owner-saved homepage draft from D1.
  // On every other host, use the reviewed, version-controlled public defaults.
  const host = (await headers()).get("host")?.toLowerCase() || null;
  const db = (env as unknown as { BLOG_ADMIN_DB?: BlogAdminDatabase }).BLOG_ADMIN_DB;
  const copy = await readStagingHomepageCopy(host, db);
  // This public key is intentionally non-sensitive. The Turnstile secret stays server-side.
  // The forms fail closed until this is configured in the Cloudflare Worker.
  const siteKey = process.env.TURNSTILE_SITE_KEY || "";
  return <div className={styles.shell}>
    <BlogSiteHeader/>
    <main className={styles.main}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h1>{copy.heroHeading}</h1>
      <p className={styles.intro}>{copy.heroDescription}</p>
      <section aria-label="Article archive" className={styles.archive}>
        <div className={styles.archiveHeader}><h2>{copy.articlesHeading}</h2><span>{copy.articlesStatus}</span></div>
        <p className={styles.empty}>{copy.articlesEmpty}</p>
      </section>
      <NewsletterBox siteKey={siteKey} heading={copy.newsletterHeading} description={copy.newsletterDescription}
        placeholder={copy.newsletterPlaceholder} submitLabel={copy.newsletterSubmitLabel} />
    </main>
    <div className={styles.contributionFooter}>
      <span>{copy.footerDescription}</span>
      <ContributionButton siteKey={siteKey} label={copy.contributionButtonLabel}/>
    </div>
    <BlogSiteFooter copy={copy}/>
  </div>;
}
