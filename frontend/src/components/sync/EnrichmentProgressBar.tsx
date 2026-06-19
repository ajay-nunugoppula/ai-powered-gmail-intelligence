import type { EnrichmentStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<string, string> = {
  starting: "Starting…",
  summarize: "Summarizing emails",
  categorize: "Categorizing emails",
  embed: "Generating embeddings",
  thread_summaries: "Summarizing threads",
  complete: "Complete",
  interrupted: "Interrupted",
};

interface EnrichmentProgressBarProps {
  enrichmentStatus?: EnrichmentStatus;
}

export function EnrichmentProgressBar({
  enrichmentStatus,
}: EnrichmentProgressBarProps) {
  if (
    !enrichmentStatus ||
    enrichmentStatus.status === "idle" ||
    enrichmentStatus.status === "completed"
  ) {
    return null;
  }

  const { status, phase, total, processed, error } = enrichmentStatus;
  const percent =
    total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const phaseLabel = PHASE_LABELS[phase] ?? phase;

  return (
    <div
      className="space-y-2 border-b px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {status === "failed" ? "AI analysis failed" : "Analyzing inbox…"}
        </span>
        <span className="text-muted-foreground">
          {processed}/{total || "?"}
        </span>
      </div>
      <p className="text-muted-foreground text-[11px]">{phaseLabel}</p>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            status === "failed" ? "bg-destructive" : "bg-violet-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {status === "failed" && error && (
        <p className="text-destructive text-xs">{error}</p>
      )}
    </div>
  );
}
