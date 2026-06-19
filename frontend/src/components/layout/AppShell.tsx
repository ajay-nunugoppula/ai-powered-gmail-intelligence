import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ComposeContext } from "@/components/email/ComposeDrawer";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { EmailPanel } from "@/components/layout/EmailPanel";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThreadPanel } from "@/components/layout/ThreadPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useGenerateDraft, useSendEmail } from "@/hooks/useCompose";
import {
  useEnrichmentStatus,
  useStartEnrichment,
} from "@/hooks/useEnrichment";
import {
  useStartSync,
  useSyncStatus,
  useThreadDetail,
  useThreads,
} from "@/hooks/useSync";
import { ApiError } from "@/lib/api";

export function AppShell() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext | null>(
    null,
  );
  const autoSyncAttempted = useRef(false);

  const { data: syncStatus } = useSyncStatus();
  const { data: enrichmentStatus } = useEnrichmentStatus();
  const startSync = useStartSync();
  const startEnrichment = useStartEnrichment();
  const generateDraft = useGenerateDraft();
  const sendEmail = useSendEmail();
  const { data: threadsData, isLoading: threadsLoading } = useThreads(
    activeCategory,
    search,
  );
  const { data: threadDetail, isLoading: threadLoading } =
    useThreadDetail(selectedThreadId);

  const isSyncing = syncStatus?.status === "syncing";
  const isEnriching = enrichmentStatus?.status === "running";

  useEffect(() => {
    if (syncStatus?.status === "completed" || syncStatus?.status === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }, [syncStatus?.status, queryClient]);

  useEffect(() => {
    if (
      enrichmentStatus?.status === "completed" ||
      enrichmentStatus?.status === "failed"
    ) {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["thread"] });
    }
  }, [enrichmentStatus?.status, queryClient]);

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

  const handleAnalyze = () => {
    startEnrichment.mutate();
  };

  const handleOpenCompose = (context: ComposeContext) => {
    setComposeContext(context);
    setComposeOpen(true);
  };

  const handleCloseCompose = () => {
    setComposeOpen(false);
    setComposeContext(null);
    generateDraft.reset();
    sendEmail.reset();
  };

  const composeError =
    (generateDraft.error instanceof ApiError
      ? generateDraft.error.message
      : generateDraft.error?.message) ||
    (sendEmail.error instanceof ApiError
      ? sendEmail.error.message
      : sendEmail.error?.message) ||
    null;

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
          enrichmentStatus={enrichmentStatus}
          isSyncing={isSyncing || startSync.isPending}
          isEnriching={isEnriching || startEnrichment.isPending}
          onSelectThread={setSelectedThreadId}
          onSync={handleSync}
          onAnalyze={handleAnalyze}
        />
        <EmailPanel
          thread={threadDetail?.thread ?? null}
          messages={threadDetail?.messages ?? []}
          isLoading={threadLoading}
          gmailConnected={profile?.gmail_connected ?? false}
          composeOpen={composeOpen}
          composeContext={composeContext}
          onOpenCompose={handleOpenCompose}
          onCloseCompose={handleCloseCompose}
          onGenerateDraft={(payload) => generateDraft.mutateAsync(payload)}
          onSendEmail={async (payload) => {
            await sendEmail.mutateAsync(payload);
            void queryClient.invalidateQueries({ queryKey: ["threads"] });
            void queryClient.invalidateQueries({ queryKey: ["thread"] });
          }}
          isGenerating={generateDraft.isPending}
          isSending={sendEmail.isPending}
          composeError={composeError}
        />
        <ChatPanel />
      </div>
    </div>
  );
}
