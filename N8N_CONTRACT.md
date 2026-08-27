# MotionForge n8n contract

The frontend sends the uploaded source image and the selected settings to the
server route. The server adds a canonical `motionPlan` before forwarding the
request to n8n.

```json
{
  "image": "data:image/jpeg;base64,...",
  "prompt": "Create a real image-to-video animation from the uploaded image...",
  "userPrompt": "Clouds drift slowly behind the subject",
  "duration": 5,
  "aspectRatio": "16:9",
  "quality": "standard",
  "motionStrength": 60,
  "motionPreset": "parallax",
  "motionPlan": {
    "camera": "...",
    "subject": "...",
    "environment": "...",
    "subjectAction": "...",
    "strength": 60,
    "negativePrompt": "...",
    "providerPrompt": "..."
  },
  "requestId": "uuid"
}
```

The generation webhook can return either a completed URL or a job:

```json
{ "videoUrl": "https://.../clip.mp4" }
```

or:

```json
{ "jobId": "provider-job-id", "status": "queued" }
```

For queued jobs, the status webhook receives `?jobId=provider-job-id` and
returns `queued`, `running`, `completed`, or `failed`, plus `progress`,
`stage`, and `videoUrl` when complete.

The server sets the top-level `prompt` to `motionPlan.providerPrompt` for
compatibility with existing n8n nodes that read `$json.prompt`. The workflow
must pass that prompt to Grok along with the uploaded image. `userPrompt` is
kept for logging and debugging. Passing only the raw image, using only
`userPrompt`, or applying camera movement without subject/environment motion
will recreate the old zoom-only behavior.
