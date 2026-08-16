import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { authSessions, users } from "@/db/schema";
import { hashToken } from "./password";

export const SESSION_COOKIE = "commit_session";
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const result = await getDb().select({ id: users.id, name: users.name, email: users.email, username: users.username, timezone: users.timezone }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date().toISOString()))).limit(1);
  return result[0] ?? null;
}
