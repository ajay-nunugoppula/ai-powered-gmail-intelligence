import { useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { Navigate } from "react-router-dom";

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
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl shadow-lg">
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
              Get started
            </CardTitle>
            <CardDescription>
              Sign in with Google, then connect Gmail to unlock your AI inbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>Secure Google OAuth via Supabase</li>
              <li>Thread-first inbox with AI summaries</li>
              <li>Conversational assistant over your emails</li>
            </ul>

            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              disabled={!isSupabaseConfigured || signingIn}
              onClick={() => void handleSignIn()}
            >
              {signingIn
                ? "Redirecting…"
                : isSupabaseConfigured
                  ? "Sign in with Google"
                  : "Configure frontend/.env.local to enable sign-in"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
