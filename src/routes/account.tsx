import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motionforgeFetch } from "@/lib/motionforge/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void motionforgeFetch<{ displayName?: string }>("/api/account").then((data) =>
      setDisplayName(data.displayName || ""),
    );
  }, [user]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await motionforgeFetch("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      toast.success("Account settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut();
    await navigate({ to: "/login" });
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="panel p-6">
          <h1 className="text-xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your account settings.
          </p>
          <Button asChild className="mt-5">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Account settings</h1>
      <div className="panel mt-6 p-6">
        <form className="space-y-5" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" value={user.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-name">Display name</Label>
            <Input
              id="account-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </form>
        <div className="mt-8 border-t border-border pt-5">
          <Button variant="ghost" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
