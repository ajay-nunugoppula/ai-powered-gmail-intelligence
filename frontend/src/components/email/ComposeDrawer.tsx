import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ComposeDraft } from "@/lib/api";

export type ComposeMode = "reply" | "compose";

export interface ComposeContext {
  mode: ComposeMode;
  threadId?: string | null;
  messageId?: string | null;
  defaultTo?: string[];
  defaultSubject?: string;
}

interface ComposeDrawerProps {
  open: boolean;
  context: ComposeContext | null;
  onClose: () => void;
  onGenerate: (payload: {
    mode: ComposeMode;
    thread_id?: string | null;
    message_id?: string | null;
    to: string[];
    cc: string[];
    subject?: string;
    tone: string;
    instructions?: string;
  }) => Promise<ComposeDraft>;
  onSend: (payload: {
    to: string[];
    cc: string[];
    subject: string;
    body: string;
    thread_id?: string | null;
    reply_to_message_id?: string | null;
  }) => Promise<void>;
  isGenerating: boolean;
  isSending: boolean;
  error?: string | null;
}

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
] as const;

function parseEmails(value: string) {
  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function ComposeDrawer({
  open,
  context,
  onClose,
  onGenerate,
  onSend,
  isGenerating,
  isSending,
  error,
}: ComposeDrawerProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("professional");
  const [instructions, setInstructions] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !context) return;
    setTo((context.defaultTo ?? []).join(", "));
    setCc("");
    setSubject(context.defaultSubject ?? "");
    setBody("");
    setInstructions("");
    setTone("professional");
    setLocalError(null);
  }, [open, context]);

  if (!open || !context) {
    return null;
  }

  const handleGenerate = async () => {
    setLocalError(null);
    try {
      const draft = await onGenerate({
        mode: context.mode,
        thread_id: context.threadId,
        message_id: context.messageId,
        to: parseEmails(to),
        cc: parseEmails(cc),
        subject: subject || undefined,
        tone,
        instructions: instructions || undefined,
      });
      setTo(draft.to.join(", "));
      setCc(draft.cc.join(", "));
      setSubject(draft.subject);
      setBody(draft.body);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to generate draft");
    }
  };

  const handleSend = async () => {
    setLocalError(null);
    const recipients = parseEmails(to);
    if (!recipients.length) {
      setLocalError("Add at least one recipient.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setLocalError("Subject and body are required.");
      return;
    }

    try {
      await onSend({
        to: recipients,
        cc: parseEmails(cc),
        subject: subject.trim(),
        body: body.trim(),
        thread_id: context.threadId,
        reply_to_message_id: context.messageId,
      });
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to send email");
    }
  };

  const displayError = localError || error;

  return (
    <div
      className="bg-background absolute inset-x-0 bottom-0 z-20 border-t shadow-2xl"
      role="dialog"
      aria-label={context.mode === "reply" ? "Reply composer" : "New email composer"}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">
            {context.mode === "reply" ? "Reply with AI" : "Compose email"}
          </h3>
          <p className="text-muted-foreground text-xs">
            Generate a draft with Gemini, edit it, then send via Gmail.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close composer">
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid max-h-[50vh] gap-3 overflow-y-auto px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-medium">To</span>
            <input
              className="bg-background rounded-md border px-3 py-2 text-sm"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="recipient@example.com"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium">Cc</span>
            <input
              className="bg-background rounded-md border px-3 py-2 text-sm"
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs">
          <span className="font-medium">Subject</span>
          <input
            className="bg-background rounded-md border px-3 py-2 text-sm"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-medium">Tone</span>
            <select
              className="bg-background rounded-md border px-3 py-2 text-sm"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
            >
              {TONES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium">Extra instructions</span>
            <input
              className="bg-background rounded-md border px-3 py-2 text-sm"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="e.g. Ask for a call next week"
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs">
          <span className="font-medium">Message</span>
          <textarea
            className="bg-background min-h-40 rounded-md border px-3 py-2 text-sm leading-relaxed"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Generate a draft or write your message here…"
          />
        </label>

        {displayError && (
          <p className="text-destructive text-xs" role="alert">
            {displayError}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={isGenerating || isSending}
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          Generate draft
        </Button>
        <Button onClick={handleSend} disabled={isGenerating || isSending}>
          {isSending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}
