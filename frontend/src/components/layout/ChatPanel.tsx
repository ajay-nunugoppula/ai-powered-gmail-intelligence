import { Bot, History, Loader2, PanelRightClose, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/common/MarkdownText";
import { ChatHistory } from "@/components/layout/ChatHistory";
import { useLayout } from "@/contexts/LayoutContext";
import {
  useChatSession,
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useSendChatMessage,
} from "@/hooks/useChat";
import { ApiError, type ChatCitation, type ChatSession } from "@/lib/api";
import { formatPreviewText } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Summarize all emails from this month",
  "Which companies rejected my job application?",
  "List important tech news from newsletters",
];

interface ChatPanelProps {
  mode: "docked" | "overlay";
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
            "bg-card/90 w-full rounded-md border px-2 py-1.5 text-left text-[11px]",
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
  mode,
  gmailConnected,
  inboxIndexed,
  onSelectThread,
}: ChatPanelProps) {
  const { closeChat, toggleChat, isMobile } = useLayout();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoCreateAttempted = useRef(false);

  const { data: sessionsData, isSuccess: sessionsLoaded } = useChatSessions();
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const { data: sessionDetail, isLoading: sessionLoading } =
    useChatSession(activeSessionId);
  const sendMessage = useSendChatMessage(activeSessionId);

  const sessions = sessionsData?.items ?? [];
  const activeSession = sessions.find((s) => s.id === activeSessionId);

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
    if (!isMobile || mode !== "overlay") return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mode]);

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
    setShowHistory(false);
    createSession.mutate(undefined, {
      onSuccess: (data) => setActiveSessionId(data.session.id),
    });
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setShowHistory(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession.mutateAsync(sessionId);
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setActiveSessionId(remaining[0]?.id ?? null);
      if (remaining.length === 0) {
        autoCreateAttempted.current = false;
        handleNewChat();
      }
    }
  };

  const handleCitationClick = (threadId: string) => {
    onSelectThread?.(threadId);
    if (isMobile) closeChat();
  };

  const disabled = !gmailConnected || !activeSessionId;

  if (mode === "overlay") {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-[1px]"
          aria-label="Close AI assistant"
          onClick={closeChat}
        />
        <aside
          className={cn(
            "bg-background fixed z-[60] flex min-h-0 flex-col shadow-2xl",
            isMobile
              ? "inset-0"
              : "inset-y-0 right-0 w-full max-w-md border-l",
          )}
          aria-label="AI assistant"
        >
          {renderContent({
            disabled,
            handleSend,
            handleNewChat,
            handleCitationClick,
            onClose: closeChat,
            showClose: true,
            inputId: "chat-input-overlay",
            showHistory,
            onToggleHistory: () => setShowHistory((open) => !open),
            sessions,
            activeSession,
            onSelectSession: handleSelectSession,
            onDeleteSession: (id) => void handleDeleteSession(id),
            isDeletingSession: deleteSession.isPending,
          })}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="bg-background flex min-h-0 w-80 shrink-0 flex-col border-l xl:w-96"
      aria-label="AI assistant"
    >
      {renderContent({
        disabled,
        handleSend,
        handleNewChat,
        handleCitationClick,
        onClose: toggleChat,
        showClose: true,
        closeLabel: "Collapse assistant",
        inputId: "chat-input-docked",
        showHistory,
        onToggleHistory: () => setShowHistory((open) => !open),
        sessions,
        activeSession,
        onSelectSession: handleSelectSession,
        onDeleteSession: (id) => void handleDeleteSession(id),
        isDeletingSession: deleteSession.isPending,
      })}
    </aside>
  );

  function renderContent({
    disabled,
    handleSend,
    handleNewChat,
    handleCitationClick,
    onClose,
    showClose,
    closeLabel = "Close assistant",
    inputId = "chat-input",
    showHistory = false,
    onToggleHistory,
    sessions = [],
    activeSession,
    onSelectSession,
    onDeleteSession,
    isDeletingSession,
  }: {
    disabled: boolean;
    handleSend: (content: string) => Promise<void>;
    handleNewChat: () => void;
    handleCitationClick: (threadId: string) => void;
    onClose: () => void;
    showClose: boolean;
    closeLabel?: string;
    inputId?: string;
    showHistory?: boolean;
    onToggleHistory?: () => void;
    sessions?: ChatSession[];
    activeSession?: ChatSession;
    onSelectSession?: (sessionId: string) => void;
    onDeleteSession?: (sessionId: string) => void;
    isDeletingSession?: boolean;
  }) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Bot className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">AI Assistant</h2>
                <p className="text-muted-foreground truncate text-xs">
                  {showHistory
                    ? `${sessions.length} saved conversation${sessions.length === 1 ? "" : "s"}`
                    : activeSession?.title
                      ? formatPreviewText(activeSession.title)
                      : gmailConnected
                        ? inboxIndexed
                          ? "Ask about your synced emails"
                          : "Run Analyze inbox to enable search"
                        : "Connect Gmail to start chatting"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant={showHistory ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
                onClick={onToggleHistory}
                disabled={!gmailConnected}
                aria-label="Previous chats"
                title="Previous chats"
              >
                <History className="size-4" />
              </Button>
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
              {showClose && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onClose}
                  aria-label={closeLabel}
                >
                  {mode === "docked" ? (
                    <PanelRightClose className="size-4" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto p-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {showHistory ? (
            <ChatHistory
              sessions={sessions}
              activeSessionId={activeSession?.id ?? null}
              onSelect={(id) => onSelectSession?.(id)}
              onDelete={(id) => onDeleteSession?.(id)}
              onClose={() => onToggleHistory?.()}
              isDeleting={isDeletingSession}
            />
          ) : (
          <div className="flex flex-col gap-3">
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
                        onSelectThread={handleCitationClick}
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
          )}
        </div>

        {error && !showHistory && (
          <p className="text-destructive shrink-0 px-4 pb-2 text-xs" role="alert">
            {error}
          </p>
        )}

        {!showHistory && (
        <form
          className="bg-background shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend(draft);
          }}
        >
          <div className="flex items-end gap-2">
            <label htmlFor={inputId} className="sr-only">
              Message
            </label>
            <textarea
              id={inputId}
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
        )}
      </div>
    );
  }
}
