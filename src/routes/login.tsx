import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { configured, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [createAccount, setCreateAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (createAccount) {
        const confirmationRequired = await signUp(email, password, displayName);
        toast.success(
          confirmationRequired ? "Check your email to confirm your account." : "Account created",
        );
        if (!confirmationRequired) await navigate({ to: "/" });
      } else {
        await signIn(email, password);
        toast.success("Signed in");
        await navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md items-center px-4 py-10">
      <div className="panel w-full p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          MotionForge
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {createAccount ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {configured
            ? "Your projects, credits, and billing follow you everywhere."
            : "Add Supabase environment variables to enable accounts."}
        </p>
        {!configured ? (
          <p className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            Authentication is not configured on this deployment yet.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {createAccount && (
              <div className="space-y-2">
                <Label htmlFor="display-name">Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={createAccount ? "new-password" : "current-password"}
              />
            </div>
            <Button className="w-full" type="submit" disabled={busy || loading}>
              {busy ? "Working…" : createAccount ? "Create account" : "Sign in"}
            </Button>
          </form>
        )}
        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-primary hover:underline"
          onClick={() => setCreateAccount((value) => !value)}
        >
          {createAccount ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>
        <Link
          to="/"
          className="mt-5 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back to Studio
        </Link>
      </div>
    </div>
  );
}
