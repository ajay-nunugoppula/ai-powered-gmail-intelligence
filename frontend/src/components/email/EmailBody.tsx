import { prepareEmailDisplay } from "@/lib/emailContent";
import { cn } from "@/lib/utils";

interface EmailBodyProps {
  bodyText: string | null;
  bodyHtml: string | null;
  className?: string;
}

export function EmailBody({ bodyText, bodyHtml, className }: EmailBodyProps) {
  const display = prepareEmailDisplay({
    body_text: bodyText,
    body_html: bodyHtml,
  });

  if (!display.content) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        (No text content)
      </p>
    );
  }

  if (display.mode === "html") {
    return (
      <div className={cn("email-body-canvas overflow-x-auto rounded-lg border", className)}>
        <div
          className="email-body-inner p-4"
          dangerouslySetInnerHTML={{ __html: display.content }}
        />
      </div>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed whitespace-pre-wrap", className)}>
      {display.content}
    </div>
  );
}
