import { env } from "cloudflare:workers";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { dailyCommitments, problemSubmissions, proofUploads } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { DAILY_REQUIRED, ensureLeetcodeMembership, LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";
import { sendCompletionNotification } from "@/lib/email/completion-notification";

const maxUploadBytes = 25 * 1024 * 1024;
const maxImages = 10;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to submit proof." }, { status: 401 });
  const { date } = await ensureLeetcodeMembership(user);
  const form = await request.formData();
  const problemTitle = String(form.get("problemTitle") ?? "").trim();
  const screenshots = form.getAll("screenshots").filter((value): value is File => value instanceof File && value.size > 0);
  if (!problemTitle) return NextResponse.json({ error: "Enter the LeetCode question title." }, { status: 400 });
  if (!screenshots.length || screenshots.length > maxImages || screenshots.some(file => !file.type.startsWith("image/")) || screenshots.reduce((total, file) => total + file.size, 0) > maxUploadBytes) return NextResponse.json({ error: "Choose image files totaling less than 25 MB." }, { status: 400 });
  const db = getDb();
  const commitment = (await db.select({ id: dailyCommitments.id }).from(dailyCommitments).where(and(eq(dailyCommitments.userId, user.id), eq(dailyCommitments.groupId, LEETCODE_GROUP_ID), eq(dailyCommitments.date, date))).limit(1))[0];
  if (!commitment) return NextResponse.json({ error: "Today’s commitment could not be created." }, { status: 500 });
  const currentCount = (await db.select({ value: count() }).from(problemSubmissions).where(eq(problemSubmissions.commitmentId, commitment.id)))[0]?.value ?? 0;
  if (currentCount >= DAILY_REQUIRED) return NextResponse.json({ error: "You already submitted both questions for today." }, { status: 409 });
  if (!env.PROOFS) return NextResponse.json({ error: "Screenshot storage is unavailable." }, { status: 503 });
  const submissionId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const proofs = screenshots.map(file => {
    const id = crypto.randomUUID();
    const extension = (file.type.split("/")[1] ?? "img").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 12) || "img";
    return { id, file, objectKey: `${date}/${user.id}/${id}.${extension}` };
  });
  try {
    await Promise.all(proofs.map(async proof => env.PROOFS.put(proof.objectKey, await proof.file.arrayBuffer(), { httpMetadata: { contentType: proof.file.type } })));
  } catch (error) {
    await Promise.all(proofs.map(proof => env.PROOFS.delete(proof.objectKey)));
    console.error("[submissions/storage] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "The screenshot could not be stored. Please try again." }, { status: 500 });
  }
  try {
    await db.batch([
      db.insert(problemSubmissions).values({ id: submissionId, commitmentId: commitment.id, userId: user.id, problemTitle, leetcodeUrl: "", notes: null, submittedAt }),
      ...proofs.map(proof => db.insert(proofUploads).values({ id: proof.id, submissionId, objectKey: proof.objectKey, imageUrl: `/api/proofs/${proof.id}`, uploadedAt: submittedAt, verificationStatus: "UNVERIFIED" })),
      db.update(dailyCommitments).set({ completedCount: currentCount + 1, status: currentCount + 1 >= DAILY_REQUIRED ? "COMPLETED" : "PENDING", completedAt: currentCount + 1 >= DAILY_REQUIRED ? submittedAt : null }).where(eq(dailyCommitments.id, commitment.id)),
    ]);
  } catch (error) {
    await Promise.all(proofs.map(proof => env.PROOFS.delete(proof.objectKey)));
    console.error("[submissions] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Your proof could not be saved. Please try again." }, { status: 500 });
  }
  const completedCount = currentCount + 1;
  const completionEmail = completedCount === DAILY_REQUIRED
    ? await sendCompletionNotification({ commitmentId: commitment.id, memberName: user.name, memberEmail: user.email, date, appUrl: new URL(request.url).origin }).catch(error => { console.error("[completion-email] notification failed", { commitmentId: commitment.id, error: error instanceof Error ? error.message : String(error) }); return { sent: false }; })
    : { sent: false };
  return NextResponse.json({ ok: true, completedCount, completionEmailSent: completionEmail.sent });
}
