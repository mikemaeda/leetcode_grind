import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { authAccounts, authSessions, users } from "@/db/schema";
import { hashPassword, hashToken } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { name?: string; email?: string; password?: string };
    const name = input.name?.trim(), email = input.email?.trim().toLowerCase(), password = input.password ?? "";
    if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return NextResponse.json({ error: "Enter a valid name, email, and password of at least 8 characters." }, { status: 400 });
    const db = getDb();
    if ((await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    const now = new Date(), userId = crypto.randomUUID(), accountId = crypto.randomUUID();
    const username = `${email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20)}_${userId.slice(0, 5)}`;
    const credentials = await hashPassword(password);
    const sessionToken = crypto.randomUUID() + crypto.randomUUID(), sessionHash = await hashToken(sessionToken), expiresAt = new Date(now.getTime() + 30 * 864e5);
    await db.batch([
      db.insert(users).values({ id: userId, name, email, username, timezone: "America/New_York", createdAt: now.toISOString() }),
      db.insert(authAccounts).values({ id: accountId, userId, passwordHash: credentials.hash, passwordSalt: credentials.salt, createdAt: now.toISOString() }),
      db.insert(authSessions).values({ id: crypto.randomUUID(), userId, tokenHash: sessionHash, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }),
    ]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
    return response;
  } catch (error) {
    console.error("[auth/register] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "We could not create your account. Please try again." }, { status: 500 });
  }
}
