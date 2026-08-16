import { runtimeValue } from "@/lib/payments/stripe";
import { recordEmailDelivery } from "./delivery-tracking";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendWelcomeNotification(input: { userId: string; memberName: string; memberEmail: string; appUrl?: string }) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("COMMIT_EMAIL_FROM") ?? "Commit <onboarding@resend.dev>";
  const appUrl = input.appUrl ?? runtimeValue("COMMIT_APP_URL") ?? "https://commit.mikemaeda.com";
  if (!apiKey) return { sent: false, reason: "Email notifications are not configured yet." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `welcome-${input.userId}` },
    body: JSON.stringify({
      from,
      to: [input.memberEmail],
      subject: "Welcome to Commit",
      text: `Welcome to Commit, ${input.memberName}! Your LeetCode Grind account is ready. Complete two LeetCode questions each day and submit your screenshot proof. Open Commit: ${appUrl}`,
      html: `<h2>Welcome to Commit, ${escapeHtml(input.memberName)}!</h2><p>Your LeetCode Grind account is ready.</p><p>Complete two LeetCode questions each day, submit your screenshot proof, and keep your commitment streak moving.</p><p><a href="${escapeHtml(appUrl)}">Open Commit and view today’s progress</a></p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[welcome-email] Resend rejected notification", { userId: input.userId, status: response.status, detail: detail.slice(0, 300) });
    return { sent: false, reason: "The welcome email could not be delivered." };
  }
  const result = await response.json() as { id?: string };
  await recordEmailDelivery({ providerEmailId: result.id, userId: input.userId, recipient: input.memberEmail, kind: "WELCOME", status: "SENT" });
  return { sent: true as const };
}
