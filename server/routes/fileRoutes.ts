import express from 'express';
import multer from 'multer';
import path from 'path';
import { storage } from '../storage';
import { fileStorageService } from '../storage/fileStorage';
import { authenticateSupabase } from '../middleware/supabaseAuth.js';
import type { InsertFileStorage, InsertProjectFile } from '@shared/schema';
import { z } from 'zod';

// Функция для определения MIME-типа по расширению файла
function getMimeTypeFromExtension(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'txt': 'text/plain',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

const router = express.Router();

// Настройка multer для загрузки файлов в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB максимум
  },
  fileFilter: (req, file, cb) => {
    // Разрешенные MIME типы
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
    }
  }
});

const uploadFileSchema = z.object({
  category: z.enum(['project_file', 'report', 'invoice', 'document', 'image', 'profile']),
  projectId: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

// Загрузка файла (используем legacy формат для совместимости)
router.post('/upload', authenticateSupabase, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('[fileRoutes] No file provided in request');
      return res.status(400).json({ message: 'Файл не предоставлен' });
    }

    const validatedData = uploadFileSchema.parse(req.body);
    const userId = req.user.id;

    // Save file to Supabase Storage via fileStorageService
    const metadata = await fileStorageService.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      validatedData.category,
      validatedData.projectId
    );

    // Для файлов профиля (аватаров) не создаем запись в project_files
    if (validatedData.category === 'profile') {
      // Возвращаем путь к файлу для профиля (используем публичный роут avatar)
      return res.json({
        fileId: metadata.fileName,
        fileName: metadata.fileName,
        fileUrl: `/api/files/avatar/${metadata.fileName}`,
        fileType: req.file.mimetype
      });
    }

    // Для проектных файлов требуется projectId
    if (!validatedData.projectId) {
      return res.status(400).json({ message: 'projectId обязателен для файлов проекта' });
    }

    // Создаем запись в legacy таблице project_files
    const fileRecord: InsertProjectFile = {
      projectId: validatedData.projectId,
      fileName: metadata.fileName,
      fileUrl: `/api/files/download/${metadata.fileName}`, // API URL для скачивания
      fileType: req.file.mimetype
    };

    const savedFile = await storage.createFile(fileRecord);

    // Добавляем запись в историю проекта
    await storage.addProjectHistory({
      projectId: validatedData.projectId,
      userId: userId,
      changeType: 'file_added',
      fieldName: 'file',
      oldValue: null,
      newValue: req.file.originalname,
      description: `Добавлен файл: ${req.file.originalname}`
    });

    res.json({
      id: savedFile.id,
      projectId: savedFile.projectId,
      fileName: savedFile.fileName,
      fileUrl: `/api/files/${savedFile.id}`, // Используем API URL
      fileType: savedFile.fileType,
      uploadedAt: savedFile.uploadedAt
    });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      message: 'Ошибка при загрузке файла',
      error: error.message
    });
  }
});

// Публичный доступ к аватаркам профиля (без аутентификации)
// Имена файлов — UUID, не угадываемые. img-теги не могут передать Authorization header.
// ВАЖНО: Этот роут должен быть ПЕРЕД /:fileId, иначе он не будет работать
router.get('/avatar/:fileName', async (req, res) => {
  try {
    // Sanitize fileName to prevent path traversal
    const fileName = path.basename(req.params.fileName);
    const mimeType = getMimeTypeFromExtension(fileName);

    // Проверяем что это изображение
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ message: 'Файл не является изображением' });
    }

    // Get from Supabase Storage (with local fallback)
    const storagePath = `avatars/${fileName}`;
    const fileBuffer = await fileStorageService.getFile(fileName, storagePath);

    res.set({
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(fileBuffer);

  } catch (error: any) {
    console.error('Error serving avatar:', error);
    res.status(404).json({
      message: 'Файл не найден',
      error: error.message
    });
  }
});

