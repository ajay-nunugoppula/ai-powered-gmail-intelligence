import type { EnrichmentStatus, SyncStatus } from "@/lib/api";

export type PipelineStep = "sync" | "analyze" | "ready" | "idle";

const SYNC_PHASE_LABELS: Record<string, string> = {
  starting: "Preparing sync…",
  fetching: "Downloading messages from Gmail",
  complete: "Sync complete",
  interrupted: "Sync interrupted",
};

const ENRICHMENT_PHASE_LABELS: Record<string, string> = {
  starting: "Preparing AI analysis…",
  summarize: "Generating message summaries",
  categorize: "Assigning categories",
  embed: "Building search embeddings",
  thread_summaries: "Creating thread summaries",
  complete: "Analysis complete",
  interrupted: "Analysis interrupted",
};

export function syncPhaseLabel(phase: string) {
  return SYNC_PHASE_LABELS[phase] ?? "Syncing inbox…";
}

export function enrichmentPhaseLabel(phase: string) {
  return ENRICHMENT_PHASE_LABELS[phase] ?? "Analyzing inbox…";
}

export function progressPercent(processed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
}

export function getPipelineStep(
  syncStatus: SyncStatus | undefined,
  enrichmentStatus: EnrichmentStatus | undefined,
): PipelineStep {
  if (syncStatus?.status === "syncing") return "sync";
  if (enrichmentStatus?.status === "running") return "analyze";
  if (
    syncStatus?.status === "completed" &&
    enrichmentStatus?.status === "completed"
  ) {
    return "ready";
  }
  if (
    syncStatus?.status === "completed" &&
    enrichmentStatus?.status === "idle"
  ) {
    return "analyze";
  }
  return "idle";
}

export function isPipelineActive(
  syncStatus: SyncStatus | undefined,
  enrichmentStatus: EnrichmentStatus | undefined,
  isSyncPending = false,
  isEnrichPending = false,
) {
  if (
    isSyncPending ||
    isEnrichPending ||
    syncStatus?.status === "syncing" ||
    enrichmentStatus?.status === "running" ||
    syncStatus?.status === "failed" ||
    enrichmentStatus?.status === "failed"
  ) {
    return true;
  }

  return (
    syncStatus?.status === "completed" &&
    enrichmentStatus?.status === "idle"
  );
}
