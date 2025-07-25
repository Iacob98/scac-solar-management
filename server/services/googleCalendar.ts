import { google } from 'googleapis';
import { db } from '../db';
import { googleTokens, calendarLogs, googleCalendarSettings, projects, crewMembers, type GoogleToken, type InsertCalendarLog } from '@shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

export interface CalendarEvent {
  summary: string;
  location?: string;
  description?: string;
  startDate: string;
  endDate: string;
  colorId?: string;
}

export class GoogleCalendarService {
  private oauth2Client: any = null;
  
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
      prompt: 'consent' // принудительно запрашиваем consent для получения refresh_token
    });
  }

  /**
   * Обменять код авторизации на токены
   */
  async exchangeCodeForTokens(code: string, firmId: string): Promise<GoogleToken> {
    try {
      const oauth2Client = await this.getOAuth2Client(firmId);
      const { tokens } = await oauth2Client.getToken(code);
      
      // Проверяем что получили refresh_token
      if (!tokens.refresh_token) {
        throw new Error('No refresh token received. Please try again with prompt=consent.');
      }
      
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
   * Создать событие для участников бригады при назначении проекта
   */
  async createProjectEventForCrewMembers(projectId: number, crewId: number): Promise<void> {
    try {
      // Получаем данные проекта
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      // Получаем участников бригады с Google Calendar ID
      const members = await db
        .select()
        .from(crewMembers)
        .where(and(
          eq(crewMembers.crewId, crewId),
          isNotNull(crewMembers.googleCalendarId)
        ));

      if (members.length === 0) {
        console.log('No crew members with Google Calendar access found');
        return;
      }

      // Получаем OAuth2 клиента для фирмы
      const oauth2Client = await this.getOAuth2Client(project.firmId);
      
      // Получаем токены для аутентификации
      const [token] = await db
        .select()
        .from(googleTokens)
        .where(eq(googleTokens.firmId, project.firmId));
      
      if (!token) {
        throw new Error('Google Calendar not authorized for this firm');
      }
      
      oauth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken
      });
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Создаем событие для каждого участника
      for (const member of members) {
        if (member.googleCalendarId) {
          const eventData = {
            summary: `Проект: ${project.id} - Установка солнечных панелей`,
            location: project.installationPersonAddress || 'Адрес установки не указан',
            description: this.buildProjectEventDescription(project),
            start: {
              date: project.workStartDate || project.startDate,
              timeZone: 'Europe/Berlin'
            },
            end: {
              date: project.workEndDate || project.endDate || project.workStartDate || project.startDate,
              timeZone: 'Europe/Berlin'
            },
            colorId: '9', // Синий цвет для рабочих событий
            attendees: [
              {
                email: member.memberEmail,
                displayName: `${member.firstName} ${member.lastName}`,
                responseStatus: 'accepted'
              }
            ],
            guestsCanInviteOthers: false,
            guestsCanModify: false,
            guestsCanSeeOtherGuests: true
          };

          try {
            await calendar.events.insert({
              calendarId: member.googleCalendarId,
              requestBody: eventData,
            });

            console.log(`Event created for crew member ${member.firstName} ${member.lastName} (${member.googleCalendarId})`);
          } catch (memberError) {
            console.warn(`Failed to create event for member ${member.firstName} ${member.lastName}:`, memberError);
          }
        }
      }
    } catch (error) {
      console.error('Error creating project events for crew members:', error);
      throw error;
    }
  }

  /**
   * Создать описание события для проекта
   */
  private buildProjectEventDescription(project: any): string {
    const parts = [
      `🏗️ Установка солнечных панелей`,
      ``,
      `📋 Детали проекта:`,
      `• Проект №${project.id}`,
      `• Статус: ${project.status}`,
    ];

    if (project.installationPersonFirstName || project.installationPersonLastName) {
      const name = [project.installationPersonFirstName, project.installationPersonLastName]
        .filter(Boolean).join(' ');
      parts.push(`• Клиент: ${name}`);
    }

    if (project.installationPersonAddress) {
      parts.push(`• Адрес: ${project.installationPersonAddress}`);
    }

    if (project.installationPersonPhone) {
      parts.push(`• Телефон: ${project.installationPersonPhone}`);
    }

    parts.push(``);

    if (project.equipmentExpectedDate) {
      parts.push(`📦 Ожидание оборудования: ${project.equipmentExpectedDate}`);
    }

    if (project.equipmentArrivedDate) {
      parts.push(`✅ Оборудование поступило: ${project.equipmentArrivedDate}`);
    }

    if (project.workStartDate) {
      parts.push(`🚀 Начало работ: ${project.workStartDate}`);
    }

    if (project.workEndDate) {
      parts.push(`🏁 Окончание работ: ${project.workEndDate}`);
    }

    if (project.notes) {
      parts.push(`📝 Примечания: ${project.notes}`);
    }

    // Добавляем ссылку для загрузки фотографий бригадой
    if (project.crewUploadToken) {
      const getBaseUrl = () => {
        if (process.env.REPLIT_DOMAINS) {
          return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
        }
        if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
          return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        }
        return process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://scac.app';
      };
      const baseUrl = getBaseUrl();
      parts.push(``, `📸 Фото-отчёт бригады:`, `${baseUrl}/upload/${project.id}/${project.crewUploadToken}`);
    }

    parts.push(``, `---`, `Система SCAC - Управление проектами`);

    return parts.join('\n');
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
   * Получить события календаря за указанную дату
   */
  async getCalendarEvents(calendarId: string, date: string) {
    const calendar = google.calendar('v3');
    
    // Начало и конец дня для указанной даты
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    return response.data.items || [];
  }

  /**
   * Обновить даты проекта в календарных событиях
   */
  async updateProjectDates(projectId: number, crewId: number, updatedDates: { workStartDate?: string; workEndDate?: string }): Promise<void> {
    try {
      // Получаем данные проекта
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      // Получаем участников бригады с Google Calendar ID
      const members = await db
        .select()
        .from(crewMembers)
        .where(and(
          eq(crewMembers.crewId, crewId),
          isNotNull(crewMembers.googleCalendarId)
        ));

      if (members.length === 0) {
        console.log('No crew members with Google Calendar access found');
        return;
      }

      // Получаем OAuth2 клиента для фирмы
      const oauth2Client = await this.getOAuth2Client(project.firmId);
      
      // Получаем токены для аутентификации
      const [token] = await db
        .select()
        .from(googleTokens)
        .where(eq(googleTokens.firmId, project.firmId));
      
      if (!token) {
        throw new Error('Google Calendar not authorized for this firm');
      }
      
      oauth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken
      });
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Обновляем события для каждого участника
      for (const member of members) {
        if (member.googleCalendarId) {
          try {
            // Получаем события проекта в календаре участника
            const events = await calendar.events.list({
              calendarId: member.googleCalendarId,
              q: `Проект: ${project.id}`,
              timeMin: new Date().toISOString(),
              maxResults: 10
            });

            if (events.data.items && events.data.items.length > 0) {
              // Обновляем каждое найденное событие
              for (const event of events.data.items) {
                if (event.id) {
                  const updatedEventData = {
                    summary: event.summary,
                    location: event.location,
                    description: this.buildProjectEventDescription(project),
                    start: {
                      date: updatedDates.workStartDate || project.workStartDate || project.startDate,
                      timeZone: 'Europe/Berlin'
                    },
                    end: {
                      date: updatedDates.workEndDate || project.workEndDate || project.endDate || updatedDates.workStartDate || project.workStartDate || project.startDate,
                      timeZone: 'Europe/Berlin'
                    }
                  };

                  await calendar.events.patch({
                    calendarId: member.googleCalendarId,
                    eventId: event.id,
                    requestBody: updatedEventData
                  });

                  console.log(`Updated calendar event for member ${member.firstName} ${member.lastName}`);
                }
              }
            }
          } catch (memberError) {
            console.warn(`Failed to update events for member ${member.firstName} ${member.lastName}:`, memberError);
          }
        }
      }
    } catch (error) {
      console.error('Error updating project dates in calendar:', error);
      throw error;
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