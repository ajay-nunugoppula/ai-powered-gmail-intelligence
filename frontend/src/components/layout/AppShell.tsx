import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { GmailConnectDialog } from "@/components/auth/GmailConnectDialog";
import type { ComposeContext } from "@/components/email/ComposeDrawer";
import { DashboardLoader } from "@/components/common/DashboardLoader";
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
import { useInboxPipeline } from "@/hooks/useInboxPipeline";
import {
  useStartSync,
  useSyncStatus,
  useThreadDetail,
  useThreads,
} from "@/hooks/useSync";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function AppShellContent() {
  const { profile, profileLoading, connectGmail } = useAuth();
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
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [pipelineWatch, setPipelineWatch] = useState(false);

  const startSync = useStartSync();
  const startEnrichment = useStartEnrichment();

  const { data: syncStatus, isLoading: syncStatusLoading } = useSyncStatus({
    watchPipeline: pipelineWatch || startSync.isPending,
  });
  const { data: enrichmentStatus } = useEnrichmentStatus({
    watchPipeline: pipelineWatch,
  });
  const { data: appConfig } = useAppConfig();
  const generateDraft = useGenerateDraft();
  const sendEmail = useSendEmail();

  const { liveRefresh, awaitingAnalysis, isSyncing, isEnriching } =
    useInboxPipeline({
      gmailConnected: profile?.gmail_connected ?? false,
      syncStatus,
      enrichmentStatus,
      enrichmentAutoStart: appConfig?.enrichment_auto_start ?? true,
      startSync,
      startEnrichment,
    });

  useEffect(() => {
    setPipelineWatch(
      awaitingAnalysis || isSyncing || isEnriching || startSync.isPending,
    );
  }, [awaitingAnalysis, isSyncing, isEnriching, startSync.isPending]);

  const { data: threadsData, isLoading: threadsLoading } = useThreads(
    activeCategory,
    search,
    { liveRefresh },
  );
  const { data: threadDetail, isLoading: threadLoading } = useThreadDetail(
    selectedThreadId,
    { liveRefresh },
  );

  useEffect(() => {
    if (syncStatus?.status === "syncing") {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  }, [syncStatus?.status, syncStatus?.progress?.processed, queryClient]);

  useEffect(() => {
    if (syncStatus?.status === "completed" || syncStatus?.status === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["enrichment-status"] });
    }
  }, [syncStatus?.status, queryClient]);

  useEffect(() => {
    if (
      enrichmentStatus?.status === "running" ||
      enrichmentStatus?.status === "completed" ||
      enrichmentStatus?.status === "failed"
    ) {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["thread"] });
    }
  }, [
    enrichmentStatus?.status,
    enrichmentStatus?.processed,
    queryClient,
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

  const handleSync = () => {
    startSync.mutate();
  };
  const handleAnalyze = () => startEnrichment.mutate();

  const handleConnectGmail = () => {
    setConnectingGmail(true);
    void connectGmail().catch(() => setConnectingGmail(false));
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

  const isBootstrapping =
    profileLoading ||
    syncStatusLoading ||
    (profile?.gmail_connected && threadsLoading && threadsData === undefined);

  const showGmailConnectDialog =
    !profileLoading && Boolean(profile) && !profile?.gmail_connected;

  const showThreadList = !isMobile || (mobileView === "threads" && !chatOpen);
  const showEmailPanel =
    !isMobile || (mobileView === "email" && !chatOpen && Boolean(selectedThreadId));
  const showEmailEmpty = !isMobile && !selectedThreadId;
  const showChatOverlay = chatOpen && (!isWide || isMobile);
  const showChatDocked = chatOpen && isWide;

  if (isBootstrapping) {
    return (
      <DashboardLoader
        message={
          profileLoading
            ? "Loading your profile…"
            : "Preparing your inbox…"
        }
      />
    );
  }

  return (
    <div className="flex h-svh overflow-hidden">
      <GmailConnectDialog
        open={showGmailConnectDialog}
        connecting={connectingGmail}
        onConnect={handleConnectGmail}
      />

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
          awaitingAnalysis={awaitingAnalysis}
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
              isSyncing={isSyncing}
              isEnriching={isEnriching}
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
              isEnriching={isEnriching}
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
                startEnrichment.mutate();
                await queryClient.invalidateQueries({ queryKey: ["enrichment-status"] });
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
              isEnriching={isEnriching}
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
          isEnriching={isEnriching}
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
