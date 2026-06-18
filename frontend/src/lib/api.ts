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
  from_email: string;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
}

export interface ThreadDetailResponse {
  thread: ThreadItem;
  messages: MessageItem[];
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
    throw new ApiError(response.status, errorBody || response.statusText);
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
};

export { API_URL };
