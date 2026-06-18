import { useState } from "react";

import { ChatPanel } from "@/components/layout/ChatPanel";
import { EmailPanel } from "@/components/layout/EmailPanel";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThreadPanel } from "@/components/layout/ThreadPanel";
import { useAuth } from "@/contexts/AuthContext";

export function AppShell() {
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("all");

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <div className="flex min-w-0 flex-1">
        <ThreadPanel gmailConnected={profile?.gmail_connected ?? false} />
        <EmailPanel />
        <ChatPanel />
      </div>
    </div>
  );
}
