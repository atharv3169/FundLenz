import { Facebook, Instagram, Linkedin, Music2 } from "lucide-react";
import { safeHttpUrl } from "@/lib/blog-rich-document";
import type { BlogHomepageContent } from "@/lib/blog-homepage-content";
import styles from "./social-links.module.css";

const networks = [
  { name: "Instagram", icon: Instagram, url: "socialInstagramUrl", enabled: "socialInstagramEnabled" },
  { name: "Facebook", icon: Facebook, url: "socialFacebookUrl", enabled: "socialFacebookEnabled" },
  { name: "X", icon: null, url: "socialXUrl", enabled: "socialXEnabled" },
  { name: "TikTok", icon: Music2, url: "socialTikTokUrl", enabled: "socialTikTokEnabled" },
  { name: "LinkedIn", icon: Linkedin, url: "socialLinkedinUrl", enabled: "socialLinkedinEnabled" },
] as const;

export function BlogSocialLinks({ copy }: { copy: BlogHomepageContent }) {
  return <div className={styles.socials} aria-label="FundLenz social profiles">
    {networks.filter(network => copy[network.enabled] === "true" && safeHttpUrl(copy[network.url]))
      .map(network => {
        const Icon = network.icon;
        return <a key={network.name} href={copy[network.url]} target="_blank"
          rel="noopener noreferrer" title={network.name} aria-label={"FundLenz on " + network.name}
          className={styles.link}>{Icon ? <Icon size={16} strokeWidth={1.7}/> : <span aria-hidden="true">𝕏</span>}</a>;
      })}
  </div>;
}
