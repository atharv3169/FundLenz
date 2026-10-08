import { SocialIcon } from "./social-icon";
import { safeHttpUrl } from "@/lib/blog-rich-document";
import type { BlogHomepageContent } from "@/lib/blog-homepage-content";
import styles from "./social-links.module.css";

const networks = [
  { name: "Instagram", url: "socialInstagramUrl", enabled: "socialInstagramEnabled" },
  { name: "Facebook", url: "socialFacebookUrl", enabled: "socialFacebookEnabled" },
  { name: "X", url: "socialXUrl", enabled: "socialXEnabled" },
  { name: "TikTok", url: "socialTikTokUrl", enabled: "socialTikTokEnabled" },
  { name: "LinkedIn", url: "socialLinkedinUrl", enabled: "socialLinkedinEnabled" },
] as const;

export function BlogSocialLinks({ copy }: { copy: BlogHomepageContent }) {
  return <div className={styles.socials} aria-label="FundLenz social profiles">
    {networks.filter(network => copy[network.enabled] === "true" && safeHttpUrl(copy[network.url]))
      .map(network => {
        return <a key={network.name} href={copy[network.url]} target="_blank"
          rel="noopener noreferrer" title={network.name} aria-label={"FundLenz on " + network.name}
          className={styles.link}><SocialIcon network={network.name}/></a>;
      })}
  </div>;
}
