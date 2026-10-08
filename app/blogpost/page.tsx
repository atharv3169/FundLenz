import type { Metadata } from "next";
import Link from "next/link";
import { ContributionButton, NewsletterBox } from "@/components/blog/visitor-forms";
import styles from "./page.module.css";
import { defaultBlogHomepageContent as copy } from "@/lib/blog-homepage-content";

export const metadata: Metadata = {
  title: "FundLenz Blog | Independent financial research",
  description: "Financial research, educational articles and community contributions from FundLenz.",
};

export default function BlogHomePage() {
  // This public key is intentionally non-sensitive. The Turnstile secret stays server-side.
  // The forms fail closed until this is configured in the Cloudflare Worker.
  const siteKey = process.env.TURNSTILE_SITE_KEY || "";
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>Fund<span>Lenz</span><small> / BLOG</small></Link>
      <nav className={styles.adminNav} aria-label="Blog navigation">
        <Link href="/blogpost/admin" className={styles.labLink}>Admin</Link>
        <Link href="/" className={styles.labLink}>Lab →</Link>
      </nav>
    </header>
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
    <footer className={styles.footer}>
      <div><strong>FundLenz</strong> · {copy.footerDescription}</div>
      <div className={styles.footerActions}>
        <ContributionButton siteKey={siteKey} label={copy.contributionButtonLabel}/>
        <span>{copy.instagramLead} <a href="https://www.instagram.com/fundlenz" target="_blank" rel="noopener noreferrer">FundLenz</a></span>
      </div>
    </footer>
  </div>;
}
