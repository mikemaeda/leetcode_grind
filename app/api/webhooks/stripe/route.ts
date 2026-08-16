import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentMethods, paymentProfiles } from "@/db/schema";
import { stripeClient, stripeWebhookSecret } from "@/lib/payments/stripe";

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
    const userId = intent.metadata.commitUserId, paymentMethodId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
    if (userId && paymentMethodId) {
      const method = await stripeClient().paymentMethods.retrieve(paymentMethodId);
      if (method.card) await db.insert(paymentMethods).values({ id: crypto.randomUUID(), userId, provider: "stripe", providerCustomerId: String(method.customer), providerPaymentMethodId: method.id, brand: method.card.brand, last4: method.card.last4, expiryMonth: method.card.exp_month, expiryYear: method.card.exp_year, status: "ACTIVE", createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: [paymentMethods.provider, paymentMethods.providerPaymentMethodId], set: { brand: method.card.brand, last4: method.card.last4, expiryMonth: method.card.exp_month, expiryYear: method.card.exp_year, status: "ACTIVE" } });
    }
  }
  if (event.type === "account.updated") {
    const account = event.data.object;
    await db.update(paymentProfiles).set({ chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, updatedAt: new Date().toISOString() }).where(eq(paymentProfiles.connectedAccountId, account.id));
  }
  return Response.json({ received: true });
}
