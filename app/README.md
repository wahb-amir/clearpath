---
title: ClearPath
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 6.26.0
app_file: app.py
pinned: false
license: mit
---

# ClearPath – Document Triage on ZeroGPU

This Space runs the **entire ClearPath backend** (Node Express API + BullMQ analysis worker + outbox dispatcher + optional Python Docling OCR worker) as supervised child processes inside a Gradio shell.

## Architecture

```
Client
  ↓
Gradio (public :$PORT)
  ↓  (reverse proxy via httpx)
Node Express API (internal :3001)
  ↓
BullMQ / Redis
  ↓
Docling OCR worker (Python, optional)
```

Gradio owns the public port. The Node API runs internally on port 3001. Gradio's FastAPI app forwards all `/api/*`, `/auth/*`, `/uploads/*` and `/analysis/*` requests to the Node API via an async httpx reverse proxy.

## Required Space secrets

| Name                         | Purpose                                            |
|------------------------------|----------------------------------------------------|
| `DATABASE_URL`               | Postgres connection string (Supabase).             |
| `SUPABASE_URL`               | Supabase project URL.                              |
| `SUPABASE_PUBLISHABLE_KEY`   | Supabase anon/publishable key.                     |
| `SUPABASE_SECRET_KEY`        | Supabase service-role / secret key.                |
| `REDIS_URL`                  | e.g. `rediss://...` Upstash URL.                   |
| `GROQ_API_KEY`               | `gsk_...` API key.                                 |
| `TAVILY_API_KEY`             | Web-search API key.                                |
| `INTERNAL_API_KEY`           | Random 16+ char string.                            |
| `FRONTEND_URL`               | `https://your-frontend.example`.                   |

## Optional variables

| Name                         | Default | Purpose                                            |
|------------------------------|---------|----------------------------------------------------|
| `INTERNAL_API_PORT`          | `3001`  | Internal port the Node API listens on.             |
| `ENABLE_PYTHON_OCR_WORKER`   | auto    | Set `0` to skip Docling; auto-starts if entry found. |
