import { ArrowLeft, Bot, Mail, PenSquare, Reply } from "lucide-react";

import { AiSummaryCard } from "@/components/email/AiSummaryCard";
import { EmailBody } from "@/components/email/EmailBody";
import {
  ComposeDrawer,
  type ComposeContext,
} from "@/components/email/ComposeDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/contexts/LayoutContext";
import type { ComposeDraft, MessageItem, ThreadItem } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/dates";
import { formatPreviewText } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

interface EmailPanelProps {
  thread: ThreadItem | null;
  messages: MessageItem[];
  isLoading: boolean;
  gmailConnected: boolean;
  composeOpen: boolean;
  composeContext: ComposeContext | null;
  onOpenCompose: (context: ComposeContext) => void;
  onCloseCompose: () => void;
  onGenerateDraft: (payload: {
    mode: "reply" | "compose";
    thread_id?: string | null;
    message_id?: string | null;
    to: string[];
    cc: string[];
    subject?: string;
    tone: string;
    instructions?: string;
  }) => Promise<ComposeDraft>;
  onSendEmail: (payload: {
    to: string[];
    cc: string[];
    subject: string;
    body: string;
    thread_id?: string | null;
    reply_to_message_id?: string | null;
  }) => Promise<void>;
  isGenerating: boolean;
  isSending: boolean;
  composeError?: string | null;
  onBack?: () => void;
  className?: string;
}

export function EmailPanel({
  thread,
  messages,
  isLoading,
  gmailConnected,
  composeOpen,
  composeContext,
  onOpenCompose,
  onCloseCompose,
  onGenerateDraft,
  onSendEmail,
  isGenerating,
  isSending,
  composeError,
  onBack,
  className,
}: EmailPanelProps) {
  const { openChat, isWide } = useLayout();

  if (!thread) {
    return (
      <section
        className={cn(
          "bg-background relative flex min-w-0 flex-1 flex-col",
          className,
        )}
        aria-label="Email content"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Mail className="text-muted-foreground size-12" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Select a thread</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Choose a conversation from the thread list to view messages, AI
            summaries, and replies.
          </p>
          {gmailConnected && (
            <Button
              variant="outline"
              onClick={() =>
                onOpenCompose({
                  mode: "compose",
                  threadId: null,
                  messageId: null,
                })
              }
            >
              <PenSquare className="size-4" aria-hidden="true" />
              Compose new email
            </Button>
          )}
        </div>

        <ComposeDrawer
          open={composeOpen}
          context={composeContext}
          onClose={onCloseCompose}
          onGenerate={onGenerateDraft}
          onSend={onSendEmail}
          isGenerating={isGenerating}
          isSending={isSending}
          error={composeError}
        />
      </section>
    );
  }

  return (
    <section
      className={cn(
        "bg-background relative flex min-w-0 flex-1 flex-col",
        className,
      )}
      aria-label="Email content"
    >
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold sm:text-lg">
                  {formatPreviewText(thread.subject || "(No subject)")}
                </h2>
              {thread.category?.name && (
                <Badge
                  variant="secondary"
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
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {thread.participant_emails.join(", ")}
            </p>
            </div>
          </div>
          {gmailConnected && (
            <div className="flex flex-wrap gap-2">
              {!isWide && (
                <Button variant="outline" size="sm" onClick={openChat}>
                  <Bot className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">AI</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOpenCompose({
                    mode: "compose",
                    threadId: thread.id,
                    messageId: null,
                    defaultSubject: thread.subject ?? undefined,
                  })
                }
              >
                <PenSquare className="size-4" aria-hidden="true" />
                Compose
              </Button>
              {messages.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const latest = messages[messages.length - 1];
                    onOpenCompose({
                      mode: "reply",
                      threadId: thread.id,
                      messageId: latest.id,
                      defaultSubject: latest.subject ?? thread.subject ?? undefined,
                      defaultTo: [latest.from_email],
                    });
                  }}
                >
                  <Reply className="size-4" aria-hidden="true" />
                  Reply
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32 sm:p-6 sm:pb-48">
        {isLoading && (
          <p className="text-muted-foreground text-sm" role="status">
            Loading messages…
          </p>
        )}

        {!isLoading && (
          <div className="space-y-6">
            {thread.thread_summary && (
              <AiSummaryCard
                title="Thread summary"
                summary={thread.thread_summary}
              />
            )}

            {messages.map((message) => (
              <article
                key={message.id}
                className="rounded-xl border p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{message.from_email}</p>
                      {message.category?.name && (
                        <Badge variant="outline" className="text-[10px]">
                          {message.category.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      To: {message.to_emails.join(", ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {gmailConnected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onOpenCompose({
                            mode: "reply",
                            threadId: thread.id,
                            messageId: message.id,
                            defaultSubject:
                              message.subject ?? thread.subject ?? undefined,
                            defaultTo: [message.from_email],
                          })
                        }
                      >
                        <Reply className="size-4" aria-hidden="true" />
                        Reply
                      </Button>
                    )}
                    <time
                      className="text-muted-foreground text-xs"
                      dateTime={message.received_at}
                    >
                      {formatDistanceToNow(new Date(message.received_at))}
                    </time>
                  </div>
                </div>

                {message.summary && (
                  <div className="bg-muted/50 mb-3 rounded-lg p-3">
                    <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                      AI summary
                    </p>
                    <p className="text-sm leading-relaxed">{message.summary}</p>
                  </div>
                )}

                <EmailBody
                  bodyText={message.body_text}
                  bodyHtml={message.body_html}
                />
              </article>
            ))}
          </div>
        )}
      </div>

      <ComposeDrawer
        open={composeOpen}
        context={composeContext}
        onClose={onCloseCompose}
        onGenerate={onGenerateDraft}
        onSend={onSendEmail}
        isGenerating={isGenerating}
        isSending={isSending}
        error={composeError}
      />
    </section>
  );
}
