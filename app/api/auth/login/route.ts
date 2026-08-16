import { and, count, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { authAccounts, authSessions, securityEvents, users } from "@/db/schema";
import { hashToken, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { TERMS_VERSION } from "@/lib/domain/leetcode-group";
import { recordSecurityEvent } from "@/lib/security/events";

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { email?: string; password?: string; acceptedTerms?: boolean } | null;
  if (!input) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  const email = input.email?.trim().toLowerCase(), password = input.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  const recentFailures = (await getDb().select({ value: count() }).from(securityEvents).where(and(eq(securityEvents.email, email), eq(securityEvents.type, "LOGIN_FAILED"), gte(securityEvents.createdAt, new Date(Date.now() - 15 * 60_000).toISOString()))))[0]?.value ?? 0;
  if (recentFailures >= 10) return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
  if (input.acceptedTerms !== true) return NextResponse.json({ error: "You must explicitly agree to the LeetCode Grind commitment terms." }, { status: 400 });
  const rows = await getDb().select({ userId: users.id, passwordHash: authAccounts.passwordHash, passwordSalt: authAccounts.passwordSalt }).from(users).innerJoin(authAccounts, eq(authAccounts.userId, users.id)).where(eq(users.email, email)).limit(1);
  const account = rows[0];
  if (!account || !(await verifyPassword(password, account.passwordSalt, account.passwordHash))) {
    await recordSecurityEvent({ type: "LOGIN_FAILED", email, ipAddress: request.headers.get("cf-connecting-ip") ?? undefined });
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  const now = new Date(), token = crypto.randomUUID() + crypto.randomUUID(), expiresAt = new Date(now.getTime() + 30 * 864e5);
  await getDb().update(users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: now.toISOString(), updatedAt: now.toISOString() }).where(eq(users.id, account.userId));
  await getDb().insert(authSessions).values({ id: crypto.randomUUID(), userId: account.userId, tokenHash: await hashToken(token), createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
  await recordSecurityEvent({ type: "LOGIN_SUCCEEDED", email, userId: account.userId, ipAddress: request.headers.get("cf-connecting-ip") ?? undefined });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
  return response;
}
