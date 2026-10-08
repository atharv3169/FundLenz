import type { Metadata } from "next";
import Link from "next/link";
import { BlogAdminLogin } from "@/components/blog/blog-admin-login";

export const metadata: Metadata = {
  title: "FundLenz blog administration",
  robots: { index: false, follow: false },
};

export default function BlogAdminPage() {
  return <main style={{
    minHeight: "100svh", background: "#f6f9fb", padding: "40px 20px",
  }}>
    <div style={{ maxWidth: 900, margin: "0 auto 32px" }}>
      <Link href="/blogpost" style={{ color: "#0d7181", fontSize: 13 }}>← Back to the blog</Link>
    </div>
    <BlogAdminLogin />
  </main>;
}
