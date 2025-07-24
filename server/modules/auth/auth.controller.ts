/**
 * Файл: server/modules/auth/auth.controller.ts
 * Назначение: Контроллер аутентификации пользователей
 * Используется в: auth.routes.ts
 * Зависимости: storage, replitAuth
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Получить информацию о текущем пользователе
 * @param req HTTP запрос с данными пользователя
 * @param res HTTP ответ
 */
export const getCurrentUser = async (req: any, res: Response) => {
  try {
    // Поддержка как Replit Auth, так и тестовых сессий
    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

/**
 * Получить список тестовых пользователей для разработки
 * @param req HTTP запрос
 * @param res HTTP ответ
 */
export const getTestUsers = async (req: Request, res: Response) => {
  try {
    const testUsers = await storage.getTestUsers();
    res.json(testUsers);
  } catch (error) {
    console.error("Error fetching test users:", error);
    res.status(500).json({ message: "Failed to fetch test users" });
  }
};

/**
 * Войти как тестовый пользователь (только для разработки)
 * @param req HTTP запрос с ID пользователя
 * @param res HTTP ответ
 */
export const loginAsTestUser = async (req: any, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Создаем тестовую сессию
    req.session.user = user;
    req.session.userId = userId;
    
    res.json({ 
      success: true, 
      message: `Logged in as ${user.firstName} ${user.lastName}`,
      user 
    });
  } catch (error) {
    console.error("Error in test login:", error);
    res.status(500).json({ message: "Failed to login as test user" });
  }
};

/**
 * Выйти из системы
 * @param req HTTP запрос
 * @param res HTTP ответ
 */
export const logout = async (req: any, res: Response) => {
  try {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      
      res.clearCookie('connect.sid');
      res.json({ success: true, message: "Logged out successfully" });
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
};