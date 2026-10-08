import type { RichRun } from "@/lib/blog-rich-document";

/** Immutable run-level formatting: never mutate contentEditable DOM to style text. */
export type RunStyle = Partial<Omit<RichRun, "text">>;
export type TextSelection = { start: number; end: number };

export function richText(runs: RichRun[]): string {
  return runs.map(run => run.text).join("");
}
export function sameRuns(left: RichRun[], right: RichRun[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function equalFormatting(a: RichRun, b: RichRun): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete("text");
  return [...keys].every(key => a[key as keyof RichRun] === b[key as keyof RichRun]);
}
export function mergeAdjacentRuns(runs: RichRun[]): RichRun[] {
  const out: RichRun[] = [];
  for (const run of runs) {
    if (run.text === "" && runs.length > 1) continue;
    const previous = out[out.length - 1];
    if (previous && equalFormatting(previous, run)) previous.text += run.text;
    else out.push({ ...run });
  }
  return out.length ? out : [{ text: "" }];
}
export function applyRunStyle(
  runs: RichRun[], selection: TextSelection | null, style: RunStyle,
): RichRun[] {
  const text = richText(runs);
  const start = selection?.start ?? 0;
  const end = selection?.end ?? text.length;
  if (!Number.isInteger(start) || !Number.isInteger(end) ||
      start < 0 || end < start || end > text.length) {
    throw new Error("Selection no longer matches the article text.");
  }
  // Empty or lost selections format the entire block, not an arbitrary substring.
  const from = start === end ? 0 : start;
  const to = start === end ? text.length : end;
  let index = 0;
  const updated: RichRun[] = [];
  for (const run of runs) {
    const left = index, right = index + run.text.length;
    index = right;
    if (right <= from || left >= to) {
      updated.push({ ...run });
      continue;
    }
    const localStart = Math.max(0, from - left);
    const localEnd = Math.min(run.text.length, to - left);
    if (localStart) updated.push({ ...run, text: run.text.slice(0, localStart) });
    updated.push({ ...run, ...style, text: run.text.slice(localStart, localEnd) });
    if (localEnd < run.text.length)
      updated.push({ ...run, text: run.text.slice(localEnd) });
  }
  if (!text.length) updated.push({ ...(runs[0] || { text: "" }), ...style, text: "" });
  const merged = mergeAdjacentRuns(updated);
  if (richText(merged) !== text) throw new Error("Formatting changed the original text.");
  if (merged.length > 300) throw new Error("Too many separately formatted segments; reduce formatting.");
  if (merged.some(run => run.text.length > 12000))
    throw new Error("Paragraph is too long. Split it into shorter blocks.");
  return merged;
}
export function toggleRunStyle(runs: RichRun[], selection: TextSelection | null,
  key: "bold" | "italic" | "underline"): RichRun[] {
  const start = selection?.start ?? 0;
  const end = selection?.end ?? richText(runs).length;
  const from = start === end ? 0 : start, to = start === end ? richText(runs).length : end;
  let offset = 0;
  const overlapping = runs.filter(run => {
    const overlaps = offset < to && offset + run.text.length > from;
    offset += run.text.length;
    return overlaps;
  });
  const turnOn = !overlapping.length || overlapping.some(run => !run[key]);
  return applyRunStyle(runs, selection, { [key]: turnOn });
}
