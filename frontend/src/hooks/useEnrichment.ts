import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export function useEnrichmentStatus() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["enrichment-status"],
    queryFn: () => api.getEnrichmentStatus(session!.access_token),
    enabled: Boolean(session?.access_token),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  });
}

export function useStartEnrichment() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.startEnrichment(session!.access_token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["enrichment-status"] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
  });
}
