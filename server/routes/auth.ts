import { Router } from 'express';
import { supabase } from '../supabaseClient.js';
import { authenticateSupabase } from '../middleware/supabaseAuth.js';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/auth/signup
 * Регистрация нового пользователя
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }).parse(req.body);

    // Создаем пользователя в Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Автоматически подтверждаем email (для dev)
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || ''
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Profile будет создан автоматически через trigger

    res.json({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        firstName,
        lastName
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Вход пользователя
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse(req.body);

    // Используем service role для входа (обходим email confirmation)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    if (!data.user || !data.session) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Получаем полный профиль
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    res.json({
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: profile?.first_name,
        lastName: profile?.last_name,
        role: profile?.role,
        profileImageUrl: profile?.profile_image_url
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Выход пользователя
 */
router.post('/logout', authenticateSupabase, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove "Bearer "

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Signout через Supabase
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      console.error('Logout error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/user
 * Получить текущего пользователя
 */
router.get('/user', authenticateSupabase, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    id: req.user.id,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    role: req.user.role,
    profileImageUrl: req.user.profileImageUrl
  });
});

/**
 * PATCH /api/auth/profile
 * Обновить профиль пользователя
 */
router.patch('/profile', authenticateSupabase, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const profileData = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      profileImageUrl: z.string().optional(),
    }).parse(req.body);

    // Обновляем profile в БД
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        phone: profileData.phone || null,
        profile_image_url: profileData.profileImageUrl
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Также обновляем metadata в auth.users
    if (profileData.firstName || profileData.lastName) {
      await supabase.auth.admin.updateUserById(
        req.user.id,
        {
          user_metadata: {
            first_name: profileData.firstName || req.user.firstName,
            last_name: profileData.lastName || req.user.lastName,
            profile_image_url: profileData.profileImageUrl || req.user.profileImageUrl
          }
        }
      );
    }

    res.json({
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
      profileImageUrl: data.profile_image_url
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/auth/password
 * Изменить пароль пользователя
 */
router.patch('/password', authenticateSupabase, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6),
    }).parse(req.body);

    // Сначала проверяем текущий пароль
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword
    });

    if (signInError) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Обновляем пароль
    const { error } = await supabase.auth.admin.updateUserById(
      req.user.id,
      {
        password: newPassword
      }
    );

    if (error) {
      console.error('Password update error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Обновить access token через refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = z.object({
      refreshToken: z.string(),
    }).parse(req.body);

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      session: data.session,
      user: data.user
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/oauth/:provider
 * OAuth авторизация (Google, GitHub, etc.)
 */
router.get('/oauth/:provider', async (req, res) => {
  try {
    const provider = req.params.provider as 'google' | 'github' | 'gitlab';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${frontendUrl}/auth/callback`
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ url: data.url });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/test-login (DEV ONLY)
 * Тестовый вход для разработки
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test-login', async (req, res) => {
    try {
      const { email } = z.object({
        email: z.string().email(),
      }).parse(req.body);

      // Создаем временную сессию для тестового пользователя
      // В production это нужно убрать!
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !profile) {
        return res.status(404).json({ error: 'Test user not found' });
      }

      // Генерируем тестовый токен (НЕ БЕЗОПАСНО для production!)
      const testToken = Buffer.from(JSON.stringify({
        sub: profile.id,
        email: profile.email,
        role: profile.role,
        exp: Date.now() + 3600000 // 1 час
      })).toString('base64');

      res.json({
        user: profile,
        token: testToken,
        warning: 'This is a test login. Do not use in production!'
      });
    } catch (error) {
      console.error('Test login error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/test-users', async (req, res) => {
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .limit(10);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(users);
    } catch (error) {
      console.error('Error fetching test users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

export default router;
