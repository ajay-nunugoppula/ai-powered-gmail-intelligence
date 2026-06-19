import { ArrowLeft, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ThreadItem } from "@/lib/api";
import { formatPreviewText } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

interface ThreadViewLoaderProps {
  previewThread?: ThreadItem | null;
  onBack?: () => void;
  className?: string;
}

function MessageSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border p-4 shadow-sm" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="bg-muted h-4 w-32 rounded" />
        <div className="bg-muted h-3 w-20 rounded" />
      </div>
      <div className="bg-muted mb-2 h-3 w-full rounded" />
      <div className="bg-muted mb-2 h-3 w-5/6 rounded" />
      <div className="bg-muted h-3 w-2/3 rounded" />
    </div>
  );
}

export function ThreadViewLoader({
  previewThread,
  onBack,
  className,
}: ThreadViewLoaderProps) {
  return (
    <section
      className={cn(
        "bg-background relative flex min-w-0 flex-1 flex-col",
        className,
      )}
      aria-label="Loading email content"
      aria-busy="true"
    >
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-start gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 size-8 shrink-0"
              onClick={onBack}
              aria-label="Back to inbox"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            {previewThread ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold sm:text-lg">
                    {formatPreviewText(previewThread.subject || "(No subject)")}
                  </h2>
                  {previewThread.category?.name && (
                    <Badge variant="secondary" className="text-[10px]">
                      {previewThread.category.name}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {previewThread.participant_emails.join(", ")}
                </p>
              </>
            ) : (
              <div className="animate-pulse space-y-2">
                <div className="bg-muted h-5 w-3/4 max-w-md rounded" />
                <div className="bg-muted h-4 w-1/2 max-w-xs rounded" />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
        <div
          className="text-muted-foreground flex items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="text-primary size-4 shrink-0 animate-spin" aria-hidden="true" />
          Opening conversation…
        </div>
        <div className="space-y-6">
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
      </div>
    </section>
  );
}
