import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|\[[0-9,\s]+\])/g;
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      !part.startsWith("**")
    ) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    if (/^\[[0-9,\s]+\]$/.test(part)) {
      return (
        <span
          key={key}
          className="text-primary align-super text-[10px] font-medium"
        >
          {part}
        </span>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

function renderBlock(line: string, index: number): ReactNode {
  const heading = line.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    const text = heading[2];
    const Tag = level === 1 ? "h4" : level === 2 ? "h5" : "h6";
    return (
      <Tag
        key={`h-${index}`}
        className={cn(
          "font-semibold",
          level === 1 && "mt-3 text-sm",
          level === 2 && "mt-2 text-sm",
          level === 3 && "mt-2 text-xs uppercase tracking-wide",
        )}
      >
        {renderInline(text, `h-${index}`)}
      </Tag>
    );
  }

  const bullet = line.match(/^[-*]\s+(.+)$/);
  if (bullet) {
    return (
      <li key={`li-${index}`} className="ml-4 list-disc">
        {renderInline(bullet[1], `li-${index}`)}
      </li>
    );
  }

  const numbered = line.match(/^\d+\.\s+(.+)$/);
  if (numbered) {
    return (
      <li key={`oli-${index}`} className="ml-4 list-decimal">
        {renderInline(numbered[1], `oli-${index}`)}
      </li>
    );
  }

  if (!line.trim()) {
    return <div key={`sp-${index}`} className="h-2" />;
  }

  return (
    <p key={`p-${index}`} className="my-1">
      {renderInline(line, `p-${index}`)}
    </p>
  );
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listBuffer.length || !listType) return;
    const ListTag = listType === "ol" ? "ol" : "ul";
    blocks.push(
      <ListTag key={`list-${blocks.length}`} className="my-1 space-y-1">
        {listBuffer}
      </ListTag>,
    );
    listBuffer = [];
    listType = null;
  };

  lines.forEach((line, index) => {
    if (/^[-*]\s+/.test(line)) {
      if (listType === "ol") flushList();
      listType = "ul";
      listBuffer.push(renderBlock(line, index));
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (listType === "ul") flushList();
      listType = "ol";
      listBuffer.push(renderBlock(line, index));
      return;
    }

    flushList();
    blocks.push(renderBlock(line, index));
  });

  flushList();

  return <div className={cn("text-sm leading-relaxed", className)}>{blocks}</div>;
}
