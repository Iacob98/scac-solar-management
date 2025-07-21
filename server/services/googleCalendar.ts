import { google } from 'googleapis';
import { db } from '../db';
import { googleTokens, calendarLogs, googleCalendarSettings, type GoogleToken, type InsertCalendarLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface CalendarEvent {
  summary: string;
  location?: string;
  description?: string;
  startDate: string;
  endDate: string;
  colorId?: string;
}

export class GoogleCalendarService {
  
  /**
   * Получить OAuth2 клиента для фирмы
   */
  private async getOAuth2Client(firmId: string) {
    const [settings] = await db
      .select()
      .from(googleCalendarSettings)
      .where(eq(googleCalendarSettings.firmId, firmId));

    if (!settings) {
      throw new Error('Google Calendar settings not configured for this firm');
    }

    return new google.auth.OAuth2(
      settings.clientId,
      settings.clientSecret,
      settings.redirectUri
    );
  }

  /**
   * Получить URL для OAuth авторизации
   */
  async getAuthUrl(firmId: string): Promise<string> {
    const oauth2Client = await this.getOAuth2Client(firmId);
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: firmId, // передаем ID фирмы в state
    });
  }

  /**
   * Обменять код авторизации на токены
   */
  async exchangeCodeForTokens(code: string, firmId: string): Promise<GoogleToken> {
    try {
      const oauth2Client = await this.getOAuth2Client(firmId);
      const { tokens } = await oauth2Client.getToken(code);
      
      // Сохраняем токены в базу данных
      const [savedToken] = await db.insert(googleTokens)
        .values({
          firmId,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token!,
          expiry: new Date(tokens.expiry_date!)
        })
        .onConflictDoUpdate({
          target: [googleTokens.firmId],
          set: {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            expiry: new Date(tokens.expiry_date!),
            updatedAt: new Date()
          }
        })
        .returning();

      return savedToken;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Получить токены фирмы из БД и установить в OAuth клиент
   */
  async setFirmCredentials(firmId: string): Promise<void> {
    const [tokens] = await db.select()
      .from(googleTokens)
      .where(eq(googleTokens.firmId, firmId))
      .limit(1);

    if (!tokens) {
      throw new Error('No Google tokens found for this firm');
    }

    // Проверяем, не истекли ли токены
    if (new Date() > tokens.expiry) {
      await this.refreshTokens(firmId);
      return this.setFirmCredentials(firmId); // Рекурсивно вызываем после обновления
    }

    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiry.getTime()
    });
  }

  /**
   * Обновить истекшие токены
   */
  private async refreshTokens(firmId: string): Promise<void> {
    const [tokens] = await db.select()
      .from(googleTokens)
      .where(eq(googleTokens.firmId, firmId))
      .limit(1);

    if (!tokens) {
      throw new Error('No tokens to refresh');
    }

    const oauth2Client = await this.getOAuth2Client(firmId);
    oauth2Client.setCredentials({
      refresh_token: tokens.refreshToken
    });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      await db.update(googleTokens)
        .set({
          accessToken: credentials.access_token!,
          expiry: new Date(credentials.expiry_date!),
          updatedAt: new Date()
        })
        .where(eq(googleTokens.firmId, firmId));

    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw new Error('Failed to refresh access tokens');
    }
  }

  /**
   * Создать календарь
   */
  async createCalendar(name: string, description?: string, firmId?: string): Promise<string> {
    let oauth2Client;
    
    if (firmId) {
      // Получаем OAuth клиента для фирмы и устанавливаем токены
      oauth2Client = await this.getOAuth2Client(firmId);
      
      // Загружаем и устанавливаем токены
      const [tokens] = await db.select()
        .from(googleTokens)
        .where(eq(googleTokens.firmId, firmId))
        .limit(1);

      if (!tokens) {
        throw new Error('No Google tokens found for this firm');
      }

      // Проверяем, не истекли ли токены
      if (new Date() > tokens.expiry) {
        await this.refreshTokens(firmId);
        // Перезагружаем токены после обновления
        const [refreshedTokens] = await db.select()
          .from(googleTokens)
          .where(eq(googleTokens.firmId, firmId))
          .limit(1);
        
        oauth2Client.setCredentials({
          access_token: refreshedTokens!.accessToken,
          refresh_token: refreshedTokens!.refreshToken,
          expiry_date: refreshedTokens!.expiry.getTime()
        });
      } else {
        oauth2Client.setCredentials({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expiry_date: tokens.expiry.getTime()
        });
      }
    } else {
      throw new Error('firmId is required for creating calendar');
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    try {
      const response = await calendar.calendars.insert({
        requestBody: {
          summary: name,
          description: description || `Календарь для ${name}`,
          timeZone: 'Europe/Berlin'
        }
      });

      return response.data.id!;
    } catch (error) {
      console.error('Error creating calendar:', error);
      throw new Error('Failed to create calendar');
    }
  }

  /**
   * Добавить пользователя в ACL календаря
   */
  async addCalendarUser(calendarId: string, userEmail: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      await calendar.acl.insert({
        calendarId,
        requestBody: {
          role,
          scope: {
            type: 'user',
            value: userEmail
          }
        }
      });
    } catch (error) {
      console.error('Error adding calendar user:', error);
      throw new Error('Failed to add user to calendar');
    }
  }

  /**
   * Создать событие в календаре
   */
  async createEvent(calendarId: string, event: CalendarEvent): Promise<string> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: event.summary,
          location: event.location,
          description: event.description,
          start: {
            date: event.startDate,
            timeZone: 'Europe/Berlin'
          },
          end: {
            date: event.endDate,
            timeZone: 'Europe/Berlin'
          },
          colorId: event.colorId
        }
      });

      return response.data.id!;
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Обновить событие в календаре
   */
  async updateEvent(calendarId: string, eventId: string, event: Partial<CalendarEvent>): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          summary: event.summary,
          location: event.location,
          description: event.description,
          start: event.startDate ? {
            date: event.startDate,
            timeZone: 'Europe/Berlin'
          } : undefined,
          end: event.endDate ? {
            date: event.endDate,
            timeZone: 'Europe/Berlin'
          } : undefined,
          colorId: event.colorId
        }
      });
    } catch (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Удалить событие из календаря
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      await calendar.events.delete({
        calendarId,
        eventId
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Логировать операцию с календарем
   */
  async logOperation(logData: InsertCalendarLog): Promise<void> {
    try {
      await db.insert(calendarLogs).values(logData);
    } catch (error) {
      console.error('Error logging calendar operation:', error);
      // Не бросаем ошибку, чтобы не прерывать основную операцию
    }
  }

  /**
   * Получить URL календаря для просмотра
   */
  getCalendarViewUrl(calendarId: string): string {
    return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}`;
  }
}

// Экспортируем единственный экземпляр
export const googleCalendarService = new GoogleCalendarService();