import type { ThreadItem } from "@/lib/api";

export interface CategoryStat {
  slug: string;
  name: string;
  color: string;
  count: number;
  percent: number;
}

const FALLBACK_COLORS: Record<string, string> = {
  newsletters: "#8b5cf6",
  "job-recruitment": "#3b82f6",
  finance: "#10b981",
  notifications: "#f59e0b",
  personal: "#ec4899",
  "work-professional": "#6366f1",
  uncategorized: "#94a3b8",
};

export function categoryColor(slug: string | null | undefined, hex?: string | null) {
  if (hex) return hex;
  if (slug && FALLBACK_COLORS[slug]) return FALLBACK_COLORS[slug];
  return FALLBACK_COLORS.uncategorized;
}

export function computeCategoryStats(threads: ThreadItem[]): CategoryStat[] {
  if (threads.length === 0) return [];

  const counts = new Map<string, CategoryStat>();

  for (const thread of threads) {
    const slug = thread.category?.slug ?? "uncategorized";
    const name = thread.category?.name ?? "Uncategorized";
    const color = categoryColor(slug, thread.category?.color);
    const existing = counts.get(slug);

    if (existing) {
      existing.count += 1;
    } else {
      counts.set(slug, { slug, name, color, count: 1, percent: 0 });
    }
  }

  const total = threads.length;
  return Array.from(counts.values())
    .map((item) => ({
      ...item,
      percent: Math.round((item.count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function topCategoryInsight(stats: CategoryStat[], total: number) {
  if (!stats.length || total === 0) {
    return "Sync and analyze your inbox to see category insights.";
  }

  const top = stats[0];
  if (top.slug === "uncategorized" && stats.length === 1) {
    return "Most threads are still uncategorized — run AI analysis to organize your inbox.";
  }

  return `${top.name} makes up ${top.percent}% of your inbox (${top.count} of ${total} threads).`;
}

export function conicGradientFromStats(stats: CategoryStat[]) {
  if (!stats.length) return "conic-gradient(#e2e8f0 0deg 360deg)";

  let cursor = 0;
  const stops: string[] = [];

  for (const stat of stats) {
    const sweep = (stat.percent / 100) * 360;
    if (sweep <= 0) continue;
    const end = cursor + sweep;
    stops.push(`${stat.color} ${cursor}deg ${end}deg`);
    cursor = end;
  }

  if (cursor < 360) {
    stops.push(`#e2e8f0 ${cursor}deg 360deg`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}
