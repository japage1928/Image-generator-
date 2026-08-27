import type { GenerationSettings } from "./types";

/**
 * Service interface for a future real image-to-video provider.
 *
 * Nothing here calls an external API. `DemoGenerationService` runs entirely in
 * the browser and produces an honestly-labelled demo render from the uploaded
 * image. When a provider is connected, implement this interface against a
 * server function and swap the export below.
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

    return { previewImage: request.image, demo: true };
  },
};

const LIVE_ENDPOINT = "/api/generations";

type JobResponse = {
  jobId?: string;
  status?: "queued" | "running" | "completed" | "failed";
  progress?: number;
  stage?: string;
  videoUrl?: string;
  previewImage?: string;
  error?: string;
};

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
      body: JSON.stringify(request),
      signal,
    });
    const created = await readJson(response);
    if (!created.jobId) throw new Error("The generation service did not return a job ID.");

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
        if (!job.videoUrl) {
          throw new Error("The provider completed the job without returning a video URL.");
        }
        return {
          previewImage: job.previewImage || request.image,
          videoUrl: job.videoUrl,
          jobId: created.jobId,
          demo: false,
        };
      }
    }
  },
};

/** Demo remains the safe local default. Set VITE_GENERATION_MODE=live after n8n is configured. */
export const generationService: GenerationService =
  import.meta.env.VITE_GENERATION_MODE === "live" ? liveGenerationService : demoGenerationService;
