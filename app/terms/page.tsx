import type { Metadata } from "next";
import { LegalBackLink } from "@/components/legal-navigation";

export const metadata: Metadata = {
  title: "Terms of Service | FundLenz",
  description: "Terms for using the FundLenz educational portfolio lab and blog.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="legal-page-card">
        <LegalBackLink />
        <p className="legal-page-kicker">FUNDLENZ · LEGAL</p>
        <h1>Terms of Service</h1>
        <p className="legal-page-date">Updated 8 October 2026</p>
        <p>FundLenz provides free educational tools, research information and, when available, blog articles. Nothing on this website is personalized investment, financial or legal advice. Information may be incomplete or outdated; check original sources before relying on it.</p>

        <h2>Using FundLenz</h2>
        <p>Please use the site lawfully and do not attempt to disrupt its services, access private systems or misuse submission forms. Availability and accuracy are not guaranteed.</p>

        <h2>Contributing articles</h2>
        <p>By submitting material, you confirm you have permission to share it. You retain ownership, while allowing FundLenz to review it and, if accepted, publish it with attribution and reasonable editorial changes. Submission does not guarantee publication. We may decline or remove content.</p>

        <h2>Contact</h2>
        <p>For questions or removal requests, email <a href="mailto:info@fundlenz.com">info@fundlenz.com</a>. Third-party websites linked from FundLenz are governed by their own terms.</p>
      </article>
    </main>
  );
}
