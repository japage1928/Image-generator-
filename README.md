# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Generation integration

The UI intentionally defaults to a local demo render. To enable the live path,
set `VITE_GENERATION_MODE=live` in the client environment and configure these
server-only variables in the deployment environment:

```bash
N8N_GENERATION_WEBHOOK_URL=https://n8n.example.com/webhook/motionforge-generate
N8N_STATUS_WEBHOOK_URL=https://n8n.example.com/webhook/motionforge-status
N8N_WEBHOOK_SECRET=replace-me
```

The generation workflow must return `{ "jobId": "..." }`. The status workflow
receives `?jobId=...` and must return `{ status, progress, stage, videoUrl }`
when complete. The server routes validate the request and keep the n8n URL and
secret out of the browser.

Before accepting paid users, replace the demo localStorage credit ledger with
authenticated durable storage. Client-side credits are suitable for the demo
only and are not a billing security boundary.
