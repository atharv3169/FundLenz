import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("app/blogpost/page.module.css", "utf8");
const archive = readFileSync("components/blog/blog-article-archive.tsx", "utf8");
const detail = readFileSync("app/blogpost/[slug]/page.tsx", "utf8");

const grid = css.match(/\.articleGrid\{([^}]+)\}/)?.[1] || "";
const card = css.match(/\.articleCard\{([^}]+)\}/)?.[1] || "";
assert.match(grid, /flex-direction:\s*column/, "Archive cards must form a single vertical stack");
assert.match(grid, /padding:\s*18px 0 0/, "Stack must meet both edges of the archive container");
assert.doesNotMatch(grid, /grid-template-columns:\s*repeat\(2/, "Do not use half-width article cards");
assert.match(card, /width:\s*100%/, "Each article must fill the archive width");
assert.match(card, /border-radius:\s*0/, "Stacked archive rows should not resemble detached tiles");
assert.match(archive, /className=\{styles\.articleGrid\}/);
assert.match(archive, /className=\{styles\.articleCard\}/);
assert.match(archive, /href=\{\`\/blogpost\/\$\{article\.slug\}\`\}/,
  "Every published article must retain a working detail link");
assert.match(detail, /<Link href="\/blogpost" className=\{styles\.backToBlog\}/,
  "Article pages must have a real route back, not history-only navigation");
assert.match(detail, /<BlogPaper/, "Public article presentation must be preserved");
assert.match(css, /\.backToBlog:focus-visible/, "Back link must have visible keyboard focus");
console.log("PASS: full-width stacked archive, mobile edges, direct-return link and focus visibility");
