import { type ReactNode } from "react";
import { type RichBlock, type RichRun, type RichMediaBlock, blogFontFamily, mediaWidth, safeEmbedUrl, safeHttpUrl } from "@/lib/blog-rich-document";
import styles from "./blog-paper.module.css";

export type ArticlePaperProps = {
  title: string; summary: string; category: string; blocks: RichBlock[];
  related?: { id: string; title: string; category: string; url?: string }[];
  onSelectRelated?: (id: string) => void;
  publishedUrl?: string; author?: string; updatedAt?: number;
};

function InlineRun({ run }: { run: RichRun }) {
  const fontFamily = blogFontFamily(run.font);
  const style = {
    fontFamily, color: run.color,
    fontSize: run.sizePx ? `${run.sizePx}px` : run.size === "small" ? "0.82em" :
      run.size === "large" ? "1.23em" :
      run.size === "xlarge" ? "1.45em" : undefined,
    fontWeight: run.bold ? 700 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline ? "underline" : undefined,
    whiteSpace: "pre-wrap" as const,
  };
  const text = <span style={style}>{run.text}</span>;
  return run.href ? <a href={run.href} target="_blank" rel="noopener noreferrer nofollow">{text}</a> : text;
}

export function RenderRichBlock({ block }: { block: RichBlock }) {
  if ("runs" in block) {
    const children: ReactNode = block.runs.map((run, i) => <InlineRun key={i} run={run} />);
    if (block.type === "heading") return <h2 className={styles.articleHeading}>{children}</h2>;
    if (block.type === "subheading") return <h3 className={styles.articleSubheading}>{children}</h3>;
    if (block.type === "quote") return <blockquote className={styles.quote}>{children}</blockquote>;
    return <p className={styles.paragraph}>{children}</p>;
  }
  const media = block as RichMediaBlock;
  const width = mediaWidth(media.widthPct, media.type);
  const mediaStyle = { width: width + "%", marginLeft: media.align === "right" ? "auto" :
    media.align === "left" ? "0" : "auto", marginRight: media.align === "left" ? "auto" :
    media.align === "right" ? "0" : "auto" };
  if (block.type === "image") return <figure className={styles.figure} style={mediaStyle}>
    {/* External HTTPS images are URL-only in this staging iteration; no private file uploads. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={block.src} alt={block.alt || block.caption || "Article image"} loading="lazy" />
    {block.caption && <figcaption>{block.caption}</figcaption>}
  </figure>;
  if (block.type === "video-thumbnail") return <figure className={styles.figure} style={mediaStyle}>
    <a href={block.src} className={styles.videoThumbnail} target="_blank" rel="noopener noreferrer"
      aria-label={"Open linked video: " + (block.caption || "external video")}>
      {block.thumbnail
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={block.thumbnail} alt={block.alt || block.caption || "Video thumbnail"} loading="lazy" />
        : <span className={styles.missingThumb}>Open video</span>}
      <span className={styles.playIcon} aria-hidden="true">▶</span>
    </a>
    {block.caption && <figcaption>{block.caption}</figcaption>}
  </figure>;
  const embed = safeEmbedUrl(block.src);
  return <figure className={styles.figure} style={mediaStyle}>
    {embed ? <div className={styles.videoFrame}>
      <iframe src={embed} title={block.caption || "Embedded video"} loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
    </div> : /\.(mp4|webm|ogg)(\?.*)?$/i.test(block.src)
      ? <video src={block.src} controls preload="metadata" playsInline className={styles.videoNative}/>
      : <a className={styles.externalVideo} href={block.src} target="_blank" rel="noopener noreferrer">▶ Watch video at source ↗</a>}
    {block.caption && <figcaption>{block.caption}</figcaption>}
  </figure>;
}

export function BlogPaper({ title, summary, category, blocks, related = [], publishedUrl, onSelectRelated,
  author = "FundLenz Editorial", updatedAt }: ArticlePaperProps) {
  const hasShare = Boolean(publishedUrl);
  const link = publishedUrl || "";
  return <div className={styles.shell}>
    <div className={styles.masthead}>
      <div><span className={styles.brand}>Fund<span>Lenz</span></span><small> JOURNAL</small></div>
      <span className={styles.mastheadRight}>Ideas · Evidence · Markets</span>
    </div>
    <div className={styles.layout}>
      <article className={styles.paper}>
        <div className={styles.breadcrumb}>THE JOURNAL <span>/</span> {category.toUpperCase()}</div>
        <header className={styles.articleHeader}>
          <p className={styles.category}>{category}</p>
          <h1>{title}</h1>
          <div className={styles.byline}>
            <span className={styles.avatar} aria-hidden="true">F</span>
            <div><strong>{author}</strong>
              <small>{updatedAt ? new Date(updatedAt * 1000).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric" }) : "Editorial preview"} · {Math.max(1,
                  Math.round(blocks.reduce((n, b) => n + ("runs" in b ? b.runs.map(r => r.text).join("").split(/\s+/).length : 0), 0) / 210))} min read</small></div>
          </div>
          {summary && <p className={styles.deck}>{summary.replace(/\s+/g, " ").trim()}</p>}
        </header>
        <div className={styles.body}>{blocks.map(block => <RenderRichBlock key={block.id} block={block} />)}</div>
        <footer className={styles.articleFooter}>
          <span>FundLenz is an educational research platform. This article is not investment advice.</span>
          <div className={styles.tags}><span>{category}</span><span>FundLenz Research</span></div>
        </footer>
      </article>
      <aside className={styles.sidebar}>
        <section className={styles.sideCard}>
          <div className={styles.sideHeading}>SHARE THIS ARTICLE</div>
          <p className={styles.sideNote}>Share useful research with your network.</p>
          {hasShare
            ? <div className={styles.shareLinks}>
              <a href={"https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(link)}
                target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
              <a href={"https://twitter.com/intent/tweet?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(title)}
                target="_blank" rel="noopener noreferrer">X / Twitter ↗</a>
              <a href={"mailto:?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(link)}>Email ↗</a>
            </div>
            : <p className={styles.sideNote}>Share links become available after publication. Private drafts stay private.</p>}
        </section>
        <section className={styles.sideCard}>
          <div className={styles.sideHeading}>RELATED READING</div>
          {related.length ? related.slice(0, 5).map((item, index) => <div className={styles.related} key={item.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>{onSelectRelated
                ? <button type="button" className={styles.relatedLink} onClick={() => onSelectRelated(item.id)}>{item.title}</button>
                : item.url && safeHttpUrl(item.url)
                  ? <a className={styles.relatedLink} href={item.url}>{item.title}</a>
                  : <strong>{item.title}</strong>}
              <small>{item.category}{onSelectRelated ? " · Private preview" : ""}</small></div>
          </div>) : <p className={styles.sideNote}>Explore more FundLenz analysis as new articles are published.</p>}
        </section>
        <section className={styles.featureCard}>
          <span className={styles.sideHeading}>FUNDLENZ INSIGHTS</span>
          <h3>Understand the market. Not just the headlines.</h3>
          <p>Research, explainers, and data-led perspectives on investing.</p>
          <span>Independent education · No investment recommendations</span>
        </section>
        <div className={styles.sideFoot}>© FundLenz · Educational content only</div>
      </aside>
    </div>
  </div>;
}
