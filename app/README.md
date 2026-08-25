---
title: ClearPath
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: mit
---

# ClearPath – Document Triage on ZeroGPU

Single-container deployment: this Space runs the **entire ClearPath
backend** (Express API + Node analysis worker + Node outbox dispatcher
+ Python Docling OCR worker) as background processes supervised by the
Gradio front-end. The Space's public URL doubles as the backend URL –
the front-end can hit `https://<space>.hf.space/api/*` directly with no
CORS preflight, because the Gradio process reverse-proxies those paths
to the loopback Express server.

## How it runs

1. HF Spaces runs `app.py` (Gradio). On startup, `app.py` boots:
   - `backend/` Express API on `127.0.0.1:7860` (the same loopback
     interface Gradio uses; only the FastAPI reverse-proxy is exposed
     publicly on `0.0.0.0:7860`).
   - `npm run worker` – the Node BullMQ consumer for `document-analysis`.
   - `npm run dispatcher` – the Node outbox dispatcher.
   - `python backend/services/ocr-engine/src/main.py` – the Docling OCR
     worker that consumes `document-ocr`.
2. The Gradio FastAPI app exposes a reverse-proxy route for every
   request whose path starts with `/api`, `/auth`, `/uploads` or
   `/analysis`. Those are forwarded to the loopback Express server, so
   cross-origin calls from your front-end no longer trigger CORS
   preflight failures.
3. The *OCR* tab runs Docling under a `@spaces.GPU` decorator so the
   GPU is only allocated while a real OCR job is in flight. CPU is the
   default to stay inside the ZeroGPU free-quota.

## Required Space secrets (Settings → Variables and secrets)

| Name                | Purpose                                            |
|---------------------|----------------------------------------------------|
| `DATABASE_URL`      | Postgres connection string (Supabase).            |
| `SUPABASE_URL`      | Supabase project URL.                              |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key.             |
| `SUPABASE_SECRET_KEY` | Supabase service-role / secret key.              |
| `REDIS_URL`         | e.g. `rediss://...` Upstash URL. **Preferred.**    |
| `GROQ_API_KEY`      | `gsk_...` API key.                                 |
| `TAVILY_API_KEY`    | Web-search API key.                                |
| `INTERNAL_API_KEY`  | Random 16+ char string.                            |
| `FRONTEND_URL`      | `https://your-frontend.example`.                   |

The backend does NOT exit if Redis is unreachable – it retries in the
background so the Space can still serve `/api/health`.

## CORS / reverse-proxy

The Gradio front-end is mounted on a FastAPI app that proxies the four
backend path prefixes to `127.0.0.1:$INTERNAL_API_PORT`. As defense in
depth, the Express CORS layer also accepts the public HF Space origin
and the configured `FRONTEND_URL`. See `backend/src/index.ts`.

Set `AUTO_BOOT=0` in the Space's environment variables if you'd rather
boot the services manually from the *Service controls* tab.

## Local dev

```bash
pip install -r requirements.txt
cd backend && npm install && npm run build
python app.py
```
