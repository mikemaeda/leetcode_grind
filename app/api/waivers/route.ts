import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { currentUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { dailyCommitments, groupMembers, users, waiverRequests } from "@/db/schema";
import { canRequestWaiver } from "@/lib/domain/commitments";
import { ensureLeetcodeMembership, LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";
import { sendWaiverNotification } from "@/lib/email/waiver-notification";

function wordCount(value: string) { return value.trim().split(/\s+/).filter(Boolean).length; }

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to request a waiver." }, { status: 401 });
  const input = await request.json().catch(() => null) as { explanation?: unknown } | null;
  const explanation = typeof input?.explanation === "string" ? input.explanation.trim() : "";
  if (wordCount(explanation) < 300) return NextResponse.json({ error: "Your explanation must be at least 300 words." }, { status: 400 });
  if (explanation.length > 12000) return NextResponse.json({ error: "Your explanation is too long." }, { status: 400 });

  const { date } = await ensureLeetcodeMembership(user);
  const db = getDb();
  const commitment = (await db.select().from(dailyCommitments).where(and(eq(dailyCommitments.userId, user.id), eq(dailyCommitments.groupId, LEETCODE_GROUP_ID), eq(dailyCommitments.date, date))).limit(1))[0];
  if (!commitment) return NextResponse.json({ error: "Today’s commitment could not be found." }, { status: 404 });
  if (commitment.completedCount >= commitment.requiredCount || commitment.status === "COMPLETED") return NextResponse.json({ error: "Today’s commitment is already complete." }, { status: 409 });
  if (commitment.status === "FAILED") return NextResponse.json({ error: "The deadline has already passed." }, { status: 409 });
  if (!canRequestWaiver(new Date(), new Date(commitment.deadline))) return NextResponse.json({ error: "Waiver requests close at 9:59 PM ET." }, { status: 409 });
  const existing = (await db.select().from(waiverRequests).where(eq(waiverRequests.commitmentId, commitment.id)).limit(1))[0];
  if (existing?.status === "PENDING" || existing?.status === "APPROVED") return NextResponse.json({ error: "You already have a waiver request for today." }, { status: 409 });

  const waiverId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  await db.batch([
    db.insert(waiverRequests).values({ id: waiverId, requesterId: user.id, groupId: LEETCODE_GROUP_ID, commitmentId: commitment.id, date, reasonCategory: "Unable to complete today", explanation, submittedAt, status: "PENDING" }),
    db.update(dailyCommitments).set({ status: "WAIVER_PENDING", waiverId }).where(eq(dailyCommitments.id, commitment.id)),
  ]);
  const activeMembers = await db.select({ email: users.email }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), isNull(groupMembers.leftAt)));
  const email = await sendWaiverNotification({ waiverId, requesterName: user.name, requesterEmail: user.email, memberEmails: activeMembers.map(member => member.email), date, progress: commitment.completedCount, explanation }).catch(error => { console.error("[waiver-email] notification failed", { waiverId, error: error instanceof Error ? error.message : String(error) }); return { sent: false as const, reason: "The request was saved, but its email notification could not be delivered." }; });
  return NextResponse.json({ waiverId, emailSent: email.sent, message: email.sent ? `Waiver requested. ${email.recipientCount} people were notified by email.` : `Waiver requested. ${email.reason}` });
}
