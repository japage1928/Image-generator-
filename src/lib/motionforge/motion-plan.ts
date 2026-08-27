import type { MotionPreset } from "./types";

export interface MotionPlan {
  camera: string;
  subject: string;
  environment: string;
  strength: number;
  negativePrompt: string;
  providerPrompt: string;
}

const CAMERA_BY_PRESET: Record<MotionPreset, string> = {
  "push-in": "a slow cinematic push-in with a stable lens and gentle depth separation",
  pan: "a smooth lateral camera pan with controlled parallax across the frame",
  orbit: "a subtle three-quarter orbit around the main subject with consistent perspective",
  parallax:
    "layered 2.5D parallax with foreground, subject, and background moving at different speeds",
  handheld: "restrained handheld camera sway with natural micro-movement, never violent shake",
};

export function buildMotionPlan(
  prompt: string,
  preset: MotionPreset,
  strength: number,
): MotionPlan {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  const camera = CAMERA_BY_PRESET[preset];
  const environment = cleaned || "subtle natural environmental movement";
  const subject =
    "Keep the uploaded subject recognizable, anatomically stable, and visually consistent throughout the clip.";
  const negativePrompt = [
    "no subject replacement",
    "no object morphing",
    "no added limbs or duplicate objects",
    "no invented logos or text",
    "no melting, warping, flicker, or frame tearing",
    "no unrequested scene change",
    "no aggressive zoom",
  ].join(", ");
  const providerPrompt = [
    `Animate the exact uploaded image as the source of truth. ${camera}.`,
    `User direction: ${environment}.`,
    subject,
    `Motion intensity: ${strength}/100.`,
    `Negative constraints: ${negativePrompt}.`,
  ].join(" ");
  return { camera, subject, environment, strength, negativePrompt, providerPrompt };
}
