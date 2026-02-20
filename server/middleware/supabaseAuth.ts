import { Request, Response, NextFunction } from 'express';
import { supabase, createSupabaseClient } from '../supabaseClient.js';

// Расширяем типы Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
        profileImageUrl?: string | null;
        role: 'admin' | 'leiter' | 'worker';
        crewMemberId?: number | null;
        createdAt?: Date | null;
        updatedAt?: Date | null;
      };
      supabaseClient?: ReturnType<typeof createSupabaseClient>;
    }
  }
}

/**
 * Middleware для проверки авторизации через Supabase Auth
 * Проверяет Bearer токен в заголовке Authorization
 */
export async function authenticateSupabase(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    // Поддерживаем токен из header или query parameter (для отображения файлов в браузере)
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Убираем "Bearer "
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header'
      });
    }

    // Верифицируем токен и получаем пользователя
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    // Получаем полный профиль пользователя через Supabase REST API
    // Используем service role client который обходит RLS

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Если профиль не найден — автоматически создаём из данных auth.users
    // Это покрывает случаи когда trigger handle_new_user не сработал
    // или таблица profiles была пересоздана (например через drizzle-kit push)
    if (profileError && profileError.code === 'PGRST116') {
      console.log(`Profile not found for user ${user.id} (${user.email}), auto-creating...`);

      const metadata = user.user_metadata || {};
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          first_name: metadata.first_name || metadata.firstName || '',
          last_name: metadata.last_name || metadata.lastName || '',
          profile_image_url: metadata.profile_image_url || metadata.avatar_url || null,
          role: 'leiter', // По умолчанию — руководитель проектов
        })
        .select()
        .single();

      if (createError || !newProfile) {
        console.error('Failed to auto-create profile:', createError);
        return res.status(500).json({
          error: 'Failed to create user profile'
        });
      }

      console.log(`Profile auto-created for user ${user.id} (${user.email}), role: leiter`);
      profile = newProfile;
      profileError = null;
    } else if (profileError || !profile) {
      console.error('Profile not found or error:', profileError);
      return res.status(404).json({
        error: 'User profile not found'
      });
    }

    // Добавляем пользователя и клиент в request
    req.user = {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      profileImageUrl: profile.profile_image_url,
      role: profile.role,
      crewMemberId: profile.crew_member_id
    };

    // Создаем Supabase клиент с токеном пользователя (для RLS)
    req.supabaseClient = createSupabaseClient(token);

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Internal server error during authentication'
    });
  }
}

/**
 * Middleware для проверки роли администратора
 * Должен использоваться после authenticateSupabase
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Not authenticated'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }

  next();
}

/**
 * Factory function для проверки доступа к фирме
 * Должен использоваться после authenticateSupabase
 */
export function requireFirmAccess(firmIdParam: string = 'firmId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated'
        });
      }

      // Admins имеют доступ ко всем фирмам
      if (req.user.role === 'admin') {
        return next();
      }

      const firmId = parseInt(req.params[firmIdParam]);

      if (isNaN(firmId)) {
        return res.status(400).json({
          error: 'Invalid firm ID'
        });
      }

      // Проверяем доступ пользователя к фирме
      const { data, error } = await supabase
        .from('user_firms')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('firm_id', firmId)
        .single();

      if (error || !data) {
        return res.status(403).json({
          error: 'Access to this firm denied'
        });
      }

      next();
    } catch (error) {
      console.error('Firm access check error:', error);
      return res.status(500).json({
        error: 'Internal server error during access check'
      });
    }
  };
}

/**
 * Optional auth middleware - не требует авторизации, но добавляет user если токен есть
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Нет токена - это OK, просто продолжаем без пользователя
      return next();
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        req.user = {
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          profileImageUrl: profile.profile_image_url,
          role: profile.role
        };
        req.supabaseClient = createSupabaseClient(token);
      }
    }

    next();
  } catch (error) {
    // Игнорируем ошибки в optional auth
    next();
  }
}
