import { currentUser } from "@/lib/auth/session";
import { syncConnectedAccount } from "@/lib/payments/sync-stripe";

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await syncConnectedAccount(user.id)); }
  catch (error) {
    console.error("[payments/sync-payouts] failed", { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "Payout status could not be refreshed yet." }, { status: 502 });
  }
}
