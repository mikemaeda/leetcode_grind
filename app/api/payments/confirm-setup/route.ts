import { currentUser } from "@/lib/auth/session";
import { syncSetupIntent } from "@/lib/payments/sync-stripe";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as { setupIntentId?: unknown } | null;
  if (typeof input?.setupIntentId !== "string" || !input.setupIntentId.startsWith("seti_")) return Response.json({ error: "Invalid card setup." }, { status: 400 });
  try { return Response.json(await syncSetupIntent(user.id, input.setupIntentId)); }
  catch (error) {
    console.error("[payments/confirm-setup] failed", { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "The card was saved by Stripe, but its status could not be confirmed yet." }, { status: 502 });
  }
}
