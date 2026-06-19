import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ChatMessage, type ChatSession } from "@/lib/api";

export function useChatSessions() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["chat", "sessions"],
    queryFn: () => api.listChatSessions(session!.access_token),
    enabled: Boolean(session?.access_token),
  });
}

export function useChatSession(sessionId: string | null) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["chat", "session", sessionId],
    queryFn: () => api.getChatSession(session!.access_token, sessionId!),
    enabled: Boolean(session?.access_token && sessionId),
  });
}

export function useCreateChatSession() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) =>
      api.createChatSession(session!.access_token, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

export function useSendChatMessage(sessionId: string | null) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      api.sendChatMessage(session!.access_token, sessionId!, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["chat", "session", sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

export function useDeleteChatSession() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      api.deleteChatSession(session!.access_token, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

export type { ChatMessage, ChatSession };
