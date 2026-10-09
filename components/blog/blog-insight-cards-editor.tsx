"use client";

import type { InsightCard, InsightCardSize } from "@/lib/blog-insight-cards";
import { BlogInsightCard } from "./blog-insight-card";
import styles from "./blog-insight-cards-editor.module.css";

export function BlogInsightCardsEditor({ label, cards, onChange, disabled = false, maxCards = 5 }: {
  label: string; cards: readonly InsightCard[]; onChange: (cards: InsightCard[]) => void;
  disabled?: boolean; maxCards?: number;
}) {
  function update(id: string, field: keyof InsightCard, value: string) {
    onChange(cards.map(card => card.id === id ? { ...card, [field]: value } : card));
  }
  function move(index: number, amount: number) {
    const next = [...cards], target = index + amount;
    if (target < 0 || target >= cards.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add() {
    if (cards.length >= maxCards) return;
    onChange([...cards, {
      id: crypto.randomUUID(), eyebrow: "FUNDLENZ INSIGHTS",
      title: "Your card headline", description: "Explain an idea to your readers.",
      footer: "Independent educational content", size: "standard",
    }]);
  }
  return <div className={styles.editor} aria-label={label}>
    <div className={styles.heading}>
      <div><h3>{label}</h3><p>Change text, size, and order. Cards move below the main content on phones.</p></div>
      <button type="button" disabled={disabled || cards.length >= maxCards} onClick={add}>+ Add card</button>
    </div>
    {!cards.length && <p className={styles.empty}>No cards yet. Add one to build your own Insights panel.</p>}
    {cards.map((card, index) => <div className={styles.item} key={card.id}>
      <div className={styles.itemHead}>
        <strong>Card {index + 1}</strong>
        <div className={styles.actions}>
          <button type="button" disabled={disabled || index === 0} onClick={() => move(index,-1)}
            aria-label={"Move " + label + " card " + (index+1) + " up"}>↑ Up</button>
          <button type="button" disabled={disabled || index === cards.length - 1} onClick={() => move(index,1)}
            aria-label={"Move " + label + " card " + (index+1) + " down"}>↓ Down</button>
          <button type="button" disabled={disabled} className={styles.remove}
            onClick={() => onChange(cards.filter(other => other.id !== card.id))}>Remove</button>
        </div>
      </div>
      <div className={styles.fields}>
        <label>Card label
          <input value={card.eyebrow} maxLength={55} disabled={disabled}
            onChange={event => update(card.id,"eyebrow",event.target.value)}/>
        </label>
        <label>Headline
          <input value={card.title} maxLength={145} required disabled={disabled}
            onChange={event => update(card.id,"title",event.target.value)}/>
        </label>
        <label className={styles.full}>Description
          <textarea rows={3} value={card.description} maxLength={350} disabled={disabled}
            onChange={event => update(card.id,"description",event.target.value)}/>
        </label>
        <label className={styles.full}>Footer note
          <textarea rows={2} value={card.footer} maxLength={175} disabled={disabled}
            onChange={event => update(card.id,"footer",event.target.value)}/>
        </label>
        <label>Card size
          <select value={card.size} disabled={disabled}
            onChange={event => update(card.id,"size",event.target.value as InsightCardSize)}>
            <option value="compact">Compact · 78% width</option>
            <option value="standard">Standard · 90% width</option>
            <option value="large">Large · full width</option>
          </select>
        </label>
      </div>
      <div className={styles.preview}><BlogInsightCard card={card}/></div>
    </div>)}
    <p className={styles.counter}>{cards.length} / {maxCards} cards</p>
  </div>;
}