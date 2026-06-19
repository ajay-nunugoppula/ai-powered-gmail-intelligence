import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: () => api.getConfig(),
    staleTime: 5 * 60 * 1000,
  });
}
