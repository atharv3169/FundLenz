"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BlogHomepageEditor } from "@/components/blog/blog-homepage-editor";
import { type BlogHomepageContent } from "@/lib/blog-homepage-content";
import { type BlogArticleDraft, type BlogDraftSummary } from "@/lib/blog-article-draft";
import { type RichDocument, type ArticleAuthor, safeAvatarDataUrl, decodeRichDocument, emptyRichDocument, encodeRichDocument } from "@/lib/blog-rich-document";
import { BlogRichEditor } from "./blog-rich-editor";
import { BlogPaper } from "./blog-paper";
import styles from "./blog-editor-dashboard.module.css";

type Tab = "articles" | "homepage";
type HomepageData = { content: BlogHomepageContent; version: number };
type HomepagePublication = { revision: number; published: boolean; updatedAt: number | null };
type ApiError = { error?: string };
type PublicationState = { slug: string; draftId: string; revision: number; published: boolean; updatedAt: number };

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
const homepagePublicationApi = "/api/blog/admin/homepage-publication";
const publicationApi = "/api/blog/admin/publications";

export function BlogEditorDashboard({ onUnsavedChange }: { onUnsavedChange?: (dirty: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("articles");
  const [articles, setArticles] = useState<BlogDraftSummary[]>([]);
  const [article, setArticle] = useState<BlogArticleDraft | null>(null);
  const [rich, setRich] = useState<RichDocument | null>(null);
  const [homepage, setHomepage] = useState<HomepageData | null>(null);
  const [homepagePublication, setHomepagePublication] = useState<HomepagePublication>({revision:0,published:false,updatedAt:null});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editorValid, setEditorValid] = useState(true);
  const [preview, setPreview] = useState(false);
  const [homepageDirty, setHomepageDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [publication, setPublication] = useState<PublicationState | null>(null);
  const [publicationSlug, setPublicationSlug] = useState("");
  const articleForm = useRef<HTMLFormElement>(null);
  const unsaved = dirty || homepageDirty;
  useEffect(() => { onUnsavedChange?.(unsaved); }, [unsaved, onUnsavedChange]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && tab === "articles" && !preview) {
        event.preventDefault(); articleForm.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [tab, preview]);
  function leaveHomepage() {
    if (busy || (homepageDirty && !window.confirm("Discard unsaved homepage edits?"))) return;
    setHomepageDirty(false); setTab("articles");
  }
  async function reloadDrafts() {
    if (busy || (unsaved && !window.confirm("Discard unsaved edits and reload drafts?"))) return;
    setBusy(true);
    if (await refresh()) {
      setArticle(null); setRich(null); setPublication(null); setPublicationSlug(""); setDirty(false); setHomepageDirty(false);
      setEditorValid(true); setPreview(false); setTab("articles"); setNotice("Draft list reloaded.");
    }
    setBusy(false);
  }

  const refresh = useCallback(async () => {
    try {
      const [a, h, pub] = await Promise.all([
        jsonRequest<{ drafts: BlogDraftSummary[] }>(articleApi),
        jsonRequest<HomepageData>(homepageApi),
        jsonRequest<{ publication: HomepagePublication }>(homepagePublicationApi)
          .catch(() => ({ publication: { revision: 0, published: false, updatedAt: null } })),
      ]);
      setArticles(a.drafts);
      setHomepage(h);
      setHomepagePublication(pub.publication);
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cannot load private drafts.");
      return false;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function openArticle(id: string, keepPreview = false) {
    if (busy) return;
    if (dirty && !window.confirm("Discard unsaved article edits?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await jsonRequest<{ draft: BlogArticleDraft }>(articleApi + "?id=" + encodeURIComponent(id));
      // Decode before updating either state: a damaged draft must never inherit
      // the previously open article's body and become accidentally overwritable.
      const decoded = decodeRichDocument(data.draft.body_markdown, data.draft.category);
      setArticle(data.draft); setRich(decoded);
      const status = await jsonRequest<{ publication: PublicationState | null }>(
        publicationApi + "?draftId=" + encodeURIComponent(id)).catch(() => ({ publication: null }));
      setPublication(status.publication);
      setPublicationSlug(status.publication?.slug || data.draft.title.toLowerCase().normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100));
      setDirty(false); setEditorValid(true); setPreview(keepPreview); setTab("articles");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open draft."); }
    finally { setBusy(false); }
  }

  async function newArticle() {
    if (busy) return;
    if (dirty && !window.confirm("Discard unsaved article edits?")) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const data = await jsonRequest<{ draft: BlogArticleDraft }>(articleApi,
        { method: "POST", body: "{}" });
      setArticle(data.draft); setRich(emptyRichDocument(data.draft.category));
      setPublication(null); setPublicationSlug("");
      setDirty(false); setEditorValid(true); setPreview(false);
      setArticles(current => [{ id: data.draft.id, title: data.draft.title, summary: "",
        category: data.draft.category, version: data.draft.version, updated_at: data.draft.updated_at },
        ...current]);
      setNotice("New private draft created. It is not published.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create draft."); }
    finally { setBusy(false); }
  }

  function changeAuthor(key: keyof ArticleAuthor, value: string | number | undefined) {
    // Empty strings mean "use the default" rather than invalid author metadata.
    const normalized = typeof value === "string" && !value.trim() ? undefined : value;
    setRich(current => current ? {
      ...current, author: { ...current.author, [key]: normalized },
    } : current);
    setDirty(true);
    setNotice("");
  }

  async function uploadAuthorAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 2_000_000) {
      setError("Select a JPG, PNG or WebP profile photo under 2 MB."); return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const size = 96;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Your browser cannot process this image.");
      const edge = Math.min(bitmap.width, bitmap.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,size,size);
      ctx.drawImage(bitmap, (bitmap.width-edge)/2, (bitmap.height-edge)/2, edge,edge,0,0,size,size);
      bitmap.close();
      let output = "";
      for (const quality of [0.7,0.52,0.36]) {
        output = canvas.toDataURL("image/jpeg", quality);
        if (safeAvatarDataUrl(output)) break;
      }
      if (!safeAvatarDataUrl(output))
        throw Error("Image is too complex for an embedded profile photo. Try a simpler or smaller photo.");
      changeAuthor("avatarDataUrl", output);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to process this profile picture."); }
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
      setNotice("Private draft saved. Public article remains unchanged until you explicitly publish.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save draft."); }
    finally { setBusy(false); }
  }


  async function publishArticle() {
    if (!article || !rich || busy || dirty || !editorValid) return;
    const slug = publicationSlug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
      setError("Publication URL must use lowercase letters, numbers and hyphens."); return;
    }
    const verb = publication?.published ? "Update the live public article" : "Publish this article publicly";
    if (!window.confirm(verb + " at /blogpost/" + slug + "? This changes the public Worker website.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await jsonRequest<{ publication: PublicationState; url: string }>(
        publicationApi, { method: "POST", body: JSON.stringify({
          draftId: article.id, draftVersion: article.version,
          slug, expectedRevision: publication?.revision || 0,
        }) });
      setPublication(res.publication);
      setNotice("Publication saved and visible on this Worker's public article URL: " + res.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish."); }
    finally { setBusy(false); }
  }

  async function unpublishArticle() {
    if (!publication?.published || busy) return;
    if (!window.confirm("Unpublish this article? Its public URL will return 404 until restored.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await jsonRequest<{ publication: PublicationState }>(
        publicationApi, { method: "DELETE", body: JSON.stringify({
          slug: publication.slug, expectedRevision: publication.revision,
        }) });
      setPublication(res.publication);
      setNotice("Article unpublished; historical revisions retained.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not unpublish."); }
    finally { setBusy(false); }
  }

  async function restoreArticle() {
    if (!publication || busy) return;
    const value = window.prompt("Previous published revision to restore (from 1 through " + (publication.revision - 1) + "):");
    if (value === null) return;
    const revision = Number(value);
    if (!Number.isSafeInteger(revision) || revision < 1 || revision >= publication.revision) {
      setError("Choose a valid earlier revision number."); return;
    }
    if (!window.confirm("Restore published revision " + revision + "?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await jsonRequest<{ publication: PublicationState }>(
        publicationApi, { method: "PUT", body: JSON.stringify({
          slug: publication.slug, expectedRevision: publication.revision, restoreRevision: revision,
        }) });
      setPublication(res.publication);
      setNotice("Earlier revision restored and published as a new revision.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not restore."); }
    finally { setBusy(false); }
  }

  async function deleteArticle() {
    if (!article || busy || !window.confirm("Permanently delete this private draft?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await jsonRequest(articleApi, { method: "DELETE", body: JSON.stringify({ id: article.id, version: article.version }) });
      setArticles(current => current.filter(item => item.id !== article.id));
      setArticle(null); setRich(null); setPublication(null); setPublicationSlug(""); setDirty(false); setEditorValid(true); setNotice("Private draft deleted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete draft."); }
    finally { setBusy(false); }
  }


  async function publishHomepage() {
    if (!homepage?.version || busy) throw Error("Save homepage wording privately before publishing.");
    if (!window.confirm("Publish reviewed homepage text, footer and social links publicly on this Worker?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await jsonRequest<{ publication: HomepagePublication }>(
        homepagePublicationApi, { method: "POST", body: JSON.stringify({
          draftVersion: homepage.version, expectedRevision: homepagePublication.revision,
        }) });
      setHomepagePublication(res.publication);
      setNotice("Homepage explicitly published. Open the production Worker blog to verify its public wording.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to publish homepage."); }
    finally { setBusy(false); }
  }
  async function revertHomepage() {
    if (!homepagePublication.published || busy) return;
    if (!window.confirm("Revert the public homepage to reviewed default wording? Draft content will stay private.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await jsonRequest<{ publication: HomepagePublication }>(
        homepagePublicationApi, { method: "DELETE", body: JSON.stringify({
          expectedRevision: homepagePublication.revision,
        }) });
      setHomepagePublication(res.publication);
      setNotice("Public homepage reverted to version-controlled default wording.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to revert homepage."); }
    finally { setBusy(false); }
  }
  async function restoreHomepage() {
    if (busy || homepagePublication.revision < 2) return;
    const raw = window.prompt("Earlier published homepage revision number:");
    if (raw === null) return;
    const revision = Number(raw);
    if (!Number.isSafeInteger(revision) || revision < 1 || revision >= homepagePublication.revision) {
      setError("Choose a valid earlier revision."); return;
    }
    if (!window.confirm("Restore earlier homepage revision " + revision + " publicly?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await jsonRequest<{ publication: HomepagePublication }>(
        homepagePublicationApi, { method: "PUT", body: JSON.stringify({
          expectedRevision: homepagePublication.revision, restoreRevision: revision,
        }) });
      setHomepagePublication(res.publication);
      setNotice("Earlier homepage content restored as a new public revision.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to restore homepage."); }
    finally { setBusy(false); }
  }

  async function saveHomepage(content: BlogHomepageContent) {
    if (!homepage) throw new Error("Homepage draft is not ready.");
    setBusy(true);
    try {
    const data = await jsonRequest<{ version: number }>(homepageApi,
      { method: "PUT", body: JSON.stringify({ content, version: homepage.version }) });
    setHomepage({ content, version: data.version }); setHomepageDirty(false);
    setNotice("Homepage draft saved privately. The production homepage remains unchanged.");
    } finally { setBusy(false); }
  }

  return <div className={styles.dashboard}>
    <div className={styles.header}>
      <span className={styles.status}>FUNDLENZ · PRIVATE EDITOR</span>
      <h2>Editorial workspace</h2>
      <p>Drafts stay private. Use the separate publication controls to make a reviewed article public.</p>
    </div>
    <div className={styles.toolbar}>
      <div role="tablist" aria-label="Editorial tools" className={styles.tabs}>
        <button type="button" role="tab" aria-selected={tab === "articles"}
          className={tab === "articles" ? styles.active : ""} disabled={busy} onClick={leaveHomepage}>Article drafts</button>
        <button type="button" role="tab" aria-selected={tab === "homepage"}
          className={tab === "homepage" ? styles.active : ""} disabled={busy || !editorValid} onClick={() => {
            setPreview(false); setTab("homepage"); }}>Homepage wording</button>
      </div>
      <button type="button" className={styles.secondary} disabled={busy || loading}
        onClick={() => { void reloadDrafts(); }}>Reload drafts</button>
    </div>
    {loading && <p role="status" className={styles.note}>Loading private drafts…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}

    {tab === "homepage" && homepage && <BlogHomepageEditor key={homepage.version}
      initial={homepage.content} onSave={saveHomepage} onCancel={leaveHomepage} onDirtyChange={setHomepageDirty}
      canPublish={homepage.version > 0} published={homepagePublication.published} publicRevision={homepagePublication.revision}
      onPublish={publishHomepage} onRevert={revertHomepage} onRestore={restoreHomepage}/>}
    {tab === "articles" && !loading && <section className={preview ? styles.previewLayout : styles.split}>
      {!preview && <aside className={styles.articleList}>
        <h3>Private article drafts</h3>
        <p className={styles.hint}>Up to 100 recent drafts shown.</p>
        <button className={styles.primary} type="button" disabled={busy} onClick={() => { void newArticle(); }}>+ New article</button>
        {articles.length === 0 && <p className={styles.note}>No drafts yet. Create one to begin.</p>}
        <label className={styles.draftSearch}>Find a draft
          <input type="search" value={query} placeholder="Title or category"
            onChange={event => setQuery(event.target.value)}/>
        </label>
        {articles.length > 0 && !articles.some(item => (item.title + " " + item.category).toLowerCase().includes(query.toLowerCase())) &&
          <p className={styles.note}>No matching drafts.</p>}
        {articles.filter(item => (item.title + " " + item.category).toLowerCase().includes(query.toLowerCase())).map(item => <button key={item.id} type="button" disabled={busy}
          className={item.id === article?.id ? styles.selected : ""}
          onClick={() => { void openArticle(item.id); }}>
          {item.title}
          <small>{item.category} · Private draft · {new Date(item.updated_at * 1000).toLocaleDateString()}</small>
        </button>)}
      </aside>}
      <div className={preview ? styles.previewPanel : styles.panel}>
        {!article ? <><h3>Start writing</h3><p className={styles.hint}>Select a draft or create an article. Publishing is separate from saving and requires a confirmation.</p></>
        : <>
          <div className={styles.editorTitleRow}>
            <div><h3>{preview ? "Published-layout preview" : "Article editor"}</h3>
              <p className={styles.hint}>{preview
                ? "This is a private simulation of how the article page will look once it has been published."
                : "Use the formatting toolbar and drag handles to build your article. Media use validated HTTPS URLs."}</p>
            </div>
            <button type="button" className={styles.secondary}
              disabled={busy || !editorValid} onClick={() => setPreview(current => !current)}>
              {preview ? "← Back to editor" : "Preview article →"}
            </button>
          </div>
          {preview && rich ? <BlogPaper title={article.title} summary={article.summary}
            category={article.category} blocks={rich.blocks} authorProfile={rich.author}
            branding={homepage?.content}
            updatedAt={article.updated_at}
            onSelectRelated={id => { void openArticle(id, true); }}
            related={articles.filter(item => item.id !== article.id).map(item => ({
              id: item.id, title: item.title, category: item.category,
            }))}/> : <form ref={articleForm} className={styles.form} onSubmit={saveArticle}>
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
            {rich && <fieldset className={styles.authorEditor}>
              <legend>Article author &amp; publication details</legend>
              <p>Different author for every article. These details are saved privately with the draft.</p>
              <div className={styles.authorGrid}>
                <label>Author name
                  <input type="text" maxLength={120} placeholder="FundLenz Editorial"
                    value={rich.author?.name || ""} disabled={busy}
                    onChange={event => changeAuthor("name", event.target.value)}/>
                </label>
                <label>Author social profile (HTTPS link)
                  <input type="url" placeholder="https://linkedin.com/in/..."
                    value={rich.author?.socialUrl || ""} disabled={busy}
                    onChange={event => changeAuthor("socialUrl", event.target.value)}/>
                </label>
                <label>Social link label
                  <input type="text" maxLength={60} placeholder="LinkedIn · Author profile"
                    value={rich.author?.socialLabel || ""} disabled={busy}
                    onChange={event => changeAuthor("socialLabel", event.target.value)}/>
                </label>
                <label>Article display date
                  <input type="date" disabled={busy}
                    value={rich.author?.displayDate || ""} onChange={event =>
                      changeAuthor("displayDate", event.target.value || undefined)}/>
                </label>
                <label>Reading time (minutes; blank for automatic)
                  <input type="number" min={1} max={90} disabled={busy}
                    value={rich.author?.readingMinutes ?? ""} onChange={event =>
                      changeAuthor("readingMinutes", event.target.value ? Number(event.target.value) : undefined)}/>
                </label>
                <label className={styles.authorImage}>Profile picture (JPG, PNG or WebP, 2 MB max)
                  <input type="file" accept="image/jpeg,image/png,image/webp"
                    disabled={busy} onChange={event => { void uploadAuthorAvatar(event.target.files?.[0]); event.target.value = ""; }}/>
                  {rich.author?.avatarDataUrl && safeAvatarDataUrl(rich.author.avatarDataUrl) &&
                    <span className={styles.avatarPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rich.author.avatarDataUrl} alt="Current author avatar"/>
                      <button type="button" disabled={busy}
                        onClick={() => changeAuthor("avatarDataUrl", undefined)}>Remove photo</button>
                    </span>}
                </label>
              </div>
            </fieldset>}
            {rich && <BlogRichEditor key={article.id} value={rich} disabled={busy}
              onDirty={() => { setDirty(true); setNotice(""); }}
              onValidityChange={setEditorValid}
              onChange={updated => { setRich(updated); setDirty(true); setNotice(""); }}/>}

            <fieldset className={styles.authorEditor}>
              <legend>Publication control — separate from private draft saving</legend>
              <p>{publication ? (publication.published ? "PUBLIC" : "UNPUBLISHED") + " · Revision " + publication.revision
                : "Not published"} · Publishing is an explicit action and requires a saved draft.</p>
              <label>Permanent article URL slug
                <input value={publicationSlug} maxLength={100} disabled={busy || Boolean(publication)}
                  onChange={event => setPublicationSlug(event.target.value.toLowerCase())}
                  placeholder="article-title"/>
              </label>
              {publication && <p><a href={"/blogpost/" + publication.slug} target="_blank"
                rel="noopener noreferrer">View public URL ↗</a></p>}
              <div className={styles.buttons}>
                <button type="button" className={styles.primary}
                  disabled={busy || dirty || !editorValid || !publicationSlug}
                  onClick={() => { void publishArticle(); }}>
                  {publication ? (publication.published ? "Update published article" : "Republish article") : "Publish article"}
                </button>
                {publication?.published && <button type="button" className={styles.danger}
                  disabled={busy} onClick={() => { void unpublishArticle(); }}>Unpublish</button>}
                {publication && publication.revision > 1 && <button type="button" className={styles.secondary}
                  disabled={busy} onClick={() => { void restoreArticle(); }}>Restore previous revision</button>}
              </div>
              {dirty && <p>Save your private draft before publishing.</p>}
            </fieldset>
            <div className={styles.buttons}>
              <button type="submit" className={styles.primary} disabled={!dirty || busy || !editorValid}>{busy ? "Saving…" : "Save private draft"}</button>
              <button type="button" className={styles.danger} disabled={busy} onClick={() => { void deleteArticle(); }}>Delete draft</button>
            </div>
          </form>}
          {!editorValid && <p role="alert" className={styles.error}>A paragraph contains text or formatting that exceeds the editor’s safe storage limits. Reduce that paragraph before saving.</p>}
          {dirty && <p className={styles.note}>Unsaved changes. Save your private draft before leaving.</p>}
        </>}
      </div>
    </section>}
  </div>;
}
