import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Film, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "./index";
import { downloadDataUrl, formatDate, useMotionForge } from "@/lib/motionforge/store";
import type { ProjectStatus } from "@/lib/motionforge/types";
import { motionforgeFetch } from "@/lib/motionforge/api-client";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — MotionForge" },
      { name: "description", content: "Browse, search and download your MotionForge renders." },
      { property: "og:title", content: "Projects — MotionForge" },
      { property: "og:description", content: "Browse, search and download your renders." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, refreshRemote } = useMotionForge();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (p.title + p.prompt).toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [projects, query, status],
  );

  function download(id: string) {
    const project = projects.find((p) => p.id === id);
    if (project?.videoUrl) {
      const link = document.createElement("a");
      link.href = project.videoUrl;
      link.download = `${project.title.replace(/\s+/g, "-").toLowerCase()}.mp4`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Download started");
      return;
    }
    if (project?.sourceImage) {
      downloadDataUrl(
        project.sourceImage,
        `${project.title.replace(/\s+/g, "-").toLowerCase()}.jpg`,
      );
      toast.success("Downloaded demo frame", {
        description: "Video export needs a connected provider.",
      });
    } else {
      toast.error("No media available", {
        description: "This demo project has no local file. Connect a provider to export video.",
      });
    }
  }

  async function removeProject(id: string) {
    setDeletingId(id);
    try {
      await motionforgeFetch(`/api/projects/${id}`, { method: "DELETE" });
      await refreshRemote();
      toast.success("Project deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete project");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your renders are synced to your account. Demo projects are labelled while you configure a
        provider.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="search" className="sr-only">
            Search projects
          </Label>
          <Input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or prompt"
            className="bg-surface pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus | "all")}>
          <SelectTrigger className="w-full bg-surface sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rendering">Rendering</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="panel mt-6 grid place-items-center px-6 py-16 text-center">
          <Film className="size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No projects match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search, or create a new render in the Studio.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/">Open Studio</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.id} className="panel overflow-hidden">
              <div className="relative aspect-video bg-elevated/60">
                {p.videoUrl ? (
                  <video
                    src={p.videoUrl}
                    poster={p.sourceImage}
                    controls
                    className="size-full object-cover"
                  />
                ) : p.sourceImage ? (
                  <img
                    src={p.sourceImage}
                    alt={`Thumbnail for ${p.title}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <Film className="size-5" aria-hidden />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-sm font-medium">{p.title}</h2>
                  <StatusPill status={p.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {p.prompt}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {p.duration}s · {p.aspectRatio} · {formatDate(p.createdAt)}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <Link to="/">Open in Studio</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => download(p.id)}
                    aria-label={`Download ${p.title}`}
                  >
                    <Download className="size-4" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeProject(p.id)}
                    disabled={deletingId === p.id}
                    aria-label={`Delete ${p.title}`}
                  >
                    {deletingId === p.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
