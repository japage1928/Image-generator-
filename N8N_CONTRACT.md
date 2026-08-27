# MotionForge n8n contract

The frontend sends the uploaded source image and the selected settings to the
server route. The server adds a canonical `motionPlan` before forwarding the
request to n8n.

```json
{
  "image": "data:image/jpeg;base64,...",
  "prompt": "Clouds drift slowly behind the subject",
  "duration": 5,
  "aspectRatio": "16:9",
  "quality": "standard",
  "motionStrength": 60,
  "motionPreset": "parallax",
  "motionPlan": {
    "camera": "...",
    "subject": "...",
    "environment": "...",
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

The n8n workflow must pass `motionPlan.providerPrompt` to Grok as the actual
motion instruction. Passing only the raw image or the original one-line prompt
will recreate the old zoom-only behavior.
