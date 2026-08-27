import { createFileRoute } from "@tanstack/react-router";
import {
  assertSameOrigin,
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
} from "@/lib/server/motionforge";

export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const identity = requireUser(await getAuthenticatedUser(request));
          const db = getServiceDb();
          await db.rpc("motionforge_bootstrap_account", { p_user_id: identity.user.id });
          const [account, subscription, plan, ledger, projectCount] = await Promise.all([
            db
              .from("motionforge_accounts")
              .select("display_name,avatar_url,plan_id")
              .eq("user_id", identity.user.id)
              .maybeSingle(),
            db
              .from("motionforge_subscriptions")
              .select("plan_id,status,stripe_customer_id,current_period_end,cancel_at_period_end")
              .eq("user_id", identity.user.id)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            db
              .from("motionforge_plans")
              .select("id,name,price_cents,monthly_video_credits,active")
              .eq("active", true)
              .order("price_cents", { ascending: true }),
            db
              .from("motionforge_credit_ledger")
              .select("id,amount,transaction_type,created_at,metadata")
              .eq("user_id", identity.user.id)
              .order("created_at", { ascending: false })
              .limit(100),
            db
              .from("motionforge_projects")
              .select("id", { count: "exact", head: true })
              .eq("user_id", identity.user.id),
          ]);
          for (const result of [account, subscription, plan, ledger, projectCount])
            if (result.error) throw result.error;
          const selectedPlanId = subscription.data?.plan_id || account.data?.plan_id || "free";
          const selectedPlan =
            plan.data?.find((item) => item.id === selectedPlanId) || plan.data?.[0];
          const rows = ledger.data || [];
          const granted = rows
            .filter((item) => item.amount > 0)
            .reduce((sum, item) => sum + item.amount, 0);
          const used = rows
            .filter((item) => item.amount < 0)
            .reduce((sum, item) => sum + Math.abs(item.amount), 0);
          return json({
            email: identity.user.email,
            displayName: account.data?.display_name || identity.user.user_metadata?.full_name || "",
            avatarUrl: account.data?.avatar_url || identity.user.user_metadata?.avatar_url || null,
            planId: selectedPlan?.id || selectedPlanId,
            plan: selectedPlan?.name || "Free",
            subscriptionStatus: subscription.data?.status || "inactive",
            renewalDate: subscription.data?.current_period_end || null,
            cancelAtPeriodEnd: Boolean(subscription.data?.cancel_at_period_end),
            manageSubscriptionAvailable: Boolean(subscription.data?.stripe_customer_id),
            credits: granted - used,
            usage: {
              creditsGranted: granted,
              creditsUsed: used,
              projectCount: projectCount.count || 0,
            },
            transactions: rows,
            plans: plan.data || [],
          });
        } catch (error) {
          return safeError(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const body = (await request.json().catch(() => ({}))) as { displayName?: unknown };
          const displayName =
            typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
          const { error } = await getServiceDb()
            .from("motionforge_accounts")
            .upsert(
              {
                user_id: identity.user.id,
                display_name: displayName || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );
          if (error) throw error;
          return json({ displayName });
        } catch (error) {
          return safeError(error);
        }
      },
    },
  },
});
