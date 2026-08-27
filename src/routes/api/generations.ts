import { createFileRoute } from "@tanstack/react-router";

const MAX_IMAGE_DATA_URL_LENGTH = 5_000_000;
const ALLOWED_RATIOS = new Set(["9:16", "1:1", "16:9"]);
const ALLOWED_QUALITIES = new Set(["standard", "high"]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
function secret(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

export const Route = createFileRoute("/api/generations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhook = secret("N8N_GENERATION_WEBHOOK_URL");
        if (!webhook) return jsonError("Generation service is not configured yet.", 503);
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return jsonError("Invalid JSON body.", 400);
        }
        const image = typeof body.image === "string" ? body.image : "";
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        if (!image.startsWith("data:image/") || image.length > MAX_IMAGE_DATA_URL_LENGTH)
          return jsonError("Image data is missing or too large.", 400);
        if (!prompt || prompt.length > 2000)
          return jsonError("Motion prompt must be between 1 and 2,000 characters.", 400);
        if (body.duration !== 5 && body.duration !== 10)
          return jsonError("Unsupported duration.", 400);
        if (typeof body.aspectRatio !== "string" || !ALLOWED_RATIOS.has(body.aspectRatio))
          return jsonError("Unsupported aspect ratio.", 400);
        if (typeof body.quality !== "string" || !ALLOWED_QUALITIES.has(body.quality))
          return jsonError("Unsupported quality.", 400);
        try {
          const upstream = await fetch(webhook, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-motionforge-secret": secret("N8N_WEBHOOK_SECRET") ?? "",
            },
            body: JSON.stringify({ ...body, prompt, requestId: crypto.randomUUID() }),
          });
          const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
          if (!upstream.ok)
            return jsonError(
              typeof payload.error === "string"
                ? payload.error
                : "Generation workflow rejected the request.",
              502,
            );
          const jobId =
            typeof payload.jobId === "string"
              ? payload.jobId
              : typeof payload.id === "string"
                ? payload.id
                : undefined;
          if (!jobId) return jsonError("Generation workflow did not return a job ID.", 502);
          return Response.json(
            { jobId, status: "queued", progress: 5, stage: "Queued" },
            { status: 202 },
          );
        } catch (error) {
          console.error("generation webhook error", error);
          return jsonError("Could not reach the generation workflow.", 502);
        }
      },
    },
  },
});
