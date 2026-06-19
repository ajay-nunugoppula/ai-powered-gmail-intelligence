# Gmail Intelligence Platform

AI-powered Gmail Intelligence Platform for the Repeatless technical assessment. Connects to Gmail, syncs emails, and provides AI-driven summarization, categorization, compose/reply, and a RAG chat agent.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12 |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (Google OAuth) + Gmail API OAuth |
| Primary AI | Google Gemini |
| Secondary AI | NVIDIA NIM |
| Jobs | ARQ + Redis |
| Deployment | Vercel (frontend) + Railway (backend + worker) |

## Project Structure

```
repeatless-assignment/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/routes/      # REST endpoints
│   │   ├── services/        # Gmail, AI, email business logic
│   │   ├── models/          # Pydantic schemas
│   │   ├── worker/          # ARQ background jobs
│   │   ├── config.py        # Environment settings
│   │   ├── deps.py          # Auth dependencies
│   │   └── main.py          # App entry point
│   ├── Dockerfile
│   ├── railway.toml
│   └── requirements.txt
├── frontend/                # React SPA
│   └── src/
│       ├── components/      # UI components (shadcn/ui)
│       ├── lib/             # Supabase client, API client, utils
│       └── pages/           # Route pages
├── supabase/
│   └── migrations/          # Database schema + RLS
├── Architecture.md          # System design document
├── .env.example             # Environment variable template
└── README.md
```

## Prerequisites

- Node.js 20+
- Python 3.12+
- A [Supabase](https://supabase.com) project
- A [Google Cloud Console](https://console.cloud.google.com) project with Gmail API enabled
- [Gemini API key](https://aistudio.google.com/apikey)
- [NVIDIA NIM API key](https://build.nvidia.com)
- Redis (local or [Upstash](https://upstash.com) for production)

## Local Setup

### 1. Clone and configure environment

```bash
git clone <your-repo-url>
cd repeatless-assignment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example) values in the copied files.

### 2. Supabase setup

1. Create a new Supabase project.
2. Enable **Google** provider under Authentication → Providers (use the same Google Client ID/Secret).
3. Under Authentication → URL Configuration, set:
   - **Site URL:** `http://localhost:5173`
   - **Redirect URLs:** `http://localhost:5173/auth/callback`
4. Run the migration in the SQL Editor:

```bash
# Paste contents of supabase/migrations/001_initial.sql into Supabase SQL Editor
```

4. Copy your project URL, anon key, service role key, and JWT secret into `backend/.env` and `frontend/.env.local`.

### 3. Google Cloud setup

1. Create an OAuth 2.0 Client ID (Web application).
2. Enable the **Gmail API** for your project.
3. Add authorized redirect URIs:
   - `http://localhost:8000/api/v1/auth/gmail/callback` (Gmail connect)
   - `https://your-project.supabase.co/auth/v1/callback` (Supabase Google login)
4. Configure OAuth consent screen (External, add yourself as test user).
5. Scopes needed: `openid`, `email`, `profile`, `gmail.readonly`, `gmail.send`, `gmail.modify`.

### 4. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
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

### 6. Worker (optional — sync runs in-process if Redis is unavailable)

```bash
cd backend
arq app.worker.settings.WorkerSettings
```

Requires Redis running at `REDIS_URL`. Without Redis, clicking **Sync** still works via FastAPI background tasks.

### Gmail sync

- After connecting Gmail, sync starts automatically (last **90 days**, up to **1000** emails).
- Use the refresh button in the inbox panel to run incremental sync.
- Progress is shown in the thread list header while syncing.

### AI enrichment (Phase 3)

After Gmail sync completes, the backend automatically:
- **Summarizes** each message and thread (Gemini)
- **Categorizes** emails into your inbox categories (Gemini)
- **Embeds** message chunks for RAG search (NVIDIA NIM, 1024-dim vectors)

Requires `GEMINI_API_KEY` and `NVIDIA_API_KEY` in `backend/.env`.

- Click the **sparkles** button in the inbox panel to run analysis manually.
- Progress shows while enrichment is running; thread list updates with categories and summaries.
- Sidebar category filters work once emails are categorized.

### Compose & reply (Phase 4)

- Open a thread and click **Reply** on any message, or **Compose** for a new email.
- Choose tone (professional / friendly / concise) and optional instructions.
- Click **Generate draft** — Gemini writes the email using thread context.
- Edit the draft, then **Send** — delivered via Gmail API (`gmail.send` scope).
- Replies stay in the same Gmail thread with proper `In-Reply-To` headers.

Requires `GEMINI_API_KEY` for draft generation and Gmail connected with send permission.

## Environment Variables

See [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example).

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key (frontend) |
| `SUPABASE_SERVICE_KEY` | Service role key (backend only) |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NVIDIA_API_KEY` | NVIDIA NIM API key |
| `REDIS_URL` | Redis connection string for ARQ worker |
| `TOKEN_ENCRYPTION_KEY` | Fernet key for encrypting Gmail refresh tokens |
| `FRONTEND_URL` | Frontend origin for CORS and OAuth redirects |
| `VITE_SUPABASE_URL` | Supabase URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (frontend) |
| `VITE_API_URL` | Backend API URL (frontend) |

Generate an encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Troubleshooting 401 Unauthorized on sync/API calls

Google login uses **Supabase Auth** on the frontend. API calls send the Supabase **access token** to the backend — not a Google token.

1. Ensure `backend/.env` exists (not only root `.env`) with:
   - `SUPABASE_URL` — same project as frontend
   - `SUPABASE_SERVICE_KEY` — service **role** key (not anon key)
   - `SUPABASE_JWT_SECRET` — from Supabase → **Project Settings → API → JWT Secret**
2. Restart the backend after changing env vars.
3. Sign out and sign in again in the app to refresh the session.

## Deployment

### Frontend (Vercel)

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_*` environment variables in Vercel dashboard

### Backend (Railway)

- Root directory: `backend`
- Uses `Dockerfile` and `railway.toml`
- Set all backend env vars in Railway dashboard
- Deploy a second Railway service for the ARQ worker with start command: `arq app.worker.settings.WorkerSettings`

## Development Phases

- [x] **Phase 0** — Project scaffolding, database schema, env setup
- [x] **Phase 1** — Auth + app shell UI
- [x] **Phase 2** — Gmail sync pipeline
- [x] **Phase 3** — Summarization + categorization + embeddings
- [x] **Phase 4** — Compose & reply
- [x] **Phase 5** — RAG chat agent
- [ ] **Phase 6** — Bonus features + polish
- [ ] **Phase 7** — Deploy + documentation

## License

MIT
