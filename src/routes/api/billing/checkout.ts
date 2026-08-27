import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import {
  assertSameOrigin,
  appUrl,
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
  stripeKey,
  stripeStarterPriceId,
} from "@/lib/server/motionforge";

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const body = (await request.json().catch(() => ({}))) as { planId?: unknown };
          if (body.planId !== "starter")
            return json({ error: "That subscription plan is not available." }, 400);
          const db = getServiceDb();
          const existing = await db
            .from("motionforge_subscriptions")
            .select("stripe_customer_id,status")
            .eq("user_id", identity.user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing.error) throw existing.error;
          if (
            existing.data &&
            ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(
              existing.data.status,
            )
          )
            return json(
              { error: "You already have an active subscription. Use Manage billing instead." },
              409,
            );
          const stripe = new Stripe(stripeKey());
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            integration_identifier: "motionforge_qmzptlrx",
            line_items: [{ price: stripeStarterPriceId(), quantity: 1 }],
            client_reference_id: identity.user.id,
            customer: existing.data?.stripe_customer_id || undefined,
            customer_email: existing.data?.stripe_customer_id ? undefined : identity.user.email,
            metadata: { user_id: identity.user.id, plan_id: "starter", credit_grant: "6" },
            subscription_data: {
              metadata: {
                user_id: identity.user.id,
                plan_id: "starter",
                monthly_credit_grant: "6",
              },
            },
            success_url: `${appUrl(request)}/billing?billing=success`,
            cancel_url: `${appUrl(request)}/billing?billing=canceled`,
          } as Stripe.Checkout.SessionCreateParams);
          return json({ url: session.url });
        } catch (error) {
          return safeError(error);
        }
      },
    },
  },
});
