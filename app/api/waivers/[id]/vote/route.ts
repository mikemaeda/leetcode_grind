import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { currentUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { dailyCommitments, groupMembers, waiverRequests, waiverVotes } from "@/db/schema";
import { ensureLeetcodeMembership, LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  await ensureLeetcodeMembership(user);
  const { id } = await context.params;
  const input = await request.json().catch(() => null) as { vote?: unknown } | null;
  if (input?.vote !== "APPROVE" && input?.vote !== "REJECT") return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  const db = getDb();
  const waiver = (await db.select().from(waiverRequests).where(and(eq(waiverRequests.id, id), eq(waiverRequests.groupId, LEETCODE_GROUP_ID))).limit(1))[0];
  if (!waiver) return NextResponse.json({ error: "Waiver request not found." }, { status: 404 });
  if (waiver.requesterId === user.id) return NextResponse.json({ error: "You cannot vote on your own waiver." }, { status: 403 });
  if (waiver.status !== "PENDING") return NextResponse.json({ error: "Voting on this request has closed." }, { status: 409 });
  const eligible = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), isNull(groupMembers.leftAt)));
  if (!eligible.some(member => member.userId === user.id)) return NextResponse.json({ error: "Only active group members can vote." }, { status: 403 });

  const now = new Date().toISOString();
  await db.insert(waiverVotes).values({ id: crypto.randomUUID(), waiverId: id, voterId: user.id, vote: input.vote, createdAt: now }).onConflictDoUpdate({ target: [waiverVotes.waiverId, waiverVotes.voterId], set: { vote: input.vote, createdAt: now } });
  const votes = await db.select({ voterId: waiverVotes.voterId, vote: waiverVotes.vote }).from(waiverVotes).where(eq(waiverVotes.waiverId, id));
  const eligibleVoterIds = eligible.map(member => member.userId).filter(userId => userId !== waiver.requesterId);
  const rejected = votes.some(vote => eligibleVoterIds.includes(vote.voterId) && vote.vote === "REJECT");
  const approved = eligibleVoterIds.length > 0 && eligibleVoterIds.every(userId => votes.some(vote => vote.voterId === userId && vote.vote === "APPROVE"));
  const status = rejected ? "REJECTED" : approved ? "APPROVED" : "PENDING";
  if (status !== "PENDING") {
    await db.batch([
      db.update(waiverRequests).set({ status }).where(eq(waiverRequests.id, id)),
      db.update(dailyCommitments).set({ status: status === "APPROVED" ? "WAIVED" : "PENDING" }).where(eq(dailyCommitments.id, waiver.commitmentId)),
    ]);
  }
  return NextResponse.json({ status, approvals: votes.filter(vote => vote.vote === "APPROVE" && eligibleVoterIds.includes(vote.voterId)).length, required: eligibleVoterIds.length });
}
