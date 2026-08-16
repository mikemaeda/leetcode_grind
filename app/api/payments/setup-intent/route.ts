import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { paymentMethods, paymentProfiles } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { isStripeModeMismatch, stripeClient, stripePublishableKey } from "@/lib/payments/stripe";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = getDb(), stripe = stripeClient();
    let profile = (await db.select().from(paymentProfiles).where(eq(paymentProfiles.userId, user.id)).limit(1))[0];
    if (!profile) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { commitUserId: user.id } }, { idempotencyKey: `commit-customer-${user.id}` });
      profile = { id: crypto.randomUUID(), userId: user.id, providerCustomerId: customer.id, connectedAccountId: null, chargesEnabled: false, payoutsEnabled: false, createdAt: new Date().toISOString(), updatedAt: null };
      await db.insert(paymentProfiles).values(profile);
    }
    let intent;
    try {
      intent = await stripe.setupIntents.create({ customer: profile.providerCustomerId, usage: "off_session", payment_method_types: ["card"], metadata: { commitUserId: user.id } });
    } catch (error) {
      if (!isStripeModeMismatch(error)) throw error;
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { commitUserId: user.id } }, { idempotencyKey: `commit-customer-${user.id}` });
      await db.update(paymentProfiles).set({ providerCustomerId: customer.id, updatedAt: new Date().toISOString() }).where(eq(paymentProfiles.userId, user.id));
      await db.update(paymentMethods).set({ status: "REMOVED" }).where(eq(paymentMethods.userId, user.id));
      intent = await stripe.setupIntents.create({ customer: customer.id, usage: "off_session", payment_method_types: ["card"], metadata: { commitUserId: user.id } });
    }
    return NextResponse.json({ clientSecret: intent.client_secret, publishableKey: stripePublishableKey() });
  } catch (error) {
    console.error("[payments/setup-intent] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Payment provider is not configured yet." }, { status: 503 });
  }
}
