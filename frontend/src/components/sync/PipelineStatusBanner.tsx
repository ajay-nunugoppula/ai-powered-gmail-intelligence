import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AppConfig, EnrichmentStatus, SyncStatus } from "@/lib/api";
import {
  enrichmentPhaseLabel,
  getPipelineStep,
  isPipelineActive,
  progressPercent,
  syncPhaseLabel,
} from "@/lib/pipelineStatus";
import { cn } from "@/lib/utils";

interface PipelineStatusBannerProps {
  syncStatus?: SyncStatus;
  enrichmentStatus?: EnrichmentStatus;
  appConfig?: AppConfig;
  threadCount: number;
  isSyncPending?: boolean;
  isEnrichPending?: boolean;
  onRetrySync?: () => void;
  onRetryAnalyze?: () => void;
}

function StepIndicator({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending" | "error";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          state === "done" &&
            "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          state === "active" &&
            "border-primary bg-primary text-primary-foreground",
          state === "pending" &&
            "border-border bg-muted text-muted-foreground",
          state === "error" &&
            "border-destructive/40 bg-destructive/10 text-destructive",
        )}
        aria-hidden="true"
      >
        {state === "done" ? (
          <CheckCircle2 className="size-4" />
        ) : state === "active" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : state === "error" ? (
          "!"
        ) : (
          "·"
        )}
      </div>
      <span
        className={cn(
          "truncate text-xs font-medium sm:text-sm",
          state === "active" && "text-foreground",
          state === "pending" && "text-muted-foreground",
          state === "done" && "text-foreground",
          state === "error" && "text-destructive",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function PipelineStatusBanner({
  syncStatus,
  enrichmentStatus,
  appConfig,
  threadCount,
  isSyncPending = false,
  isEnrichPending = false,
  onRetrySync,
  onRetryAnalyze,
}: PipelineStatusBannerProps) {
  const [successDismissed, setSuccessDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const wasPipelineRunning = useRef(false);

  const syncDays = appConfig?.sync_days_back ?? 7;
  const autoAnalyze = appConfig?.enrichment_auto_start ?? true;
  const step = getPipelineStep(syncStatus, enrichmentStatus);
  const isSyncing =
    isSyncPending || syncStatus?.status === "syncing";
  const isEnriching =
    isEnrichPending || enrichmentStatus?.status === "running";
  const syncFailed = syncStatus?.status === "failed";
  const enrichFailed = enrichmentStatus?.status === "failed";
  const pipelineRunning = isSyncing || isEnriching;

  useEffect(() => {
    if (pipelineRunning) {
      wasPipelineRunning.current = true;
      setShowSuccess(false);
      setSuccessDismissed(false);
      return;
    }

    if (
      wasPipelineRunning.current &&
      syncStatus?.status === "completed" &&
      enrichmentStatus?.status === "completed" &&
      !successDismissed
    ) {
      setShowSuccess(true);
      wasPipelineRunning.current = false;
    }
  }, [
    pipelineRunning,
    syncStatus?.status,
    enrichmentStatus?.status,
    successDismissed,
  ]);

  useEffect(() => {
    if (!showSuccess || successDismissed) return;
    const timer = window.setTimeout(() => setSuccessDismissed(true), 10000);
    return () => window.clearTimeout(timer);
  }, [showSuccess, successDismissed]);

  if (
    !isPipelineActive(
      syncStatus,
      enrichmentStatus,
      isSyncPending,
      isEnrichPending,
    ) &&
    !(showSuccess && !successDismissed)
  ) {
    return null;
  }

  if (showSuccess && !successDismissed) {
    return (
      <div
        className="border-border/70 bg-emerald-500/10 flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold">Inbox ready</p>
            <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
              AI summaries, categories, and chat search are available across your
              synced emails.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setSuccessDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  const syncProgress = syncStatus?.progress;
  const syncPercent = progressPercent(
    syncProgress?.processed ?? 0,
    syncProgress?.total ?? 0,
  );
  const enrichPercent = progressPercent(
    enrichmentStatus?.processed ?? 0,
    enrichmentStatus?.total ?? 0,
  );

  const syncStepState = syncFailed
    ? "error"
    : isSyncing
      ? "active"
      : syncStatus?.status === "completed"
        ? "done"
        : "pending";

  const analyzeStepState = enrichFailed
    ? "error"
    : isEnriching || (step === "analyze" && !isSyncing)
      ? "active"
      : enrichmentStatus?.status === "completed"
        ? "done"
        : "pending";

  return (
    <div
      className="border-border/70 bg-muted/40 border-b px-4 py-4 sm:px-6"
      role="status"
      aria-live="polite"
      aria-busy={isSyncing || isEnriching}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StepIndicator label="Sync Gmail" state={syncStepState} />
        <div className="bg-border hidden h-px w-6 sm:block" aria-hidden="true" />
        <StepIndicator label="AI analysis" state={analyzeStepState} />
        <div className="bg-border hidden h-px w-6 sm:block" aria-hidden="true" />
        <StepIndicator
          label="Ready to use"
          state={
            enrichmentStatus?.status === "completed" && !isSyncing
              ? "done"
              : "pending"
          }
        />
      </div>

      {isSyncing && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {syncPhaseLabel(syncProgress?.phase ?? "fetching")}
            </span>
            <span className="text-muted-foreground text-xs">
              {syncProgress?.processed ?? 0}/{syncProgress?.total || "?"} messages
              {syncProgress?.threads_synced
                ? ` · ${syncProgress.threads_synced} threads`
                : ""}
              {syncPercent > 0 ? ` · ${syncPercent}%` : ""}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                "bg-primary h-full rounded-full transition-all duration-500",
                syncPercent === 0 && "w-1/3 animate-pulse",
              )}
              style={{
                width: syncPercent > 0 ? `${syncPercent}%` : undefined,
              }}
            />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Importing the last {syncDays} day{syncDays === 1 ? "" : "s"} from
            Gmail.
            {threadCount > 0
              ? ` ${threadCount} thread${threadCount === 1 ? "" : "s"} already available — you can read emails while sync continues.`
              : " Threads will appear here as they are imported."}
          </p>
        </div>
      )}

      {!isSyncing && (isEnriching || (step === "analyze" && !syncFailed)) && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles
                className="text-primary size-4 shrink-0"
                aria-hidden="true"
              />
              {isEnriching
                ? enrichmentPhaseLabel(enrichmentStatus?.phase ?? "starting")
                : autoAnalyze
                  ? "Starting AI analysis…"
                  : "Waiting for AI analysis"}
            </span>
            {isEnriching && (
              <span className="text-muted-foreground text-xs">
                {enrichmentStatus?.processed ?? 0}/
                {enrichmentStatus?.total || "?"} messages
                {enrichPercent > 0 ? ` · ${enrichPercent}%` : ""}
              </span>
            )}
          </div>
          {isEnriching && (
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full bg-violet-500 transition-all duration-500",
                  enrichPercent === 0 && "w-1/4 animate-pulse",
                )}
                style={{
                  width: enrichPercent > 0 ? `${enrichPercent}%` : undefined,
                }}
              />
            </div>
          )}
          <p className="text-muted-foreground text-xs leading-relaxed">
            {autoAnalyze
              ? "Summaries, categories, and search embeddings are generated automatically after sync. This usually takes a few minutes depending on inbox size."
              : "Click the sparkles button in the inbox header to run AI analysis."}
            {threadCount > 0 &&
              " You can already open threads — summaries will fill in as analysis completes."}
          </p>
        </div>
      )}

      {syncFailed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-destructive text-sm">
            {syncProgress?.error ?? "Gmail sync failed. Please try again."}
          </p>
          {onRetrySync && (
            <Button variant="outline" size="sm" onClick={onRetrySync}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry sync
            </Button>
          )}
        </div>
      )}

      {enrichFailed && !isSyncing && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-destructive text-sm">
            {enrichmentStatus?.error ??
              "AI analysis failed. Your emails are still readable."}
          </p>
          {onRetryAnalyze && (
            <Button variant="outline" size="sm" onClick={onRetryAnalyze}>
              <Sparkles className="size-4" aria-hidden="true" />
              Retry analysis
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
