import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Copy,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  downloadDataUrl,
  formatDate,
  readImageFile,
  useMotionForge,
} from "@/lib/motionforge/store";
import { generationService } from "@/lib/motionforge/generation-service";
import {
  ASPECT_CLASS,
  creditCost,
  type AspectRatio,
  type Duration,
  type MotionPreset,
  type Project,
  type Quality,
} from "@/lib/motionforge/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio — MotionForge image to video" },
      {
        name: "description",
        content:
          "Upload an image, describe the motion, and render a short cinematic clip in the MotionForge studio.",
      },
      { property: "og:title", content: "Studio — MotionForge image to video" },
      {
        property: "og:description",
        content: "Upload an image, describe the motion, and render a short cinematic clip.",
      },
    ],
  }),
  component: StudioPage,
});

const SUGGESTIONS = [
  "Make the subject breathe, blink, and shift naturally",
  "Animate the person walking slowly while the background stays stable",
  "Show the product being handled with believable moving parts",
  "Animate wind moving hair, fabric, foliage, and drifting particles",
];

const DURATIONS: Duration[] = [5, 10];
const RATIOS: AspectRatio[] = ["9:16", "1:1", "16:9"];
const QUALITIES: Array<{ value: Quality; label: string }> = [
  { value: "standard", label: "Standard 720p" },
  { value: "high", label: "High 1080p" },
];
const MOTION_PRESETS: Array<{ value: MotionPreset; label: string; prompt: string }> = [
  {
    value: "bring-to-life",
    label: "Bring to life",
    prompt: "Make the subject breathe, blink, and shift naturally while staying recognizable.",
  },
  {
    value: "subject-action",
    label: "Subject action",
    prompt: "Animate the subject performing a clear, physically plausible action.",
  },
  {
    value: "product-demo",
    label: "Product demo",
    prompt:
      "Animate the product in use with believable movement while preserving its exact design.",
  },
  {
    value: "environment",
    label: "Animate scene",
    prompt: "Animate wind, water, smoke, light, foliage, or particles around the subject.",
  },
  {
    value: "expression",
    label: "Expression & gesture",
    prompt: "Animate natural facial expression, blinking, breathing, and subtle gestures.",
  },
];
const MOTION_PREVIEW_CLASS: Record<MotionPreset, string> = {
  "bring-to-life": "motion-preview-life",
  "subject-action": "motion-preview-action",
  "product-demo": "motion-preview-product",
  environment: "motion-preview-environment",
  expression: "motion-preview-expression",
  "push-in": "motion-preview-push",
  pan: "motion-preview-pan",
  orbit: "motion-preview-orbit",
  parallax: "motion-preview-parallax",
  handheld: "motion-preview-handheld",
};

