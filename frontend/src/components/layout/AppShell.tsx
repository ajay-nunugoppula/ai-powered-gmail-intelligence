import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ComposeContext } from "@/components/email/ComposeDrawer";
import { ChatFab } from "@/components/layout/ChatFab";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { EmailPanel } from "@/components/layout/EmailPanel";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThreadPanel } from "@/components/layout/ThreadPanel";
import { PipelineStatusBanner } from "@/components/sync/PipelineStatusBanner";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
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
import { cn } from "@/lib/utils";

function AppShellContent() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const {
    isMobile,
    isWide,
    chatOpen,
    mobileView,
    showMobileEmail,
    showMobileThreads,
    closeChat,
  } = useLayout();

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
  const { data: appConfig } = useAppConfig();
  const startSync = useStartSync();
  const startEnrichment = useStartEnrichment();
  const generateDraft = useGenerateDraft();
  const sendEmail = useSendEmail();

  const isSyncing = syncStatus?.status === "syncing";
  const isEnriching = enrichmentStatus?.status === "running";
  const pipelineActive =
    isSyncing ||
    isEnriching ||
    startSync.isPending ||
    startEnrichment.isPending;

  const { data: threadsData, isLoading: threadsLoading } = useThreads(
    activeCategory,
    search,
    { liveRefresh: pipelineActive },
  );
  const { data: threadDetail, isLoading: threadLoading } = useThreadDetail(
    selectedThreadId,
    { liveRefresh: pipelineActive },
  );

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

  useEffect(() => {
    if (isMobile && selectedThreadId) {
      showMobileEmail();
    }
  }, [isMobile, selectedThreadId, showMobileEmail]);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (isMobile) {
      closeChat();
      showMobileEmail();
    }
  };

  const handleBackToThreads = () => {
    setSelectedThreadId(null);
    showMobileThreads();
  };

  const handleSync = () => startSync.mutate();
  const handleAnalyze = () => startEnrichment.mutate();

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

  const showThreadList = !isMobile || (mobileView === "threads" && !chatOpen);
  const showEmailPanel =
    !isMobile || (mobileView === "email" && !chatOpen && Boolean(selectedThreadId));
  const showEmailEmpty = !isMobile && !selectedThreadId;
  const showChatOverlay = chatOpen && (!isWide || isMobile);
  const showChatDocked = chatOpen && isWide;

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PipelineStatusBanner
          syncStatus={syncStatus}
          enrichmentStatus={enrichmentStatus}
          appConfig={appConfig}
          threadCount={threadsData?.items.length ?? 0}
          isSyncPending={startSync.isPending}
          isEnrichPending={startEnrichment.isPending}
          onRetrySync={handleSync}
          onRetryAnalyze={handleAnalyze}
        />
        <div
          className={cn(
            "flex min-h-0 flex-1",
            isMobile && !chatOpen && "pb-14",
          )}
        >
          {showThreadList && (
            <ThreadPanel
              gmailConnected={profile?.gmail_connected ?? false}
              threads={threadsData?.items ?? []}
              isLoading={threadsLoading}
              selectedThreadId={selectedThreadId}
              syncStatus={syncStatus}
              isSyncing={isSyncing || startSync.isPending}
              isEnriching={isEnriching || startEnrichment.isPending}
              syncDaysBack={appConfig?.sync_days_back}
              onSelectThread={handleSelectThread}
              onSync={handleSync}
              onAnalyze={handleAnalyze}
              className={cn(isMobile ? "w-full border-r-0" : "w-80")}
            />
          )}

          {(showEmailPanel || showEmailEmpty) && (
            <EmailPanel
              thread={threadDetail?.thread ?? null}
              messages={threadDetail?.messages ?? []}
              isLoading={threadLoading}
              gmailConnected={profile?.gmail_connected ?? false}
              userEmail={profile?.email}
              isEnriching={isEnriching || startEnrichment.isPending}
              enrichmentProgress={
                enrichmentStatus?.status === "running"
                  ? {
                      processed: enrichmentStatus.processed,
                      total: enrichmentStatus.total,
                    }
                  : undefined
              }
              composeOpen={composeOpen}
              composeContext={composeContext}
              onOpenCompose={handleOpenCompose}
              onCloseCompose={handleCloseCompose}
              onGenerateDraft={(payload) => generateDraft.mutateAsync(payload)}
              onSendEmail={async (payload) => {
                await sendEmail.mutateAsync(payload);
                await queryClient.invalidateQueries({ queryKey: ["threads"] });
                await queryClient.invalidateQueries({
                  queryKey: ["thread", selectedThreadId],
                });
              }}
              isGenerating={generateDraft.isPending}
              isSending={sendEmail.isPending}
              composeError={composeError}
              onBack={isMobile ? handleBackToThreads : undefined}
              className={cn(isMobile && "w-full")}
            />
          )}

          {showChatDocked && (
            <ChatPanel
              mode="docked"
              gmailConnected={profile?.gmail_connected ?? false}
              inboxIndexed={enrichmentStatus?.status === "completed"}
              isEnriching={isEnriching || startEnrichment.isPending}
              enrichmentProgress={
                enrichmentStatus?.status === "running"
                  ? {
                      processed: enrichmentStatus.processed,
                      total: enrichmentStatus.total,
                    }
                  : undefined
              }
              onSelectThread={handleSelectThread}
            />
          )}
        </div>

        {isMobile && !chatOpen && (
          <MobileNav hasSelectedThread={Boolean(selectedThreadId)} />
        )}
      </div>

      {showChatOverlay && (
        <ChatPanel
          mode="overlay"
          gmailConnected={profile?.gmail_connected ?? false}
          inboxIndexed={enrichmentStatus?.status === "completed"}
          isEnriching={isEnriching || startEnrichment.isPending}
          enrichmentProgress={
            enrichmentStatus?.status === "running"
              ? {
                  processed: enrichmentStatus.processed,
                  total: enrichmentStatus.total,
                }
              : undefined
          }
          onSelectThread={handleSelectThread}
        />
      )}

      <ChatFab />
    </div>
  );
}

export function AppShell() {
  return (
    <LayoutProvider>
      <AppShellContent />
    </LayoutProvider>
  );
}
