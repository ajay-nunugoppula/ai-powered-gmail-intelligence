import { Bot, Loader2, Plus, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/common/MarkdownText";
import {
  useChatSession,
  useChatSessions,
  useCreateChatSession,
  useSendChatMessage,
} from "@/hooks/useChat";
import { ApiError, type ChatCitation } from "@/lib/api";
import { formatPreviewText } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Summarize all emails from this month",
  "Which companies rejected my job application?",
  "List important tech news from newsletters",
];

interface ChatPanelProps {
  gmailConnected: boolean;
  inboxIndexed: boolean;
  onSelectThread?: (threadId: string) => void;
}

function CitationList({
  citations,
  onSelectThread,
}: {
  citations: ChatCitation[];
  onSelectThread?: (threadId: string) => void;
}) {
  if (!citations.length) return null;

  return (
    <div className="mt-2 space-y-1" aria-label="Sources">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        Sources
      </p>
      {citations.map((citation) => (
        <button
          key={`${citation.message_id}-${citation.index}`}
          type="button"
          disabled={!citation.thread_id || !onSelectThread}
          onClick={() => citation.thread_id && onSelectThread?.(citation.thread_id)}
          className={cn(
            "bg-background/80 w-full rounded-md border px-2 py-1.5 text-left text-[11px]",
            citation.thread_id && onSelectThread
              ? "hover:bg-accent cursor-pointer"
              : "cursor-default opacity-80",
          )}
        >
          <span className="text-primary font-medium">[{citation.index}]</span>{" "}
          <span className="font-medium">
            {formatPreviewText(citation.subject || "(No subject)")}
          </span>
          {citation.from_email && (
            <span className="text-muted-foreground"> · {citation.from_email}</span>
          )}
          {citation.snippet && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2">
              {formatPreviewText(citation.snippet)}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

export function ChatPanel({
  gmailConnected,
  inboxIndexed,
  onSelectThread,
}: ChatPanelProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoCreateAttempted = useRef(false);

  const { data: sessionsData, isSuccess: sessionsLoaded } = useChatSessions();
  const createSession = useCreateChatSession();
  const { data: sessionDetail, isLoading: sessionLoading } =
    useChatSession(activeSessionId);
  const sendMessage = useSendChatMessage(activeSessionId);

  const messages = sessionDetail?.messages ?? [];
  const isSending = sendMessage.isPending;
  const error =
    sendMessage.error instanceof ApiError
      ? sendMessage.error.message
      : sendMessage.error?.message ?? null;

  useEffect(() => {
    if (activeSessionId) return;
    const existing = sessionsData?.items?.[0];
    if (existing) {
      setActiveSessionId(existing.id);
      return;
    }
    if (
      gmailConnected &&
      sessionsLoaded &&
      !autoCreateAttempted.current &&
      !createSession.isPending
    ) {
      autoCreateAttempted.current = true;
      createSession.mutate(undefined, {
        onSuccess: (data) => setActiveSessionId(data.session.id),
      });
    }
  }, [
    activeSessionId,
    sessionsData?.items,
    sessionsLoaded,
    gmailConnected,
    createSession.isPending,
    createSession.mutate,
  ]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length, isSending]);

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !activeSessionId || isSending) return;
    setDraft("");
    await sendMessage.mutateAsync(trimmed);
  };

  const handleNewChat = () => {
    createSession.mutate(undefined, {
      onSuccess: (data) => setActiveSessionId(data.session.id),
    });
  };

  const disabled = !gmailConnected || !activeSessionId;

  return (
    <aside
      className="bg-background hidden w-96 shrink-0 flex-col border-l xl:flex"
      aria-label="AI assistant"
    >
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="size-4" aria-hidden="true" />
            <h2 className="text-sm font-semibold">AI Assistant</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleNewChat}
            disabled={!gmailConnected || createSession.isPending}
            aria-label="New conversation"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {gmailConnected
            ? inboxIndexed
              ? "Ask questions about your synced emails"
              : "Run Analyze inbox to enable search"
            : "Connect Gmail to start chatting"}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!gmailConnected && (
          <p className="text-muted-foreground text-center text-sm">
            Connect Gmail from the sidebar to chat with your inbox.
          </p>
        )}

        {gmailConnected && sessionLoading && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading conversation…
          </div>
        )}

        {gmailConnected && !sessionLoading && messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
              <Sparkles className="size-3" aria-hidden="true" />
              Suggested prompts
            </p>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={disabled || isSending}
                onClick={() => void handleSend(prompt)}
                className="bg-muted/50 hover:bg-muted w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn("flex", isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted border",
                )}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <MarkdownText content={message.content} />
                )}
                {!isUser && (
                  <CitationList
                    citations={message.citations}
                    onSelectThread={onSelectThread}
                  />
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-muted flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Searching your inbox…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive px-4 pb-2 text-xs" role="alert">
          {error}
        </p>
      )}

      <form
        className="border-t p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend(draft);
              }
            }}
            disabled={disabled || isSending}
            placeholder={
              gmailConnected ? "Ask about your emails…" : "Connect Gmail first"
            }
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[72px] flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
          <Button
            type="submit"
            size="icon"
            disabled={disabled || isSending || !draft.trim()}
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </form>
    </aside>
  );
}
