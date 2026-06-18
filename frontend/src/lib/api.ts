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
};

export { API_URL };
