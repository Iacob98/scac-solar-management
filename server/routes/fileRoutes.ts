import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { fileStorage as fileStorageService } from '../storage/fileStorage';
import { isAuthenticated } from '../replitAuth';
import type { InsertFileStorage, InsertProjectFile } from '@shared/schema';
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
  category: z.enum(['project_file', 'report', 'invoice', 'document', 'image', 'profile']),
  projectId: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

// Загрузка файла (используем legacy формат для совместимости)
router.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не предоставлен' });
    }

    const validatedData = uploadFileSchema.parse(req.body);
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    
    // Сохраняем файл в папку uploads (legacy формат)
    const fs = await import('fs');
    const path = await import('path');
    
    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `${path.basename(req.file.originalname, fileExtension)}_${timestamp}${fileExtension}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, fileName);

    // Создаем папку uploads если не существует
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Сохраняем файл
    fs.writeFileSync(filePath, req.file.buffer);

    // Создаем запись в legacy таблице project_files
    const fileRecord: InsertProjectFile = {
      projectId: validatedData.projectId!,
      fileName: fileName,
      fileUrl: `/uploads/${fileName}`,
      fileType: req.file.mimetype
    };

    const savedFile = await storage.createFile(fileRecord);

    // Добавляем запись в историю проекта
    if (validatedData.projectId) {
      await storage.addProjectHistory({
        projectId: validatedData.projectId,
        userId: userId,
        changeType: 'file_added',
        fieldName: 'file',
        oldValue: null,
        newValue: req.file.originalname,
        description: `Добавлен файл: ${req.file.originalname}`
      });
    }

    console.log('File uploaded successfully (legacy):', {
      id: savedFile.id,
      fileName: savedFile.fileName,
      projectId: savedFile.projectId
    });

    res.json({
      id: savedFile.id,
      projectId: savedFile.projectId,
      fileName: savedFile.fileName,
      fileUrl: savedFile.fileUrl,
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

// Получение файла
router.get('/:fileId', isAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    
    // Сначала пытаемся найти в новой системе файлов
    const fileRecord = await storage.getFileRecord(req.params.fileId);
    
    if (fileRecord && !fileRecord.isDeleted) {
      // Обрабатываем файл из новой системы
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

      return res.send(fileBuffer);
    }

    // Если не найден в новой системе, пытаемся найти в legacy таблице
    const legacyFile = await storage.getFileById(fileId);
    
    if (!legacyFile) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Проверяем права доступа к legacy файлу
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    const hasAccess = await storage.hasProjectAccess(userId, legacyFile.projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к файлу' });
    }

    // Для legacy файлов используем файлы из папки uploads
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Путь к файлу в папке uploads
      const filePath = path.join(process.cwd(), 'uploads', legacyFile.fileName);
      
      // Проверяем существует ли файл
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Физический файл не найден' });
      }

      const fileBuffer = fs.readFileSync(filePath);
      
      res.set({
        'Content-Type': legacyFile.fileType,
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(legacyFile.fileName)}"`
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
router.get('/project/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    // Проверяем доступ к проекту
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    const hasAccess = await storage.hasProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к проекту' });
    }

    // Получаем файлы из legacy таблицы project_files
    const legacyFiles = await storage.getFilesByProjectId(projectId);
    
    // Пока используем только legacy файлы, так как новая система требует дополнительной настройки
    const combinedFiles = legacyFiles;

    res.json(combinedFiles);

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
    const fileId = parseInt(req.params.fileId);

    // Сначала пытаемся найти в новой системе файлов
    const fileRecord = await storage.getFileRecord(req.params.fileId);
    
    if (fileRecord && !fileRecord.isDeleted) {
      // Обрабатываем файл из новой системы
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const userRole = (req.user as any)?.role || 'user';
      
      // Проверяем права доступа
      if (fileRecord.projectId) {
        const hasAccess = await storage.hasProjectAccess(userId, fileRecord.projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Нет доступа к файлу' });
        }
      }

      // Проверяем, что пользователь может удалить файл
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

      return res.json({ message: 'Файл успешно удален' });
    }

    // Если не найден в новой системе, пытаемся найти в legacy таблице project_files
    const legacyFile = await storage.getFileById(fileId);
    
    if (!legacyFile) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    // Проверяем права доступа к legacy файлу
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
    const hasAccess = await storage.hasProjectAccess(userId, legacyFile.projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к файлу' });
    }

    // Удаляем legacy файл
    await storage.deleteFile(fileId);

    // Добавляем запись в историю проекта для legacy файла
    await storage.createProjectHistoryEntry({
      projectId: legacyFile.projectId,
      userId,
      changeType: 'file_deleted',
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