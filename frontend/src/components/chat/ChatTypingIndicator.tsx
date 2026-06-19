export function ChatTypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="bg-muted flex items-center gap-1.5 rounded-xl border px-4 py-3"
        role="status"
        aria-live="polite"
        aria-label="Assistant is typing"
      >
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  );
}
