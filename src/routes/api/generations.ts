import { createFileRoute } from "@tanstack/react-router";
import { buildMotionPlan } from "@/lib/motionforge/motion-plan";
import type { MotionPreset } from "@/lib/motionforge/types";
import {
  assertSameOrigin,
  getAuthenticatedUser,
  getServiceDb,
  json,
  requireUser,
  safeError,
  maxDailySpend,
} from "@/lib/server/motionforge";

const MAX_IMAGE_DATA_URL_LENGTH = 5_000_000;
const ALLOWED_RATIOS = new Set(["9:16", "1:1", "16:9"]);
const ALLOWED_QUALITIES = new Set(["standard", "high"]);
const ALLOWED_PRESETS = new Set([
  "bring-to-life",
  "subject-action",
  "product-demo",
  "environment",
  "expression",
  "push-in",
  "pan",
  "orbit",
  "parallax",
  "handheld",
]);

function env(name: string) {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

function videoUrlFrom(payload: Record<string, unknown>) {
  if (typeof payload.videoUrl === "string") return payload.videoUrl;
  if (typeof payload.video_url === "string") return payload.video_url;
  if (typeof payload.url === "string") return payload.url;
  if (typeof payload.output === "string") return payload.output;
  if (
    payload.output &&
    typeof payload.output === "object" &&
    typeof (payload.output as { url?: unknown }).url === "string"
  )
    return (payload.output as { url: string }).url;
  return undefined;
}

function creditCost(duration: number, quality: string) {
  const base = duration === 10 ? 2 : 1;
  return quality === "high" ? base * 2 : base;
}

async function dispatch(payload: Record<string, unknown>) {
  const webhook = env("N8N_GENERATION_WEBHOOK_URL");
  if (!webhook)
    throw Object.assign(new Error("Generation service is not configured yet."), { status: 503 });
  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-motionforge-secret": env("N8N_WEBHOOK_SECRET") || "",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof data.error === "string"
          ? data.error
          : `Generation workflow returned HTTP ${response.status}.`,
      ),
      { status: 502 },
    );
  return data;
}

export const Route = createFileRoute("/api/generations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let generationId: string | null = null;
        try {
          assertSameOrigin(request);
          const identity = requireUser(await getAuthenticatedUser(request));
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const image = typeof body.image === "string" ? body.image : "";
          const userPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
          const motionPreset = typeof body.motionPreset === "string" ? body.motionPreset : "";
          const motionStrength = typeof body.motionStrength === "number" ? body.motionStrength : 50;
          const duration = body.duration === 5 || body.duration === 10 ? body.duration : 0;
          const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio : "";
          const quality = typeof body.quality === "string" ? body.quality : "";
          if (!image.startsWith("data:image/") || image.length > MAX_IMAGE_DATA_URL_LENGTH)
            return json({ error: "Image data is missing or too large." }, 400);
          if (!userPrompt || userPrompt.length > 2000)
            return json({ error: "Motion prompt must be between 1 and 2,000 characters." }, 400);
          if (!duration) return json({ error: "Unsupported duration." }, 400);
          if (!ALLOWED_RATIOS.has(aspectRatio))
            return json({ error: "Unsupported aspect ratio." }, 400);
          if (!ALLOWED_QUALITIES.has(quality)) return json({ error: "Unsupported quality." }, 400);
          if (!ALLOWED_PRESETS.has(motionPreset))
            return json({ error: "Unsupported motion style." }, 400);
          if (!Number.isFinite(motionStrength) || motionStrength < 10 || motionStrength > 100)
            return json({ error: "Motion strength must be between 10 and 100." }, 400);
          const requestKey = request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
          const plan = buildMotionPlan(userPrompt, motionPreset as MotionPreset, motionStrength);
          const credits = creditCost(duration, quality);
          const apiCost = Number((credits * 0.12).toFixed(4));
          const db = getServiceDb();
          await db.rpc("motionforge_bootstrap_account", { p_user_id: identity.user.id });
          const projectInsert = await db
            .from("motionforge_projects")
            .insert({
              user_id: identity.user.id,
              title: userPrompt.split(/\s+/).slice(0, 6).join(" ") || "Untitled animation",
              prompt: userPrompt,
              source_image: image,
              duration_seconds: duration,
              aspect_ratio: aspectRatio,
              quality,
              motion_strength: motionStrength,
              motion_preset: motionPreset,
              status: "draft",
            })
            .select("*")
            .single();
          if (projectInsert.error) throw projectInsert.error;
          const projectId = projectInsert.data.id as string;
          const reservation = await db.rpc("motionforge_reserve_generation", {
            p_user_id: identity.user.id,
            p_project_id: projectId,
            p_request_key: requestKey,
            p_estimated_credits: credits,
            p_duration_seconds: duration,
            p_quality: quality,
            p_estimated_api_cost: apiCost,
            p_max_daily_spend: maxDailySpend(),
          });
          if (reservation.error) throw reservation.error;
          const reserved = Array.isArray(reservation.data) ? reservation.data[0] : reservation.data;
          if (!reserved?.reserved || !reserved.generation_id) {
            await db.from("motionforge_projects").delete().eq("id", projectId);
            return json(
              {
                error:
                  reserved?.reason === "insufficient_credits"
                    ? "Not enough credits."
                    : "Generation is temporarily unavailable.",
                code: reserved?.reason || "reservation_failed",
              },
              reserved?.reason === "insufficient_credits" ? 402 : 503,
            );
          }
          generationId = reserved.generation_id;
          const upstream = await dispatch({
            ...body,
            image,
            prompt: plan.providerPrompt,
            userPrompt,
            motionPlan: plan,
            requestId: requestKey,
            generationId,
            projectId,
            userId: identity.user.id,
          });
          const immediateVideoUrl = videoUrlFrom(upstream);
          if (immediateVideoUrl) {
            const outputPayload = { ...upstream, video_url: immediateVideoUrl };
            await db.rpc("motionforge_complete_generation", {
              p_generation_id: generationId,
              p_output_payload: outputPayload,
              p_actual_credits: credits,
              p_actual_api_cost: apiCost,
            });
            return json({
              jobId: generationId,
              projectId,
              status: "completed",
              progress: 100,
              stage: "Complete",
              videoUrl: immediateVideoUrl,
              project: { ...projectInsert.data, video_url: immediateVideoUrl, status: "completed" },
            });
          }
          const providerJobId =
            typeof upstream.jobId === "string"
              ? upstream.jobId
              : typeof upstream.id === "string"
                ? upstream.id
                : "";
          if (!providerJobId)
            throw new Error("Generation workflow did not return a job ID or video URL.");
          const marked = await db.rpc("motionforge_mark_generation_queued", {
            p_generation_id: generationId,
            p_workflow_payload: { providerJobId, requestKey, provider: "n8n-grok" },
          });
          if (marked.error) throw marked.error;
          return json(
            { jobId: generationId, projectId, status: "queued", progress: 5, stage: "Queued" },
            202,
          );
        } catch (error) {
          if (generationId) {
            try {
              await getServiceDb().rpc("motionforge_fail_generation", {
                p_generation_id: generationId,
                p_reason:
                  error instanceof Error ? error.message.slice(0, 1000) : "Generation failed.",
              });
            } catch {
              /* preserve original error */
            }
          }
          return safeError(error);
        }
      },
    },
  },
});

export { videoUrlFrom };
