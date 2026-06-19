import { useEffect, useRef, useState } from "react";

import type { EnrichmentStatus, SyncStatus } from "@/lib/api";

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;
const ENRICHMENT_RETRY_MS = 5000;
const MAX_ENRICHMENT_RETRIES = 4;

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
  const syncWasActive = useRef(false);
  const enrichRetryCount = useRef(0);
  const [awaitingAnalysis, setAwaitingAnalysis] = useState(false);

  const isSyncing = syncStatus?.status === "syncing" || startSync.isPending;
  const isEnriching =
    enrichmentStatus?.status === "running" || startEnrichment.isPending;
  const pipelineBusy = isSyncing || isEnriching;

  useEffect(() => {
    if (!gmailConnected) {
      bootSyncAttempted.current = false;
      syncWasActive.current = false;
      enrichRetryCount.current = 0;
      setAwaitingAnalysis(false);
    }
  }, [gmailConnected]);

  useEffect(() => {
    if (isSyncing) {
      syncWasActive.current = true;
    }
  }, [isSyncing]);

  useEffect(() => {
    if (!gmailConnected || bootSyncAttempted.current) return;
    if (syncStatus?.status === "syncing") return;

    bootSyncAttempted.current = true;
    syncWasActive.current = true;
    startSync.mutate();
  }, [gmailConnected, syncStatus?.status, startSync.mutate]);

  useEffect(() => {
    if (!gmailConnected) return;

    const tick = () => {
      if (pipelineBusy || awaitingAnalysis) return;
      syncWasActive.current = true;
      startSync.mutate();
    };

    const intervalId = window.setInterval(tick, AUTO_SYNC_INTERVAL_MS);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [gmailConnected, pipelineBusy, awaitingAnalysis, startSync.mutate]);

  useEffect(() => {
    if (!gmailConnected || !enrichmentAutoStart) return;
    if (syncStatus?.status !== "completed" || !syncWasActive.current) return;

    syncWasActive.current = false;
    setAwaitingAnalysis(true);
    enrichRetryCount.current = 0;

    if (enrichmentStatus?.status !== "running" && !startEnrichment.isPending) {
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

  useEffect(() => {
    if (!awaitingAnalysis) return;

    if (enrichmentStatus?.status === "running") {
      enrichRetryCount.current = 0;
      return;
    }

    if (enrichmentStatus?.status === "completed") {
      setAwaitingAnalysis(false);
      enrichRetryCount.current = 0;
      return;
    }

    if (enrichmentStatus?.status === "failed") {
      setAwaitingAnalysis(false);
      return;
    }

    const timer = window.setTimeout(() => {
      if (
        enrichmentStatus?.status === "idle" &&
        !startEnrichment.isPending &&
        enrichRetryCount.current < MAX_ENRICHMENT_RETRIES
      ) {
        enrichRetryCount.current += 1;
        startEnrichment.mutate();
      }
    }, ENRICHMENT_RETRY_MS);

    return () => window.clearTimeout(timer);
  }, [
    awaitingAnalysis,
    enrichmentStatus?.status,
    startEnrichment.isPending,
    startEnrichment.mutate,
  ]);

  const liveRefresh =
    gmailConnected &&
    (pipelineBusy || awaitingAnalysis || syncStatus?.status === "syncing");

  const watchPipeline =
    gmailConnected &&
    (pipelineBusy || awaitingAnalysis || syncStatus?.status === "syncing");

  return {
    liveRefresh,
    watchPipeline,
    awaitingAnalysis,
    pipelineBusy,
    isSyncing,
    isEnriching,
  };
}
