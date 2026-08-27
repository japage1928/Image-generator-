import { getSession } from "@/lib/auth/supabase";
import type { Project, ProjectStatus, MotionPreset } from "./types";

export async function motionforgeFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

export function projectFromApi(row: Record<string, unknown>, fallback?: Partial<Project>): Project {
  const status =
    row.status === "queued" ||
    row.status === "running" ||
    row.status === "failed" ||
    row.status === "completed"
      ? row.status
      : "completed";
  return {
    id: String(row.id || fallback?.id || `p-${Date.now()}`),
    title: String(row.title || fallback?.title || "Untitled animation"),
    prompt: String(row.prompt || fallback?.prompt || ""),
    status: status as ProjectStatus,
    duration: Number(row.duration_seconds || fallback?.duration || 5) === 10 ? 10 : 5,
    aspectRatio:
      row.aspect_ratio === "9:16" || row.aspect_ratio === "1:1" || row.aspect_ratio === "16:9"
        ? row.aspect_ratio
        : fallback?.aspectRatio || "16:9",
    quality: row.quality === "high" ? "high" : "standard",
    motionStrength: Number(row.motion_strength || fallback?.motionStrength || 50),
    motionPreset: (row.motion_preset as MotionPreset | undefined) || fallback?.motionPreset,
    credits: Number(row.credits || fallback?.credits || 1),
    createdAt: String(row.created_at || fallback?.createdAt || new Date().toISOString()),
    sourceImage: typeof row.source_image === "string" ? row.source_image : fallback?.sourceImage,
    videoUrl: typeof row.video_url === "string" ? row.video_url : fallback?.videoUrl,
    demo: Boolean(row.demo ?? fallback?.demo ?? false),
    error: typeof row.error === "string" ? row.error : fallback?.error,
  };
}
