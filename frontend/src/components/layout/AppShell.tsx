import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ChatPanel } from "@/components/layout/ChatPanel";
import { EmailPanel } from "@/components/layout/EmailPanel";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThreadPanel } from "@/components/layout/ThreadPanel";
import { useAuth } from "@/contexts/AuthContext";
import {
  useStartSync,
  useSyncStatus,
  useThreadDetail,
  useThreads,
} from "@/hooks/useSync";

export function AppShell() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const autoSyncAttempted = useRef(false);

  const { data: syncStatus } = useSyncStatus();
  const startSync = useStartSync();
  const { data: threadsData, isLoading: threadsLoading } = useThreads(
    activeCategory,
    search,
  );
  const { data: threadDetail, isLoading: threadLoading } =
    useThreadDetail(selectedThreadId);

  const isSyncing = syncStatus?.status === "syncing";

  useEffect(() => {
    if (syncStatus?.status === "completed" || syncStatus?.status === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }, [syncStatus?.status, queryClient]);

  useEffect(() => {
    if (!profile?.gmail_connected) {
      autoSyncAttempted.current = false;
    }
  }, [profile?.gmail_connected]);

  useEffect(() => {
    if (
      profile?.gmail_connected &&
      syncStatus?.status === "idle" &&
      !threadsLoading &&
      (threadsData?.items.length ?? 0) === 0 &&
      !startSync.isPending &&
      !isSyncing &&
      !autoSyncAttempted.current
    ) {
      autoSyncAttempted.current = true;
      startSync.mutate();
    }
  }, [
    profile?.gmail_connected,
    syncStatus?.status,
    threadsLoading,
    threadsData?.items.length,
    startSync,
    isSyncing,
  ]);

  const handleSync = () => {
    startSync.mutate();
  };

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <div className="flex min-w-0 flex-1">
        <ThreadPanel
          gmailConnected={profile?.gmail_connected ?? false}
          threads={threadsData?.items ?? []}
          isLoading={threadsLoading}
          selectedThreadId={selectedThreadId}
          syncStatus={syncStatus}
          isSyncing={isSyncing || startSync.isPending}
          onSelectThread={setSelectedThreadId}
          onSync={handleSync}
        />
        <EmailPanel
          thread={threadDetail?.thread ?? null}
          messages={threadDetail?.messages ?? []}
          isLoading={threadLoading}
        />
        <ChatPanel />
      </div>
    </div>
  );
}
