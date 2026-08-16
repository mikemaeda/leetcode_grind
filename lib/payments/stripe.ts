import Stripe from "stripe";
import { env } from "cloudflare:workers";

export function runtimeValue(name: string) { return (env as unknown as Record<string, string | undefined>)[name]; }
export function stripeClient() {
  const key = runtimeValue("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key, { apiVersion: "2026-07-29.dahlia", httpClient: Stripe.createFetchHttpClient() });
}
export function stripePublishableKey() { return runtimeValue("STRIPE_PUBLISHABLE_KEY") ?? ""; }
export function stripeWebhookSecret() { return runtimeValue("STRIPE_WEBHOOK_SECRET") ?? ""; }

export function isStripeModeMismatch(error: unknown) {
  return error instanceof Stripe.errors.StripeInvalidRequestError &&
    (error.code === "resource_missing" || error.message.toLowerCase().includes("test mode"));
}
