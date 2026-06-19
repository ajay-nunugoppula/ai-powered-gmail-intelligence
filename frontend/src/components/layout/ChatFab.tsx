import { Bot } from "lucide-react";

import { useLayout } from "@/contexts/LayoutContext";

export function ChatFab() {
  const { openChat, isWide, chatOpen } = useLayout();

  if (!isWide || chatOpen) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={openChat}
      className="bg-primary text-primary-foreground fixed right-6 bottom-6 z-30 flex size-14 items-center justify-center rounded-full shadow-lg ring-4 ring-primary/25 transition-transform hover:scale-105 hover:shadow-xl focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-4"
      aria-label="Open AI assistant"
      title="Open AI assistant"
    >
      <Bot className="size-6" aria-hidden="true" />
    </button>
  );
}
