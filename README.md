# MotionForge

MotionForge is a dark, account-backed image-to-video studio built with TanStack Start, React, Supabase, Stripe Billing, and an n8n/Grok provider workflow.

## Local development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the values for the environment you are using. The app starts in `demo` mode so the UI can be previewed without a provider. Set `VITE_GENERATION_MODE=live` to enable authenticated generation through n8n.

## Backend setup

The isolated `motionforge_*` schema lives in the existing `thetoolshed` Supabase project for now. Apply `supabase/migrations/20260827_motionforge_backend.sql` to that project before enabling live mode. It includes accounts, projects, generations, credit reservations, subscriptions, Stripe event idempotency, daily spend tracking, support requests, RLS policies, and server-only RPCs.

Required variables:

```bash
VITE_SUPABASE_URL=https://fgvvcmfpydbmzupyqgor.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
N8N_GENERATION_WEBHOOK_URL=https://n8n.example.com/webhook/motionforge-generate
N8N_STATUS_WEBHOOK_URL=https://n8n.example.com/webhook/motionforge-status
N8N_WEBHOOK_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_STARTER_PRICE_ID=...
APP_URL=https://your-site.example
MOTIONFORGE_MAX_DAILY_SPEND=5
```

Use the Stripe price ID from the same Stripe mode as `STRIPE_SECRET_KEY` (test or live). Configure a Stripe webhook for `/api/billing/webhook` with `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.paid`. The app verifies the signature and ignores duplicate event IDs.

The starter plan currently grants six five-second generations at `$19.99`; the free plan grants two. Generation reservations are made server-side before calling n8n, and failed jobs are refunded. The daily spend ceiling is an additional guardrail while provider pricing is being validated.

## Provider contract

The generation workflow receives the authenticated image-to-video request, including a top-level `prompt` containing the subject-centric motion plan, plus `userPrompt`, `motionPlan`, `duration`, `aspectRatio`, `quality`, and `image`.

It may return `{ "jobId": "..." }` for an asynchronous job or `{ "videoUrl": "..." }` for a completed render. The status workflow receives `?jobId=...` and should return `{ status, progress, stage, videoUrl }` when complete. `video_url`, `url`, and a string/object `output` are also accepted for compatibility with the existing workflow.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret keys, webhook secrets, or n8n secrets to the browser or commit them to the repository.
