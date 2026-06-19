import { Loader2, Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GmailConnectDialogProps {
  open: boolean;
  connecting: boolean;
  onConnect: () => void;
}

export function GmailConnectDialog({
  open,
  connecting,
  onConnect,
}: GmailConnectDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-connect-title"
    >
      <div className="bg-card w-full max-w-md rounded-xl border p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="gmail-connect-title" className="text-lg font-semibold">
              Connect Gmail
            </h2>
            <p className="text-muted-foreground text-sm">
              Required to sync and analyze your inbox
            </p>
          </div>
        </div>

        <ul className="text-muted-foreground mb-6 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
            AI summaries, categories, and search across your emails
          </li>
          <li className="flex items-start gap-2">
            <Mail className="text-primary mt-0.5 size-4 shrink-0" />
            Compose and reply directly from the dashboard
          </li>
        </ul>

        <Button
          className="h-11 w-full"
          onClick={onConnect}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Redirecting to Google…
            </>
          ) : (
            "Connect Gmail"
          )}
        </Button>
      </div>
    </div>
  );
}
