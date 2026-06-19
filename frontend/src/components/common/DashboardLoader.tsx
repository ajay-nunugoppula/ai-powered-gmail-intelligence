import { Loader2, Mail } from "lucide-react";

interface DashboardLoaderProps {
  message?: string;
}

export function DashboardLoader({
  message = "Loading your inbox…",
}: DashboardLoaderProps) {
  return (
    <div
      className="bg-background flex min-h-svh flex-col items-center justify-center gap-4 p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-primary/10 text-primary relative flex size-16 items-center justify-center rounded-2xl">
        <Mail className="size-8" aria-hidden="true" />
        <Loader2
          className="text-primary absolute -right-1 -bottom-1 size-6 animate-spin rounded-full bg-background"
          aria-hidden="true"
        />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
