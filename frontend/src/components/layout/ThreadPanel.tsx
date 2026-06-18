import { Inbox, MailOpen } from "lucide-react";

interface ThreadPanelProps {
  gmailConnected: boolean;
}

export function ThreadPanel({ gmailConnected }: ThreadPanelProps) {
  return (
    <section
      className="bg-background flex w-80 shrink-0 flex-col border-r"
      aria-label="Thread list"
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Inbox</h2>
        <p className="text-muted-foreground text-xs">Threads will appear after sync</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        {gmailConnected ? (
          <>
            <MailOpen className="text-muted-foreground size-10" aria-hidden="true" />
            <p className="text-sm font-medium">No threads yet</p>
            <p className="text-muted-foreground text-xs">
              Sync starts in Phase 2. Your inbox will show up here.
            </p>
          </>
        ) : (
          <>
            <Inbox className="text-muted-foreground size-10" aria-hidden="true" />
            <p className="text-sm font-medium">Connect Gmail to begin</p>
            <p className="text-muted-foreground text-xs">
              Use the sidebar button to authorize Gmail access.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
