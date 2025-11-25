import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  profile_image_url: string | null;
}

interface AuthContextType {
  user: (SupabaseUser & { role?: string }) | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile: (data: ProfileUpdateData) => Promise<{ error: any }>;
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
    console.log('[useAuth] loadProfile called for userId:', userId);

    try {
      // Используем fetch напрямую к Supabase REST API с таймаутом
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
      console.log('[useAuth] loadProfile result:', { data });

      if (data && data.length > 0) {
        const profileData = data[0];
        console.log('[useAuth] Setting profile with role:', profileData.role);
        setProfile(profileData);
        setUser(prev => {
          const updated = prev ? { ...prev, role: profileData.role } : null;
          console.log('[useAuth] Updated user with role:', updated?.role);
          return updated;
        });
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

    // Таймаут на случай зависания - гарантируем что loading станет false
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000); // 5 секунд максимум на загрузку

    // Получить текущую сессию
    console.log('[useAuth] Starting getSession...');
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted) return;

        console.log('[useAuth] getSession completed', {
          hasSession: !!session,
          hasUser: !!session?.user,
          error
        });

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('[useAuth] Loading profile for user:', session.user.id);
          try {
            await loadProfile(session.user.id, session.access_token);
            console.log('[useAuth] Profile loaded successfully');
          } catch (error) {
            console.error('[useAuth] Error loading profile:', error);
          }
        } else {
          console.log('[useAuth] No session found - user not logged in');
        }
      })
      .catch((error) => {
        console.error('[useAuth] Error getting session:', error);
      })
      .finally(() => {
        if (mounted) {
          console.log('[useAuth] Setting loading to false');
          clearTimeout(loadingTimeout);
          setLoading(false);
        }
      });

    // Подписаться на изменения auth состояния
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
          console.error('Error loading profile:', error);
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
      console.log('[useAuth] signOut called');

      // Очищаем состояние сразу
      setUser(null);
      setProfile(null);
      setSession(null);

      // Пробуем выйти через Supabase с таймаутом
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      try {
        await Promise.race([
          supabase.auth.signOut(),
          timeoutPromise
        ]);
        console.log('[useAuth] signOut completed');
      } catch (e) {
        console.warn('[useAuth] signOut timed out or failed, but state cleared');
      }

      return { error: null };
    } catch (error) {
      console.error('[useAuth] signOut error:', error);
      // Даже при ошибке очищаем состояние
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

      // Обновляем profile через API
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

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile
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

// Helper hook для получения access token
export function useAccessToken() {
  const { session } = useAuth();
  return session?.access_token || null;
}

// Helper hook для проверки авторизации
export function useIsAuthenticated() {
  const { user, loading } = useAuth();
  return { isAuthenticated: !!user, loading };
}
