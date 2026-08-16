import { runtimeValue } from "@/lib/payments/stripe";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendWaiverNotification(input: { waiverId: string; requesterName: string; requesterEmail: string; memberEmails: string[]; date: string; progress: number; explanation: string; appUrl?: string }) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("COMMIT_EMAIL_FROM") ?? "Commit <onboarding@resend.dev>";
  const appUrl = input.appUrl ?? runtimeValue("COMMIT_APP_URL") ?? "https://leetcode-grind-xi.vercel.app";
  if (!apiKey) return { sent: false, reason: "Email notifications are not configured yet." };
  const requesterEmail = input.requesterEmail.trim().toLowerCase();
  const recipients = Array.from(new Set(input.memberEmails.map(email => email.trim().toLowerCase()).filter(email => Boolean(email) && email !== requesterEmail)));
  if (!recipients.length) return { sent: true as const, recipientCount: 0 };

  const deliveries = await Promise.all(recipients.map(async recipient => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `waiver-request-${input.waiverId}-${recipient}` },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `${input.requesterName} requested a LeetCode waiver`,
        html: `<h2>${escapeHtml(input.requesterName)} requested a waiver</h2><p><strong>Date:</strong> ${escapeHtml(input.date)}</p><p><strong>Progress:</strong> ${input.progress}/2 questions</p><p><strong>Account:</strong> ${escapeHtml(input.requesterEmail)}</p><h3>Explanation</h3><p style="white-space:pre-wrap">${escapeHtml(input.explanation)}</p><p>Your vote is required. Every active member other than the requester must approve this waiver.</p><p><a href="${escapeHtml(appUrl)}">Review and vote in Commit</a></p>`,
      }),
    });
    if (response.ok) return true;
    const detail = await response.text();
    console.error("[waiver-email] Resend rejected notification", { waiverId: input.waiverId, recipient, status: response.status, detail: detail.slice(0, 300) });
    return false;
  }));
  const recipientCount = deliveries.filter(Boolean).length;
  const failedCount = deliveries.length - recipientCount;
  return failedCount
    ? { sent: false as const, recipientCount, failedCount, reason: `${failedCount} waiver notification${failedCount === 1 ? "" : "s"} could not be delivered.` }
    : { sent: true as const, recipientCount, failedCount: 0 };
}
