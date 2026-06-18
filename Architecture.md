# Architecture & Design Document

> Gmail Intelligence Platform — Repeatless Technical Assessment  
> Status: Phase 0 scaffold. Sections will be completed as features are built.

## 1. System Architecture

*(To be completed in Phase 7)*

Components:
- **Frontend** — React + TypeScript on Vercel
- **API** — FastAPI on Railway
- **Worker** — ARQ + Redis for Gmail sync and AI enrichment
- **Database** — Supabase PostgreSQL + pgvector
- **External** — Gmail API, Google Gemini, NVIDIA NIM

## 2. Database Schema

See [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql) for the full schema.

Key design decisions:
- **Threads are first-class** — all features operate on `threads`, not isolated messages
- **pgvector (1024-dim)** — stores NIM embedding chunks for RAG retrieval
- **RLS on every table** — multi-tenant isolation via `auth.uid() = user_id`
- **Encrypted Gmail tokens** — refresh tokens encrypted at application layer before storage

## 3. AI Design

*(To be completed in Phases 3–5)*

Planned approach:
- **Gemini 2.0 Flash** — summarization, chat, compose/reply
- **NVIDIA NIM embeddings** — vector indexing for RAG
- **NVIDIA NIM Llama 3.1 8B** — batch categorization fallback
- **Hybrid RAG** — pgvector similarity + metadata filters + citation-enforced prompts

## 4. Gmail API Strategy

*(To be completed in Phase 2)*

Planned approach:
- Initial sync: last 90 days (~1000 emails) with pagination
- Incremental sync via `historyId`
- Exponential backoff on 429 responses
- Background worker — never block API responses

## 5. Tool & Technology Decisions

| Choice | Justification |
|--------|---------------|
| FastAPI | Async, typed, excellent for AI pipelines |
| React + TypeScript | Type safety, large ecosystem, Vercel deploy |
| Supabase | Required; auth + Postgres + pgvector in one |
| ARQ + Redis | Lightweight job queue for sync/AI tasks |
| shadcn/ui | Accessible, professional UI with minimal custom CSS |

## 6. Trade-offs & Limitations

*(To be updated as development progresses)*

Current scope decisions:
- Initial sync capped at 90 days / ~1000 emails for demo reliability
- No attachment parsing in v1
- Polling-based sync (no Gmail push notifications)
- OAuth consent screen in Google "Testing" mode for assessment
