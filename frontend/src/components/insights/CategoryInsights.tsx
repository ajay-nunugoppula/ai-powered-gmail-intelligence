import { BarChart3 } from "lucide-react";

import type { ThreadItem } from "@/lib/api";
import {
  computeCategoryStats,
  conicGradientFromStats,
  topCategoryInsight,
} from "@/lib/categoryStats";
import { cn } from "@/lib/utils";

interface CategoryInsightsProps {
  threads: ThreadItem[];
  className?: string;
}

export function CategoryInsights({ threads, className }: CategoryInsightsProps) {
  const total = threads.length;
  const stats = computeCategoryStats(threads);
  const categorized = threads.filter((t) => t.category?.slug).length;
  const analyzedPercent =
    total > 0 ? Math.round((categorized / total) * 100) : 0;
  const gradient = conicGradientFromStats(stats);
  const insight = topCategoryInsight(stats, total);

  if (total === 0) {
    return (
      <div
        className={cn(
          "border-border/70 bg-muted/30 rounded-xl border p-6 text-center",
          className,
        )}
      >
        <BarChart3
          className="text-muted-foreground mx-auto mb-2 size-8"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">No inbox data yet</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Connect Gmail and sync to see category insights.
        </p>
      </div>
    );
  }

  const chartLabel = stats
    .map((s) => `${s.name} ${s.percent}%`)
    .join(", ");

  return (
    <section
      className={cn(
        "border-border/70 bg-card w-full max-w-xl rounded-xl border p-6 shadow-sm",
        className,
      )}
      aria-label="Inbox category insights"
    >
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="text-primary size-5" aria-hidden="true" />
        <h3 className="text-base font-semibold">Inbox insights</h3>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <div
            className="size-36 rounded-full"
            style={{ background: gradient }}
            role="img"
            aria-label={`Category distribution: ${chartLabel}`}
          />
          <div className="bg-card absolute inset-0 m-auto flex size-20 flex-col items-center justify-center rounded-full border shadow-inner">
            <span className="text-2xl font-bold tabular-nums">{total}</span>
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
              threads
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-muted-foreground text-sm leading-relaxed">{insight}</p>
          <p className="text-muted-foreground text-xs">
            {analyzedPercent}% of threads categorized by AI
          </p>
          <ul className="space-y-2">
            {stats.map((stat) => (
              <li
                key={stat.slug}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stat.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{stat.name}</span>
                </div>
                <div className="text-muted-foreground shrink-0 tabular-nums text-xs">
                  {stat.count} · {stat.percent}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
