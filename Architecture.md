# Gmail Intelligence Platform — Architecture & Design Document

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend (Vite)                       │
│  Dashboard │ Inbox │ Thread View │ Compose │ AI Chat Agent          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API (JWT Auth)
┌──────────────────────────────▼──────────────────────────────────────┐
│                      FastAPI Backend                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Auth API │ │ Email API│ │ Compose  │ │ Chat API │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘             │
│       │             │            │             │                     │
│  ┌────▼─────────────▼────────────▼─────────────▼─────┐             │
│  │              Service Layer                          │             │
│  │  GmailService │ SyncService │ AIService (Gemini)   │             │
│  │  RAGService   │ NIMService  │ RateLimiter          │             │
│  └────┬──────────────┬──────────────┬─────────────────┘             │
└───────┼──────────────┼──────────────┼───────────────────────────────┘
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌────▼──────────┐
   │ Google  │   │ Supabase  │  │ AI Models     │
   │ Gmail   │   │ PostgreSQL│  │ Gemini (primary)│
   │ OAuth   │   │ + pgvector│  │ NVIDIA NIM    │
   └─────────┘   └───────────┘  │ (embeddings + │
                                 │  classification)│
                                 └───────────────┘
```

### Component Interactions

1. **Authentication Flow**: User clicks "Sign in with Google" → OAuth 2.0 flow requests Gmail + profile scopes → Backend exchanges code for tokens → Stores user + OAuth tokens in Supabase → Returns JWT for API access.

2. **Email Sync Flow**: User triggers sync → Background task fetches messages via Gmail API (paginated) → Each message is parsed, stored, summarized (Gemini), categorized (NIM), and embedded (NIM) → Incremental sync uses Gmail History API for subsequent syncs.

3. **Chat Agent Flow**: User sends query → RAG pipeline retrieves relevant email chunks via vector similarity → Context + chat history sent to Gemini → Response includes source attribution from retrieved emails.

4. **Multi-User Isolation**: Every database query is scoped by `user_id`. JWT tokens encode user identity. OAuth tokens are stored per-user.

---

## 2. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts from Google OAuth | google_id, email, name, avatar_url |
| `oauth_tokens` | Gmail API credentials per user | access_token, refresh_token, token_expiry |
| `threads` | Email threads (first-class) | gmail_thread_id, subject, thread_summary |
| `emails` | Individual email messages | gmail_message_id, body_text, summary, in_reply_to |
| `email_categories` | AI-assigned categories | category (enum), confidence |
| `email_embeddings` | Vector chunks for RAG | chunk_text, embedding (vector 768) |
| `sync_state` | Incremental sync tracking | last_history_id, sync_status |
| `chat_sessions` / `chat_messages` | Conversational agent history | role, content, sources (JSONB) |
| `news_items` | Extracted newsletter items for dedup | title, embedding, dedup_group_id |

### Design Decisions

- **Threads as first-class entities**: The assignment requires thread-aware operations. Storing threads separately from emails enables efficient thread-level summaries and reply context assembly.

- **Separate categories table**: Allows reclassification without modifying email records. The enum type enforces the assignment's taxonomy.

- **Chunked embeddings**: Long emails are split into ~800-char chunks with 150-char overlap. This improves retrieval precision — a query about a specific detail in a long email can match the relevant chunk rather than a diluted whole-email embedding.

- **pgvector with IVFFlat index**: Cosine similarity search via the `match_emails()` RPC function. IVFFlat provides approximate nearest-neighbor search suitable for thousands of email chunks.

### pgvector Usage

- **What is embedded**: Email content chunks combining subject, sender, and body text.
- **Embedding model**: NVIDIA NIM `nv-embedqa-e5-v5` (768 dimensions) — optimized for retrieval QA.
- **Why**: Semantic search enables the chat agent to find relevant emails even when exact keywords don't match (e.g., "Kubernetes" finding emails about "k8s deployment").

---

## 3. AI Design

### Email Summarization

- **Individual emails**: Gemini receives subject + sender + body (truncated to 4000 chars). Prompt asks for 2-3 sentence summary focusing on key info and action items.
- **Thread summaries**: All messages in chronological order are concatenated (up to 8000 chars) and sent to Gemini with instructions to capture the conversation arc, decisions, and current status.
- **Long thread strategy**: For threads exceeding context limits, we summarize in batches — first summarize groups of messages, then summarize the summaries. Initial implementation truncates at 8000 chars; batch summarization is a planned enhancement.

### RAG Pipeline

```
User Query
    │
    ▼
Query Analysis (regex + keyword detection)
    ├── Sender-specific? → Filter by sender_email
    ├── Category-specific? → Filter by category
    └── General? → Vector similarity search
    │
    ▼
NIM Embedding (query) → pgvector cosine search → Top-K chunks
    │
    ▼
Fallback: Keyword search if vector search unavailable
    │
    ▼
Deduplicate results by email_id
    │
    ▼
Build context block with [Email N] citations
    │
    ▼
