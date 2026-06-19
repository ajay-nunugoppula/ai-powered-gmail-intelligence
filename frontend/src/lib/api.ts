const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  gmail_connected: boolean;
}

export interface SyncProgress {
  phase: string;
  total: number;
  processed: number;
  threads_synced: number;
  messages_synced: number;
  error?: string | null;
}

export interface SyncStatus {
  status: string;
  history_id: string | null;
  last_sync_at: string | null;
  progress: SyncProgress;
}

export interface EnrichmentStatus {
  status: string;
  phase: string;
  total: number;
  processed: number;
  error?: string | null;
}

export interface CategoryInfo {
  name: string | null;
  slug: string | null;
  color: string | null;
}

export interface ThreadItem {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  last_message_at: string | null;
  participant_emails: string[];
  message_count: number;
  thread_summary: string | null;
  category: CategoryInfo | null;
}

export interface ThreadListResponse {
  items: ThreadItem[];
  total: number;
  page: number;
  limit: number;
}

export interface MessageItem {
  id: string;
  gmail_message_id?: string | null;
  from_email: string;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
  summary: string | null;
  category: CategoryInfo | null;
  category_confidence: number | null;
}

export interface ThreadDetailResponse {
  thread: ThreadItem;
  messages: MessageItem[];
}

export interface ComposeDraft {
  mode: string;
  thread_id: string | null;
  message_id: string | null;
  subject: string;
  body: string;
  to: string[];
  cc: string[];
}

export interface ChatCitation {
  index: number;
  message_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  snippet: string | null;
  similarity: number | null;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  citations: ChatCitation[];
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
}

function parseApiError(body: string) {
  try {
    const parsed = JSON.parse(body) as { detail?: string | { msg?: string }[] };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) {
      return parsed.detail[0].msg;
    }
  } catch {
    // keep raw body
  }
  return body;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ApiError(response.status, parseApiError(errorBody) || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<{ status: string }>("/api/v1/health"),
  getRoot: () => request<{ message: string; status: string }>("/"),
  getMe: (token: string) =>
    request<UserProfile>("/api/v1/auth/me", { method: "GET" }, token),
  connectGmail: (token: string) =>
    request<{ auth_url: string }>(
      "/api/v1/auth/gmail/connect",
      { method: "POST" },
      token,
    ),
  disconnectGmail: (token: string) =>
    request<{ message: string }>(
      "/api/v1/auth/gmail/disconnect",
      { method: "DELETE" },
      token,
    ),
  getSyncStatus: (token: string) =>
    request<SyncStatus>("/api/v1/sync/status", { method: "GET" }, token),
  startSync: (token: string) =>
    request<{ job_type: string; status: string; message: string }>(
      "/api/v1/sync/start",
      { method: "POST" },
      token,
    ),
  getEnrichmentStatus: (token: string) =>
    request<EnrichmentStatus>(
      "/api/v1/enrichment/status",
      { method: "GET" },
      token,
    ),
  startEnrichment: (token: string) =>
    request<{ status: string; pending_messages: number; message: string }>(
      "/api/v1/enrichment/start",
      { method: "POST" },
      token,
    ),
  getThreads: (
    token: string,
    params?: { category?: string; search?: string; page?: number },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    const query = searchParams.toString();
    return request<ThreadListResponse>(
      `/api/v1/threads${query ? `?${query}` : ""}`,
      { method: "GET" },
      token,
    );
  },
  getThread: (token: string, threadId: string) =>
    request<ThreadDetailResponse>(
      `/api/v1/threads/${threadId}`,
      { method: "GET" },
      token,
    ),
  generateDraft: (
    token: string,
    payload: {
      mode: "reply" | "compose";
      thread_id?: string | null;
      message_id?: string | null;
      to?: string[];
      cc?: string[];
      subject?: string;
      tone?: string;
      instructions?: string;
    },
  ) =>
    request<ComposeDraft>(
      "/api/v1/compose/generate",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  sendEmail: (
    token: string,
    payload: {
      to: string[];
      cc?: string[];
      subject: string;
      body: string;
      thread_id?: string | null;
      reply_to_message_id?: string | null;
    },
  ) =>
    request<{ gmail_message_id: string | null; message: string }>(
      "/api/v1/compose/send",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  listChatSessions: (token: string) =>
    request<{ items: ChatSession[] }>(
      "/api/v1/chat/sessions",
      { method: "GET" },
      token,
    ),
  createChatSession: (token: string, title?: string) =>
    request<{ session: ChatSession }>(
      "/api/v1/chat/sessions",
      {
        method: "POST",
        body: JSON.stringify(title ? { title } : {}),
      },
      token,
    ),
  getChatSession: (token: string, sessionId: string) =>
    request<ChatSessionDetail>(
      `/api/v1/chat/sessions/${sessionId}`,
      { method: "GET" },
      token,
    ),
  sendChatMessage: (token: string, sessionId: string, content: string) =>
    request<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
      { method: "POST", body: JSON.stringify({ content }) },
      token,
    ),
  deleteChatSession: (token: string, sessionId: string) =>
    request<{ message: string }>(
      `/api/v1/chat/sessions/${sessionId}`,
      { method: "DELETE" },
      token,
    ),
};

export { API_URL };
