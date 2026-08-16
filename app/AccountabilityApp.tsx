"use client";

import { useEffect, useState } from "react";

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

function Payment({ onAdd }: { onAdd: () => void }) { return <div className="grind-page"><div className="grind-title"><p>PAYMENT</p><h1>Penalty payment method</h1><span>A valid card is required before participating in the grind.</span></div><section className="payment-section"><div><h2>No card on file</h2><p>Your card is only used if you miss both required LeetCode submissions and do not have an approved waiver.</p><button className="primary" onClick={onAdd}>Add card securely</button></div><dl className="terms-list"><div><dt>Penalty</dt><dd>$10 per other member</dd></div><div><dt>Card storage</dt><dd>Handled by payment provider</dd></div><div><dt>Commit stores</dt><dd>Brand, last 4, provider token</dd></div></dl></section><p className="security-copy">Commit never stores full card numbers, security codes, or magnetic-stripe data.</p></div>; }

function SubmitDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">SUBMIT PROOF</p><h2>LeetCode question</h2><p className="modal-intro">Submit one accepted question and its screenshot. You need two valid submissions today.</p><form className="form" onSubmit={e => { e.preventDefault(); onDone(); }}><label>Question title<input required placeholder="Question name" /></label><label>LeetCode URL<input required type="url" placeholder="https://leetcode.com/problems/..." /></label><label>Accepted screenshot<span className="upload"><input required type="file" accept="image/png,image/jpeg,image/webp" /><b>Choose screenshot</b><small>PNG, JPG, or WEBP</small></span></label><button className="primary wide">Submit proof</button></form></section></div>; }

function CardDialog({ onClose }: { onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">SECURE CARD SETUP</p><h2>Connect payment provider</h2><p className="modal-intro">Card entry will appear here through the payment provider’s secure hosted fields after the provider account is connected. Commit will not create ordinary inputs for card numbers or CVVs.</p><div className="notice">Stripe or another PCI-compliant payment provider must be configured before live card details can be accepted.</div><button className="outline wide" onClick={onClose}>Close</button></section></div>; }
