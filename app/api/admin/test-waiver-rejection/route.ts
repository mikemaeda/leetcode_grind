import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";
import { sendWaiverRejectedNotifications } from "@/lib/email/waiver-rejected-notification";
import { runtimeValue } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const configuredToken = runtimeValue("EMAIL_TEST_TOKEN");
  if (!configuredToken || request.headers.get("authorization") !== `Bearer ${configuredToken}`) return Response.json({ error: "Forbidden" }, { status: 403 });
  const recipients = await getDb().select({ id: users.id, email: users.email }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), isNull(groupMembers.leftAt)));
  const testId = new Date().toISOString().slice(0, 16);
  const result = await sendWaiverRejectedNotifications({ waiverId: testId, requesterName: "Test User", voterName: "Commit Test", date: new Date().toISOString().slice(0, 10), recipients, appUrl: new URL(request.url).origin, test: true });
  return Response.json(result, { status: result.sent ? 200 : 502 });
}
