import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import {
  getServiceDb,
  json,
  safeError,
  stripeKey,
  stripeWebhookSecret,
} from "@/lib/server/motionforge";

function iso(unix: unknown) {
  const value = Number(unix);
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

async function upsertSubscription(stripe: Stripe, subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {};
  const userId = metadata.user_id;
  if (!userId) return;
  const customer =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const { error } = await getServiceDb()
    .from("motionforge_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: metadata.plan_id || "starter",
        status: subscription.status,
        stripe_customer_id: customer,
        stripe_subscription_id: subscription.id,
        current_period_end: iso(
          (subscription as Stripe.Subscription & { current_period_end?: number })
            .current_period_end,
        ),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (error) throw error;
  void stripe;
}

async function grantCredits(
  userId: string,
  amount: number,
  type: "subscription_grant",
  key: string,
  paymentId: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  const { error } = await getServiceDb()
    .from("motionforge_credit_ledger")
    .insert({
      user_id: userId,
      amount,
      transaction_type: type,
      idempotency_key: key,
      payment_id: paymentId,
      metadata: { source: "stripe_verified_webhook" },
    });
  if (error && error.code !== "23505") throw error;
}

export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let eventId = "";
        try {
          const stripe = new Stripe(stripeKey());
          const event = stripe.webhooks.constructEvent(
            await request.text(),
            request.headers.get("stripe-signature") || "",
            stripeWebhookSecret(),
          );
          eventId = event.id;
          const db = getServiceDb();
          const claim = await db
            .from("motionforge_stripe_events")
            .insert({ event_id: event.id, event_type: event.type, status: "processing" });
          if (claim.error?.code === "23505") return json({ received: true, duplicate: true });
          if (claim.error) throw claim.error;

          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.user_id || session.client_reference_id;
            if (userId && session.payment_status === "paid") {
              const subscriptionId =
                typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription?.id;
              if (subscriptionId)
                await upsertSubscription(
                  stripe,
                  await stripe.subscriptions.retrieve(subscriptionId),
                );
              await grantCredits(
                userId,
                Number(session.metadata?.credit_grant || 6),
                "subscription_grant",
                `motionforge_checkout:${session.id}`,
                typeof session.payment_intent === "string" ? session.payment_intent : session.id,
              );
            }
          } else if (event.type.startsWith("customer.subscription.")) {
            await upsertSubscription(stripe, event.data.object as Stripe.Subscription);
          } else if (event.type === "invoice.paid") {
            const invoice = event.data.object as Stripe.Invoice & {
              subscription?: string | { id: string };
              billing_reason?: string;
            };
            if (invoice.billing_reason !== "subscription_create" && invoice.subscription) {
              const subscriptionId =
                typeof invoice.subscription === "string"
                  ? invoice.subscription
                  : invoice.subscription.id;
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const userId = subscription.metadata?.user_id;
              if (userId)
                await grantCredits(
                  userId,
                  Number(subscription.metadata?.monthly_credit_grant || 6),
                  "subscription_grant",
                  `motionforge_invoice:${invoice.id}`,
                  invoice.id,
                );
              await upsertSubscription(stripe, subscription);
            }
          }
          const { error } = await db
            .from("motionforge_stripe_events")
            .update({ status: "completed", processed_at: new Date().toISOString(), error: null })
            .eq("event_id", event.id);
          if (error) throw error;
          return json({ received: true });
        } catch (error) {
          if (eventId) {
            try {
              await getServiceDb()
                .from("motionforge_stripe_events")
                .update({
                  status: "failed",
                  error: error instanceof Error ? error.message.slice(0, 1000) : "Webhook failed.",
                })
                .eq("event_id", eventId);
            } catch {
              /* Stripe retries failed events. */
            }
          }
          return safeError(error);
        }
      },
    },
  },
});
