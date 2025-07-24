/**
 * Файл: server/modules/auth/auth.service.ts
 * Назначение: Бизнес-логика аутентификации пользователей
 * Используется в: auth.controller.ts
 * Зависимости: storage
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import { storage } from "../../storage";
import type { User } from "@shared/schema";

/**
 * Сервис для работы с аутентификацией пользователей
 */
export class AuthService {
  /**
   * Получить пользователя по ID
   * @param userId Идентификатор пользователя
   * @returns Данные пользователя или null
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      return await storage.getUser(userId);
    } catch (error) {
      console.error('AuthService: Error getting user by ID:', error);
      throw new Error('Не удалось получить данные пользователя');
    }
  }

  /**
   * Получить список всех тестовых пользователей
   * @returns Массив тестовых пользователей
   */
  async getTestUsers(): Promise<User[]> {
    try {
      return await storage.getTestUsers();
    } catch (error) {
      console.error('AuthService: Error getting test users:', error);
      throw new Error('Не удалось получить список тестовых пользователей');
    }
  }

  /**
   * Проверить права администратора у пользователя
   * @param userId Идентификатор пользователя
   * @returns true если пользователь администратор
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user?.role === 'admin';
    } catch (error) {
      console.error('AuthService: Error checking admin rights:', error);
      return false;
    }
  }

  /**
   * Проверить существование пользователя
   * @param userId Идентификатор пользователя
   * @returns true если пользователь существует
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user !== null;
    } catch (error) {
      console.error('AuthService: Error checking user existence:', error);
      return false;
    }
  }

  /**
   * Создать тестовую сессию для пользователя
   * @param userId Идентификатор пользователя
   * @param session Объект сессии Express
   * @returns Данные пользователя
   */
  async createTestSession(userId: string, session: any): Promise<User> {
    const user = await this.getUserById(userId);
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Создаем тестовую сессию
    session.user = user;
    session.userId = userId;

    return user;
  }
}

// Экспортируем единственный экземпляр сервиса
export const authService = new AuthService();