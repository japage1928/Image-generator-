import { createFileRoute } from "@tanstack/react-router";
import {
  assertSameOrigin,
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
} from "@/lib/server/motionforge";

export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const identity = requireUser(await getAuthenticatedUser(request));
          const db = getServiceDb();
          const { data, error } = await db
            .from("motionforge_projects")
            .select("*")
            .eq("user_id", identity.user.id)
            .order("created_at", { ascending: false })
            .limit(100);
          if (error) throw error;
          return json({ projects: data || [] });
        } catch (error) {
          return safeError(error);
        }
      },
      DELETE: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const id = new URL(request.url).searchParams.get("id") || "";
          if (!/^[0-9a-f-]{36}$/i.test(id))
            return json({ error: "A valid project id is required." }, 400);
          const { error } = await getServiceDb()
            .from("motionforge_projects")
            .delete()
            .eq("id", id)
            .eq("user_id", identity.user.id);
          if (error) throw error;
          return json({ deleted: true });
        } catch (error) {
          return safeError(error);
        }
      },
    },
  },
});
