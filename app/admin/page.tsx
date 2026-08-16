/* eslint-disable @next/next/no-html-link-for-pages */
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailDeliveries, groupMembers, problemSubmissions, securityEvents, users, violationCharges } from "@/db/schema";
import { currentAdmin } from "@/lib/admin";
import { LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) return <main className="admin-page"><h1>Admin access required</h1><a href="/">Return to Commit</a></main>;
  const db = getDb();
  const [members, submissions, payments, events, emails] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, role: groupMembers.role }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(eq(groupMembers.groupId, LEETCODE_GROUP_ID)),
    db.select({ id: problemSubmissions.id, title: problemSubmissions.problemTitle, email: users.email, submittedAt: problemSubmissions.submittedAt }).from(problemSubmissions).innerJoin(users, eq(users.id, problemSubmissions.userId)).orderBy(desc(problemSubmissions.submittedAt)).limit(30),
    db.select().from(violationCharges).orderBy(desc(violationCharges.createdAt)).limit(30),
    db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(50),
    db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.createdAt)).limit(50),
  ]);
  return <AdminPanel viewerId={admin.id} members={members} submissions={submissions} payments={payments} events={events} emails={emails} />;
}
