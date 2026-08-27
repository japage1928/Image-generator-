import { createFileRoute } from "@tanstack/react-router";
import {
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
} from "@/lib/server/motionforge";

function videoUrlFrom(payload: Record<string, unknown>) {
  const direct = payload.videoUrl || payload.video_url || payload.url;
  if (typeof direct === "string" && direct.startsWith("http")) return direct;
  if (typeof payload.output === "string" && payload.output.startsWith("http"))
    return payload.output;
  if (payload.output && typeof payload.output === "object") {
    const nested = payload.output as Record<string, unknown>;
    const url = nested.videoUrl || nested.video_url || nested.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return null;
}

function env(name: string) {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

export const Route = createFileRoute("/api/generations/$jobId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const identity = requireUser(await getAuthenticatedUser(request));
          const db = getServiceDb();
          const row = await db
            .from("motionforge_generations")
            .select("id,project_id,status,credits_reserved,workflow_payload,output_payload,error")
            .eq("id", params.jobId)
            .eq("user_id", identity.user.id)
            .maybeSingle();
          if (row.error) throw row.error;
          if (!row.data) return json({ error: "Generation not found." }, 404);
          if (row.data.status === "completed")
            return json({
              jobId: row.data.id,
              projectId: row.data.project_id,
              status: "completed",
              progress: 100,
              stage: "Complete",
              videoUrl: videoUrlFrom(row.data.output_payload || {}),
            });
          if (row.data.status === "failed")
            return json({
              jobId: row.data.id,
              status: "failed",
              error: row.data.error || "Generation failed.",
            });
          const statusWebhook = env("N8N_STATUS_WEBHOOK_URL");
          if (!statusWebhook)
            return json({ error: "Generation status service is not configured yet." }, 503);
          const providerJobId =
            typeof row.data.workflow_payload?.providerJobId === "string"
              ? row.data.workflow_payload.providerJobId
              : params.jobId;
          const url = new URL(statusWebhook);
          url.searchParams.set("jobId", providerJobId);
          const response = await fetch(url, {
            headers: { "x-motionforge-secret": env("N8N_WEBHOOK_SECRET") || "" },
          });
          const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          if (!response.ok)
            return json(
              {
                error:
                  typeof payload.error === "string" ? payload.error : "Status workflow failed.",
              },
              502,
            );
          const videoUrl = videoUrlFrom(payload);
          const status =
            payload.status === "completed" || videoUrl
              ? "completed"
              : payload.status === "failed"
                ? "failed"
                : "running";
          if (status === "completed" && videoUrl) {
            await db.rpc("motionforge_complete_generation", {
              p_generation_id: row.data.id,
              p_output_payload: { ...payload, video_url: videoUrl },
              p_actual_credits: row.data.credits_reserved,
              p_actual_api_cost: Number((Number(row.data.credits_reserved) * 0.12).toFixed(4)),
            });
            return json({
              jobId: row.data.id,
              projectId: row.data.project_id,
              status,
              progress: 100,
              stage: "Complete",
              videoUrl,
            });
          }
          if (status === "failed") {
            await db.rpc("motionforge_fail_generation", {
              p_generation_id: row.data.id,
              p_reason: typeof payload.error === "string" ? payload.error : "Provider failed.",
            });
            return json({
              jobId: row.data.id,
              status,
              error: typeof payload.error === "string" ? payload.error : "Provider failed.",
            });
          }
          await db
            .from("motionforge_generations")
            .update({ status: "running", updated_at: new Date().toISOString() })
            .eq("id", row.data.id)
            .eq("user_id", identity.user.id);
          await db
            .from("motionforge_projects")
            .update({ status: "running", updated_at: new Date().toISOString() })
            .eq("id", row.data.project_id)
            .eq("user_id", identity.user.id);
          return json({
            jobId: row.data.id,
            projectId: row.data.project_id,
            status,
            progress: typeof payload.progress === "number" ? payload.progress : 25,
            stage: typeof payload.stage === "string" ? payload.stage : "Rendering",
          });
        } catch (error) {
          return safeError(error);
        }
      },
    },
  },
});
