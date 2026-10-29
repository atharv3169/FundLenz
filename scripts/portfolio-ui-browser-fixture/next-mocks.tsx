import type { AnchorHTMLAttributes, ReactNode } from "react";

// Browser tests exercise the actual drawer without changing Next.js routing.
export default function Link({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return <a href={href} {...props}>{children}</a>;
}
export function usePathname() { return "/"; }
