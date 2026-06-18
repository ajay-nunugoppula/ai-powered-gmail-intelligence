import { Bot, Sparkles } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "Summarize all emails from this month",
  "Which companies rejected my job application?",
  "List important tech news from newsletters",
];

export function ChatPanel() {
  return (
    <aside
      className="bg-background hidden w-96 shrink-0 flex-col border-l xl:flex"
      aria-label="AI assistant"
    >
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="size-4" aria-hidden="true" />
          <h2 className="text-sm font-semibold">AI Assistant</h2>
        </div>
        <p className="text-muted-foreground text-xs">
          Chat with your inbox — available after sync in Phase 5
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-end p-4">
        <div className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
            <Sparkles className="size-3" aria-hidden="true" />
            Suggested prompts
          </p>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled
              className="bg-muted/50 text-muted-foreground w-full rounded-lg border px-3 py-2 text-left text-xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
