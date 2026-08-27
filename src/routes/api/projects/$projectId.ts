import { createFileRoute } from "@tanstack/react-router";
import {
  assertSameOrigin,
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
} from "@/lib/server/motionforge";

export const Route = createFileRoute("/api/projects/$projectId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const { error } = await getServiceDb()
            .from("motionforge_projects")
            .delete()
            .eq("id", params.projectId)
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
