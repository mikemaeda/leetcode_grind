import type { Metadata } from "next";
import { AccountabilityApp } from "./AccountabilityApp";
import { AuthScreen } from "./AuthScreen";
import { currentUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commit — Daily accountability that counts",
  description: "Daily commitments, proof, streaks, waivers, and fair consequences for developer groups.",
};

export default async function Home() {
  const user = await currentUser();
  if (!user) return <AuthScreen />;
  const registeredUsers = await getDb().select({ id: users.id, name: users.name }).from(users);
  return <AccountabilityApp viewerName={user.name} viewerEmail={user.email} members={registeredUsers} />;
}
