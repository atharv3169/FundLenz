import type { Metadata } from "next";
import Link from "next/link";
import { ContributionButton, NewsletterBox } from "@/components/blog/visitor-forms";
import styles from "./page.module.css";

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
      <Link href="/" className={styles.labLink}>Lab →</Link>
    </header>
    <main className={styles.main}>
      <p className={styles.eyebrow}>FUNDLENZ JOURNAL</p>
      <h1>Research worth reading.</h1>
      <p className={styles.intro}>A home for clear, evidence-led writing about markets, funds and the decisions behind portfolios.</p>
      <section aria-label="Article archive" className={styles.archive}>
        <div className={styles.archiveHeader}><h2>Articles</h2><span>Publication library in development</span></div>
        <p className={styles.empty}>The article library is being prepared. Published articles will appear here once the editorial system is ready.</p>
      </section>
      <NewsletterBox siteKey={siteKey} />
    </main>
    <footer className={styles.footer}>
      <div><strong>FundLenz</strong> · Independent education, not investment advice.</div>
      <div className={styles.footerActions}>
        <ContributionButton siteKey={siteKey}/>
        <span>Follow on Instagram - <a href="https://www.instagram.com/fundlenz" target="_blank" rel="noopener noreferrer">FundLenz</a></span>
      </div>
    </footer>
  </div>;
}
