import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Lazily-created Stripe.js singleton. The publishable key is a NEXT_PUBLIC_ var so it
 * ships to the browser; the PaymentElement runs client-side. Returns null if no key is
 * configured (mock mode never reaches this path).
 */
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (stripePromise === null) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
