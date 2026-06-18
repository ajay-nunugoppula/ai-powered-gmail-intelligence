# MailMind — AI-Powered Gmail Intelligence Platform

An AI-driven email management platform that connects to Gmail, processes emails intelligently, and provides a conversational assistant to interact with your email data.

**Live Demo**: [Deploy URL — update after deployment]

## Features

- **Gmail Integration** — OAuth 2.0 authentication with incremental sync
- **Email Summarization** — AI-generated summaries for individual emails and full threads
- **Compose & Reply** — Draft emails from natural language prompts
- **Thread-Aware Replies** — Context-aware replies preserving Gmail thread headers
- **Email Categorization** — Auto-classification into 6 categories
- **AI Chat Agent** — RAG-powered assistant with source attribution
- **Newsletter Deduplication** — Semantic dedup of news items across sources (bonus)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL + pgvector) |
| Primary AI | Google Gemini 2.0 Flash |
| Secondary AI | NVIDIA NIM (embeddings + classification) |
| Auth | Google OAuth 2.0 + JWT |

## Project Structure

```
repeatless-assignment/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Environment settings
│   │   ├── dependencies.py      # Auth middleware
│   │   ├── api/                 # Route handlers
│   │   │   ├── auth.py          # Google OAuth + JWT
│   │   │   ├── emails.py        # Email listing, threads, sync
│   │   │   ├── compose.py       # Draft & send emails
│   │   │   ├── chat.py          # AI chat agent
│   │   │   └── categories.py    # Category statistics
│   │   ├── services/            # Business logic
│   │   │   ├── gmail_service.py # Gmail API wrapper
│   │   │   ├── sync_service.py  # Email sync orchestration
│   │   │   ├── ai_service.py    # Gemini integration
│   │   │   ├── nim_service.py   # NVIDIA NIM integration
│   │   │   └── rag_service.py   # RAG pipeline
│   │   ├── models/              # Pydantic schemas + DB client
│   │   └── utils/               # Rate limiter, text processing
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/               # Dashboard, Inbox, Chat, Compose
│   │   ├── components/          # Layout, shared UI
│   │   ├── context/             # Auth context
│   │   └── api/                 # API client
│   ├── package.json
│   └── Dockerfile
├── supabase/
│   └── migrations/              # Database schema
├── Architecture.md              # Design document
├── docker-compose.yml
└── .env.example
```

## Setup Instructions

### Prerequisites

- Python 3.12+
- Node.js 20+
- A Supabase project (free tier works)
- Google Cloud project with Gmail API enabled
- Google Gemini API key
- NVIDIA NIM API key (free at [build.nvidia.com](https://build.nvidia.com))

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **Gmail API**
3. Go to **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized redirect URIs: `http://localhost:8000/api/auth/callback`
6. Note the Client ID and Client Secret

### 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Note the Project URL and Service Role Key (Settings → API)

### 3. Environment Variables

Copy `.env.example` to `.env` in the project root and fill in values:

```bash
cp .env.example .env
```

### 4. Run Locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with Google.

### 5. Run with Docker

```bash
docker-compose up --build
```

Frontend: `http://localhost:3000` | Backend: `http://localhost:8000`

## Deployment

### Backend (Render)

1. Connect GitHub repo to [Render](https://render.com)
2. Create a **Web Service** pointing to `backend/` directory
3. Set environment variables from `.env.example`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel)

1. Import repo to [Vercel](https://vercel.com)
2. Set root directory to `frontend/`
3. Set `VITE_API_URL` to your Render backend URL + `/api`
4. Deploy

### Update OAuth Redirect

Add your production callback URL to Google Cloud Console:
`https://your-backend.onrender.com/api/auth/callback`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/login` | Get Google OAuth URL |
| GET | `/api/auth/callback` | OAuth callback |
| GET | `/api/auth/me` | Current user |
| GET | `/api/emails` | List emails (paginated) |
| GET | `/api/emails/threads` | List threads |
| GET | `/api/emails/threads/{id}` | Thread with messages |
| POST | `/api/emails/sync` | Trigger email sync |
| GET | `/api/emails/sync/status` | Sync status |
| POST | `/api/compose/draft` | AI compose draft |
| POST | `/api/compose/reply` | AI reply draft |
| POST | `/api/compose/send` | Send email via Gmail |
| POST | `/api/chat/message` | Chat with AI agent |
| GET | `/api/categories/stats` | Category breakdown |

## License

Built for the Repeatless technical assessment.
