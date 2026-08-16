import { runtimeValue } from "@/lib/payments/stripe";
import { recordEmailDelivery } from "./delivery-tracking";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendWaiverRejectedNotifications(input: { waiverId: string; requesterName: string; voterName: string; date: string; recipients: { id: string; email: string }[]; appUrl?: string; test?: boolean }) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("COMMIT_EMAIL_FROM") ?? "Commit <onboarding@resend.dev>";
  const appUrl = input.appUrl ?? runtimeValue("COMMIT_APP_URL") ?? "https://commit.mikemaeda.com";
  if (!apiKey) return { sent: false as const, recipientCount: 0, failedCount: input.recipients.length, reason: "Email notifications are not configured yet." };

  const prefix = input.test ? "[TEST] " : "";
  const results = await Promise.all(input.recipients.map(async recipient => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${input.test ? "test-" : ""}waiver-rejected-${input.waiverId}-${recipient.id}` },
      body: JSON.stringify({
        from,
        to: [recipient.email],
        subject: `${prefix}${input.voterName} rejected ${input.requesterName}’s waiver`,
        text: `${prefix}${input.voterName} rejected ${input.requesterName}’s waiver request for ${input.date}. View the latest waiver status: ${appUrl}`,
        html: `<h2>${escapeHtml(prefix)}${escapeHtml(input.voterName)} rejected ${escapeHtml(input.requesterName)}’s waiver</h2><p>The waiver request for ${escapeHtml(input.date)} was rejected.</p><p><a href="${escapeHtml(appUrl)}">View the latest waiver status in Commit</a></p>`,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("[waiver-rejected-email] Resend rejected notification", { waiverId: input.waiverId, recipient: recipient.email, status: response.status, detail: detail.slice(0, 300) });
      return false;
    }
    const result = await response.json() as { id?: string };
    await recordEmailDelivery({ providerEmailId: result.id, userId: recipient.id, recipient: recipient.email, kind: input.test ? "WAIVER_REJECTED_TEST" : "WAIVER_REJECTED", status: "SENT" });
    return true;
  }));
  const recipientCount = results.filter(Boolean).length;
  const failedCount = results.length - recipientCount;
  return failedCount
    ? { sent: false as const, recipientCount, failedCount, reason: `${failedCount} rejection notification${failedCount === 1 ? "" : "s"} could not be delivered.` }
    : { sent: true as const, recipientCount, failedCount: 0 };
}
