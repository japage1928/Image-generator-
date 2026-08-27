import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMotionForge } from "@/lib/motionforge/store";

export const Route = createFileRoute("/usage")({ component: UsagePage });

function UsagePage() {
  const { usage } = useMotionForge();
  const remaining = Math.max(0, usage.creditsTotal - usage.creditsUsed);
  const percent = usage.creditsTotal ? (usage.creditsUsed / usage.creditsTotal) * 100 : 0;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Usage & credits</h1>
      <div className="panel mt-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4 text-cyan" /> Current plan
            </div>
            <h2 className="mt-2 text-xl font-semibold">{usage.plan}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Credits reset with your billing cycle.
            </p>
          </div>
          <Button asChild>
            <Link to="/billing">
              View plans <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-8 flex items-end justify-between text-sm">
          <span className="text-muted-foreground">Video credits used</span>
          <span>
            <strong>{remaining}</strong> remaining
          </span>
        </div>
        <Progress value={percent} className="mt-3" />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{usage.creditsUsed} used</span>
          <span>{usage.creditsTotal} total</span>
        </div>
      </div>
      <div className="panel mt-4 p-5">
        <h2 className="text-sm font-semibold">Usage rules</h2>
        <ul className="mt-4 grid gap-3 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Check className="size-4 shrink-0 text-success" />
            Free plan includes 2 five-second standard videos.
          </li>
          <li className="flex gap-2">
            <Check className="size-4 shrink-0 text-success" />
            Every live render reserves credits before it starts.
          </li>
          <li className="flex gap-2">
            <Check className="size-4 shrink-0 text-success" />
            Failed live renders must be reconciled server-side before credits are charged.
          </li>
        </ul>
      </div>
    </div>
  );
}
