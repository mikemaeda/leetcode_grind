export type TransferRequest = { idempotencyKey: string; sourceUserId: string; recipientUserId: string; amount: number; currency: "usd" };
export type TransferResult = { providerTransactionId: string; status: "COMPLETED" | "FAILED"; failureReason?: string };
export interface PaymentProvider { createTransfer(request: TransferRequest): Promise<TransferResult>; }
export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly failureRate = 0) {}
  async createTransfer(request: TransferRequest): Promise<TransferResult> {
    const failed = Math.random() < this.failureRate;
    return failed ? { providerTransactionId: `mock_fail_${request.idempotencyKey}`, status: "FAILED", failureReason: "Simulated provider decline" } : { providerTransactionId: `mock_${request.idempotencyKey}`, status: "COMPLETED" };
  }
}
