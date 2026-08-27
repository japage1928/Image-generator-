import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { motionforgeFetch } from "@/lib/motionforge/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/billing")({ component: BillingPage });

type Account = {
  plan: string;
  planId: string;
  subscriptionStatus: string;
  renewalDate?: string | null;
  cancelAtPeriodEnd?: boolean;
  manageSubscriptionAvailable?: boolean;
};

function BillingPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user)
      void motionforgeFetch<Account>("/api/account")
        .then(setAccount)
        .catch(() => undefined);
  }, [user]);

  async function startCheckout() {
    setBusy(true);
    try {
      const result = await motionforgeFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "starter" }),
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open checkout.");
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    try {
      const result = await motionforgeFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing portal.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Subscriptions and payments are handled securely by Stripe.
      </p>
      {!user ? (
        <div className="panel mt-6 p-6">
          <p className="text-sm text-muted-foreground">Sign in before choosing a plan.</p>
          <Button asChild className="mt-4">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="panel mt-6 p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <h2 className="mt-2 text-xl font-semibold">{account?.plan || "Loading…"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {account?.subscriptionStatus || "inactive"}
              {account?.renewalDate
                ? ` · renews ${new Date(account.renewalDate).toLocaleDateString()}`
                : ""}
            </p>
            {account?.manageSubscriptionAvailable && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => void openPortal()}
                disabled={busy}
              >
                Manage subscription
              </Button>
            )}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="panel p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Starter</h2>
                <CreditCard className="size-5 text-primary" />
              </div>
              <p className="mt-5 text-3xl font-semibold">
                $19.99<span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">For regular short-form creation.</p>
              <p className="mt-5 flex items-center gap-2 text-sm">
                <Check className="size-4 text-success" />6 video credits each month
              </p>
              <Button
                className="mt-6 w-full"
                onClick={() => void startCheckout()}
                disabled={busy || account?.manageSubscriptionAvailable}
              >
                {account?.manageSubscriptionAvailable
                  ? "Current subscription"
                  : "Subscribe with Stripe"}
              </Button>
            </div>
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">More capacity</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Higher tiers will be added after the Grok cost profile is proven. No imaginary
                pricing, what a concept.
              </p>
              <Button className="mt-6 w-full" variant="secondary" disabled>
                Coming soon
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
