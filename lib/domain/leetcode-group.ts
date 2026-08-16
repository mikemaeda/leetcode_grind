import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyCommitments, groupMembers, groups, streaks } from "@/db/schema";

export const LEETCODE_GROUP_ID = "leetcode-grind";
export const TERMS_VERSION = "2026-08-16";
export const DAILY_REQUIRED = 2;
export const PENALTY_PER_MEMBER = 10;

export function easternDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function easternDeadline(date: string) {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" }).formatToParts(noonUtc).find(part => part.type === "timeZoneName")?.value ?? "GMT-04:00";
  const offset = offsetName.replace("GMT", "");
  return new Date(`${date}T23:59:00${offset}`).toISOString();
}

export async function ensureLeetcodeMembership(user: { id: string }) {
  const db = getDb();
  const now = new Date().toISOString();
  const existingGroup = (await db.select({ id: groups.id }).from(groups).where(eq(groups.id, LEETCODE_GROUP_ID)).limit(1))[0];
  if (!existingGroup) {
    await db.insert(groups).values({ id: LEETCODE_GROUP_ID, name: "LeetCode Grind", description: "Solve two LeetCode questions every day.", ownerId: user.id, inviteCode: "leetcode-grind", dailyRequiredProblems: DAILY_REQUIRED, penaltyPerParticipant: PENALTY_PER_MEMBER, deadline: "23:59", timezone: "America/New_York", challengeStartDate: easternDate(), challengeEndDate: null, status: "ACTIVE", createdAt: now, updatedAt: now }).onConflictDoNothing();
  }
  const member = (await db.select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), eq(groupMembers.userId, user.id), isNull(groupMembers.leftAt))).limit(1))[0];
  if (!member) await db.insert(groupMembers).values({ id: crypto.randomUUID(), groupId: LEETCODE_GROUP_ID, userId: user.id, role: existingGroup ? "MEMBER" : "OWNER", penaltyAgreementAt: now, joinedAt: now, leftAt: null }).onConflictDoNothing();
  await db.insert(streaks).values({ id: crypto.randomUUID(), groupId: LEETCODE_GROUP_ID, userId: user.id, currentStreak: 0, longestStreak: 0, totalSuccessfulDays: 0, totalFailedDays: 0, totalProblemsCompleted: 0, updatedAt: now }).onConflictDoNothing();
  const date = easternDate();
  await db.insert(dailyCommitments).values({ id: crypto.randomUUID(), userId: user.id, groupId: LEETCODE_GROUP_ID, date, status: "PENDING", completedCount: 0, requiredCount: DAILY_REQUIRED, completedAt: null, deadline: easternDeadline(date), penaltyTriggered: false, waiverId: null }).onConflictDoNothing();
  return { date };
}
