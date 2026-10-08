"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./blog-admin-login.module.css";
import { BlogEditorDashboard } from "./blog-editor-dashboard";

type AdminStatus = "checking" | "unavailable" | "logged-out" | "logged-in";

export function BlogAdminLogin() {
  const [status, setStatus] = useState<AdminStatus>("checking");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/blog/admin/session", { cache: "no-store", credentials: "same-origin" })
      .then(async response => {
        if (!active) return;
        if (!response.ok) { setStatus("unavailable"); return; }
        const result = await response.json() as { authenticated?: boolean };
        setStatus(result.authenticated ? "logged-in" : "logged-out");
      })
      .catch(() => { if (active) setStatus("unavailable"); });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/blog/admin/login", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !result.authenticated)
        throw new Error(result.error || "Could not log in.");
      setPassword("");
      setStatus("logged-in");
      setMessage("Welcome to the private staging editorial workspace.");
    } catch (error) {
      setPassword("");
      setMessage(error instanceof Error ? error.message : "Login is unavailable.");
    } finally { setBusy(false); }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/blog/admin/logout", {
        method: "POST", credentials: "same-origin",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Logout failed.");
      setStatus("logged-out");
      setMessage("You are signed out.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Logout failed.");
    } finally { setBusy(false); }
  }

  if (status === "checking") return <p role="status" className={styles.note}>Checking administrator session…</p>;
  if (status === "unavailable") return <p role="alert" className={styles.warning}>
    Administrator authentication has not been configured for this environment. No default login is enabled.
  </p>;
  if (status === "logged-in") return <>
    <div style={{ maxWidth: 1080, margin: "0 auto 18px", display: "flex", justifyContent: "space-between",
      flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <p role="status" className={styles.note} style={{ margin: 0 }}>Administrator session active · Draft-only workspace</p>
      <button type="button" onClick={logout} disabled={busy} className={styles.button}>
        {busy ? "Signing out…" : "Log out"}
      </button>
    </div>
    {message && <p role="status" className={styles.note}>{message}</p>}
    <BlogEditorDashboard />
  </>;
  return <section className={styles.panel}>
    <h1>Blog administration</h1>
    <p>Sign in to access FundLenz editorial tools.</p>
    <form onSubmit={login} className={styles.form}>
      <label>Username
        <input name="username" type="text" autoComplete="username" required maxLength={100}
          value={username} onChange={event => setUsername(event.target.value)} />
      </label>
      <label>Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={256}
          value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <button type="submit" disabled={busy} className={styles.button}>{busy ? "Signing in…" : "Log in"}</button>
      {message && <p role="alert" className={styles.warning}>{message}</p>}
    </form>
  </section>;
}
