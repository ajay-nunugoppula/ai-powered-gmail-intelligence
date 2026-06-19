import { Bot, Inbox } from "lucide-react";

import { useLayout } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  hasSelectedThread: boolean;
}

export function MobileNav({ hasSelectedThread }: MobileNavProps) {
  const { mobileView, showMobileThreads, openChat, chatOpen, closeChat } =
    useLayout();

  return (
    <nav
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      <button
        type="button"
        onClick={() => {
          closeChat();
          showMobileThreads();
        }}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors",
          mobileView === "threads" && !chatOpen
            ? "text-primary font-medium"
            : "text-muted-foreground",
        )}
      >
        <Inbox className="size-5" aria-hidden="true" />
        Inbox
      </button>
      <button
        type="button"
        onClick={() => {
          if (chatOpen) {
            closeChat();
            if (hasSelectedThread) return;
          } else {
            openChat();
          }
        }}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors",
          chatOpen ? "text-primary font-medium" : "text-muted-foreground",
        )}
      >
        <Bot className="size-5" aria-hidden="true" />
        AI Assistant
      </button>
    </nav>
  );
}
