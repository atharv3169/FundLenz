"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  blogHomepageFields, type BlogHomepageContent,
  validateBlogHomepageContent,
} from "@/lib/blog-homepage-content";
import styles from "./blog-homepage-editor.module.css";
import { BlogSocialLinks } from "./social-links";
import { SocialIcon, type SocialNetwork } from "./social-icon";

/**
 * This editor is intentionally only a component, NOT a public route or an API.
 * Mount it only after verifying the server-side admin session. The onSave
 * callback MUST be a server-protected write to the approved GitHub content path.
 */
export function BlogHomepageEditor({ initial, onSave, onCancel }: {
  initial: BlogHomepageContent;
  onSave: (draft: BlogHomepageContent) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BlogHomepageContent>(() => ({ ...initial }));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const groups = useMemo(
    () => [...new Set(blogHomepageFields.map(item => item.group))].filter(group => group !== "Social links"),
    [],
  );
  const changed = blogHomepageFields.some(field => draft[field.key] !== initial[field.key]);

  function change(key: keyof BlogHomepageContent, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !changed) return;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const verified = validateBlogHomepageContent(draft);
      await onSave(verified);
      setMessage("Saved as a private staging draft. No public changes have been published.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.editor} aria-label="Edit blog homepage text">
    <div className={styles.heading}>
      <div>
        <p className={styles.kicker}>ADMIN · BLOG APPEARANCE</p>
        <h1>Edit homepage wording</h1>
        <p>Update headlines, descriptions, placeholders and footer text without changing any code.</p>
      </div>
      <button className={styles.quiet} type="button" onClick={onCancel} disabled={busy}>Close editor</button>
    </div>
    <div className={styles.switches}>
      <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}
        className={!preview ? styles.selected : ""}>Edit text</button>
      <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}
        className={preview ? styles.selected : ""}>Preview wording</button>
    </div>
    {preview
      ? <div className={styles.preview}>
        <div className={styles.previewSection}><strong>Article page masthead</strong><p>{draft.eyebrow}</p>{draft.articleMastheadRight && <small>{draft.articleMastheadRight}</small>}</div>
        <p className={styles.kicker}>{draft.eyebrow}</p>
        <h2>{draft.heroHeading}</h2>
        <p>{draft.heroDescription}</p>
        <div className={styles.previewSection}>
          <h3>{draft.articlesHeading}</h3>
          <small>{draft.articlesStatus}</small>
          <p>{draft.articlesEmpty}</p>
          <small>Search field: {draft.articleSearchPlaceholder}</small>
        </div>
        <div className={styles.previewSection}>
          <h3>{draft.newsletterHeading}</h3>
          <p>{draft.newsletterDescription}</p>
          <small>{draft.newsletterPlaceholder} · {draft.newsletterSubmitLabel}</small>
        </div>
        <div className={styles.previewSection}>
          <p>{draft.footerDescription}</p>
          <small>{draft.contributionButtonLabel}</small>
          {draft.socialInstagramEnabled === "true" && <small>{draft.instagramLead}</small>}
          <BlogSocialLinks copy={draft}/>
        </div>
      </div>
      : <form id="blog-homepage-copy-form" onSubmit={save} className={styles.form}>
        {groups.map(group => <fieldset className={styles.group} key={group}>
          <legend>{group}</legend>
          {blogHomepageFields.filter(field => field.group === group).map(field => (
            <label key={field.key} className={styles.field}>
              <span>{field.label}</span>
              {field.multiline
                ? <textarea rows={3} required={!('optional' in field)} maxLength={field.max} disabled={busy}
                  value={draft[field.key]} onChange={event => change(field.key, event.target.value)} />
                : <input type="text" required={!('optional' in field)} maxLength={field.max} disabled={busy}
                  value={draft[field.key]} onChange={event => change(field.key, event.target.value)} />}
              <small>{draft[field.key].length} / {field.max} characters</small>
            </label>
          ))}
        </fieldset>)}
        <fieldset className={styles.group}>
          <legend>Social profile icons</legend>
          <p>Check the profiles you want visitors to see. Unchecked links stay hidden, even if a URL is saved.</p>
          {([
            {name:"Instagram",id:"socialInstagram"},
            {name:"Facebook",id:"socialFacebook"},
            {name:"X",id:"socialX"},
            {name:"TikTok",id:"socialTikTok"},
            {name:"LinkedIn",id:"socialLinkedin"},
          ] as const).map(network => {
            const urlKey = (network.id + "Url") as keyof BlogHomepageContent;
            const enabledKey = (network.id + "Enabled") as keyof BlogHomepageContent;
            return <div className={styles.socialEditorRow} key={network.id}>
              <label className={styles.socialToggle}>
                <input type="checkbox" disabled={busy} checked={draft[enabledKey] === "true"}
                  onChange={event => change(enabledKey,event.target.checked ? "true" : "false")}/>
                <span className={styles.socialIcon}><SocialIcon network={network.name as SocialNetwork}/></span>
                <span>{network.name}</span>
              </label>
              <input aria-label={network.name + " social profile URL"}
                type="url" placeholder={"https://"+network.name.toLowerCase()+".com/..."}
                disabled={busy} maxLength={2048} value={draft[urlKey]}
                onChange={event => change(urlKey,event.target.value)}/>
            </div>;
          })}
          <div className={styles.socialPreview}><span>Visible icons preview</span><BlogSocialLinks copy={draft}/></div>
        </fieldset>
      </form>}
    {message && <p role={failed ? "alert" : "status"} className={failed ? styles.error : styles.feedback}>{message}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.quiet} disabled={busy || !changed}
        onClick={() => { setDraft({ ...initial }); setMessage(""); }}>Discard unsaved edits</button>
      <button form="blog-homepage-copy-form" className={styles.save} type="submit"
        disabled={busy || !changed || preview}>{busy ? "Saving…" : "Save homepage wording"}</button>
    </div>
    <p className={styles.note}>Save stores a private draft in the staging D1 database, not GitHub. Changes aren't live
      until a separate, authorized publishing workflow completes. Privacy-consent wording and
      private visitor details aren't included in this editor.</p>
  </section>;
}
