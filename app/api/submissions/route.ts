import { env } from "cloudflare:workers";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { dailyCommitments, problemSubmissions, proofUploads } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { DAILY_REQUIRED, ensureLeetcodeMembership, LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const maxImageBytes = 10 * 1024 * 1024;
const maxImages = 3;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to submit proof." }, { status: 401 });
  const { date } = await ensureLeetcodeMembership(user);
  const form = await request.formData();
  const problemTitle = String(form.get("problemTitle") ?? "").trim();
  const leetcodeUrl = String(form.get("leetcodeUrl") ?? "").trim();
  const screenshots = form.getAll("screenshots").filter((value): value is File => value instanceof File && value.size > 0);
  if (!problemTitle || !/^https:\/\/(www\.)?leetcode\.com\/problems\//i.test(leetcodeUrl)) return NextResponse.json({ error: "Enter the question title and a valid LeetCode problem URL." }, { status: 400 });
  if (!screenshots.length || screenshots.length > maxImages || screenshots.some(file => !allowedTypes.has(file.type) || file.size > maxImageBytes)) return NextResponse.json({ error: "Choose 1–3 PNG, JPG, WEBP, GIF, or AVIF images, up to 10 MB each." }, { status: 400 });
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
    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
    return { id, file, objectKey: `${date}/${user.id}/${id}.${extension}` };
  });
  await Promise.all(proofs.map(proof => env.PROOFS.put(proof.objectKey, proof.file.arrayBuffer(), { httpMetadata: { contentType: proof.file.type } })));
  try {
    await db.batch([
      db.insert(problemSubmissions).values({ id: submissionId, commitmentId: commitment.id, userId: user.id, problemTitle, leetcodeUrl, notes: null, submittedAt }),
      ...proofs.map(proof => db.insert(proofUploads).values({ id: proof.id, submissionId, objectKey: proof.objectKey, imageUrl: `/api/proofs/${proof.id}`, uploadedAt: submittedAt, verificationStatus: "UNVERIFIED" })),
      db.update(dailyCommitments).set({ completedCount: currentCount + 1, status: currentCount + 1 >= DAILY_REQUIRED ? "COMPLETED" : "PENDING", completedAt: currentCount + 1 >= DAILY_REQUIRED ? submittedAt : null }).where(eq(dailyCommitments.id, commitment.id)),
    ]);
  } catch (error) {
    await Promise.all(proofs.map(proof => env.PROOFS.delete(proof.objectKey)));
    console.error("[submissions] failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Your proof could not be saved. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, completedCount: currentCount + 1 });
}
