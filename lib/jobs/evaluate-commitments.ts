import type { PaymentProvider } from "../payments/provider";

export type EvaluationRepository = {
  findDue(nowIso: string): Promise<Array<{ id: string; groupId: string; userId: string; status: string; penaltyPerParticipant: number }>>;
  activeRecipientIds(groupId: string, failedUserId: string): Promise<string[]>;
  markFailedOnce(commitmentId: string): Promise<boolean>;
  createPenaltyOnce(input: { commitmentId: string; groupId: string; failedUserId: string; recipientUserId: string; amount: number }): Promise<{ id: string; alreadyProcessed: boolean }>;
  completePenalty(id: string, providerTransactionId: string, succeeded: boolean): Promise<void>;
};

/** Safe to retry: status transitions and recipient transfers are protected by unique constraints. */
export async function evaluateDueCommitments(now: Date, repository: EvaluationRepository, payments: PaymentProvider) {
  for (const item of await repository.findDue(now.toISOString())) {
    if (item.status === "COMPLETED" || item.status === "WAIVED") continue;
    if (!(await repository.markFailedOnce(item.id))) continue;
    for (const recipientUserId of await repository.activeRecipientIds(item.groupId, item.userId)) {
      const penalty = await repository.createPenaltyOnce({ commitmentId: item.id, groupId: item.groupId, failedUserId: item.userId, recipientUserId, amount: item.penaltyPerParticipant });
      if (penalty.alreadyProcessed) continue;
      const result = await payments.createTransfer({ idempotencyKey: `${item.id}:${recipientUserId}`, sourceUserId: item.userId, recipientUserId, amount: item.penaltyPerParticipant, currency: "usd" });
      await repository.completePenalty(penalty.id, result.providerTransactionId, result.status === "COMPLETED");
    }
  }
}
