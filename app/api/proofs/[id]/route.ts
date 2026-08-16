import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { groupMembers, proofUploads } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const membership = (await getDb().select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, LEETCODE_GROUP_ID), eq(groupMembers.userId, user.id), isNull(groupMembers.leftAt))).limit(1))[0];
  if (!membership) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const proof = (await getDb().select({ objectKey: proofUploads.objectKey }).from(proofUploads).where(eq(proofUploads.id, id)).limit(1))[0];
  if (!proof || !env.PROOFS) return new Response("Not found", { status: 404 });
  const object = await env.PROOFS.get(proof.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=300");
  headers.set("content-security-policy", "default-src 'none'");
  return new Response(object.body, { headers });
}
