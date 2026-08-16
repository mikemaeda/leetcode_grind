import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { proofUploads } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
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
