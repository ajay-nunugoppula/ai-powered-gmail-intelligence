-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    gmail_connected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Gmail OAuth credentials (encrypted at application layer)
-- ---------------------------------------------------------------------------
CREATE TABLE public.gmail_credentials (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    refresh_token_enc TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    token_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Sync state for incremental Gmail sync
-- ---------------------------------------------------------------------------
CREATE TABLE public.sync_state (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    history_id TEXT,
    last_sync_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'idle'
        CHECK (status IN ('idle', 'syncing', 'completed', 'failed')),
    progress_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, slug)
);

-- ---------------------------------------------------------------------------
-- Email threads (first-class entity)
-- ---------------------------------------------------------------------------
CREATE TABLE public.threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gmail_thread_id TEXT NOT NULL,
    subject TEXT,
    snippet TEXT,
    last_message_at TIMESTAMPTZ,
    participant_emails TEXT[] NOT NULL DEFAULT '{}',
    message_count INTEGER NOT NULL DEFAULT 0,
    thread_summary TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, gmail_thread_id)
);

-- ---------------------------------------------------------------------------
-- Email messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    gmail_thread_id TEXT NOT NULL,
    from_email TEXT NOT NULL,
    to_emails TEXT[] NOT NULL DEFAULT '{}',
    cc_emails TEXT[] NOT NULL DEFAULT '{}',
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    labels TEXT[] NOT NULL DEFAULT '{}',
    in_reply_to TEXT,
    references_header TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, gmail_message_id)
);

-- ---------------------------------------------------------------------------
-- AI summaries
-- ---------------------------------------------------------------------------
CREATE TABLE public.message_summaries (
    message_id UUID PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.thread_summaries (
    thread_id UUID PRIMARY KEY REFERENCES public.threads(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Message categorization
-- ---------------------------------------------------------------------------
CREATE TABLE public.message_categories (
    message_id UUID PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    confidence REAL NOT NULL DEFAULT 0.0,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Vector embeddings (NIM nv-embedqa-e5-v5-v2 = 1024 dimensions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.message_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding vector(1024),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, chunk_index)
);

-- ---------------------------------------------------------------------------
-- Chat sessions and messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Background job tracking
-- ---------------------------------------------------------------------------
CREATE TABLE public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL
        CHECK (job_type IN ('initial_sync', 'incremental_sync', 'summarize', 'categorize', 'embed')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_threads_user_last_message ON public.threads (user_id, last_message_at DESC);
CREATE INDEX idx_threads_user_category ON public.threads (user_id, category_id);
CREATE INDEX idx_threads_gmail_thread_id ON public.threads (gmail_thread_id);
CREATE INDEX idx_messages_user_received ON public.messages (user_id, received_at DESC);
CREATE INDEX idx_messages_thread_id ON public.messages (thread_id);
CREATE INDEX idx_messages_from_email ON public.messages (user_id, from_email);
CREATE INDEX idx_message_embeddings_user_id ON public.message_embeddings (user_id);
CREATE INDEX idx_sync_jobs_user_status ON public.sync_jobs (user_id, status);
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions (user_id, updated_at DESC);
CREATE INDEX idx_chat_messages_session ON public.chat_messages (session_id, created_at);

CREATE INDEX idx_message_embeddings_vector
    ON public.message_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
        NEW.raw_user_meta_data ->> 'avatar_url'
    );

    INSERT INTO public.sync_state (user_id) VALUES (NEW.id);

    INSERT INTO public.categories (user_id, name, slug, color, is_system) VALUES
        (NEW.id, 'Newsletters', 'newsletters', '#8b5cf6', TRUE),
        (NEW.id, 'Job / Recruitment', 'job-recruitment', '#3b82f6', TRUE),
        (NEW.id, 'Finance', 'finance', '#10b981', TRUE),
        (NEW.id, 'Notifications', 'notifications', '#f59e0b', TRUE),
        (NEW.id, 'Personal', 'personal', '#ec4899', TRUE),
        (NEW.id, 'Work / Professional', 'work-professional', '#6366f1', TRUE);

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Gmail credentials
CREATE POLICY "Users can view own gmail credentials"
    ON public.gmail_credentials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gmail credentials"
    ON public.gmail_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gmail credentials"
    ON public.gmail_credentials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gmail credentials"
    ON public.gmail_credentials FOR DELETE USING (auth.uid() = user_id);

-- Sync state
CREATE POLICY "Users can view own sync state"
    ON public.sync_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own sync state"
    ON public.sync_state FOR UPDATE USING (auth.uid() = user_id);

-- Categories
CREATE POLICY "Users can view own categories"
    ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories"
    ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories"
    ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own non-system categories"
    ON public.categories FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- Threads
CREATE POLICY "Users can view own threads"
    ON public.threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own threads"
    ON public.threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own threads"
    ON public.threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own threads"
    ON public.threads FOR DELETE USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Users can view own messages"
    ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages"
    ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages"
    ON public.messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages"
    ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- Message summaries
CREATE POLICY "Users can view own message summaries"
    ON public.message_summaries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_id AND m.user_id = auth.uid()
    ));

-- Thread summaries
CREATE POLICY "Users can view own thread summaries"
    ON public.thread_summaries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.threads t
        WHERE t.id = thread_id AND t.user_id = auth.uid()
    ));

-- Message categories
CREATE POLICY "Users can view own message categories"
    ON public.message_categories FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_id AND m.user_id = auth.uid()
    ));

-- Embeddings
CREATE POLICY "Users can view own embeddings"
    ON public.message_embeddings FOR SELECT USING (auth.uid() = user_id);

-- Chat sessions
CREATE POLICY "Users can view own chat sessions"
    ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat sessions"
    ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions"
    ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat sessions"
    ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- Chat messages
CREATE POLICY "Users can view own chat messages"
    ON public.chat_messages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.chat_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ));
CREATE POLICY "Users can insert own chat messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.chat_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ));

-- Sync jobs
CREATE POLICY "Users can view own sync jobs"
    ON public.sync_jobs FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Vector similarity search helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_message_embeddings(
    query_embedding vector(1024),
    match_user_id UUID,
    match_count INT DEFAULT 20,
    match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    message_id UUID,
    chunk_text TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        me.id,
        me.message_id,
        me.chunk_text,
        me.metadata,
        1 - (me.embedding <=> query_embedding) AS similarity
    FROM public.message_embeddings me
    WHERE me.user_id = match_user_id
      AND me.embedding IS NOT NULL
      AND 1 - (me.embedding <=> query_embedding) > match_threshold
    ORDER BY me.embedding <=> query_embedding
    LIMIT match_count;
$$;
