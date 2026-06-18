import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useStartSync } from "@/hooks/useSync";

export function DashboardPage() {
  const { refreshProfile } = useAuth();
  const startSync = useStartSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const autoSyncTriggered = useRef(false);

  useEffect(() => {
    const gmailStatus = searchParams.get("gmail");
    if (!gmailStatus) return;

    if (gmailStatus === "connected") {
      setNotice("Gmail connected successfully. Starting inbox sync…");
      void refreshProfile().then(() => {
        if (!autoSyncTriggered.current) {
          autoSyncTriggered.current = true;
          startSync.mutate();
        }
      });
    } else if (gmailStatus === "error") {
      setNotice("Failed to connect Gmail. Please try again.");
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, refreshProfile, startSync]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <>
      {notice && (
        <div
          className="bg-primary text-primary-foreground fixed top-4 right-4 z-50 rounded-lg px-4 py-2 text-sm shadow-lg"
          role="status"
          aria-live="polite"
        >
          {notice}
        </div>
      )}
      <AppShell />
    </>
  );
}
