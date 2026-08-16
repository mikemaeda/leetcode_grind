import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyCommitments, groupMembers, groups, paymentMethods, paymentProfiles, penaltyTransactions, violationCharges } from "@/db/schema";
import { stripeClient } from "./stripe";

/** Charges a failed member once, then splits the captured charge into one transfer per other member. */
export async function processViolationPayment(commitmentId: string) {
  const db = getDb(), stripe = stripeClient();
  const row = (await db.select({ commitment: dailyCommitments, penalty: groups.penaltyPerParticipant }).from(dailyCommitments).innerJoin(groups, eq(groups.id, dailyCommitments.groupId)).where(eq(dailyCommitments.id, commitmentId)).limit(1))[0];
  if (!row || row.commitment.status !== "FAILED") throw new Error("Only failed commitments can trigger payment");
  const recipients = await db.select({ userId: groupMembers.userId, connectedAccountId: paymentProfiles.connectedAccountId, payoutsEnabled: paymentProfiles.payoutsEnabled }).from(groupMembers).leftJoin(paymentProfiles, eq(paymentProfiles.userId, groupMembers.userId)).where(and(eq(groupMembers.groupId, row.commitment.groupId), isNull(groupMembers.leftAt)));
  const eligible = recipients.filter(member => member.userId !== row.commitment.userId);
  if (!eligible.length) return { status: "NO_RECIPIENTS" as const };
  if (eligible.some(member => !member.connectedAccountId || !member.payoutsEnabled)) throw new Error("Every recipient must complete payout onboarding before penalties can run");
  const payerProfile = (await db.select().from(paymentProfiles).where(eq(paymentProfiles.userId, row.commitment.userId)).limit(1))[0];
  const payerMethod = (await db.select().from(paymentMethods).where(and(eq(paymentMethods.userId, row.commitment.userId), eq(paymentMethods.status, "ACTIVE"))).limit(1))[0];
  if (!payerProfile || !payerMethod) throw new Error("Failed member has no active payment method");
  const amountCents = Math.round(row.penalty * eligible.length * 100), now = new Date().toISOString();
  await db.insert(violationCharges).values({ id: crypto.randomUUID(), dailyCommitmentId: commitmentId, failedUserId: row.commitment.userId, amount: amountCents / 100, status: "PENDING", createdAt: now }).onConflictDoNothing();
  const chargeRecord = (await db.select().from(violationCharges).where(eq(violationCharges.dailyCommitmentId, commitmentId)).limit(1))[0];
  if (chargeRecord.status === "COMPLETED") return { status: "COMPLETED" as const, paymentIntentId: chargeRecord.providerPaymentIntentId };
  await db.update(violationCharges).set({ status: "PROCESSING" }).where(eq(violationCharges.id, chargeRecord.id));
  try {
    const intent = await stripe.paymentIntents.create({ amount: amountCents, currency: "usd", customer: payerProfile.providerCustomerId, payment_method: payerMethod.providerPaymentMethodId, off_session: true, confirm: true, transfer_group: `commitment_${commitmentId}`, description: `LeetCode Grind missed commitment ${commitmentId}`, metadata: { commitmentId, failedUserId: row.commitment.userId } }, { idempotencyKey: `violation-charge-${commitmentId}` });
    if (intent.status !== "succeeded") {
      await db.update(violationCharges).set({ status: intent.status === "requires_action" ? "ACTION_REQUIRED" : "FAILED", providerPaymentIntentId: intent.id, failureReason: `Payment status: ${intent.status}`, processedAt: new Date().toISOString() }).where(eq(violationCharges.id, chargeRecord.id));
      return { status: intent.status };
    }
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
    if (!chargeId) throw new Error("Successful payment has no source charge");
    await db.update(violationCharges).set({ providerPaymentIntentId: intent.id, providerChargeId: chargeId }).where(eq(violationCharges.id, chargeRecord.id));
    for (const recipient of eligible) {
      await db.insert(penaltyTransactions).values({ id: crypto.randomUUID(), groupId: row.commitment.groupId, failedUserId: row.commitment.userId, recipientUserId: recipient.userId, dailyCommitmentId: commitmentId, amount: row.penalty, status: "PROCESSING", createdAt: now }).onConflictDoNothing();
      const transaction = (await db.select().from(penaltyTransactions).where(and(eq(penaltyTransactions.dailyCommitmentId, commitmentId), eq(penaltyTransactions.recipientUserId, recipient.userId))).limit(1))[0];
      if (transaction.status === "COMPLETED") continue;
      const transfer = await stripe.transfers.create({ amount: Math.round(row.penalty * 100), currency: "usd", destination: recipient.connectedAccountId!, source_transaction: chargeId, transfer_group: `commitment_${commitmentId}`, metadata: { commitmentId, recipientUserId: recipient.userId } }, { idempotencyKey: `violation-transfer-${commitmentId}-${recipient.userId}` });
      await db.update(penaltyTransactions).set({ status: "COMPLETED", processedAt: new Date().toISOString(), paymentProviderTransactionId: transfer.id }).where(eq(penaltyTransactions.id, transaction.id));
    }
    await db.update(violationCharges).set({ status: "COMPLETED", processedAt: new Date().toISOString() }).where(eq(violationCharges.id, chargeRecord.id));
    await db.update(dailyCommitments).set({ penaltyTriggered: true }).where(eq(dailyCommitments.id, commitmentId));
    return { status: "COMPLETED" as const, paymentIntentId: intent.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(violationCharges).set({ status: "FAILED", failureReason: message, processedAt: new Date().toISOString() }).where(eq(violationCharges.id, chargeRecord.id));
    throw error;
  }
}
