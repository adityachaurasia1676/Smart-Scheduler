# Smart Scheduler

A Next.js smart scheduling app with local persistence, working-hour availability, fixed events, and optional Gemini recommendations.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and add a `GEMINI_API_KEY` to enable Gemini recommendations. Without a key, the app uses its local scheduling fallback.

## Run

```bash
npm run dev
```

Open http://localhost:3000.
