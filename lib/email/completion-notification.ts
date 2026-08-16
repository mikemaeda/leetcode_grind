import { runtimeValue } from "@/lib/payments/stripe";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendCompletionNotification(input: { commitmentId: string; memberName: string; memberEmail: string; date: string; appUrl?: string }) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("COMMIT_EMAIL_FROM") ?? "Commit <onboarding@resend.dev>";
  const appUrl = input.appUrl ?? runtimeValue("COMMIT_APP_URL") ?? "https://leetcode-grind-xi.vercel.app";
  if (!apiKey) return { sent: false, reason: "Email notifications are not configured yet." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `commitment-complete-${input.commitmentId}` },
    body: JSON.stringify({
      from,
      to: [input.memberEmail],
      subject: "You completed today’s 2 LeetCode questions",
      html: `<h2>Congratulations, ${escapeHtml(input.memberName)}!</h2><p>You completed both LeetCode questions for ${escapeHtml(input.date)}.</p><p>Your progress is now <strong>2/2</strong>, and today’s commitment is complete.</p><p><a href="${escapeHtml(appUrl)}">View today’s progress in Commit</a></p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[completion-email] Resend rejected notification", { commitmentId: input.commitmentId, status: response.status, detail: detail.slice(0, 300) });
    return { sent: false, reason: "The completion email could not be delivered." };
  }
  return { sent: true as const };
}
