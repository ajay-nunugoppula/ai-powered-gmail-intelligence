import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (session) {
        navigate("/dashboard", { replace: true });
        return;
      }

      setError("No session found after sign in.");
    };

    void handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
        Completing sign in…
      </p>
    </div>
  );
}
