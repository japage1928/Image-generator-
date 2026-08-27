export type AspectRatio = "9:16" | "1:1" | "16:9";
export type Duration = 5 | 10;
export type Quality = "standard" | "high";
export type ProjectStatus = "queued" | "rendering" | "completed" | "failed";

export interface Project {
  id: string;
  title: string;
  prompt: string;
  status: ProjectStatus;
  duration: Duration;
  aspectRatio: AspectRatio;
  quality: Quality;
  motionStrength: number;
  credits: number;
  createdAt: string;
  /** Data URL of the source image, when the user uploaded one. */
  sourceImage?: string;
  /** True when the render was produced by the local demo pipeline. */
  demo: boolean;
  error?: string;
}

export interface CreditTransaction {
  id: string;
  label: string;
  amount: number;
  createdAt: string;
}

export interface UsageState {
  plan: "Free" | "Creator" | "Pro";
  creditsTotal: number;
  creditsUsed: number;
  transactions: CreditTransaction[];
}

export interface GenerationSettings {
  prompt: string;
  duration: Duration;
  aspectRatio: AspectRatio;
  quality: Quality;
  motionStrength: number;
}

export const ASPECT_CLASS: Record<AspectRatio, string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
};

export function creditCost(duration: Duration, quality: Quality): number {
  const base = duration === 10 ? 2 : 1;
  return quality === "high" ? base * 2 : base;
}
