import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ComposeDraft } from "@/lib/api";

export function useGenerateDraft() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.generateDraft>[1]) =>
      api.generateDraft(session!.access_token, payload),
  });
}

export function useSendEmail() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.sendEmail>[1]) =>
      api.sendEmail(session!.access_token, payload),
  });
}

export type { ComposeDraft };
