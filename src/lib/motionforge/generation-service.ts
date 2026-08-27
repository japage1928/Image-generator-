import type { GenerationSettings } from "./types";
import { buildMotionPlan } from "./motion-plan";

/**
 * The demo service is local and intentionally honest. The live service submits
 * a validated job to the server route, which forwards it to n8n and polls for
 * the completed provider output.
 */
export interface GenerationRequest extends GenerationSettings {
  /** Data URL of the source image. */
  image: string;
}

export interface GenerationResult {
  /** Preview source for the render. Demo mode reuses the uploaded image. */
  previewImage: string;
  /** No provider is connected yet, so this is always undefined in demo mode. */
  videoUrl?: string;
  jobId?: string;
  motionPreset?: GenerationSettings["motionPreset"];
  demo: boolean;
}

export interface GenerationService {
  readonly isDemo: boolean;
  generate(
    request: GenerationRequest,
    onProgress: (percent: number, stage: string) => void,
    signal?: AbortSignal,
  ): Promise<GenerationResult>;
}

const STAGES: Array<[number, string]> = [
  [8, "Validating input"],
  [24, "Analysing source image"],
  [46, "Planning camera motion"],
  [68, "Synthesising frames"],
  [86, "Interpolating motion"],
  [96, "Finishing render"],
  [100, "Complete"],
];

export const demoGenerationService: GenerationService = {
  isDemo: true,
  async generate(request, onProgress, signal) {
    if (!request.image) throw new Error("An image is required.");
    if (!request.prompt.trim()) throw new Error("A motion prompt is required.");

    const step = request.duration === 10 ? 620 : 460;
    for (const [percent, stage] of STAGES) {
      await new Promise((resolve) => setTimeout(resolve, step));
      if (signal?.aborted) throw new Error("Generation cancelled.");
      onProgress(percent, stage);
    }

    return {
      previewImage: request.image,
      motionPreset: request.motionPreset,
      demo: true,
    };
  },
};

const LIVE_ENDPOINT = "/api/generations";

type JobResponse = {
  jobId?: string;
  status?: "queued" | "running" | "completed" | "failed";
  progress?: number;
  stage?: string;
  videoUrl?: string;
  video_url?: string;
  url?: string;
  output?: string | { url?: string };
  previewImage?: string;
  error?: string;
};

function videoUrlFrom(payload: JobResponse): string | undefined {
  if (payload.videoUrl) return payload.videoUrl;
  if (payload.video_url) return payload.video_url;
  if (payload.url) return payload.url;
  if (typeof payload.output === "string") return payload.output;
  if (payload.output && typeof payload.output === "object" && payload.output.url)
    return payload.output.url;
  return undefined;
}

async function readJson(response: Response): Promise<JobResponse> {
  const body = (await response.json().catch(() => ({}))) as JobResponse;
  if (!response.ok)
    throw new Error(body.error || `Generation request failed (${response.status}).`);
  return body;
}

const liveGenerationService: GenerationService = {
  isDemo: false,
  async generate(request, onProgress, signal) {
    const response = await fetch(LIVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        motionPlan: buildMotionPlan(request.prompt, request.motionPreset, request.motionStrength),
      }),
      signal,
    });
    const created = await readJson(response);
    const immediateVideoUrl = videoUrlFrom(created);
    if (immediateVideoUrl) {
      onProgress(100, "Complete");
      return {
        previewImage: created.previewImage || request.image,
        videoUrl: immediateVideoUrl,
        demo: false,
      };
    }
    if (!created.jobId)
      throw new Error("The generation service did not return a job ID or video URL.");

    onProgress(created.progress ?? 5, created.stage ?? "Queued");
    while (true) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 3500);
        signal?.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(new Error("Generation cancelled."));
          },
          { once: true },
        );
      });
      const jobResponse = await fetch(`${LIVE_ENDPOINT}/${encodeURIComponent(created.jobId)}`, {
        signal,
      });
      const job = await readJson(jobResponse);
      onProgress(job.progress ?? 20, job.stage ?? "Rendering");
      if (job.status === "failed") {
        throw new Error(job.error || "The provider failed to render this video.");
      }
      if (job.status === "completed") {
        const videoUrl = videoUrlFrom(job);
        if (!videoUrl) {
          throw new Error("The provider completed the job without returning a video URL.");
        }
        return {
          previewImage: job.previewImage || request.image,
          videoUrl,
          jobId: created.jobId,
          motionPreset: request.motionPreset,
          demo: false,
        };
      }
    }
  },
};

/** Demo remains the safe local default. Set VITE_GENERATION_MODE=live after n8n is configured. */
export const generationService: GenerationService =
  import.meta.env.VITE_GENERATION_MODE === "live" ? liveGenerationService : demoGenerationService;
