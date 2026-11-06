import type { AnchorHTMLAttributes, ReactNode } from "react";

// Browser tests exercise the actual drawer without changing Next.js routing.
export default function Link({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean | null }) {
  // Prefetch is a routing option, not a DOM attribute.
  const anchorProps = { ...props };
  delete anchorProps.prefetch;
  return <a href={href} {...anchorProps}>{children}</a>;
}
export function usePathname() { return "/"; }
