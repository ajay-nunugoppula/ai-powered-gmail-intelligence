import { useState } from "react";
import {
  Bot,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";
import { Navigate } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI thread summaries",
    description:
      "Instant context on every conversation so you can scan your inbox in seconds.",
  },
  {
    icon: Tags,
    title: "Smart categorization",
    description:
      "Emails grouped by intent — work, finance, travel, and more — for faster triage.",
  },
  {
    icon: MessageSquare,
    title: "Compose & reply",
    description:
      "Draft polished responses with AI assistance grounded in your thread history.",
  },
  {
    icon: Bot,
    title: "RAG chat agent",
    description:
      "Ask questions across your inbox and get answers with cited email sources.",
  },
] as const;

const TRUST_POINTS = [
  { icon: Shield, label: "Google OAuth via Supabase" },
  { icon: Zap, label: "Real-time Gmail sync" },
  { icon: Mail, label: "Thread-first inbox view" },
] as const;

export function LandingPage() {
  const { session, loading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setSigningIn(false);
    }
  };

  return (
    <div className="bg-background text-foreground relative flex min-h-svh flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.12_264/0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.15_264/0.18),transparent)]"
      />

      <header className="border-border/60 relative z-10 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
              <Mail className="size-4" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight">
                Gmail Intelligence
              </p>
              <p className="text-muted-foreground hidden text-xs sm:block">
                AI-powered inbox platform
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-5">
              Repeatless technical assessment
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your inbox,{" "}
              <span className="text-primary/80 dark:text-primary">
                intelligently organized
              </span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              Connect Gmail, sync your threads, and unlock AI summaries,
              categorization, compose assistance, and a conversational agent
              that searches your email with citations.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="bg-card/80 border-border/70 hover:border-border shadow-sm backdrop-blur-sm transition-colors"
              >
                <CardHeader className="gap-3">
                  <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-border/60 bg-muted/30 border-y">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-16">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Ready to explore your AI inbox?
              </h2>
              <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
                Sign in with Google to authenticate securely, then connect Gmail
                to start syncing threads. Enrichment runs in the background so
                summaries and chat are available as your inbox indexes.
              </p>
              <ul className="grid gap-3 sm:grid-cols-3">
                {TRUST_POINTS.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="border-border/70 bg-background/80 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <Icon
                      className="text-primary size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Card className="border-border/70 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="text-primary size-5" aria-hidden="true" />
                  Get started
                </CardTitle>
                <CardDescription>
                  One click to sign in. Gmail connection happens inside the
                  dashboard after authentication.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <p
                    className="text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <Button
                  className="h-11 w-full text-base"
                  disabled={!isSupabaseConfigured || signingIn}
                  onClick={() => void handleSignIn()}
                >
                  {signingIn
                    ? "Redirecting…"
                    : isSupabaseConfigured
                      ? "Sign in with Google"
                      : "Configure frontend/.env.local to enable sign-in"}
                </Button>

                {!isSupabaseConfigured && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Add your Supabase URL and anon key to{" "}
                    <code className="bg-muted rounded px-1 py-0.5">
                      frontend/.env.local
                    </code>{" "}
                    to enable authentication.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-border/60 relative z-10 border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <div>
            <p className="text-muted-foreground text-sm">Developed by</p>
            <p className="mt-1 text-base font-semibold tracking-tight">
              Nunugoppula Ajay Kumar
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            Gmail Intelligence Platform · {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {loading && (
        <div
          className={cn(
            "bg-background/60 pointer-events-none fixed inset-0 z-20 flex items-center justify-center backdrop-blur-[1px]",
          )}
          aria-live="polite"
          aria-busy="true"
        >
          <p className="text-muted-foreground text-sm">Loading session…</p>
        </div>
      )}
    </div>
  );
}
