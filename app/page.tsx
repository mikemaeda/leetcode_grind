import type { Metadata } from "next";
import { AccountabilityApp } from "./AccountabilityApp";
import { AuthScreen } from "./AuthScreen";
import { currentUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { dailyCommitments, groupMembers, problemSubmissions, proofUploads, streaks, users } from "@/db/schema";
import { ensureLeetcodeMembership, LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commit — Daily accountability that counts",
  description: "Daily commitments, proof, streaks, waivers, and fair consequences for developer groups.",
};

export default async function Home() {
  const user = await currentUser();
  if (!user) return <AuthScreen />;
  const { date } = await ensureLeetcodeMembership(user);
  const db = getDb();
  const registeredUsers = await db.select({ id: users.id, name: users.name, progress: dailyCommitments.completedCount, status: dailyCommitments.status, streak: streaks.currentStreak }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).leftJoin(dailyCommitments, and(eq(dailyCommitments.userId, users.id), eq(dailyCommitments.groupId, LEETCODE_GROUP_ID), eq(dailyCommitments.date, date))).leftJoin(streaks, and(eq(streaks.userId, users.id), eq(streaks.groupId, LEETCODE_GROUP_ID))).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), isNull(groupMembers.leftAt)));
  const submissionRows = await db.select({ id: problemSubmissions.id, memberId: users.id, memberName: users.name, problemTitle: problemSubmissions.problemTitle, submittedAt: problemSubmissions.submittedAt, proofUrl: proofUploads.imageUrl, verificationStatus: proofUploads.verificationStatus }).from(problemSubmissions).innerJoin(users, eq(users.id, problemSubmissions.userId)).innerJoin(dailyCommitments, eq(dailyCommitments.id, problemSubmissions.commitmentId)).innerJoin(proofUploads, eq(proofUploads.submissionId, problemSubmissions.id)).where(and(eq(dailyCommitments.groupId, LEETCODE_GROUP_ID), eq(dailyCommitments.date, date))).orderBy(problemSubmissions.submittedAt);
  const submissions = Array.from(submissionRows.reduce((map, row) => { const existing = map.get(row.id); if (existing) existing.proofUrls.push(row.proofUrl); else map.set(row.id, { id: row.id, memberId: row.memberId, memberName: row.memberName, problemTitle: row.problemTitle, submittedAt: row.submittedAt, proofUrls: [row.proofUrl], verificationStatus: row.verificationStatus }); return map; }, new Map<string, { id: string; memberId: string; memberName: string; problemTitle: string; submittedAt: string; proofUrls: string[]; verificationStatus: string }>()).values());
  const ownProgress = registeredUsers.find(member => member.id === user.id)?.progress ?? 0;
  return <AccountabilityApp viewerName={user.name} viewerEmail={user.email} viewerId={user.id} members={registeredUsers.map(member => ({ ...member, progress: member.progress ?? 0, status: member.status ?? "PENDING", streak: member.streak ?? 0 }))} submissions={submissions} ownProgress={ownProgress} />;
}
