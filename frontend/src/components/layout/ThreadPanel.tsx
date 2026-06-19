import { Inbox, MailOpen, Menu, RefreshCw, Sparkles } from "lucide-react";

import {
  EnrichmentProgressBar,
} from "@/components/sync/EnrichmentProgressBar";
import {
  SyncProgressBar,
} from "@/components/sync/SyncProgressBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLayout } from "@/contexts/LayoutContext";
import type { EnrichmentStatus, SyncStatus, ThreadItem } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/dates";
import { formatPreviewText } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

function formatThreadDate(value: string | null) {
  if (!value) return "";
  try {
    return formatDistanceToNow(new Date(value));
  } catch {
    return "";
  }
}

interface ThreadPanelProps {
  gmailConnected: boolean;
  threads: ThreadItem[];
  isLoading: boolean;
  selectedThreadId: string | null;
  syncStatus?: SyncStatus;
  enrichmentStatus?: EnrichmentStatus;
  isSyncing: boolean;
  isEnriching: boolean;
  onSelectThread: (threadId: string) => void;
  onSync: () => void;
  onAnalyze: () => void;
  className?: string;
}

export function ThreadPanel({
  gmailConnected,
  threads,
  isLoading,
  selectedThreadId,
  syncStatus,
  enrichmentStatus,
  isSyncing,
  isEnriching,
  onSelectThread,
  onSync,
  onAnalyze,
  className,
}: ThreadPanelProps) {
  const { openSidebar, openChat, isMobile, isDesktop, isWide } = useLayout();

  return (
    <section
      className={cn(
        "bg-background flex shrink-0 flex-col border-r",
        className ?? "w-80",
      )}
      aria-label="Thread list"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {(isMobile || !isDesktop) && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={openSidebar}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Inbox</h2>
            <p className="text-muted-foreground truncate text-xs">
              {threads.length > 0
                ? `${threads.length} threads`
                : "Your synced conversations"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {gmailConnected && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onAnalyze}
                disabled={isSyncing || isEnriching}
                aria-label="Run AI analysis"
                title="Summarize, categorize, and embed emails"
              >
                <Sparkles
                  className={cn("size-4", isEnriching && "animate-pulse")}
                  aria-hidden="true"
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing || isEnriching}
                aria-label="Sync inbox"
              >
                <RefreshCw
                  className={cn("size-4", isSyncing && "animate-spin")}
                  aria-hidden="true"
                />
              </Button>
            </>
          )}
          {!isWide && (
            <Button
              variant="outline"
              size="sm"
              onClick={openChat}
              aria-label="Open AI assistant"
            >
              <Sparkles className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <SyncProgressBar syncStatus={syncStatus} />
      <EnrichmentProgressBar enrichmentStatus={enrichmentStatus} />

      <div className="flex-1 overflow-y-auto pb-2 md:pb-0">
        {!gmailConnected && (
          <EmptyState
            icon={Inbox}
            title="Connect Gmail to begin"
            description="Use the sidebar button to authorize Gmail access."
          />
        )}

        {gmailConnected && isLoading && (
          <p className="text-muted-foreground p-4 text-sm" role="status">
            Loading threads…
          </p>
        )}

        {gmailConnected && !isLoading && threads.length === 0 && (
          <EmptyState
            icon={MailOpen}
            title={
              syncStatus?.status === "failed"
                ? "Sync failed"
                : isSyncing
                  ? "Syncing your inbox…"
                  : "No threads yet"
            }
            description={
              syncStatus?.status === "failed"
                ? (syncStatus.progress.error ??
                  "Click the refresh button to try again.")
                : isSyncing
                  ? "Importing emails from the last 90 days."
                  : "Click sync to import emails from the last 90 days."
            }
          />
        )}

        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelectThread(thread.id)}
            className={cn(
              "hover:bg-muted/60 w-full border-b px-4 py-3 text-left transition-colors",
              selectedThreadId === thread.id && "bg-muted",
            )}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="line-clamp-1 text-sm font-medium">
                {formatPreviewText(thread.subject || "(No subject)")}
              </p>
              <span className="text-muted-foreground shrink-0 text-[11px]">
                {formatThreadDate(thread.last_message_at)}
              </span>
            </div>
            {thread.category?.name && (
              <Badge
                variant="outline"
                className="mb-1 text-[10px]"
                style={
                  thread.category.color
                    ? { borderColor: thread.category.color, color: thread.category.color }
                    : undefined
                }
              >
                {thread.category.name}
              </Badge>
            )}
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {formatPreviewText(
                thread.thread_summary || thread.snippet || "No preview available",
              )}
            </p>
            {thread.message_count > 1 && (
              <p className="text-muted-foreground mt-1 text-[11px]">
                {thread.message_count} messages
              </p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon className="text-muted-foreground size-10" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}
