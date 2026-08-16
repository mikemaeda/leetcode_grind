import { and, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyCommitments } from "@/db/schema";
import { processViolationPayment } from "@/lib/payments/process-violation";
import { runtimeValue } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const secret = runtimeValue("COMMIT_CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb(), now = new Date().toISOString();
  const due = await db.select({ id: dailyCommitments.id }).from(dailyCommitments).where(and(lte(dailyCommitments.deadline, now), or(eq(dailyCommitments.status, "PENDING"), eq(dailyCommitments.status, "WAIVER_PENDING"))));
  const results: Array<{ commitmentId: string; status: string }> = [];
  for (const commitment of due) {
    await db.update(dailyCommitments).set({ status: "FAILED" }).where(and(eq(dailyCommitments.id, commitment.id), or(eq(dailyCommitments.status, "PENDING"), eq(dailyCommitments.status, "WAIVER_PENDING"))));
    try {
      const result = await processViolationPayment(commitment.id);
      results.push({ commitmentId: commitment.id, status: result.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[jobs/evaluate-violations] payment failed", { commitmentId: commitment.id, error: message });
      results.push({ commitmentId: commitment.id, status: `FAILED: ${message}` });
    }
  }
  return Response.json({ evaluatedAt: now, count: results.length, results });
}
