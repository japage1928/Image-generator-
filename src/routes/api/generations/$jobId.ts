import { createFileRoute } from "@tanstack/react-router";

function secret(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

export const Route = createFileRoute("/api/generations/$jobId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const statusWebhook = secret("N8N_STATUS_WEBHOOK_URL");
        if (!statusWebhook)
          return Response.json(
            { error: "Generation status service is not configured yet." },
            { status: 503 },
          );
        try {
          const url = new URL(statusWebhook);
          url.searchParams.set("jobId", params.jobId);
          const response = await fetch(url, {
            headers: { "x-motionforge-secret": secret("N8N_WEBHOOK_SECRET") ?? "" },
          });
          const payload = await response.json().catch(() => ({}));
          return Response.json(payload, { status: response.ok ? 200 : 502 });
        } catch (error) {
          console.error("generation status error", error);
          return Response.json(
            { error: "Could not reach the generation status workflow." },
            { status: 502 },
          );
        }
      },
    },
  },
});
