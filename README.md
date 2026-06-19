# Gmail Intelligence Platform

AI-powered Gmail Intelligence Platform for the Repeatless technical assessment. Connects to Gmail, syncs emails, and provides AI-driven summarization, categorization, compose/reply, and a RAG chat agent over your inbox.

**Live demo:** [ai-powered-gmail-intelligence.vercel.app](https://ai-powered-gmail-intelligence.vercel.app)  
**Architecture:** See [Architecture.md](Architecture.md) for system design, database schema, AI/RAG pipeline, and trade-offs.

---

## Features

- Google login (Supabase Auth) + Gmail OAuth connect
- Initial + incremental Gmail sync with progress UI
- AI summarization and categorization (Gemini)
- Vector search over emails (NVIDIA NIM embeddings + pgvector)
- RAG chat assistant with clickable source citations
- AI compose / reply with tone control, sent via Gmail API
- Category filters, inbox insights, responsive 3-panel layout

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | FastAPI, Python 3.12 |
| Database | Supabase (PostgreSQL + pgvector + RLS) |
| Auth | Supabase Auth (Google OAuth) + Gmail API OAuth |
| Primary AI | Google Gemini (`gemini-3.1-flash-lite`) |
| Embeddings | NVIDIA NIM (`nvidia/nv-embedqa-e5-v5`) |
| Jobs | ARQ + Redis (optional; in-process fallback on Vercel) |
| Deployment | Vercel (frontend + backend) — see [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## Project Structure

```
repeatless-assignment/
├── frontend/                         # React SPA (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/                 # Gmail connect dialog, protected routes
│   │   │   ├── chat/                 # Typing indicator, chat UI helpers
│   │   │   ├── common/               # Markdown, loaders, shared UI
│   │   │   ├── email/                # Email body, compose drawer, AI summary cards
│   │   │   ├── insights/             # Inbox category stats (donut chart)
│   │   │   ├── layout/               # App shell, sidebar, thread/email/chat panels
│   │   │   ├── sync/                 # Pipeline banner, progress bars
│   │   │   └── ui/                   # shadcn/ui primitives (button, badge, …)
│   │   ├── contexts/                 # Auth, theme, layout state
│   │   ├── hooks/                    # useSync, useChat, useEnrichment, useCompose, …
│   │   ├── lib/                      # API client, Supabase, dates, email utils
│   │   └── pages/                    # Landing, dashboard, auth callback
│   ├── .env.example
│   └── vercel.json
│
├── backend/                          # FastAPI application
│   ├── api/
│   │   └── index.py                  # Vercel serverless entrypoint
│   ├── app/
│   │   ├── api/routes/               # auth, sync, threads, enrichment, compose, chat, config
│   │   ├── services/
│   │   │   ├── gmail/                # OAuth, API client, parser, rate limiter, sender
│   │   │   ├── sync/                 # Initial/incremental sync, job queue
│   │   │   ├── ai/                   # Gemini, NVIDIA NIM, chunker, RAG, enrichment
│   │   │   ├── chat/                 # Chat session orchestration
│   │   │   ├── compose/              # Draft generation + Gmail send
│   │   │   ├── email/                # Message persistence repository
│   │   │   └── supabase_client.py    # All database operations
│   │   ├── worker/                     # ARQ task definitions
│   │   ├── models/schemas.py         # Pydantic request/response models
│   │   ├── config.py                 # Environment settings
│   │   ├── deps.py                   # JWT auth dependency
│   │   └── main.py                   # FastAPI app factory
│   ├── .env.example
│   ├── Dockerfile                    # Railway / container deploy
│   └── requirements.txt
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql           # Full schema, indexes, RLS, pgvector function
│
├── Architecture.md                   # System design document (submission)
├── DEPLOYMENT.md                     # Vercel deploy guide
└── README.md                         # This file
```

### Module responsibilities

| Module | Responsibility |
|--------|----------------|
| `frontend/src/lib/api.ts` | Typed HTTP client for all backend endpoints |
| `frontend/src/hooks/useInboxPipeline.ts` | Auto sync, auto enrichment, live polling |
| `backend/app/services/sync/service.py` | Gmail initial + incremental sync |
| `backend/app/services/ai/enrichment.py` | Summarize → categorize → embed pipeline |
| `backend/app/services/ai/rag.py` | Hybrid retrieval for chat |
| `backend/app/services/chat/service.py` | Chat sessions, RAG + Gemini, citations |

---

## Prerequisites

- **Node.js** 20+
- **Python** 3.12+
- **Supabase** project ([supabase.com](https://supabase.com))
- **Google Cloud** project with Gmail API enabled
- **Gemini API key** ([aistudio.google.com](https://aistudio.google.com/apikey))
- **NVIDIA NIM API key** ([build.nvidia.com](https://build.nvidia.com))
- **Redis** (optional — local or [Upstash](https://upstash.com) for ARQ worker)

---

## Local Setup

### 1. Clone and configure environment

```bash
git clone https://github.com/ajay-nunugoppula/ai-powered-gmail-intelligence.git
cd repeatless-assignment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in values in both copied files (see [Environment Variables](#environment-variables) below).

### 2. Supabase

1. Create a new Supabase project.
2. **Authentication → Providers** — enable **Google** (same Client ID/Secret as Google Cloud).
3. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/auth/callback`
4. **SQL Editor** — paste and run `supabase/migrations/001_initial.sql`.
5. Copy **Project URL**, **anon key**, **service role key**, and **JWT secret** into your env files.

### 3. Google Cloud

1. Create an OAuth 2.0 Client ID (Web application).
2. Enable the **Gmail API**.
3. **Authorized redirect URIs:**
   - `http://localhost:8000/api/v1/auth/gmail/callback` (Gmail connect)
   - `https://<your-project>.supabase.co/auth/v1/callback` (Supabase login)
4. Configure OAuth consent screen (External; add yourself as a test user).
5. Scopes: `openid`, `email`, `profile`, `gmail.readonly`, `gmail.send`, `gmail.modify`.

### 4. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

### 6. Worker (optional)

If Redis is running locally:

```bash
cd backend
arq app.worker.settings.WorkerSettings
```

Set `USE_ARQ_WORKER=true` in `backend/.env`. Without Redis, sync and enrichment still work via FastAPI background tasks.

---

## Using the App

1. **Sign in** with Google on the landing page.
2. **Connect Gmail** from the sidebar or connect dialog.
3. **Sync** runs automatically — imports emails from the last `SYNC_DAYS_BACK` days (default 90).
4. **AI analysis** runs after sync — summarizes, categorizes, and embeds messages.
5. **Browse** threads by category in the sidebar; view AI summaries in the email panel.
6. **Chat** with the AI assistant about your inbox (requires enrichment to complete).
7. **Reply / Compose** using AI draft generation.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DEBUG` | No | Enable debug mode (`true` / `false`). Default: `false` |
| `FRONTEND_URL` | Yes | Frontend origin for OAuth redirects. e.g. `http://localhost:5173` |
| `API_URL` | Yes | Public backend URL. e.g. `http://localhost:8000` |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins. e.g. `http://localhost:5173` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key — **backend only, never expose to frontend** |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase → Settings → API |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Gmail OAuth callback. e.g. `http://localhost:8000/api/v1/auth/gmail/callback` |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key for summarize, chat, compose |
| `GEMINI_MODEL` | No | Gemini model name. Default: `gemini-3.1-flash-lite` |
| `NVIDIA_API_KEY` | Yes* | NVIDIA NIM API key for embeddings |
| `NVIDIA_NIM_BASE_URL` | No | NIM API base URL. Default: `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_EMBED_MODEL` | No | Embedding model. Default: `nvidia/nv-embedqa-e5-v5` |
| `REDIS_URL` | No | Redis connection string for ARQ. Default: `redis://localhost:6379` |
| `TOKEN_ENCRYPTION_KEY` | Yes | Fernet key for encrypting Gmail refresh tokens at rest |
| `USE_ARQ_WORKER` | No | Use ARQ worker for jobs. Default: `false` (in-process on Vercel) |
| `SYNC_MAX_MESSAGES` | No | Max messages per sync run. Default: `1000` |
| `SYNC_DAYS_BACK` | No | How many days of email to import. Default: `90` (use `7` for production demo) |
| `GMAIL_REQUESTS_PER_SECOND` | No | Gmail API rate limit. Default: `10` |
| `ENRICHMENT_AUTO_START` | No | Auto-run AI after sync. Default: `true` |
| `ENRICHMENT_BATCH_SIZE` | No | Messages processed per enrichment batch. Default: `50` |
| `EMBEDDING_CHUNK_SIZE` | No | Characters per embedding chunk. Default: `400` |
| `EMBEDDING_CHUNK_OVERLAP` | No | Overlap between chunks. Default: `50` |

\* At least one of `GEMINI_API_KEY` or `NVIDIA_API_KEY` is needed; both are required for full functionality.

**Generate encryption key:**

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (same as backend) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase **anon** public key |
| `VITE_API_URL` | Yes | Backend API URL. e.g. `http://localhost:8000` |

> Vite only exposes variables prefixed with `VITE_`. Rebuild/redeploy after changing them.

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for step-by-step Vercel deployment (frontend + backend from the same GitHub repo).

Quick summary:
- **Frontend** Vercel project → root `frontend/`
- **Backend** Vercel project → root `backend/`
- Set all env vars in each project's dashboard
- Add production URLs to Supabase and Google Cloud Console

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **401 on API calls** | Verify `SUPABASE_JWT_SECRET` and `SUPABASE_SERVICE_KEY` in `backend/.env`; sign out and back in |
| **CORS error** | `CORS_ORIGINS` must exactly match frontend URL (no trailing slash) |
| **Gmail `redirect_uri_mismatch`** | `GOOGLE_REDIRECT_URI` must match Google Console exactly |
| **Sync stops mid-way** | Vercel serverless timeout — reduce `SYNC_DAYS_BACK` to `7` |
| **Chat says inbox not indexed** | Wait for enrichment to finish, or click the sparkles (Analyze) button |
| **Gemini 429** | API quota exhausted — add credits or switch to `gemini-2.5-flash-lite` |

---

## Development Phases

- [x] Phase 0 — Scaffolding, database schema, env setup
- [x] Phase 1 — Auth + app shell UI
- [x] Phase 2 — Gmail sync pipeline
- [x] Phase 3 — Summarization, categorization, embeddings
- [x] Phase 4 — Compose & reply
- [x] Phase 5 — RAG chat agent
- [x] Phase 6 — UX polish (pipeline banner, insights, chat UX)
- [x] Phase 7 — Deploy + documentation

---

## Author

**Nunugoppula Ajay Kumar**

## License

MIT
