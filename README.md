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
cp .env.example .env
```

Fill in all values in `.env`. Copy the same `VITE_*` values into `frontend/.env.local`.

### 2. Supabase setup

1. Create a new Supabase project.
2. Enable **Google** provider under Authentication → Providers.
3. Run the migration in the SQL Editor:

```bash
# Paste contents of supabase/migrations/001_initial.sql into Supabase SQL Editor
```

4. Copy your project URL, anon key, service role key, and JWT secret into `.env`.

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

### 6. Worker (optional for Phase 0)

```bash
cd backend
arq app.worker.settings.WorkerSettings
```

Requires Redis running at `REDIS_URL`.

## Environment Variables

See [.env.example](.env.example) for the full list with descriptions.

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
- [ ] **Phase 1** — Auth + app shell UI
- [ ] **Phase 2** — Gmail sync pipeline
- [ ] **Phase 3** — Summarization + categorization
- [ ] **Phase 4** — Compose & reply
- [ ] **Phase 5** — RAG chat agent
- [ ] **Phase 6** — Bonus features + polish
- [ ] **Phase 7** — Deploy + documentation

## License

MIT
