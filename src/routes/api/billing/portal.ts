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
} from "@/lib/server/motionforge";

export const Route = createFileRoute("/api/billing/portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const row = await getServiceDb()
            .from("motionforge_subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", identity.user.id)
            .not("stripe_customer_id", "is", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (row.error) throw row.error;
          if (!row.data?.stripe_customer_id)
            return json({ error: "No Stripe customer is attached to this account." }, 404);
          const stripe = new Stripe(stripeKey());
          const session = await stripe.billingPortal.sessions.create({
            customer: row.data.stripe_customer_id,
            return_url: `${appUrl(request)}/billing`,
          });
          return json({ url: session.url });
        } catch (error) {
          return safeError(error);
        }
      },
    },
  },
});
