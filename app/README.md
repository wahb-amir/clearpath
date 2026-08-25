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

A thin Gradio front-end that boots the ClearPath Node/Express backend in
a child process and exposes a per-request OCR path on the ZeroGPU. The
backend itself is unchanged – only the entry point is the Gradio app.

## How it runs

1. HF Spaces runs `app.py` (Gradio). The Python process binds to port
   `7860` and starts the UI.
2. From the *Service controls* tab, click **Start API** to spawn the
   Node Express server (`backend/`). Logs stream to `logs/api.log`.
3. The *OCR (GPU)* tab runs Docling under a `@spaces.GPU` decorator so
   the GPU is only allocated while a real OCR job is in flight. Each
   click is a fresh allocation – don't spam it if you care about the
   ZeroGPU free-quota.

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

If `REDIS_URL` is not set, the backend falls back to `REDIS_HOST`/
`REDIS_PORT`/..., or to `redis://localhost:6379` as a last resort. The
backend does NOT exit if Redis is unreachable – it retries in the
background so the Space can still serve `/api/health`.

## Local dev

```bash
pip install -r requirements.txt
python app.py
```
