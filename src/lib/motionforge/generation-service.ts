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

export const generationService: GenerationService = demoGenerationService;
