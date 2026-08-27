import { createFileRoute } from "@tanstack/react-router";
import {
  assertSameOrigin,
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
} from "@/lib/server/motionforge";

export const Route = createFileRoute("/api/support")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const body = (await request.json().catch(() => ({}))) as {
            subject?: unknown;
            message?: unknown;
          };
          const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 160) : "";
          const message =
            typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";
          if (!subject || !message)
            return json({ error: "Subject and message are required." }, 400);
          const { data, error } = await getServiceDb()
            .from("motionforge_support_requests")
            .insert({ user_id: identity.user.id, subject, message })
            .select("id,created_at")
            .single();
          if (error) throw error;
          return json({ request: data }, 201);
        } catch (error) {
          return safeError(error);
        }
      },
    },
  },
});