function StudioPage() {
  const { projects, usage, addProject, spendCredits } = useMotionForge();
  const inputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<Duration>(5);
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [quality, setQuality] = useState<Quality>("standard");
  const [strength, setStrength] = useState(50);
  const [motionPreset, setMotionPreset] = useState<MotionPreset>("push-in");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<Project | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  const cost = creditCost(duration, quality);
  const isFree = usage.plan === "Free";
  const remaining = Math.max(0, usage.creditsTotal - usage.creditsUsed);
  const recent = projects.slice(0, 3);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", { description: "Please choose a PNG, JPG or WebP image." });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image too large", { description: "Maximum file size is 12 MB." });
      return;
    }
    try {
      const dataUrl = await readImageFile(file);
      setImage(dataUrl);
      setImageName(file.name);
      toast.success("Image ready", { description: file.name });
    } catch (e) {
      toast.error("Could not read image", {
        description: e instanceof Error ? e.message : "Try a different file.",
      });
    }
  }, []);

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function removeImage() {
    setImage(null);
    setImageName("");
    if (inputRef.current) inputRef.current.value = "";
    toast("Image removed");
  }

  async function generate() {
    if (!image) {
      toast.error("Add an image first", { description: "Upload a still to animate." });
      return;
    }
    if (!prompt.trim()) {
      toast.error("Describe the motion", { description: "Tell MotionForge how it should move." });
      return;
    }
    if (remaining < cost) {
      toast.error("Not enough credits", {
        description: `This render costs ${cost} credits and you have ${remaining} left.`,
      });
      return;
    }

    setStatus("running");
    setProgress(0);
    setStage("Queued");
    setErrorMessage("");
    setResult(null);

    try {
      const output = await generationService.generate(
        {
          image,
          prompt,
          duration,
          aspectRatio: ratio,
          quality,
          motionStrength: strength,
          motionPreset,
        },
        (percent, currentStage) => {
          setProgress(percent);
          setStage(currentStage);
        },
      );

      const project: Project = {
        id: `p-${Date.now()}`,
        title: prompt.trim().split(/\s+/).slice(0, 5).join(" ") || "Untitled render",
        prompt: prompt.trim(),
        status: "completed",
        duration,
        aspectRatio: ratio,
        quality,
        motionStrength: strength,
        motionPreset,
        credits: cost,
        createdAt: new Date().toISOString(),
        sourceImage: output.previewImage,
        videoUrl: output.videoUrl,
        demo: output.demo,
      };
      addProject(project);
      spendCredits(cost, `Render — ${project.title} (${duration}s, ${quality})`);
      setResult(project);
      setStatus("done");
      setReplayKey((k) => k + 1);
      toast.success(output.demo ? "Demo render complete" : "Video render complete", {
        description: output.demo
          ? "Produced locally — connect a provider for real video output."
          : "Your video is ready to preview and download.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Generation failed.";
      setErrorMessage(message);
      setStatus("error");
      toast.error("Render failed", { description: message });
    }
  }

  function download() {
    if (result?.videoUrl) {
      const link = document.createElement("a");
      link.href = result.videoUrl;
      link.download = `${result.title.replace(/\s+/g, "-").toLowerCase()}.mp4`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Download started");
      return;
    }
    if (result?.sourceImage) {
      downloadDataUrl(result.sourceImage, `${result.title.replace(/\s+/g, "-").toLowerCase()}.jpg`);
      toast.success("Downloaded demo frame", {
        description: "Demo mode exports the still frame. Video files need a connected provider.",
      });
      return;
    }
    toast.error("Nothing to download yet", {
      description: "A connected video provider is required to export an MP4.",
    });
  }

  function createVariant() {
    if (!result) return;
    setPrompt(result.prompt);
    if (result.motionPreset) setMotionPreset(result.motionPreset);
    setStatus("idle");
    setProgress(0);
    setResult(null);
    toast("Variant ready to render", {
      description: "Tweak the prompt or settings, then generate.",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-8">
        <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
          <Sparkles className="mr-1 size-3" aria-hidden />
          {generationService.isDemo ? "Demo mode" : "Live generation"}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Turn an image into motion.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Upload a still, describe how it should move, and render a short clip. Output in this build
          {generationService.isDemo
            ? "Output is generated locally as a motion preview until a provider is connected."
            : "Your image is sent to the configured image-to-video workflow for rendering."}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        {/* Creation column */}
        <section className="space-y-6" aria-label="Create a render">
          {/* Upload */}
          <div className="panel p-5">
            <Label className="text-sm font-medium">Source image</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG or WebP · up to 12 MB · best results at 1024px or larger.
            </p>

            {!image ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                aria-label="Upload an image by dropping a file or pressing enter to browse"
                className={cn(
                  "mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/10"
                    : "border-border-strong bg-elevated/40 hover:border-primary/60",
                )}
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
                  <Upload className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">Drag and drop your image</p>
                  <p className="text-xs text-muted-foreground">or browse from your device</p>
                </div>
                <Button type="button" variant="secondary" size="sm">
                  <ImagePlus className="size-4" aria-hidden /> Browse files
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-elevated/40 p-3 sm:flex-row sm:items-center">
                <img
                  src={image}
                  alt={`Selected source: ${imageName}`}
                  className="h-28 w-full rounded-lg object-cover sm:w-40"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{imageName}</p>
                  <p className="text-xs text-muted-foreground">Ready to animate</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => inputRef.current?.click()}
                    >
                      <RefreshCw className="size-4" aria-hidden /> Replace
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={removeImage}>
                      <Trash2 className="size-4" aria-hidden /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Choose an image file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>

          {/* Prompt */}
          <div className="panel p-5">
            <Label htmlFor="prompt" className="text-sm font-medium">
              Motion prompt
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe the movement: camera, subject, atmosphere. e.g. slow push-in as fog drifts across the ridge."
              className="mt-2 resize-none bg-elevated/50"
            />
            <div className="mt-4">
              <Label className="text-xs font-medium text-muted-foreground">Motion style</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {MOTION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={motionPreset === preset.value}
                    onClick={() => {
                      setMotionPreset(preset.value);
                      if (!prompt.trim()) setPrompt(preset.prompt);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      motionPreset === preset.value
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-elevated/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="rounded-full border border-border bg-elevated/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="panel p-5">
            <fieldset>
              <legend className="text-sm font-medium">Duration</legend>
              <div className="mt-2 flex gap-2">
                {(isFree ? [5] : DURATIONS).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={duration === d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors sm:flex-none sm:px-5",
                      duration === d
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium">Aspect ratio</legend>
              <div className="mt-2 flex gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={ratio === r}
                    onClick={() => setRatio(r)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors sm:flex-none sm:px-5",
                      ratio === r
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-5">
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-elevated/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                Advanced controls
                <ChevronDown
                  className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-5 pt-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="strength" className="text-sm font-medium">
                      Motion strength
                    </Label>
                    <span className="text-xs text-muted-foreground">{strength}</span>
                  </div>
                  <Slider
                    id="strength"
                    value={[strength]}
                    onValueChange={([v]) => setStrength(v ?? 50)}
                    min={10}
                    max={100}
                    step={5}
                    className="mt-3"
                    aria-label="Motion strength"
                  />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">Output quality</legend>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    {QUALITIES.map((q) => (
                      <button
                        key={q.value}
                        type="button"
                        aria-pressed={quality === q.value}
                        disabled={isFree && q.value === "high"}
                        onClick={() => setQuality(q.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                          quality === q.value
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="sticky bottom-4 z-20 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Button
              size="lg"
              className="w-full"
              onClick={() => void generate()}
              disabled={status === "running"}
            >
              {status === "running" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Rendering…
                </>
              ) : (
                <>
                  <Wand2 className="size-4" aria-hidden /> Generate video · {cost}{" "}
                  {cost === 1 ? "credit" : "credits"}
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {remaining} credits remaining on the {usage.plan} plan
            </p>
          </div>
        </section>

        {/* Preview column */}
        <section aria-label="Preview" className="lg:sticky lg:top-20 lg:self-start">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">Preview</span>
              {result && (
                <Badge variant="outline" className="border-cyan/40 text-cyan">
                  {result.demo ? "Demo preview" : "Live render"}
                </Badge>
              )}
            </div>

            <div className="p-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border bg-elevated/60",
                  ASPECT_CLASS[ratio],
                )}
              >
                {status === "done" && result?.videoUrl ? (
                  <video
                    key={replayKey}
                    src={result.videoUrl}
                    poster={result.sourceImage}
                    controls
                    autoPlay
                    loop
                    className="size-full object-cover"
                  />
                ) : status === "done" && result?.sourceImage ? (
                  <img
                    key={replayKey}
                    src={result.sourceImage}
                    alt={`Demo render preview for ${result.title}`}
                    className={cn(
                      "size-full object-cover",
                      MOTION_PREVIEW_CLASS[result.motionPreset ?? "push-in"],
                    )}
                  />
                ) : status === "running" ? (
                  <div className="absolute inset-0 grid place-items-center overflow-hidden">
                    {image && (
                      <img
                        src={image}
                        alt=""
                        aria-hidden
                        className={cn(
                          "absolute inset-0 size-full object-cover opacity-25 blur-sm",
                          MOTION_PREVIEW_CLASS[motionPreset],
                        )}
                      />
                    )}
                    <div className="relative z-10 w-full px-6 text-center">
                      <Loader2 className="mx-auto size-6 animate-spin text-primary" aria-hidden />
                      <p className="mt-3 text-sm font-medium">{stage}</p>
                      <Progress value={progress} className="mt-3" />
                      <p className="mt-2 text-xs text-muted-foreground">{progress}%</p>
                    </div>
                  </div>
                ) : status === "error" ? (
                  <div className="absolute inset-0 grid place-items-center px-6 text-center">
                    <div>
                      <TriangleAlert className="mx-auto size-6 text-destructive" aria-hidden />
                      <p className="mt-3 text-sm font-medium">Render failed</p>
                      <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-4"
                        onClick={() => void generate()}
                      >
                        Try again
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center px-6 text-center">
                    <div>
                      <span className="mx-auto grid size-11 place-items-center rounded-full border border-border bg-surface text-muted-foreground">
                        <Play className="size-5" aria-hidden />
                      </span>
                      <p className="mt-3 text-sm font-medium">No render yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add an image and a motion prompt to see your clip here.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {status === "done" && result ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {result.demo
                      ? "Demo preview — animated locally from your image. Connect a video provider to produce a downloadable MP4."
                      : "Live render returned by the configured image-to-video provider."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setReplayKey((k) => k + 1)}>
                      <RefreshCw className="size-4" aria-hidden /> Replay
                    </Button>
                    <Button variant="secondary" onClick={download}>
                      <Download className="size-4" aria-hidden /> Download
                    </Button>
                    <Button variant="outline" className="col-span-2" onClick={createVariant}>
                      <Copy className="size-4" aria-hidden /> Create variant
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ["Duration", `${duration}s`],
                    ["Ratio", ratio],
                    ["Quality", quality === "high" ? "1080p" : "720p"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border bg-elevated/40 py-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Recent projects */}
      <section className="mt-10" aria-label="Recent projects">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent projects</h2>
          <Link to="/projects" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((p) => (
            <article key={p.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-sm font-medium">{p.title}</h3>
                <StatusPill status={p.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {p.prompt}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {p.duration}s · {p.aspectRatio} · {formatDate(p.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function StatusPill({ status }: { status: Project["status"] }) {
  const map: Record<Project["status"], string> = {
    completed: "border-success/40 text-success",
    rendering: "border-cyan/40 text-cyan",
    queued: "border-border-strong text-muted-foreground",
    failed: "border-destructive/40 text-destructive",
  };
  return (
    <Badge variant="outline" className={cn("shrink-0 capitalize", map[status])}>
      {status}
    </Badge>
  );
}
