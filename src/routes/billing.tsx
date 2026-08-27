import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/billing")({ component: BillingPage });

function BillingPage() {
  const plans = [
    {
      name: "Starter",
      price: "$20",
      credits: "6 standard videos",
      copy: "For occasional projects",
    },
    { name: "Pro", price: "$40", credits: "12 standard videos", copy: "For frequent creation" },
  ];
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Choose the amount of room you need. Live pricing and checkout will be supplied by Stripe
        when billing is enabled.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <div className="panel p-6" key={plan.name}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <CreditCard className="size-5 text-primary" />
            </div>
            <p className="mt-5 text-3xl font-semibold">
              {plan.price}
              <span className="text-sm font-normal text-muted-foreground"> / month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{plan.copy}</p>
            <p className="mt-5 flex items-center gap-2 text-sm">
              <Check className="size-4 text-success" />
              {plan.credits}
            </p>
            <Button className="mt-6 w-full" disabled>
              Stripe checkout coming next
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
