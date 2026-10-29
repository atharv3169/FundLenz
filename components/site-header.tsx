"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ScanSearch } from "lucide-react";
import { isReviewedEditorHost } from "@/lib/blog-editor-hosts";
import { ProjectsDrawer } from "./projects-drawer";
import styles from "./fundlens-blog-nav.module.css";

const subscribeToHost = () => () => {};
const isEditorHost = () => isReviewedEditorHost(window.location.hostname);
const serverEditorHost = () => false;

/** Preserve the homepage header style with contextual page navigation. */
export function SiteHeader() {
  const pathname = usePathname() || "/";
  const blogPage = pathname === "/blogpost" || pathname.startsWith("/blogpost/");
  const cataloguePage = pathname === "/catalogue" || pathname.startsWith("/catalogue-");
  const fincalcPage = pathname === "/fincalc";
  const homePage = pathname === "/";
  const reviewedEditorHost = useSyncExternalStore(subscribeToHost, isEditorHost, serverEditorHost);
  const primary = homePage
    ? { href: "/catalogue-global", label: "Catalogue" }
    : { href: "/", label: "Portfolio Lab" };
  const secondary = blogPage && reviewedEditorHost
    ? { href: "/blogpost/admin", label: "Admin" }
    : { href: "/blogpost", label: "Blog" };
  const subtitle = blogPage ? "BLOG"
    : fincalcPage ? "FINCALC"
    : cataloguePage ? (pathname === "/catalogue-securities" ? "SECURITIES CATALOGUE" : "FUND CATALOGUE")
    : homePage ? "PORTFOLIO LAB" : "FUNDLENZ";

  return (
    <header className={`masthead ${styles.siteHeader}`} data-primary={homePage ? "catalogue" : "portfolio"} data-section={blogPage ? "blog" : "site"}>
      <Link href="/" prefetch={false} className="brand" aria-label="FundLenz home">
        <span className="brand-mark"><ScanSearch size={25} strokeWidth={1.7} aria-hidden="true" /></span>
        Fund<span>Lenz</span><span className="brand-divider" /><small>{subtitle}</small>
      </Link>
      <nav className="masthead-right" aria-label="FundLenz navigation">
        <Link href={primary.href} className="catalog-nav-link catalogue-main-link">{primary.label}</Link>
        <Link href={secondary.href} className="catalog-nav-link lab-blog-link">{secondary.label}</Link>
        <ProjectsDrawer />
        <span className="project-credit inline-flex items-center gap-1.5 whitespace-nowrap">
          A project by <Link href="/about" className="font-medium text-[#dce7ec] underline decoration-[#9ab5c2] underline-offset-[3px] hover:text-[#8adacc] hover:decoration-[#8adacc] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">Atharva Sahu</Link>
        </span>
      </nav>
    </header>
  );
}
