import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Mail } from "lucide-react";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Help
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Support</h1>
      <div className="panel mt-6 p-6">
        <LifeBuoy className="size-6 text-primary" />
        <h2 className="mt-4 text-lg font-semibold">Need a hand?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tell us what happened, include the render ID if you have one, and we’ll help sort it out.
        </p>
        <a
          className="mt-5 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          href="mailto:support@motionforge.app"
        >
          <Mail className="size-4" /> support@motionforge.app
        </a>
      </div>
    </div>
  );
}
