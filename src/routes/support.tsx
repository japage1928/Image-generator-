import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { LifeBuoy, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/AuthProvider";
import { motionforgeFetch } from "@/lib/motionforge/api-client";

export const Route = createFileRoute("/support")({ component: SupportPage });

function SupportPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Add a subject and message first");
      return;
    }

    setSending(true);
    try {
      await motionforgeFetch("/api/support", {
        method: "POST",
        body: JSON.stringify({ subject, message }),
      });
      setSubject("");
      setMessage("");
      toast.success("Support request sent", {
        description: "We’ll follow up by email.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send request");
    } finally {
      setSending(false);
    }
  }

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
        {user ? (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What do you need help with?"
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Include a render ID or any useful details."
                rows={6}
                maxLength={5000}
              />
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LifeBuoy className="size-4" />
              )}
              Send request
            </Button>
          </form>
        ) : (
          <div className="mt-5 rounded-lg border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
            <p>Sign in to send a request from your account.</p>
            <Button asChild size="sm" className="mt-3">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        )}
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
