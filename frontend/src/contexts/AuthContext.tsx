import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { api, type UserProfile } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const currentSession = (await supabase.auth.getSession()).data.session;
    if (!currentSession?.access_token) {
      setProfile(null);
      return;
    }

    try {
      const me = await api.getMe(currentSession.access_token);
      setProfile(me);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      void refreshProfile();
    } else {
      setProfile(null);
    }
  }, [session?.access_token, refreshProfile]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  const connectGmail = useCallback(async () => {
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }
    const { auth_url } = await api.connectGmail(session.access_token);
    window.location.href = auth_url;
  }, [session?.access_token]);

  const disconnectGmail = useCallback(async () => {
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }
    await api.disconnectGmail(session.access_token);
    await refreshProfile();
  }, [session?.access_token, refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signInWithGoogle,
      signOut,
      refreshProfile,
      connectGmail,
      disconnectGmail,
    }),
    [
      user,
      session,
      profile,
      loading,
      signInWithGoogle,
      signOut,
      refreshProfile,
      connectGmail,
      disconnectGmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
