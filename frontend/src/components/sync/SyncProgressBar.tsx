import type { SyncStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SyncProgressBarProps {
  syncStatus?: SyncStatus;
}

export function SyncProgressBar({ syncStatus }: SyncProgressBarProps) {
  if (!syncStatus || syncStatus.status === "idle") {
    return null;
  }

  const { progress, status } = syncStatus;
  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : status === "completed"
        ? 100
        : 0;

  return (
    <div className="space-y-2 px-4 py-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium capitalize">
          {status === "syncing"
            ? "Syncing inbox…"
            : status === "failed" && progress.phase === "interrupted"
              ? "Sync interrupted"
              : status}
        </span>
        <span className="text-muted-foreground">
          {progress.processed}/{progress.total || "?"}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            status === "failed" ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {status === "failed" && progress.error && (
        <p className="text-destructive text-xs">{progress.error}</p>
      )}
    </div>
  );
}
