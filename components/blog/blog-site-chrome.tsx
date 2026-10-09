import Link from "next/link";
import { LegalLink } from "@/components/legal-navigation";
import { FileText, ScanSearch } from "lucide-react";
import { BlogSocialLinks } from "./social-links";
import { defaultBlogHomepageContent, type BlogHomepageContent } from "@/lib/blog-homepage-content";
import styles from "./blog-site-chrome.module.css";

export function BlogSiteHeader({ showAdmin = false }: { showAdmin?: boolean }) {
  return <header className={styles.header}>
    <Link href="/" className={styles.brand} aria-label="FundLenz portfolio lab homepage">
      <span className={styles.logoIcon}><ScanSearch size={25} strokeWidth={1.7}/></span>
      Fund<span>Lenz</span><span className={styles.divider}/>
      <small>BLOG</small>
    </Link>
    <nav className={styles.nav} aria-label="FundLenz navigation">
      <span className={styles.projectCredit}>A project by <strong>Atharva Sahu</strong></span>
      <Link href="/" className={styles.headerButton}><FileText size={16}/> Portfolio lab</Link>
      {showAdmin && <Link href="/blogpost/admin" className={styles.adminLink}>Admin</Link>}
    </nav>
  </header>;
}

export function BlogSiteFooter({copy=defaultBlogHomepageContent}: {copy?: BlogHomepageContent}) {
  return <footer className={styles.footer}>
    <div className={styles.footerInner}>
      <span className={styles.footerBrand}><ScanSearch size={16}/>FundLenz <span>·</span> Make the holdings visible.</span>
      <a className={styles.contact} href="mailto:info@fundlenz.com">info@fundlenz.com</a>
      <nav className={styles.legalLinks} aria-label="Legal information">
        <LegalLink href="/privacy">Privacy</LegalLink>
        <LegalLink href="/terms">Terms</LegalLink>
      </nav>
      <div className={styles.footerRight}>
        {copy.socialInstagramEnabled === "true" && <span>{copy.instagramLead}</span>}
        <BlogSocialLinks copy={copy}/>
        <span>FundLenz is a free educational portfolio lab. It does not provide investment advice or recommend investments.</span>
      </div>
    </div>
  </footer>;
}
