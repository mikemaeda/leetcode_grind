import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { groupMembers } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";

export async function currentAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const owner = (await getDb().select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), eq(groupMembers.userId, user.id), eq(groupMembers.role, "OWNER"), isNull(groupMembers.leftAt))).limit(1))[0];
  return owner ? user : null;
}
