import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface AiSummaryCardProps {
  title: string;
  summary: string;
  badge?: string | null;
}

export function AiSummaryCard({ title, summary, badge }: AiSummaryCardProps) {
  return (
    <section
      className="border-primary/20 bg-primary/5 mb-6 rounded-xl border p-4"
      aria-label={title}
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="text-primary size-4" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </div>
      <p className="text-sm leading-relaxed">{summary}</p>
    </section>
  );
}
