import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { fileStorage as fileStorageService } from '../storage/fileStorage';
import { isAuthenticated } from '../replitAuth';
import type { InsertFileStorage } from '@shared/schema';
import { z } from 'zod';

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
  category: z.enum(['project_file', 'report', 'invoice', 'document', 'image']),
  projectId: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

// Загрузка файла
router.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не предоставлен' });
    }

    const validatedData = uploadFileSchema.parse(req.body);
    
    // Сохраняем файл на диск
    const fileMetadata = await fileStorageService.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      validatedData.category,
      validatedData.projectId
    );

    // Получаем ID пользователя из аутентификации
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    
    // Сохраняем метаданные в базу данных
    const fileRecord: InsertFileStorage = {
      fileId: fileMetadata.id,
      originalName: fileMetadata.originalName,
      fileName: fileMetadata.fileName,
      mimeType: fileMetadata.mimeType,
      size: fileMetadata.size,
      category: validatedData.category,
      projectId: validatedData.projectId,
      uploadedBy: parseInt(userId)
    };

    const savedFile = await storage.createFileRecord(fileRecord);

    // Добавляем запись в историю проекта, если файл связан с проектом
    if (validatedData.projectId) {
      await storage.addProjectHistory({
        projectId: validatedData.projectId,
        userId: parseInt(userId),
        changeType: 'file_added',
        fieldName: 'file',
        oldValue: null,
        newValue: fileMetadata.originalName,
        description: `Добавлен файл: ${fileMetadata.originalName}`
      });
    }

    res.json({
      id: savedFile.id,
      fileId: savedFile.fileId,
      originalName: savedFile.originalName,
      size: savedFile.size,
      category: savedFile.category,
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

// Получение файла
router.get('/:fileId', isAuthenticated, async (req, res) => {
  try {
    const fileRecord = await storage.getFileRecord(req.params.fileId);
    
    if (!fileRecord || fileRecord.isDeleted) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Проверяем права доступа к файлу
    // Если файл связан с проектом, проверяем доступ к проекту
    if (fileRecord.projectId) {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const hasAccess = await storage.hasProjectAccess(userId, fileRecord.projectId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Нет доступа к файлу' });
      }
    }

    const fileBuffer = await fileStorageService.getFile(fileRecord.fileName);
    
    res.set({
      'Content-Type': fileRecord.mimeType,
      'Content-Length': fileRecord.size.toString(),
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`
    });

    res.send(fileBuffer);

  } catch (error: any) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      message: 'Ошибка при получении файла',
      error: error.message 
    });
  }
});

// Получение списка файлов для проекта
router.get('/project/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    // Проверяем доступ к проекту
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    const hasAccess = await storage.hasProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к проекту' });
    }

    const files = await storage.getProjectFiles(projectId);
    res.json(files);

  } catch (error: any) {
    console.error('Error getting project files:', error);
    res.status(500).json({ 
      message: 'Ошибка при получении файлов проекта',
      error: error.message 
    });
  }
});

// Удаление файла
router.delete('/:fileId', isAuthenticated, async (req, res) => {
  try {
    const fileRecord = await storage.getFileRecord(req.params.fileId);
    
    if (!fileRecord || fileRecord.isDeleted) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Получаем ID пользователя из аутентификации
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    const userRole = (req.user as any)?.role || 'user';
    
    // Проверяем права доступа
    if (fileRecord.projectId) {
      const hasAccess = await storage.hasProjectAccess(userId, fileRecord.projectId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Нет доступа к файлу' });
      }
    }

    // Проверяем, что пользователь может удалить файл (загрузивший его или админ)
    if (fileRecord.uploadedBy !== parseInt(userId) && userRole !== 'admin') {
      return res.status(403).json({ message: 'Нет прав на удаление файла' });
    }

    // Мягкое удаление в базе данных
    await storage.deleteFileRecord(req.params.fileId);

    // Удаляем физический файл
    await fileStorageService.deleteFile(fileRecord.fileName);

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
router.get('/admin/storage-stats', isAuthenticated, async (req, res) => {
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