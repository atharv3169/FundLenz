import Link from "next/link";
import { ScanSearch } from "lucide-react";
import { ProjectsDrawer } from "./projects-drawer";
import styles from "./fundlens-blog-nav.module.css";

/** Shared FundLenz site header used by every route. */
export function SiteHeader() {
  return (
    <header className={`masthead ${styles.siteHeader}`}>
      <Link href="/" prefetch={false} className="brand" aria-label="FundLenz home">
        <span className="brand-mark"><ScanSearch size={25} strokeWidth={1.7} aria-hidden="true" /></span>
        Fund<span>Lenz</span><span className="brand-divider" /><small>PORTFOLIO LAB</small>
      </Link>
      <nav className="masthead-right" aria-label="FundLenz navigation">
        <Link href="/catalogue-global" className="catalog-nav-link catalogue-main-link">Catalogue</Link>
        <Link href="/blogpost" className="catalog-nav-link lab-blog-link">Blog</Link>
        <ProjectsDrawer />
        <span className="project-credit inline-flex items-center gap-1.5 whitespace-nowrap">
          A project by <Link href="/about" className="font-medium text-[#dce7ec] underline decoration-[#9ab5c2] underline-offset-[3px] hover:text-[#8adacc] hover:decoration-[#8adacc] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">Atharva Sahu</Link>
        </span>
      </nav>
    </header>
  );
}
