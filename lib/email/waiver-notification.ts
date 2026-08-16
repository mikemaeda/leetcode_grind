import { runtimeValue } from "@/lib/payments/stripe";

const WAIVER_INBOX = "mhm5@alfred.edu";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendWaiverNotification(input: { waiverId: string; requesterName: string; requesterEmail: string; date: string; progress: number; explanation: string }) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("COMMIT_EMAIL_FROM") ?? "Commit <onboarding@resend.dev>";
  const appUrl = runtimeValue("COMMIT_APP_URL") ?? "https://leetcode-grind-mikemaedas-projects.vercel.app";
  if (!apiKey) return { sent: false, reason: "Email notifications are not configured yet." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `waiver-request-${input.waiverId}` },
    body: JSON.stringify({
      from,
      to: [WAIVER_INBOX],
      subject: `${input.requesterName} requested a LeetCode waiver`,
      html: `<h2>${escapeHtml(input.requesterName)} requested a waiver</h2><p><strong>Date:</strong> ${escapeHtml(input.date)}</p><p><strong>Progress:</strong> ${input.progress}/2 questions</p><p><strong>Account:</strong> ${escapeHtml(input.requesterEmail)}</p><h3>Explanation</h3><p style="white-space:pre-wrap">${escapeHtml(input.explanation)}</p><p>Every other active member must approve this request in Commit.</p><p><a href="${escapeHtml(appUrl)}">Review the request in Commit</a></p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[waiver-email] Resend rejected notification", { waiverId: input.waiverId, status: response.status, detail: detail.slice(0, 300) });
    return { sent: false, reason: "The request was saved, but its email notification could not be delivered." };
  }
  return { sent: true as const };
}
