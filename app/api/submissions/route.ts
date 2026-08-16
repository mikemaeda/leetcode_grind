import { env } from "cloudflare:workers";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { dailyCommitments, problemSubmissions, proofUploads } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { DAILY_REQUIRED, ensureLeetcodeMembership, LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to submit proof." }, { status: 401 });
  const { date } = await ensureLeetcodeMembership(user);
  const form = await request.formData();
  const problemTitle = String(form.get("problemTitle") ?? "").trim();
  const leetcodeUrl = String(form.get("leetcodeUrl") ?? "").trim();
  const screenshot = form.get("screenshot");
  if (!problemTitle || !/^https:\/\/(www\.)?leetcode\.com\/problems\//i.test(leetcodeUrl)) return NextResponse.json({ error: "Enter the question title and a valid LeetCode problem URL." }, { status: 400 });
  if (!(screenshot instanceof File) || !allowedTypes.has(screenshot.type) || screenshot.size === 0 || screenshot.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Choose a PNG, JPG, or WEBP screenshot under 5 MB." }, { status: 400 });
  const db = getDb();
  const commitment = (await db.select({ id: dailyCommitments.id }).from(dailyCommitments).where(and(eq(dailyCommitments.userId, user.id), eq(dailyCommitments.groupId, LEETCODE_GROUP_ID), eq(dailyCommitments.date, date))).limit(1))[0];
  if (!commitment) return NextResponse.json({ error: "Today’s commitment could not be created." }, { status: 500 });
  const currentCount = (await db.select({ value: count() }).from(problemSubmissions).where(eq(problemSubmissions.commitmentId, commitment.id)))[0]?.value ?? 0;
  if (currentCount >= DAILY_REQUIRED) return NextResponse.json({ error: "You already submitted both questions for today." }, { status: 409 });
  if (!env.PROOFS) return NextResponse.json({ error: "Screenshot storage is unavailable." }, { status: 503 });
  const submissionId = crypto.randomUUID();
  const proofId = crypto.randomUUID();
  const extension = screenshot.type === "image/png" ? "png" : screenshot.type === "image/webp" ? "webp" : "jpg";
  const objectKey = `${date}/${user.id}/${proofId}.${extension}`;
  const submittedAt = new Date().toISOString();
  await env.PROOFS.put(objectKey, await screenshot.arrayBuffer(), { httpMetadata: { contentType: screenshot.type } });
  try {
    await db.batch([
      db.insert(problemSubmissions).values({ id: submissionId, commitmentId: commitment.id, userId: user.id, problemTitle, leetcodeUrl, notes: null, submittedAt }),
      db.insert(proofUploads).values({ id: proofId, submissionId, objectKey, imageUrl: `/api/proofs/${proofId}`, uploadedAt: submittedAt, verificationStatus: "UNVERIFIED" }),
      db.update(dailyCommitments).set({ completedCount: currentCount + 1, status: currentCount + 1 >= DAILY_REQUIRED ? "COMPLETED" : "PENDING", completedAt: currentCount + 1 >= DAILY_REQUIRED ? submittedAt : null }).where(eq(dailyCommitments.id, commitment.id)),
    ]);
  } catch (error) {
    await env.PROOFS.delete(objectKey);
    console.error("[submissions] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Your proof could not be saved. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, completedCount: currentCount + 1 });
}
