import type { Metadata } from "next";
import { getChatGPTUser } from "./chatgpt-auth";
import { AccountabilityApp } from "./AccountabilityApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commit — Daily accountability that counts",
  description: "Daily commitments, proof, streaks, waivers, and fair consequences for developer groups.",
};

export default async function Home() {
  const user = await getChatGPTUser();
  return <AccountabilityApp viewerName={user?.fullName?.split(" ")[0] ?? "Mike"} signedIn={Boolean(user)} />;
}
