"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BlogHomepageEditor } from "@/components/blog/blog-homepage-editor";
import { type BlogHomepageContent } from "@/lib/blog-homepage-content";
import { type BlogArticleDraft, type BlogDraftSummary } from "@/lib/blog-article-draft";
import { type RichDocument, decodeRichDocument, emptyRichDocument, encodeRichDocument } from "@/lib/blog-rich-document";
import { BlogRichEditor } from "./blog-rich-editor";
import { BlogPaper } from "./blog-paper";
import styles from "./blog-editor-dashboard.module.css";

type Tab = "articles" | "homepage";
type HomepageData = { content: BlogHomepageContent; version: number };
type ApiError = { error?: string };

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init, credentials: "same-origin", cache: "no-store",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const data = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(data.error || "Draft request failed.");
  return data;
}

const articleApi = "/api/blog/admin/article-drafts";
const homepageApi = "/api/blog/admin/homepage-draft";

export function BlogEditorDashboard() {
  const [tab, setTab] = useState<Tab>("articles");
  const [articles, setArticles] = useState<BlogDraftSummary[]>([]);
  const [article, setArticle] = useState<BlogArticleDraft | null>(null);
  const [rich, setRich] = useState<RichDocument | null>(null);
  const [homepage, setHomepage] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editorValid, setEditorValid] = useState(true);
  const [preview, setPreview] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([
        jsonRequest<{ drafts: BlogDraftSummary[] }>(articleApi),
        jsonRequest<HomepageData>(homepageApi),
      ]);
      setArticles(a.drafts);
      setHomepage(h);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cannot load staging drafts.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function openArticle(id: string, keepPreview = false) {
    if (dirty && !window.confirm("Discard unsaved article edits?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await jsonRequest<{ draft: BlogArticleDraft }>(articleApi + "?id=" + encodeURIComponent(id));
      setArticle(data.draft); setRich(decodeRichDocument(data.draft.body_markdown, data.draft.category));
      setDirty(false); setEditorValid(true); setPreview(keepPreview); setTab("articles");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open draft."); }
    finally { setBusy(false); }
  }

  async function newArticle() {
    if (dirty && !window.confirm("Discard unsaved article edits?")) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const data = await jsonRequest<{ draft: BlogArticleDraft }>(articleApi,
        { method: "POST", body: "{}" });
      setArticle(data.draft); setRich(emptyRichDocument(data.draft.category));
      setDirty(false); setEditorValid(true); setPreview(false);
      setArticles(current => [{ id: data.draft.id, title: data.draft.title, summary: "",
        category: data.draft.category, version: data.draft.version, updated_at: data.draft.updated_at },
        ...current]);
      setNotice("New private draft created. It is not published.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create draft."); }
    finally { setBusy(false); }
  }

  function changeArticle(key: "title" | "summary" | "category", value: string) {
    setArticle(current => current ? { ...current, [key]: value } : null);
    if (key === "category") setRich(current => current ? { ...current, category: value } : current);
    setDirty(true); setNotice("");
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!article || !rich || !dirty || busy || !editorValid) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const encodedBody = encodeRichDocument({ ...rich, category: article.category });
      const data = await jsonRequest<{ version: number; updated_at: number }>(articleApi,
        { method: "PUT", body: JSON.stringify({
          id: article.id, version: article.version, title: article.title,
          summary: article.summary, body_markdown: encodedBody, category: article.category,
        }) });
      const saved = { ...article, body_markdown: encodedBody, version: data.version, updated_at: data.updated_at };
      setArticle(saved); setDirty(false);
      setArticles(current => current.map(item => item.id === saved.id ? {
        id: saved.id, title: saved.title, summary: saved.summary, category: saved.category,
        version: saved.version, updated_at: saved.updated_at,
      } : item));
      setNotice("Saved privately in staging D1. Not published.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save draft."); }
    finally { setBusy(false); }
  }

  async function deleteArticle() {
    if (!article || busy || !window.confirm("Permanently delete this private staging draft?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await jsonRequest(articleApi, { method: "DELETE", body: JSON.stringify({ id: article.id, version: article.version }) });
      setArticles(current => current.filter(item => item.id !== article.id));
      setArticle(null); setRich(null); setDirty(false); setEditorValid(true); setNotice("Private draft deleted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete draft."); }
    finally { setBusy(false); }
  }

  async function saveHomepage(content: BlogHomepageContent) {
    if (!homepage) throw new Error("Homepage draft is not ready.");
    const data = await jsonRequest<{ version: number }>(homepageApi,
      { method: "PUT", body: JSON.stringify({ content, version: homepage.version }) });
    setHomepage({ content, version: data.version });
    setNotice("Homepage wording saved as a private staging draft. Not published.");
  }

  return <div className={styles.dashboard}>
    <div className={styles.header}>
      <span className={styles.status}>FUNDLENZ · PRIVATE STAGING</span>
      <h2>Editorial workspace</h2>
      <p>Write articles and refine the homepage before publication. Draft saves stay in the isolated staging database; nothing here changes your public FundLenz website.</p>
    </div>
    <div className={styles.toolbar}>
      <div role="tablist" aria-label="Editorial tools" className={styles.tabs}>
        <button type="button" role="tab" aria-selected={tab === "articles"}
          className={tab === "articles" ? styles.active : ""} onClick={() => setTab("articles")}>Article drafts</button>
        <button type="button" role="tab" aria-selected={tab === "homepage"}
          className={tab === "homepage" ? styles.active : ""} onClick={() => {
            if (dirty && !window.confirm("Discard unsaved article edits?")) return;
            setArticle(null); setRich(null); setDirty(false); setEditorValid(true); setPreview(false); setTab("homepage"); }}>Homepage wording</button>
      </div>
      <button type="button" className={styles.secondary} disabled={busy || loading} onClick={() => {
        if (dirty && !window.confirm("Discard unsaved article edits?")) return;
        void refresh();
      }}>Reload drafts</button>
    </div>
    {loading && <p role="status" className={styles.note}>Loading protected staging drafts…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}

    {tab === "homepage" && homepage && <BlogHomepageEditor key={homepage.version}
      initial={homepage.content} onSave={saveHomepage} onCancel={() => setTab("articles")}/>}
    {tab === "articles" && !loading && <section className={preview ? styles.previewLayout : styles.split}>
      {!preview && <aside className={styles.articleList}>
        <h3>Private article drafts</h3>
        <p className={styles.hint}>Up to 100 recent drafts shown.</p>
        <button className={styles.primary} type="button" disabled={busy} onClick={() => { void newArticle(); }}>+ New article</button>
        {articles.length === 0 && <p className={styles.note}>No drafts yet. Create one to begin.</p>}
        {articles.map(item => <button key={item.id} type="button" disabled={busy}
          className={item.id === article?.id ? styles.selected : ""}
          onClick={() => { void openArticle(item.id); }}>
          {item.title}
          <small>{item.category} · Private draft · {new Date(item.updated_at * 1000).toLocaleDateString()}</small>
        </button>)}
      </aside>}
      <div className={preview ? styles.previewPanel : styles.panel}>
        {!article ? <><h3>Start writing</h3><p className={styles.hint}>Select a draft or create a new article. Publishing will be added only after the GitHub workflow and its safeguards are ready.</p></>
        : <>
          <div className={styles.editorTitleRow}>
            <div><h3>{preview ? "Published-layout preview" : "Article editor"}</h3>
              <p className={styles.hint}>{preview
                ? "This is a private simulation of how the article page will look once it has been published."
                : "Use the formatting toolbar and drag handles to build a complete article. Media use HTTPS URLs during staging."}</p>
            </div>
            <button type="button" className={styles.secondary}
              onClick={() => setPreview(current => !current)}>
              {preview ? "← Back to editor" : "Preview article →"}
            </button>
          </div>
          {preview && rich ? <BlogPaper title={article.title} summary={article.summary}
            category={article.category} blocks={rich.blocks}
            updatedAt={article.updated_at}
            onSelectRelated={id => { void openArticle(id, true); }}
            related={articles.filter(item => item.id !== article.id).map(item => ({
              id: item.id, title: item.title, category: item.category,
            }))}/> : <form className={styles.form} onSubmit={saveArticle}>
            <label>Title
              <input value={article.title} maxLength={160} required disabled={busy}
                onChange={event => changeArticle("title", event.target.value)}/>
            </label>
            <div className={styles.articleMetaFields}>
            <label>Category — choose any topic
              <input type="text" list="fundlenz-categories" value={article.category}
                required maxLength={80} disabled={busy}
                onChange={event => changeArticle("category", event.target.value)}
                placeholder="e.g. Geopolitics, Markets, AI, Opinion"/>
              <datalist id="fundlenz-categories">
                {["Research","Markets","Funds","Learning","Opinion","Technology","Economics","Policy","Geopolitics"].map(c =>
                  <option key={c} value={c}/>)}
              </datalist>
            </label>
            <label>Short description
              <textarea rows={3} maxLength={600} disabled={busy}
                value={article.summary} onChange={event => changeArticle("summary", event.target.value)}/>
            </label>
            </div>
            {rich && <BlogRichEditor value={rich} disabled={busy}
              onDirty={() => { setDirty(true); setNotice(""); }}
              onValidityChange={setEditorValid}
              onChange={updated => { setRich(updated); setDirty(true); setNotice(""); }}/>}
            <div className={styles.buttons}>
              <button type="submit" className={styles.primary} disabled={!dirty || busy || !editorValid}>{busy ? "Saving…" : "Save private draft"}</button>
              <button type="button" className={styles.danger} disabled={busy} onClick={() => { void deleteArticle(); }}>Delete draft</button>
            </div>
          </form>}
          {!editorValid && <p role="alert" className={styles.error}>A paragraph contains text or formatting that exceeds the editor's safe storage limits. Reduce that paragraph before saving.</p>}
          {dirty && <p className={styles.note}>Unsaved changes. Save your private draft before leaving.</p>}
        </>}
      </div>
    </section>}
  </div>;
}
