import { Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { MessageItem, ThreadItem } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/dates";

interface EmailPanelProps {
  thread: ThreadItem | null;
  messages: MessageItem[];
  isLoading: boolean;
}

export function EmailPanel({ thread, messages, isLoading }: EmailPanelProps) {
  if (!thread) {
    return (
      <section
        className="bg-background flex min-w-0 flex-1 flex-col"
        aria-label="Email content"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Mail className="text-muted-foreground size-12" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Select a thread</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Choose a conversation from the thread list to view messages and AI
            summaries.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="bg-background flex min-w-0 flex-1 flex-col"
      aria-label="Email content"
    >
      <header className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {thread.subject || "(No subject)"}
          </h2>
          {thread.category?.name && (
            <Badge variant="secondary">{thread.category.name}</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {thread.participant_emails.join(", ")}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <p className="text-muted-foreground text-sm" role="status">
            Loading messages…
          </p>
        )}

        {!isLoading && (
          <div className="space-y-6">
            {messages.map((message) => (
              <article
                key={message.id}
                className="rounded-xl border p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{message.from_email}</p>
                    <p className="text-muted-foreground text-xs">
                      To: {message.to_emails.join(", ") || "—"}
                    </p>
                  </div>
                  <time
                    className="text-muted-foreground text-xs"
                    dateTime={message.received_at}
                  >
                    {formatDistanceToNow(new Date(message.received_at))}
                  </time>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.body_text || "(No text content)"}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
