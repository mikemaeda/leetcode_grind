import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentProfiles } from "@/db/schema";
import { stripeClient, stripeWebhookSecret } from "@/lib/payments/stripe";
import { syncSetupIntent } from "@/lib/payments/sync-stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !stripeWebhookSecret()) return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(await request.text(), signature, stripeWebhookSecret(), undefined, Stripe.createSubtleCryptoProvider());
  } catch { return Response.json({ error: "Invalid signature" }, { status: 400 }); }
  const db = getDb();
  if (event.type === "setup_intent.succeeded") {
    const intent = event.data.object;
    const userId = intent.metadata.commitUserId;
    if (userId) await syncSetupIntent(userId, intent.id);
  }
  if (event.type === "account.updated") {
    const account = event.data.object;
    await db.update(paymentProfiles).set({ chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, updatedAt: new Date().toISOString() }).where(eq(paymentProfiles.connectedAccountId, account.id));
  }
  return Response.json({ received: true });
}
