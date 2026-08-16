import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { paymentProfiles } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { stripeClient } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = getDb(), stripe = stripeClient(), origin = new URL(request.url).origin;
    let profile = (await db.select().from(paymentProfiles).where(eq(paymentProfiles.userId, user.id)).limit(1))[0];
    if (!profile) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { commitUserId: user.id } }, { idempotencyKey: `commit-customer-${user.id}` });
      profile = { id: crypto.randomUUID(), userId: user.id, providerCustomerId: customer.id, connectedAccountId: null, chargesEnabled: false, payoutsEnabled: false, createdAt: new Date().toISOString(), updatedAt: null };
      await db.insert(paymentProfiles).values(profile);
    }
    let accountId = profile.connectedAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: "express", email: user.email, capabilities: { transfers: { requested: true } }, metadata: { commitUserId: user.id } }, { idempotencyKey: `commit-connect-${user.id}` });
      accountId = account.id;
      await db.update(paymentProfiles).set({ connectedAccountId: accountId, updatedAt: new Date().toISOString() }).where(eq(paymentProfiles.userId, user.id));
    }
    const link = await stripe.accountLinks.create({ account: accountId, refresh_url: `${origin}/?payment=refresh`, return_url: `${origin}/?payment=connected`, type: "account_onboarding" });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("[payments/connect] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Payout onboarding is not configured yet." }, { status: 503 });
  }
}
