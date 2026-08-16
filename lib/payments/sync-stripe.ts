import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentMethods, paymentProfiles } from "@/db/schema";
import { stripeClient } from "./stripe";

export async function syncSetupIntent(userId: string, setupIntentId: string) {
  const stripe = stripeClient();
  const intent = await stripe.setupIntents.retrieve(setupIntentId);
  if (intent.status !== "succeeded" || intent.metadata.commitUserId !== userId) throw new Error("The card setup is not complete for this user");
  const methodId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  if (!methodId) throw new Error("The completed card setup has no payment method");
  const method = await stripe.paymentMethods.retrieve(methodId);
  if (!method.card || typeof method.customer !== "string") throw new Error("The saved payment method is not a customer card");
  const profile = (await getDb().select({ providerCustomerId: paymentProfiles.providerCustomerId }).from(paymentProfiles).where(eq(paymentProfiles.userId, userId)).limit(1))[0];
  if (!profile || profile.providerCustomerId !== method.customer) throw new Error("The saved card does not belong to this account");
  const db = getDb();
  await db.update(paymentMethods).set({ status: "REMOVED" }).where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.status, "ACTIVE"), ne(paymentMethods.providerPaymentMethodId, method.id)));
  await db.insert(paymentMethods).values({ id: crypto.randomUUID(), userId, provider: "stripe", providerCustomerId: method.customer, providerPaymentMethodId: method.id, brand: method.card.brand, last4: method.card.last4, expiryMonth: method.card.exp_month, expiryYear: method.card.exp_year, status: "ACTIVE", createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: [paymentMethods.provider, paymentMethods.providerPaymentMethodId], set: { brand: method.card.brand, last4: method.card.last4, expiryMonth: method.card.exp_month, expiryYear: method.card.exp_year, status: "ACTIVE" } });
  return { hasCard: true, brand: method.card.brand, last4: method.card.last4 };
}

export async function syncConnectedAccount(userId: string) {
  const db = getDb();
  const profile = (await db.select({ connectedAccountId: paymentProfiles.connectedAccountId }).from(paymentProfiles).where(eq(paymentProfiles.userId, userId)).limit(1))[0];
  if (!profile?.connectedAccountId) return { payoutsReady: false };
  const account = await stripeClient().accounts.retrieve(profile.connectedAccountId);
  await db.update(paymentProfiles).set({ chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, updatedAt: new Date().toISOString() }).where(eq(paymentProfiles.userId, userId));
  return { payoutsReady: account.payouts_enabled, detailsSubmitted: account.details_submitted };
}
