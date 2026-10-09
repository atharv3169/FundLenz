import type { InsightCard } from "@/lib/blog-insight-cards";
import styles from "./blog-insight-card.module.css";

export function BlogInsightCard({ card }: { card: InsightCard }) {
  return <section className={styles.card + " " + styles[card.size]} aria-label={card.title}>
    {card.eyebrow && <span className={styles.eyebrow}>{card.eyebrow}</span>}
    <h3>{card.title}</h3>
    {card.description && <p>{card.description}</p>}
    {card.footer && <span className={styles.footer}>{card.footer}</span>}
  </section>;
}