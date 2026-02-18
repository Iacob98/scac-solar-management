import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  profile_image_url: string | null;
}

interface AuthContextType {
  user: (SupabaseUser & { role?: string }) | null;
  profile: UserProfile | null;
  session: Session | null;
  accessToken: string | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile: (data: ProfileUpdateData) => Promise<{ error: any }>;
  setSession: (accessToken: string, refreshToken: string) => Promise<void>;
}

interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(SupabaseUser & { role?: string }) | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string, accessToken?: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const headers: Record<string, string> = {
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers,
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const profileData = data[0];
        setProfile(profileData);
        setUser(prev => prev ? { ...prev, role: profileData.role } : null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[useAuth] Profile load timed out');
      } else {
        console.error('[useAuth] Error loading profile:', error);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[useAuth] Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            await loadProfile(session.user.id, session.access_token);
          } catch (error) {
            console.error('[useAuth] Error loading profile:', error);
          }
        }
      })
      .catch((error) => {
        console.error('[useAuth] Error getting session:', error);
      })
      .finally(() => {
        if (mounted) {
          clearTimeout(loadingTimeout);
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          await loadProfile(session.user.id, session.access_token);
        } catch (error) {
          console.error('[useAuth] Error loading profile:', error);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setProfile(null);
      setSession(null);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      try {
        await Promise.race([
          supabase.auth.signOut(),
          timeoutPromise
        ]);
      } catch {
        // signOut timed out or failed, but state already cleared
      }

      return { error: null };
    } catch (error) {
      console.error('[useAuth] signOut error:', error);
      setUser(null);
      setProfile(null);
      setSession(null);
      return { error };
    }
  };

  const updateProfile = async (profileData: ProfileUpdateData) => {
    try {
      if (!user) {
        return { error: new Error('No user logged in') };
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const error = await response.json();
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const setSessionFromToken = async (accessToken: string, refreshToken: string) => {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[useAuth] Error setting session:', error);
      throw error;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      if (data.session.user) {
        await loadProfile(data.session.user.id, accessToken);
      }
    }
  };

  const value = {
    user,
    profile,
    session,
    accessToken: session?.access_token || null,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    setSession: setSessionFromToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAccessToken() {
  const { session } = useAuth();
  return session?.access_token || null;
}

export function useIsAuthenticated() {
  const { user, loading } = useAuth();
  return { isAuthenticated: !!user, loading };
}
