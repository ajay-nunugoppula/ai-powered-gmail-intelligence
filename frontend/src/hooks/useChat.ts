import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  api,
  type ChatMessage,
  type ChatSession,
  type ChatSessionDetail,
} from "@/lib/api";

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
    mutationFn: (content: string) => {
      if (!sessionId) {
        throw new Error("No active chat session");
      }
      return api.sendChatMessage(session!.access_token, sessionId, content);
    },
    onMutate: async (content) => {
      if (!sessionId) return {};

      const queryKey = ["chat", "session", sessionId] as const;
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ChatSessionDetail>(queryKey);
      const optimisticId = `pending-user-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        role: "user",
        content,
        citations: [],
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatSessionDetail>(queryKey, (old) => {
        if (!old) {
          return {
            session: {
              id: sessionId,
              title: content.slice(0, 80) || "New conversation",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            messages: [optimisticMessage],
          };
        }

        return {
          ...old,
          messages: [...old.messages, optimisticMessage],
        };
      });

      return { previous, optimisticId };
    },
    onSuccess: (data, _content, context) => {
      if (!sessionId) return;

      const queryKey = ["chat", "session", sessionId] as const;
      queryClient.setQueryData<ChatSessionDetail>(queryKey, (old) => {
        if (!old) {
          return {
            session: {
              id: sessionId,
              title: data.user_message.content.slice(0, 80) || "New conversation",
              created_at: data.user_message.created_at,
              updated_at: data.assistant_message.created_at,
            },
            messages: [data.user_message, data.assistant_message],
          };
        }

        const withoutPending = old.messages.filter(
          (message) =>
            message.id !== context?.optimisticId &&
            !message.id.startsWith("pending-user-"),
        );

        return {
          ...old,
          messages: [
            ...withoutPending,
            data.user_message,
            data.assistant_message,
          ],
        };
      });

      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
    onError: (_error, _content, context) => {
      if (!sessionId || !context?.previous) return;
      queryClient.setQueryData(
        ["chat", "session", sessionId],
        context.previous,
      );
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