Gemini generates answer with source attribution
```

### Source Clarity

- Each retrieved email chunk is labeled `[Email N]` in the context block with ID, sender, subject, and date.
- The Gemini prompt explicitly requires citing sources and forbids hallucination.
- Response includes a `sources` array with email metadata displayed in the UI.

### Hallucination Prevention

1. System prompt restricts answers to provided email context only.
2. Explicit instruction: "If information is not in the emails, say so."
3. Source citations are mandatory in the prompt template.
4. Retrieved context is limited to actual email data — no external knowledge injection.

### NVIDIA NIM Model Selection

| Model | Role | Why |
|-------|------|-----|
| `nv-embedqa-e5-v5` | Embeddings for RAG | Purpose-built for retrieval QA, 768-dim, free tier |
| `meta/llama-3.1-8b-instruct` | Email categorization | Fast, lightweight classification without burning Gemini quota |
| NIM cosine similarity | Newsletter deduplication | Semantic dedup of news items across sources |

**Rationale**: Gemini handles complex reasoning (summarization, chat, compose). NIM handles high-volume, simpler tasks (embeddings, classification) on free tier, reducing cost and latency.

### Newsletter Deduplication (Bonus)

1. Gemini extracts individual news items from newsletter emails.
2. NIM generates embeddings for each item title.
3. Cosine similarity ≥ 0.85 groups duplicate stories.
4. Merged items show all source attributions.

---

## 4. Gmail API Strategy

### Initial Sync vs Incremental Sync

- **Initial sync**: Paginated `messages.list()` fetching up to 2500 messages (50 pages × 50 batch). Each message fetched individually with `messages.get(format=full)`.
- **Incremental sync**: Uses `history.list(startHistoryId)` to fetch only new/changed messages since last sync. Falls back to full sync if history ID is stale (>7 days).

### Pagination

- `messages.list()` returns `nextPageToken` for pagination.
- Batch processing: 50 message IDs per page, 10 messages processed concurrently per batch.
- Database queries use offset/limit pagination for UI (20 items per page).

### Rate Limiting & Quota Handling

- **Token bucket rate limiter**: 8 requests/second (Gmail allows ~250 quota units/second; message.get = 5 units).
- **Exponential backoff decorator**: Retries up to 5 times on 429/5xx with delays of 1s, 2s, 4s, 8s, 16s.
- **Batch concurrency**: Limited to 10 parallel message fetches to avoid burst quota exhaustion.

---

## 5. Tool & Technology Decisions

| Choice | Alternative Considered | Justification |
|--------|----------------------|---------------|
| **FastAPI** | Django, Flask | Async-native, automatic OpenAPI docs, Pydantic validation, ideal for AI API orchestration |
| **React + Vite** | Next.js, Vue | Fast dev experience, component model suits dashboard UI, Vite for quick builds |
| **Supabase** | Raw PostgreSQL, Firebase | Built-in pgvector support, managed Postgres, easy setup for assignment timeline |
| **Gemini 2.0 Flash** | GPT-4, Claude | Required by assignment; fast, cost-effective, good at summarization |
| **NVIDIA NIM** | OpenAI embeddings, Cohere | Required by assignment; free tier, purpose-built embedding model |
| **JWT auth** | Session cookies | Stateless, works well with SPA frontend and multi-user |
| **Background tasks** | Celery + Redis | FastAPI BackgroundTasks sufficient for sync jobs at this scale; Celery would be over-engineering for MVP |

---

## 6. Trade-offs & Limitations

### Deliberately Simplified

- **No Celery/Redis job queue**: Sync runs as FastAPI background task. Works for single-server deployment but won't scale to many concurrent users syncing simultaneously.
- **No real-time push**: UI polls sync status every 3 seconds instead of WebSocket updates.
- **Thread summary batching**: Long threads (>8000 chars) are truncated rather than hierarchically summarized.
- **Email body in UI**: Thread view shows snippet/summary rather than full HTML rendering (security consideration for XSS).
- **No attachment handling**: Attachments are flagged but not downloaded or processed.

### With More Time

1. **Celery + Redis** for robust background job processing with progress tracking.
2. **WebSocket** for real-time sync progress and chat streaming.
3. **Hierarchical thread summarization** for very long conversations.
4. **Reranking step** in RAG pipeline (cross-encoder reranking of retrieved chunks).
5. **Scheduled auto-sync** via cron jobs.
6. **Email HTML rendering** in sandboxed iframe.
7. **Refresh token rotation** and automatic token refresh before expiry.
8. **Comprehensive test suite** with mocked Gmail API responses.

---

## Libraries Used

| Library | Purpose |
|---------|---------|
| `google-api-python-client` | Gmail API integration |
| `google-generativeai` | Gemini API |
| `supabase-py` | Database client |
| `httpx` | Async HTTP for NIM API |
| `tenacity` | Retry logic |
| `html2text` | HTML email body parsing |
| `python-jose` | JWT token handling |
| `react-router-dom` | Frontend routing |
| `react-markdown` | Chat message rendering |
| `lucide-react` | UI icons |
| `tailwindcss` | Styling |
