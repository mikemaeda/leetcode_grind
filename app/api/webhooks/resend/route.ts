import { Webhook } from "svix";
import { runtimeValue } from "@/lib/payments/stripe";
import { updateEmailDelivery } from "@/lib/email/delivery-tracking";

type ResendEvent = { type: string; created_at?: string; data?: { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } } };

export async function POST(request: Request) {
  const secret = runtimeValue("RESEND_WEBHOOK_SECRET");
  if (!secret) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  const payload = await request.text();
  let event: ResendEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as ResendEvent;
  } catch { return Response.json({ error: "Invalid signature" }, { status: 400 }); }
  const emailId = event.data?.email_id;
  if (emailId) {
    const status = event.type.replace("email.", "").toUpperCase();
    const error = event.data?.bounce?.message ?? event.data?.failed?.reason;
    await updateEmailDelivery(emailId, status, error);
  }
  return Response.json({ received: true });
}
