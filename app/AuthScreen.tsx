"use client";
import { useState } from "react";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login"), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({ error: "The server could not complete the request." })) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span className="brand-mark">C</span><span>commit<span className="brand-dot">.</span></span></div><p className="eyebrow">ACCOUNTABILITY, CLEARLY</p><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p>{mode === "login" ? "Sign in to see today’s commitment." : "Start showing up for what you committed to."}</p><form className="form" onSubmit={submit}>{mode === "signup" && <label>Name<input name="name" required autoComplete="name" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="primary wide" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form><button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "New to Commit? Create an account" : "Already have an account? Sign in"}</button><small className="auth-note">Commit uses secure, HTTP-only sessions. Your password is never stored in plain text.</small></section></main>;
}
