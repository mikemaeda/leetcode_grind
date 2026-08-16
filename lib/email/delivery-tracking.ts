import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailDeliveries } from "@/db/schema";

export async function recordEmailDelivery(input: { providerEmailId?: string; userId?: string; recipient: string; kind: string; status: string; error?: string }) {
  const now = new Date().toISOString();
  await getDb().insert(emailDeliveries).values({ id: crypto.randomUUID(), providerEmailId: input.providerEmailId ?? null, userId: input.userId ?? null, recipient: input.recipient, kind: input.kind, status: input.status, error: input.error ?? null, createdAt: now, lastEventAt: now });
}

export async function updateEmailDelivery(providerEmailId: string, status: string, error?: string) {
  await getDb().update(emailDeliveries).set({ status, error: error ?? null, lastEventAt: new Date().toISOString() }).where(eq(emailDeliveries.providerEmailId, providerEmailId));
}