// Получение файла
router.get('/:fileId', authenticateSupabase, async (req, res) => {
  try {
    const fileIdParam = req.params.fileId;
    const fileId = parseInt(fileIdParam);
    // Проверяем, является ли fileId UUID (для новой системы) или числом (для legacy)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdParam);

    // Сначала пытаемся найти в новой системе файлов (только если это UUID)
    let fileRecord = null;
    if (isUUID) {
      fileRecord = await storage.getFileRecord(fileIdParam);
    }
    
    if (fileRecord && !fileRecord.isDeleted) {
      // Обрабатываем файл из новой системы
      if (fileRecord.projectId) {
        const userId = req.user.id;
        const hasAccess = await storage.hasProjectAccess(userId, fileRecord.projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Нет доступа к файлу' });
        }
      }

      // Get file from Supabase Storage (with local fallback)
      const fileBuffer = await fileStorageService.getFile(fileRecord.fileName, fileRecord.storagePath || undefined);

      res.set({
        'Content-Type': fileRecord.mimeType,
        'Content-Length': fileRecord.size.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`
      });

      return res.send(fileBuffer);
    }

    // Если не найден в новой системе, пытаемся найти в legacy таблице
    const legacyFile = await storage.getFileById(fileId);

    if (!legacyFile) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Проверяем права доступа к legacy файлу
    const userId = req.user.id;
    const hasAccess = await storage.hasProjectAccess(userId, legacyFile.projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к файлу' });
    }

    // Get legacy file via fileStorageService (Supabase first, local fallback)
    try {
      const fileBuffer = await fileStorageService.getFile(legacyFile.fileName || '');
      const mimeType = getMimeTypeFromExtension(legacyFile.fileName || '');

      res.set({
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(legacyFile.fileName || 'file')}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(fileBuffer);

    } catch (fileError) {
      console.error('Error reading legacy file:', fileError);
      return res.status(404).json({ message: 'Не удалось прочитать файл' });
    }

  } catch (error: any) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      message: 'Ошибка при получении файла',
      error: error.message 
    });
  }
});

// Получение списка файлов для проекта (объединяем legacy и новые файлы)
router.get('/project/:projectId', authenticateSupabase, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    // Проверяем доступ к проекту
    const userId = req.user.id;
    const hasAccess = await storage.hasProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к проекту' });
    }

    // Получаем файлы из legacy таблицы project_files
    const legacyFiles = await storage.getFilesByProjectId(projectId);
    
    // Получаем файлы из новой системы file_storage
    const newFiles = await storage.getProjectFiles(projectId);
    
    // Преобразуем новые файлы в формат совместимый с legacy
    const transformedNewFiles = newFiles.map(file => ({
      id: file.id,
      projectId: file.projectId || projectId,
      fileUrl: `/api/files/${file.fileId}`, // Используем fileId для новой системы
      fileName: file.originalName,
      fileType: file.category,
      uploadedAt: file.uploadedAt
    }));
    
    // Объединяем legacy и новые файлы
    const combinedFiles = [...legacyFiles, ...transformedNewFiles];

    res.json(combinedFiles);

  } catch (error: any) {
    console.error('Error getting project files:', error);
    res.status(500).json({ 
      message: 'Ошибка при получении файлов проекта',
      error: error.message 
    });
  }
});

// Скачивание файла по имени (для API URL /api/files/download/:fileName)
router.get('/download/:fileName', authenticateSupabase, async (req, res) => {
  try {
    // Sanitize fileName to prevent path traversal
    const fileName = path.basename(req.params.fileName);

    // Get file from Supabase Storage (with local fallback)
    const fileBuffer = await fileStorageService.getFile(fileName);
    const mimeType = getMimeTypeFromExtension(fileName);

    res.set({
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length.toString(),
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.send(fileBuffer);

  } catch (error: any) {
    console.error('Error downloading file by name:', error);
    res.status(404).json({
      message: 'Файл не найден',
      error: error.message
    });
  }
});

// Удаление файла
router.delete('/:fileId', authenticateSupabase, async (req, res) => {
  try {
    const fileIdParam = req.params.fileId;
    const fileId = parseInt(fileIdParam);

    // Проверяем, является ли fileId UUID (для новой системы) или числом (для legacy)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdParam);

    // Сначала пытаемся найти в новой системе файлов (только если это UUID)
    let fileRecord = null;
    if (isUUID) {
      fileRecord = await storage.getFileRecord(fileIdParam);
    }

    if (fileRecord && !fileRecord.isDeleted) {
      // Обрабатываем файл из новой системы
      const userId = req.user.id;
      const userRole = req.user.role || 'user';
      
      // Проверяем права доступа
      if (fileRecord.projectId) {
        const hasAccess = await storage.hasProjectAccess(userId, fileRecord.projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Нет доступа к файлу' });
        }
      }

      // Проверяем, что пользователь может удалить файл
      // uploadedBy is UUID string, userId is also UUID string
      if (fileRecord.uploadedBy !== userId && userRole !== 'admin') {
        return res.status(403).json({ message: 'Нет прав на удаление файла' });
      }

      // Мягкое удаление в базе данных
      await storage.deleteFileRecord(fileIdParam);
      // Удаляем файл из Supabase Storage
      await fileStorageService.deleteFile(fileRecord.fileName, fileRecord.storagePath || undefined);

      // Добавляем запись в историю проекта
      if (fileRecord.projectId) {
        await storage.addProjectHistory({
          projectId: fileRecord.projectId,
          userId: req.user!.id,
          changeType: 'file_deleted',
          fieldName: 'file',
          oldValue: fileRecord.originalName,
          newValue: null,
          description: `Удален файл: ${fileRecord.originalName}`
        });
      }

      return res.json({ message: 'Файл успешно удален' });
    }

    // Если не найден в новой системе, пытаемся найти в legacy таблице project_files
    const legacyFile = await storage.getFileById(fileId);
    
    if (!legacyFile) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Проверяем права доступа к legacy файлу
    const userId = req.user.id;
    const hasAccess = await storage.hasProjectAccess(userId, legacyFile.projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к файлу' });
    }

    // Удаляем legacy файл
    await storage.deleteFile(fileId);

    // Добавляем запись в историю проекта для legacy файла
    await storage.addProjectHistory({
      projectId: legacyFile.projectId,
      userId,
      changeType: 'file_deleted',
      fieldName: 'file',
      oldValue: legacyFile.fileName,
      newValue: null,
      description: `Удален файл: ${legacyFile.fileName}`,
    });

    res.json({ message: 'Файл успешно удален' });

  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      message: 'Ошибка при удалении файла',
      error: error.message 
    });
  }
});

// Получение статистики хранилища (только для админов)
router.get('/admin/storage-stats', authenticateSupabase, async (req, res) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const diskStats = await fileStorageService.getStorageStats();
    const dbStats = await storage.getFileStorageStats();

    res.json({
      disk: diskStats,
      database: dbStats
    });

  } catch (error: any) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ 
      message: 'Ошибка при получении статистики',
      error: error.message 
    });
  }
});

export default router;