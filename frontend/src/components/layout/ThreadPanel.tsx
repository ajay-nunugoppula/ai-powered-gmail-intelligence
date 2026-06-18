import { Inbox, MailOpen, RefreshCw } from "lucide-react";

import {
  SyncProgressBar,
} from "@/components/sync/SyncProgressBar";
import { Button } from "@/components/ui/button";
import type { SyncStatus, ThreadItem } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/dates";
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
  isSyncing: boolean;
  onSelectThread: (threadId: string) => void;
  onSync: () => void;
}

export function ThreadPanel({
  gmailConnected,
  threads,
  isLoading,
  selectedThreadId,
  syncStatus,
  isSyncing,
  onSelectThread,
  onSync,
}: ThreadPanelProps) {
  return (
    <section
      className="bg-background flex w-80 shrink-0 flex-col border-r"
      aria-label="Thread list"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Inbox</h2>
          <p className="text-muted-foreground text-xs">
            {threads.length > 0
              ? `${threads.length} threads`
              : "Your synced conversations"}
          </p>
        </div>
        {gmailConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            aria-label="Sync inbox"
          >
            <RefreshCw
              className={cn("size-4", isSyncing && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
        )}
      </div>

      <SyncProgressBar syncStatus={syncStatus} />

      <div className="flex-1 overflow-y-auto">
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
                {thread.subject || "(No subject)"}
              </p>
              <span className="text-muted-foreground shrink-0 text-[11px]">
                {formatThreadDate(thread.last_message_at)}
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {thread.snippet || "No preview available"}
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
