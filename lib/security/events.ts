import { getDb } from "@/db";
import { securityEvents } from "@/db/schema";

export async function recordSecurityEvent(input: { type: string; email?: string; userId?: string; ipAddress?: string; details?: string }) {
  await getDb().insert(securityEvents).values({ id: crypto.randomUUID(), type: input.type, email: input.email ?? null, userId: input.userId ?? null, ipAddress: input.ipAddress ?? null, details: input.details ?? null, createdAt: new Date().toISOString() });
}
