import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const POLL_MS = 2000;

export function useSyncStatus(options?: { watchPipeline?: boolean }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["sync-status"],
    queryFn: () => api.getSyncStatus(session!.access_token),
    enabled: Boolean(session?.access_token),
    refetchInterval: (query) => {
      if (query.state.data?.status === "syncing" || options?.watchPipeline) {
        return POLL_MS;
      }
      return false;
    },
  });
}

export function useStartSync() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.startSync(session!.access_token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });

      let polls = 0;
      const intervalId = window.setInterval(() => {
        polls += 1;
        void queryClient.invalidateQueries({ queryKey: ["sync-status"] });
        void queryClient.invalidateQueries({ queryKey: ["threads"] });
        if (polls >= 30) {
          window.clearInterval(intervalId);
        }
      }, POLL_MS);
    },
  });
}

export function useThreads(
  category: string,
  search: string,
  options?: { liveRefresh?: boolean },
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["threads", category, search],
    queryFn: () =>
      api.getThreads(session!.access_token, {
        category: category === "all" ? undefined : category,
        search: search || undefined,
      }),
    enabled: Boolean(session?.access_token),
    refetchInterval: options?.liveRefresh ? POLL_MS : false,
  });
}

export function useThreadDetail(
  threadId: string | null,
  options?: { liveRefresh?: boolean },
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.getThread(session!.access_token, threadId!),
    enabled: Boolean(session?.access_token && threadId),
    refetchInterval: options?.liveRefresh ? POLL_MS : false,
  });
}
