# Deployment Guide (GitHub → Vercel)

Repo: `https://github.com/ajay-nunugoppula/ai-powered-gmail-intelligence`

Deploy **two Vercel projects** from the same GitHub repository — one for the React frontend, one for the FastAPI backend.

> **Sync / AI jobs:** Gmail sync and enrichment run as background work. On Vercel serverless, keep `USE_ARQ_WORKER=false` for the demo (jobs run in-process). For heavier inboxes, add **Railway + Redis** later (see README). Set `SYNC_DAYS_BACK=7` in production if that is your evaluator setting.

---

## 0. Push latest code

```bash
git add .
git commit -m "chore: add Vercel deployment config"
git push origin main
```

---

## 1. Supabase (production URLs)

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| Site URL | `https://<your-frontend>.vercel.app` |
| Redirect URLs | `https://<your-frontend>.vercel.app/auth/callback` |

---

## 2. Google Cloud (production URLs)

**OAuth client → Authorized redirect URIs**

- `https://<your-supabase-project>.supabase.co/auth/v1/callback` (login)
- `https://<your-backend>.vercel.app/api/v1/auth/gmail/callback` (Gmail connect)

**OAuth consent screen:** add evaluator emails as test users if app is in Testing mode.

---

## 3. Vercel — Frontend project

1. Go to [vercel.com/new](https://vercel.com/new) → **Import** `ajay-nunugoppula/ai-powered-gmail-intelligence`
2. **Project name:** e.g. `gmail-intelligence-web`
3. **Root Directory:** `frontend` ← important
4. **Framework Preset:** Vite
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`

### Environment variables (Vercel → Settings → Environment Variables)

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | `https://<your-backend>.vercel.app` |

6. **Deploy** → note the URL, e.g. `https://gmail-intelligence-web.vercel.app`

---

## 4. Vercel — Backend project

1. **Add New Project** → same GitHub repo again
2. **Project name:** e.g. `gmail-intelligence-api`
3. **Root Directory:** `backend` ← important
4. **Framework Preset:** Other (Python)

### Environment variables

Copy from `backend/.env.example`. Production values:

| Variable | Production value |
|----------|------------------|
| `FRONTEND_URL` | `https://<your-frontend>.vercel.app` |
| `API_URL` | `https://<your-backend>.vercel.app` |
| `CORS_ORIGINS` | `https://<your-frontend>.vercel.app` |
| `GOOGLE_REDIRECT_URI` | `https://<your-backend>.vercel.app/api/v1/auth/gmail/callback` |
| `SUPABASE_URL` | Same Supabase project |
| `SUPABASE_SERVICE_KEY` | Service role key (not anon) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GEMINI_API_KEY` | Your Gemini key |
| `NVIDIA_API_KEY` | Your NVIDIA NIM key |
| `TOKEN_ENCRYPTION_KEY` | Fernet key (generate once, keep stable) |
| `SYNC_DAYS_BACK` | `7` |
| `USE_ARQ_WORKER` | `false` |
| `REDIS_URL` | Optional for Vercel-only deploy |

5. **Deploy** → note API URL

---

## 5. Wire frontend to backend

Update frontend Vercel env:

- `VITE_API_URL` = backend Vercel URL

**Redeploy** the frontend (Deployments → ⋯ → Redeploy).

Update Supabase Site URL / redirect URLs with the final frontend URL if not done already.

---

## 6. Smoke test

1. Open `https://<frontend>.vercel.app`
2. Sign in with Google
3. Connect Gmail from sidebar
4. Sync inbox → wait for AI analysis banner
5. Open a thread, reply, open AI chat

**Health check:** `https://<backend>.vercel.app/api/v1/health`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 on API calls | Check `SUPABASE_JWT_SECRET` + `SUPABASE_SERVICE_KEY`; sign out/in |
| CORS error | `CORS_ORIGINS` must exactly match frontend URL (no trailing slash) |
| Gmail connect fails | `GOOGLE_REDIRECT_URI` must match Google Console exactly |
| Sync stops mid-way | Vercel timeout — reduce `SYNC_DAYS_BACK` or move API to Railway |
| Gemini 429 | Use `GEMINI_MODEL=gemini-2.5-flash-lite` or add API credits |
