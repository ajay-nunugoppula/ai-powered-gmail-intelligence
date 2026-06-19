import { Loader2, Sparkles } from "lucide-react";

interface AnalysisPendingCardProps {
  progress?: { processed: number; total: number };
}

export function AnalysisPendingCard({ progress }: AnalysisPendingCardProps) {
  const percent =
    progress && progress.total > 0
      ? Math.min(
          100,
          Math.round((progress.processed / progress.total) * 100),
        )
      : null;

  return (
    <section
      className="border-primary/20 bg-primary/5 mb-6 rounded-xl border p-4"
      aria-label="AI analysis in progress"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Sparkles className="text-primary size-4" aria-hidden="true" />
            <h3 className="text-sm font-semibold">AI summary on the way</h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This thread is still being analyzed. Message summaries and categories
            will appear shortly — the full email content below is already
            available to read.
          </p>
          {percent !== null && percent > 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              Inbox analysis {percent}% complete
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
