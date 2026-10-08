import type { ReactNode } from "react";

export type SocialNetwork = "Instagram" | "Facebook" | "X" | "TikTok" | "LinkedIn";

/** Tiny monochrome platform marks; all are CSS-inherited grey, not remote images. */
export function SocialIcon({ network }: { network: SocialNetwork }): ReactNode {
  if (network === "Instagram") return <svg width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5"/>
    <circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
  </svg>;
  if (network === "Facebook") return <svg width="16" height="16" viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M14 21v-8h2.8l.4-3.3H14V7.6c0-1 .3-1.7 1.7-1.7h1.7V3.1A23 23 0 0 0 15 3c-2.6 0-4.4 1.6-4.4 4.5v2.2H8V13h2.6v8H14z"/>
  </svg>;
  if (network === "X") return <span aria-hidden="true" style={{fontSize:17,fontWeight:650}}>𝕏</span>;
  if (network === "LinkedIn") return <svg width="16" height="16" viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3.4 9H7v12H3.4V9Zm6 0h3.4v1.7c.5-.9 1.5-2 3.7-2 4 0 4.2 2.7 4.2 6.1V21h-3.6v-5.6c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9.4V9Z"/>
  </svg>;
  return <svg width="16" height="16" viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M16 2h2.1c.2 2 1.2 3.8 3.9 4.3v3.4a10 10 0 0 1-4-1.1v6.2A7.1 7.1 0 1 1 10.6 8v3.7a3.5 3.5 0 1 0 3.9 3.5V2H16z"/>
  </svg>;
}
