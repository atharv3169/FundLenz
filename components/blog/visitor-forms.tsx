"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./visitor-forms.module.css";

type TurnstileAPI = {
  render: (element: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileAPI } }

function useTurnstileScript(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.turnstile) { setReady(true); return; }
    let script = document.querySelector<HTMLScriptElement>("script[data-fundlenz-turnstile]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.fundlenzTurnstile = "true";
      document.head.appendChild(script);
    }
    const onLoad = () => { if (window.turnstile) setReady(true); };
    script.addEventListener("load", onLoad);
    // Handles a script that completed loading just before the listener was attached.
    onLoad();
    return () => script?.removeEventListener("load", onLoad);
  }, []);
  return ready;
}

function HumanCheck({ siteKey, action, onToken, resetSignal }: {
  siteKey: string; action: string; onToken: (value: string) => void; resetSignal: number;
}) {
  const ready = useTurnstileScript();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  useEffect(() => {
    if (!siteKey || !ready || !window.turnstile || !container.current) return;
    const id = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    widgetId.current = id;
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      onToken("");
    };
    // Callback belongs to the parent; keep it stable via a ref below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, ready, action]);
  useEffect(() => {
    if (resetSignal && widgetId.current && window.turnstile) {
      onToken("");
      window.turnstile.reset(widgetId.current);
    }
  }, [resetSignal, onToken]);
  if (!siteKey) return <p className={styles.notice}>Submissions will open after verification is configured.</p>;
  return <div className={styles.turnstile} ref={container} aria-label="Human verification" />;
}

function requestError(value: unknown): string {
  if (!value || typeof value !== "object") return "Please try again.";
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : "Please try again.";
}

export function NewsletterBox({ siteKey, heading = "Interested in FundLenz updates?",
  description = "Leave your email for possible future updates. We are not currently sending newsletters." }: {
  siteKey: string; heading?: string; description?: string;
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !consent || busy || !siteKey) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/blog/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, turnstileToken: token }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(requestError(data));
      setMessage("Thank you. Your email has been recorded.");
      setEmail("");
      setConsent(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your email. Please retry.");
    } finally {
      setBusy(false);
      setToken("");
      setResetSignal(value => value + 1);
    }
  }
  return <section className={styles.panel} aria-label="Email collection">
    <h2>{heading}</h2>
    <p>{description}</p>
    <form onSubmit={submit}>
      <div className={styles.inputRow}>
        <label className={styles.srOnly} htmlFor="fundlenz-newsletter-email">Email address</label>
        <input id="fundlenz-newsletter-email" type="email" autoComplete="email" required
          placeholder="Your email address" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
        <button type="submit" disabled={busy || !token || !consent || !siteKey}>
          {busy ? "Saving…" : "Submit"}
        </button>
      </div>
      <label className={styles.consent}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required />
        <span>I agree to FundLenz storing my email for future contact, as explained in the <a href="/privacy">Privacy Policy</a>.</span>
      </label>
      <HumanCheck siteKey={siteKey} action="blog_subscribe" onToken={setToken} resetSignal={resetSignal} />
      {message && <p className={styles.feedback} role="status">{message}</p>}
    </form>
  </section>;
}

export function ContributionButton({ siteKey }: { siteKey: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={styles.outlineButton} onClick={() => setOpen(true)}>
      Add your own article
    </button>
    {open && <ContributionDialog siteKey={siteKey} onDismiss={() => setOpen(false)} />}
  </>;
}

function ContributionDialog({ siteKey, onDismiss }: { siteKey: string; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [fileProblem, setFileProblem] = useState("");
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token || !siteKey || !consent || fileProblem) return;
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData(event.currentTarget);
      data.set("turnstileToken", token);
      data.set("consent", "true");
      const file = data.get("document");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        throw new Error("Upload a PDF, DOC or DOCX of 5 MB or less.");
      const response = await fetch("/api/blog/contribute", { method: "POST", body: data });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(requestError(payload));
      setSuccess(true);
      setMessage("Thank you for your contribution! Our editor will review your article and consider it for publication on FundLenz.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed. Please retry.");
    } finally {
      setBusy(false);
      setToken("");
      setResetSignal(value => value + 1);
    }
  }
  return <dialog ref={dialogRef} className={styles.dialog}
    aria-label="Submit an article" onClose={onDismiss} onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className={styles.dialogHead}>
      <div><p className={styles.kicker}>COMMUNITY CONTRIBUTIONS</p><h2>Share your article</h2></div>
      <button type="button" aria-label="Close" disabled={busy} className={styles.close}
        onClick={() => dialogRef.current?.close()}>×</button>
    </div>
    {success ? <>
      <p role="status" className={styles.success}>{message}</p>
      <button type="button" className={styles.primaryButton} onClick={() => dialogRef.current?.close()}>Close</button>
    </> : <form className={styles.form} onSubmit={submit}>
      <label>Your name <strong>*</strong>
        <input required name="name" maxLength={120} placeholder="Full name" autoComplete="name" />
      </label>
      <label>Your social profile (optional)
        <input name="social" type="url" maxLength={500} placeholder="https://instagram.com/…" />
      </label>
      <label>Email address <strong>*</strong>
        <input required name="email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" />
      </label>
      <label>Article title (optional)
        <input name="title" maxLength={240} placeholder="A working title" />
      </label>
      <label>Upload document <strong>*</strong>
        <input required name="document" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            setFileProblem(file && file.size > 5 * 1024 * 1024 ? "The maximum file size is 5 MB." : "");
          }} />
        <small>PDF, DOC or DOCX · Maximum 5 MB</small>
      </label>
      {fileProblem && <p role="alert" className={styles.error}>{fileProblem}</p>}
      <label className={styles.consent}>
        <input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />
        <span>I agree to my contribution and contact details being stored privately for editorial review under the <a href="/privacy">Privacy Policy</a>.</span>
      </label>
      <HumanCheck siteKey={siteKey} action="blog_contribute" onToken={setToken} resetSignal={resetSignal} />
      {message && <p className={styles.error} role="alert">{message}</p>}
      <button className={styles.primaryButton} type="submit" disabled={!siteKey || !token || !consent || busy || Boolean(fileProblem)}>
        {busy ? "Sending…" : "Send contribution"}
      </button>
      <p className={styles.fallback}>Need another way to send your work? Email <a href="mailto:atharva@fundlenz.com">atharva@fundlenz.com</a>.</p>
    </form>}
  </dialog>;
}
