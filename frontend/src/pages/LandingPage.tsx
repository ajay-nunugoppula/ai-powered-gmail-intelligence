import { Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase";

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Mail className="size-8" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Gmail Intelligence
          </h1>
          <p className="text-muted-foreground text-lg">
            AI-powered email assistant — summarize, categorize, compose, and
            chat with your inbox.
          </p>
        </div>

        <Card className="w-full text-left">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" aria-hidden="true" />
              Phase 0 Complete
            </CardTitle>
            <CardDescription>
              Project scaffold is ready. Next: connect Google Auth and Gmail
              sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>FastAPI backend with health check</li>
              <li>Supabase schema with pgvector + RLS</li>
              <li>React + TypeScript + Tailwind + shadcn/ui</li>
              <li>ARQ worker scaffold for background jobs</li>
            </ul>
            <Button
              className="w-full"
              disabled={!isSupabaseConfigured}
              aria-disabled={!isSupabaseConfigured}
            >
              {isSupabaseConfigured
                ? "Sign in with Google"
                : "Configure .env to enable sign-in"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
