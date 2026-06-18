import { Mail } from "lucide-react";

export function EmailPanel() {
  return (
    <section
      className="bg-background flex min-w-0 flex-1 flex-col"
      aria-label="Email content"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Mail className="text-muted-foreground size-12" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Select a thread</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Choose a conversation from the thread list to view messages, AI
          summaries, and reply options.
        </p>
      </div>
    </section>
  );
}
