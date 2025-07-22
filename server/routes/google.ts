import express from 'express';
import { GoogleCalendarService } from '../services/googleCalendar';
import { db } from '../db';
import { googleCalendarSettings, googleTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();
const calendarService = new GoogleCalendarService();

// Получить статус авторизации для фирмы
router.get('/status/:firmId', async (req, res) => {
  try {
    const { firmId } = req.params;
    
    // Проверяем есть ли настройки
    const [settings] = await db
      .select()
      .from(googleCalendarSettings)
      .where(eq(googleCalendarSettings.firmId, firmId));
    
    if (!settings) {
      return res.json({ isConfigured: false, isAuthorized: false });
    }
    
    // Проверяем есть ли токены
    const [token] = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.firmId, firmId));
    
    res.json({
      isConfigured: true,
      isAuthorized: !!token,
      hasSettings: !!settings.clientId && !!settings.clientSecret
    });
  } catch (error) {
    console.error('Error checking Google status:', error);
    res.status(500).json({ error: 'Failed to check Google status' });
  }
});

// Получить настройки Google Calendar для фирмы
router.get('/settings/:firmId', async (req, res) => {
  try {
    const { firmId } = req.params;
    
    const [settings] = await db
      .select()
      .from(googleCalendarSettings)
      .where(eq(googleCalendarSettings.firmId, firmId));
    
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    // Не отправляем секретные данные на фронтенд
    res.json({
      firmId: settings.firmId,
      redirectUri: settings.redirectUri,
      masterCalendarId: settings.masterCalendarId,
      hasCredentials: !!(settings.clientId && settings.clientSecret)
    });
  } catch (error) {
    console.error('Error fetching Google settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Обновить настройки Google Calendar для фирмы
router.put('/settings/:firmId', async (req, res) => {
  try {
    const { firmId } = req.params;
    const { masterCalendarId } = req.body;
    
    // Используем environment variables для credentials
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Google OAuth credentials not configured' });
    }
    
    const redirectUri = `${req.protocol}://${req.get('host')}/api/google/callback`;
    
    await db
      .insert(googleCalendarSettings)
      .values({
        firmId,
        clientId,
        clientSecret,
        redirectUri,
        masterCalendarId: masterCalendarId || null
      })
      .onConflictDoUpdate({
        target: googleCalendarSettings.firmId,
        set: {
          clientId,
          clientSecret,
          redirectUri,
          masterCalendarId: masterCalendarId || null,
          updatedAt: new Date()
        }
      });
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating Google settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Получить URL для OAuth авторизации
router.get('/auth/:firmId', async (req, res) => {
  try {
    const { firmId } = req.params;
    
    // Сначала обновим настройки с текущими credentials
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Google OAuth credentials not configured' });
    }
    
    const redirectUri = `${req.protocol}://${req.get('host')}/api/google/callback`;
    
    await db
      .insert(googleCalendarSettings)
      .values({
        firmId,
        clientId,
        clientSecret,
        redirectUri
      })
      .onConflictDoUpdate({
        target: googleCalendarSettings.firmId,
        set: {
          clientId,
          clientSecret,
          redirectUri,
          updatedAt: new Date()
        }
      });
    
    const authUrl = await calendarService.getAuthUrl(firmId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({ error: 'Failed to get authorization URL' });
  }
});

// OAuth callback handler
router.get('/callback', async (req, res) => {
  try {
    const { code, state: firmId } = req.query;
    
    if (!code || !firmId) {
      return res.status(400).send('Missing authorization code or firm ID');
    }
    
    await calendarService.exchangeCodeForTokens(code as string, firmId as string);
    
    // Перенаправляем обратно в приложение с сообщением об успехе
    res.redirect(`/?google_auth=success`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`/?google_auth=error&message=${encodeURIComponent(errorMessage)}`);
  }
});

// Получить логи календаря
router.get('/logs', async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(googleTokens)
      .orderBy(googleTokens.createdAt)
      .limit(50);
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;