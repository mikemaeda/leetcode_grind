import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentMethods, paymentProfiles } from "@/db/schema";

export type PaymentCommitmentStatus = { hasCard: boolean; payoutsReady: boolean; complete: boolean };

export async function paymentCommitmentStatus(userId: string): Promise<PaymentCommitmentStatus> {
  const db = getDb();
  const [method, profile] = await Promise.all([
    db.select({ id: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.status, "ACTIVE"))).limit(1),
    db.select({ connectedAccountId: paymentProfiles.connectedAccountId, payoutsEnabled: paymentProfiles.payoutsEnabled }).from(paymentProfiles).where(eq(paymentProfiles.userId, userId)).limit(1),
  ]);
  const hasCard = Boolean(method[0]);
  const payoutsReady = Boolean(profile[0]?.connectedAccountId && profile[0]?.payoutsEnabled);
  return { hasCard, payoutsReady, complete: hasCard && payoutsReady };
}
