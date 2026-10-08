import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | FundLenz",
  description: "How FundLenz handles visitor emails, article submissions and website data.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-page-card">
        <Link className="legal-home-link" href="/">← Back to FundLenz</Link>
        <p className="legal-page-kicker">FUNDLENZ · LEGAL</p>
        <h1>Privacy Policy</h1>
        <p className="legal-page-date">Updated 8 October 2026</p>
        <p>FundLenz is a free educational portfolio lab. We respect your privacy and collect only information needed to operate the website and its optional blog features.</p>

        <h2>Information we receive</h2>
        <p>When available, the blog's email form collects the address you submit for a voluntary contact list. We do not currently send newsletters. If you contribute an article, we collect the name, email, optional social link, article title and document you provide.</p>

        <h2>How it is handled</h2>
        <p>Form submissions are intended to be stored privately in the FundLenz owner's Google Drive for contact-list management and editorial review—not in the public website repository. Cloudflare may process technical requests to host and protect the site. Portfolio analysis and CSV imports run in your browser rather than being sent to our blog submission storage.</p>

        <h2>Your choices</h2>
        <p>You can request access to, correction of, or deletion of information you submitted by emailing <a href="mailto:info@fundlenz.com">info@fundlenz.com</a>. Records are kept while needed for these purposes, subject to applicable legal requirements. External websites linked from FundLenz have their own privacy policies.</p>
      </article>
    </main>
  );
}
