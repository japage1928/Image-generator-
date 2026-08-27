import type { MotionPreset } from "./types";

export interface MotionPlan {
  camera: string;
  subject: string;
  environment: string;
  subjectAction: string;
  strength: number;
  negativePrompt: string;
  providerPrompt: string;
}

const SUBJECT_ACTION_BY_PRESET: Record<MotionPreset, string> = {
  "bring-to-life":
    "Make the main subject visibly come alive with natural breathing or weight shift, blinking or subtle eye movement when applicable, and small physically plausible movements.",
  "subject-action":
    "Make the main subject perform the user-requested action with clear temporal movement, stable anatomy or geometry, and a natural beginning, middle, and end.",
  "product-demo":
    "Animate the product in a believable demonstration: show supported parts operating, materials reacting, or the product being handled, while preserving its exact design and identity.",
  environment:
    "Animate the scene itself with visible environmental movement such as wind, water, smoke, fire, light, weather, foliage, or drifting particles while the subject remains grounded.",
  expression:
    "Animate the subject's expression and gestures with subtle facial movement, blinking, breathing, and natural posture or hand movement when those features are present.",
  "push-in": "Keep the subject alive with subtle natural movement; camera motion is secondary.",
  pan: "Keep the subject alive with subtle natural movement; camera motion is secondary.",
  orbit: "Keep the subject alive with subtle natural movement; camera motion is secondary.",
  parallax: "Keep the subject alive with subtle natural movement; camera motion is secondary.",
  handheld: "Keep the subject alive with subtle natural movement; camera motion is secondary.",
};

const CAMERA_BY_PRESET: Record<MotionPreset, string> = {
  "bring-to-life": "a mostly locked camera with only minimal natural framing drift",
  "subject-action": "a stable camera that keeps the moving subject clearly visible",
  "product-demo": "a stable product-demo camera with no distracting reframing",
  environment: "a mostly locked camera that lets environmental motion read clearly",
  expression: "a steady portrait camera focused on the subject's face and gestures",
  "push-in": "a restrained slow push-in only if it helps the subject motion read",
  pan: "a restrained lateral move only if it helps the subject motion read",
  orbit: "a restrained orbit only if it helps the subject motion read",
  parallax: "subtle depth separation only if it helps the subject motion read",
  handheld: "minimal handheld drift only if it helps the subject motion read",
};

export function buildMotionPlan(
  prompt: string,
  preset: MotionPreset,
  strength: number,
): MotionPlan {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  const camera = CAMERA_BY_PRESET[preset];
  const environment = cleaned || "subtle natural environmental movement";
  const subjectAction = SUBJECT_ACTION_BY_PRESET[preset];
  const subject =
    "Preserve the exact uploaded subject, identity, proportions, colors, markings, product details, and scene layout throughout the clip.";
  const negativePrompt = [
    "no camera-only animation",
    "no zoom used as a substitute for subject motion",
    "no subject replacement",
    "no object morphing",
    "no added limbs or duplicate objects",
    "no invented logos or text",
    "no melting, warping, flicker, or frame tearing",
    "no unrequested scene change",
    "no aggressive zoom",
  ].join(", ");
  const providerPrompt = [
    "Create a real image-to-video animation from the uploaded image.",
    `PRIMARY MOTION: ${subjectAction}`,
    `USER MOTION DIRECTION: ${environment}.`,
    `CAMERA (SECONDARY ONLY): ${camera}. Do not rely on camera movement alone.`,
    subject,
    "The subject or environment must visibly change over time in multiple frames; hold the opening composition briefly, animate smoothly, then resolve naturally.",
    `Motion intensity: ${strength}/100.`,
    `Negative constraints: ${negativePrompt}.`,
  ].join(" ");
  return { camera, subject, environment, subjectAction, strength, negativePrompt, providerPrompt };
}
