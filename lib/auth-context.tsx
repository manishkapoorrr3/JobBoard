'use client';
// Auth context: tracks the logged-in user + their profile (for account type).
// Exposes loading, session, profile, signOut, and a refresh helper.
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase-client';
import { Profile } from '@/lib/types';

interface AuthState {
  loading: boolean; // true until first session check completes
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const user = session?.user ?? null;

  // Load the profile row for the current user (if any).
  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }, [supabase, session]);

  useEffect(() => {
    // Get the initial session on mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to auth changes (login/logout/token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Whenever the session changes, reload the profile.
  useEffect(() => {
    if (session?.user?.id) refreshProfile();
    else setProfile(null);
  }, [session?.user?.id, refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ loading, session, user, profile, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
