import { runtimeValue } from "@/lib/payments/stripe";
import { recordEmailDelivery } from "./delivery-tracking";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendWaiverAcceptedNotification(input: { waiverId: string; requesterId: string; requesterName: string; requesterEmail: string; voterId: string; voterName: string; date: string; appUrl?: string }) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("COMMIT_EMAIL_FROM") ?? "Commit <onboarding@resend.dev>";
  const appUrl = input.appUrl ?? runtimeValue("COMMIT_APP_URL") ?? "https://commit.mikemaeda.com";
  if (!apiKey) return { sent: false as const, reason: "Email notifications are not configured yet." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `waiver-accepted-${input.waiverId}-${input.voterId}` },
    body: JSON.stringify({
      from,
      to: [input.requesterEmail],
      subject: `${input.voterName} accepted your waiver`,
      text: `Hi ${input.requesterName}, ${input.voterName} accepted your waiver request for ${input.date}. View the latest approval status: ${appUrl}`,
      html: `<h2>${escapeHtml(input.voterName)} accepted your waiver</h2><p>Hi ${escapeHtml(input.requesterName)},</p><p><strong>${escapeHtml(input.voterName)}</strong> accepted your waiver request for ${escapeHtml(input.date)}.</p><p><a href="${escapeHtml(appUrl)}">View the latest approval status in Commit</a></p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[waiver-accepted-email] Resend rejected notification", { waiverId: input.waiverId, voterId: input.voterId, status: response.status, detail: detail.slice(0, 300) });
    return { sent: false as const, reason: "The waiver acceptance email could not be delivered." };
  }
  const result = await response.json() as { id?: string };
  await recordEmailDelivery({ providerEmailId: result.id, userId: input.requesterId, recipient: input.requesterEmail, kind: "WAIVER_ACCEPTED", status: "SENT" });
  return { sent: true as const };
}
