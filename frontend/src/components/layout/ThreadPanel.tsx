import { Inbox, Loader2, MailOpen, Menu, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLayout } from "@/contexts/LayoutContext";
import type { SyncStatus, ThreadItem } from "@/lib/api";
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

function ThreadListSkeleton() {
  return (
    <div className="space-y-0" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse border-b px-4 py-3">
          <div className="bg-muted mb-2 h-4 w-3/4 rounded" />
          <div className="bg-muted mb-2 h-3 w-1/3 rounded" />
          <div className="bg-muted h-3 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

interface ThreadPanelProps {
  gmailConnected: boolean;
  threads: ThreadItem[];
  isLoading: boolean;
  selectedThreadId: string | null;
  syncStatus?: SyncStatus;
  isSyncing: boolean;
  isEnriching: boolean;
  syncDaysBack?: number;
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
  isSyncing,
  isEnriching,
  syncDaysBack = 7,
  onSelectThread,
  onSync,
  onAnalyze,
  className,
}: ThreadPanelProps) {
  const { openSidebar, openChat, isMobile, isDesktop, isWide } = useLayout();
  const syncDaysLabel = `${syncDaysBack} day${syncDaysBack === 1 ? "" : "s"}`;

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
              {isSyncing
                ? "Importing conversations…"
                : isEnriching
                  ? "AI analysis in progress…"
                  : threads.length > 0
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

      <div className="flex-1 overflow-y-auto pb-2 md:pb-0">
        {!gmailConnected && (
          <EmptyState
            icon={Inbox}
            title="Connect Gmail to begin"
            description="Use the sidebar button to authorize Gmail access."
          />
        )}

        {gmailConnected && isLoading && threads.length === 0 && (
          <ThreadListSkeleton />
        )}

        {gmailConnected && isLoading && threads.length > 0 && (
          <p className="text-muted-foreground flex items-center gap-2 p-4 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Refreshing threads…
          </p>
        )}

        {gmailConnected && !isLoading && threads.length === 0 && (
          <EmptyState
            icon={isSyncing ? Loader2 : MailOpen}
            iconClassName={isSyncing ? "animate-spin" : undefined}
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
                  ? `Importing emails from the last ${syncDaysLabel}. Threads will appear here as they arrive.`
                  : `Click sync to import emails from the last ${syncDaysLabel}.`
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
            <div className="mb-1 flex flex-wrap items-center gap-1">
              {thread.category?.name && (
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={
                    thread.category.color
                      ? {
                          borderColor: thread.category.color,
                          color: thread.category.color,
                        }
                      : undefined
                  }
                >
                  {thread.category.name}
                </Badge>
              )}
              {isEnriching && !thread.thread_summary && !thread.category?.name && (
                <Badge variant="secondary" className="text-[10px]">
                  <Loader2
                    className="mr-1 size-3 animate-spin"
                    aria-hidden="true"
                  />
                  Analyzing
                </Badge>
              )}
            </div>
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
  iconClassName,
  title,
  description,
}: {
  icon: typeof Inbox;
  iconClassName?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon
        className={cn("text-muted-foreground size-10", iconClassName)}
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
    </div>
  );
}
