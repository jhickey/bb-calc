import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '#/lib/supabase';

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
  /**
   * Whether the signed-in user has at least one registered passkey. `null` while
   * unknown (signed out, or the lookup hasn't resolved). Drives whether to offer
   * "Add a passkey".
   */
  hasPasskey: boolean | null;
  /** Send a one-time magic link to `email`. */
  signInWithEmail: (email: string) => Promise<AuthResult>;
  /** Sign in with a previously registered passkey (discoverable credential). */
  signInWithPasskey: () => Promise<AuthResult>;
  /** Register a passkey for the currently signed-in user. */
  registerPasskey: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function message(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setHasPasskey(null);
      return;
    }
    let cancelled = false;
    // Fail open: if the lookup errors, treat as "no passkey" so the user can still add one.
    supabase.auth.passkey
      .list()
      .then(({ data }) => {
        if (!cancelled) setHasPasskey((data?.length ?? 0) > 0);
      })
      .catch(() => {
        if (!cancelled) setHasPasskey(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      hasPasskey,
      async signInWithEmail(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        return { error: message(error) };
      },
      async signInWithPasskey() {
        const { error } = await supabase.auth.signInWithPasskey();
        return { error: message(error) };
      },
      async registerPasskey() {
        const { error } = await supabase.auth.registerPasskey();
        if (!error) setHasPasskey(true);
        return { error: message(error) };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, hasPasskey],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
