import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { authAccounts, authSessions, users } from "@/db/schema";
import { hashToken, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { TERMS_VERSION } from "@/lib/domain/leetcode-group";

export async function POST(request: Request) {
  const input = await request.json() as { email?: string; password?: string; acceptedTerms?: boolean };
  const email = input.email?.trim().toLowerCase(), password = input.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  if (input.acceptedTerms !== true) return NextResponse.json({ error: "You must explicitly agree to the LeetCode Grind commitment terms." }, { status: 400 });
  const rows = await getDb().select({ userId: users.id, passwordHash: authAccounts.passwordHash, passwordSalt: authAccounts.passwordSalt }).from(users).innerJoin(authAccounts, eq(authAccounts.userId, users.id)).where(eq(users.email, email)).limit(1);
  const account = rows[0];
  if (!account || !(await verifyPassword(password, account.passwordSalt, account.passwordHash))) return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  const now = new Date(), token = crypto.randomUUID() + crypto.randomUUID(), expiresAt = new Date(now.getTime() + 30 * 864e5);
  await getDb().update(users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: now.toISOString(), updatedAt: now.toISOString() }).where(eq(users.id, account.userId));
  await getDb().insert(authSessions).values({ id: crypto.randomUUID(), userId: account.userId, tokenHash: await hashToken(token), createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
  return response;
}
