"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

type View = "Today" | "Members" | "Submissions" | "Payment";
type Member = { id: string; name: string };

const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();

export function AccountabilityApp({ viewerName, viewerEmail, members }: { viewerName: string; viewerEmail: string; members: Member[] }) {
  const [view, setView] = useState<View>("Today");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 3200); return () => clearTimeout(id); }, [toast]);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }

  return <div className="grind-shell">
    <header className="grind-header">
      <button className="grind-brand" onClick={() => setView("Today")}><span className="brand-mark">C</span><span>Commit</span><small>LEETCODE GRIND</small></button>
      <nav>{(["Today", "Members", "Submissions", "Payment"] as View[]).map(item => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>
      <button className="account-button" onClick={logout}><span className="avatar blue">{initials(viewerName)}</span><span><b>{viewerName}</b><small>Log out</small></span></button>
    </header>

    <main className="grind-main">
      {view === "Today" && <Today name={viewerName.split(" ")[0]} members={members} onSubmit={() => setSubmitOpen(true)} onMembers={() => setView("Members")} />}
      {view === "Members" && <Members members={members} viewerEmail={viewerEmail} />}
      {view === "Submissions" && <Submissions />}
      {view === "Payment" && <Payment onAdd={() => setCardOpen(true)} />}
    </main>

    {submitOpen && <SubmitDialog onClose={() => setSubmitOpen(false)} onDone={() => { setSubmitOpen(false); setToast("Proof submission is ready for storage connection."); }} />}
    {cardOpen && <CardDialog onClose={() => setCardOpen(false)} />}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
}

function Today({ name, members, onSubmit, onMembers }: { name: string; members: Member[]; onSubmit: () => void; onMembers: () => void }) {
  return <div className="grind-page"><div className="grind-title"><p>LEETCODE GRIND</p><h1>Hey {name}. Two questions today.</h1><span>Submit proof before 11:59 PM ET.</span></div>
    <section className="commitment-block">
      <div className="commitment-main"><p className="label">TODAY’S REQUIREMENT</p><h2>Solve 2 LeetCode questions</h2><div className="big-progress"><strong>0 <span>/ 2</span></strong><div><span style={{ width: "0%" }} /></div></div><p className="quiet">No proof submitted yet.</p><button className="primary" onClick={onSubmit}>Submit question + screenshot</button></div>
      <dl className="terms-list"><div><dt>Deadline</dt><dd>11:59 PM ET</dd></div><div><dt>Penalty if missed</dt><dd>$10 to each other member</dd></div><div><dt>Waiver cutoff</dt><dd>9:59 PM ET</dd></div></dl>
    </section>
    <section className="member-summary"><div className="section-heading"><div><p className="label">THE GROUP</p><h2>Today’s status</h2></div><button className="text-link" onClick={onMembers}>View all members →</button></div>{members.length ? <div className="simple-member-list">{members.slice(0, 5).map(member => <MemberRow member={member} key={member.id} />)}</div> : <div className="calm-empty">No members have joined yet.</div>}</section>
  </div>;
}

function Members({ members, viewerEmail }: { members: Member[]; viewerEmail: string }) { return <div className="grind-page"><div className="grind-title"><p>LEETCODE GRIND</p><h1>Members</h1><span>{members.length} registered {members.length === 1 ? "member" : "members"} · {viewerEmail}</span></div><section className="plain-section">{members.length ? <div className="simple-member-list">{members.map(member => <MemberRow member={member} key={member.id} />)}</div> : <div className="calm-empty">No members have joined yet.</div>}</section></div>; }

function MemberRow({ member }: { member: Member }) { return <div className="simple-member"><span className="avatar blue">{initials(member.name)}</span><div><b>{member.name}</b><small>0 day streak</small></div><span className="member-progress">0 / 2 today</span><span className="status pending">NOT STARTED</span></div>; }

function Submissions() { return <div className="grind-page"><div className="grind-title"><p>PROOF</p><h1>Submissions</h1><span>Open a member to review the two screenshots they submitted today.</span></div><section className="plain-section"><div className="calm-empty"><b>No screenshots submitted today.</b><span>Accepted LeetCode proof will appear here under the member who submitted it.</span></div></section></div>; }

function Payment({ onAdd }: { onAdd: () => void }) { const [error, setError] = useState(""); async function connectPayouts() { setError(""); const response = await fetch("/api/payments/connect", { method: "POST" }); const result = await response.json() as { url?: string; error?: string }; if (result.url) window.location.href = result.url; else setError(result.error ?? "Payout setup is unavailable."); } return <div className="grind-page"><div className="grind-title"><p>PAYMENT</p><h1>Penalty payments</h1><span>Two separate setups are required: a card to cover violations and a payout account to receive transfers.</span></div><section className="payment-section"><div><h2>Card for violations</h2><p>Your saved card is charged only after a confirmed missed commitment: fewer than two valid submissions and no approved waiver by the deadline.</p><button className="primary" onClick={onAdd}>Add card securely</button><button className="outline payout-button" onClick={connectPayouts}>Set up payouts</button>{error && <p className="auth-error" role="alert">{error}</p>}</div><dl className="terms-list"><div><dt>Violation charge</dt><dd>$10 × other eligible members</dd></div><div><dt>Transfers</dt><dd>One $10 transfer per member</dd></div><div><dt>Duplicate protection</dt><dd>One charge per failed day</dd></div></dl></section><p className="security-copy">Commit never stores full card numbers or security codes. Stripe tokenizes the card and verifies payout recipients.</p></div>; }

function SubmitDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">SUBMIT PROOF</p><h2>LeetCode question</h2><p className="modal-intro">Submit one accepted question and its screenshot. You need two valid submissions today.</p><form className="form" onSubmit={e => { e.preventDefault(); onDone(); }}><label>Question title<input required placeholder="Question name" /></label><label>LeetCode URL<input required type="url" placeholder="https://leetcode.com/problems/..." /></label><label>Accepted screenshot<span className="upload"><input required type="file" accept="image/png,image/jpeg,image/webp" /><b>Choose screenshot</b><small>PNG, JPG, or WEBP</small></span></label><button className="primary wide">Submit proof</button></form></section></div>; }

function CardDialog({ onClose }: { onClose: () => void }) { const [secret, setSecret] = useState(""), [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null), [error, setError] = useState(""); useEffect(() => { fetch("/api/payments/setup-intent", { method: "POST" }).then(async response => { const result = await response.json() as { clientSecret?: string; publishableKey?: string; error?: string }; if (!response.ok || !result.clientSecret || !result.publishableKey) throw new Error(result.error ?? "Card setup is unavailable."); setSecret(result.clientSecret); setStripePromise(loadStripe(result.publishableKey)); }).catch(reason => setError(reason instanceof Error ? reason.message : "Card setup is unavailable.")); }, []); return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">SECURE CARD SETUP</p><h2>Card for violation charges</h2><p className="modal-intro">By saving a card, you authorize an off-session charge of $10 per other eligible member only when a daily violation is confirmed.</p>{error && <div className="auth-error" role="alert">{error}</div>}{secret && stripePromise ? <Elements stripe={stripePromise} options={{ clientSecret: secret }}><StripeCardForm onDone={onClose} /></Elements> : !error && <div className="notice">Loading secure card fields…</div>}</section></div>; }

function StripeCardForm({ onDone }: { onDone: () => void }) { const stripe = useStripe(), elements = useElements(); const [error, setError] = useState(""), [saving, setSaving] = useState(false); async function save(event: React.FormEvent) { event.preventDefault(); if (!stripe || !elements) return; setSaving(true); setError(""); const result = await stripe.confirmSetup({ elements, confirmParams: { return_url: window.location.href }, redirect: "if_required" }); if (result.error) { setError(result.error.message ?? "Card could not be saved."); setSaving(false); return; } onDone(); } return <form className="stripe-form" onSubmit={save}><PaymentElement options={{ layout: "tabs" }} /><label className="consent-line"><input type="checkbox" required /> I authorize Commit to charge this card only for confirmed LeetCode Grind violations, calculated as $10 per other eligible member.</label>{error && <div className="auth-error">{error}</div>}<button className="primary wide" disabled={!stripe || saving}>{saving ? "Saving…" : "Save card"}</button></form>; }
