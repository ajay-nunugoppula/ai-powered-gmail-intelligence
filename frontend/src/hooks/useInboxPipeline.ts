import { useEffect, useRef } from "react";

import type { EnrichmentStatus, SyncStatus } from "@/lib/api";

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;

interface UseInboxPipelineOptions {
  gmailConnected: boolean;
  syncStatus?: SyncStatus;
  enrichmentStatus?: EnrichmentStatus;
  enrichmentAutoStart?: boolean;
  startSync: { mutate: () => void; isPending: boolean };
  startEnrichment: { mutate: () => void; isPending: boolean };
}

export function useInboxPipeline({
  gmailConnected,
  syncStatus,
  enrichmentStatus,
  enrichmentAutoStart = true,
  startSync,
  startEnrichment,
}: UseInboxPipelineOptions) {
  const bootSyncAttempted = useRef(false);
  const prevSyncStatus = useRef<string | undefined>(undefined);

  const isSyncing = syncStatus?.status === "syncing" || startSync.isPending;
  const isEnriching =
    enrichmentStatus?.status === "running" || startEnrichment.isPending;
  const pipelineBusy = isSyncing || isEnriching;

  useEffect(() => {
    if (!gmailConnected) {
      bootSyncAttempted.current = false;
      prevSyncStatus.current = undefined;
    }
  }, [gmailConnected]);

  useEffect(() => {
    if (!gmailConnected || bootSyncAttempted.current) return;
    if (syncStatus?.status === "syncing") return;

    bootSyncAttempted.current = true;
    startSync.mutate();
  }, [gmailConnected, syncStatus?.status, startSync.mutate]);

  useEffect(() => {
    if (!gmailConnected) return;

    const tick = () => {
      if (pipelineBusy) return;
      startSync.mutate();
    };

    const intervalId = window.setInterval(tick, AUTO_SYNC_INTERVAL_MS);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [gmailConnected, pipelineBusy, startSync.mutate]);

  useEffect(() => {
    if (!gmailConnected || !enrichmentAutoStart) return;

    const previous = prevSyncStatus.current;
    prevSyncStatus.current = syncStatus?.status;

    if (
      previous === "syncing" &&
      syncStatus?.status === "completed" &&
      enrichmentStatus?.status === "idle" &&
      !startEnrichment.isPending
    ) {
      startEnrichment.mutate();
    }
  }, [
    gmailConnected,
    enrichmentAutoStart,
    syncStatus?.status,
    enrichmentStatus?.status,
    startEnrichment.isPending,
    startEnrichment.mutate,
  ]);

  const liveRefresh =
    gmailConnected &&
    (pipelineBusy ||
      syncStatus?.status === "syncing" ||
      enrichmentStatus?.status === "running" ||
      (syncStatus?.status === "completed" &&
        enrichmentStatus?.status !== "completed" &&
        enrichmentStatus?.status !== "failed"));

  return { liveRefresh, pipelineBusy, isSyncing, isEnriching };
}
