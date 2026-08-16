import type { Metadata } from "next";
import { AccountabilityApp } from "./AccountabilityApp";
import { AuthScreen } from "./AuthScreen";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commit — Daily accountability that counts",
  description: "Daily commitments, proof, streaks, waivers, and fair consequences for developer groups.",
};

export default async function Home() {
  const user = await currentUser();
  if (!user) return <AuthScreen />;
  return <AccountabilityApp viewerName={user.name.split(" ")[0]} />;
}
