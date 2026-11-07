import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppRole } from "@hr/shared";
import { supabase } from "./supabase";

export interface Profile {
  id: string; email: string; first_name: string; last_name: string;
  phone: string | null; address: string | null; city: string | null; country: string | null; role: AppRole;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const { data } = await supabase.from("profiles")
      .select("id, email, first_name, last_name, phone, address, city, country, role").eq("id", s.user.id).single();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer the query: calling Supabase inside this callback can deadlock the auth lock.
      setTimeout(() => void loadProfile(s), 0);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value: AuthState = {
    loading, session, profile,
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
