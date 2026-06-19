import { History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatSession } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/dates";
import { formatPreviewText } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
  isDeleting?: boolean;
}

function formatSessionDate(value: string) {
  try {
    return formatDistanceToNow(new Date(value));
  } catch {
    return "";
  }
}

export function ChatHistory({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onClose,
  isDeleting,
}: ChatHistoryProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground size-4" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Previous chats</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Back
        </Button>
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No saved conversations yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {sessions.map((session) => (
            <li key={session.id}>
              <div
                className={cn(
                  "group flex items-start gap-1 rounded-lg border transition-colors",
                  activeSessionId === session.id
                    ? "border-primary/30 bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className="min-w-0 flex-1 px-3 py-2.5 text-left"
                >
                  <p className="line-clamp-2 text-sm font-medium">
                    {formatPreviewText(session.title || "New conversation")}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {formatSessionDate(session.updated_at)}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive mt-1 size-8 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  disabled={isDeleting}
                  aria-label={`Delete ${session.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(session.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
