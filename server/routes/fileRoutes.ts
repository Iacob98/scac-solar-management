import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { fileStorage as fileStorageService } from '../storage/fileStorage';
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
      return res.status(400).json({ message: 'Файл не предоставлен' });
    }

    const validatedData = uploadFileSchema.parse(req.body);
    const userId = req.user.id;
    
    // Сохраняем файл в папку uploads (legacy формат)
    const fs = await import('fs');
    const path = await import('path');
    
    // Создаем уникальное имя файла с правильной кодировкой
    const timestamp = Date.now();
    const fileExtension = path.extname(req.file.originalname);
    // Убираем кириллицу из имени файла для избежания проблем с кодировкой
    const baseName = path.basename(req.file.originalname, fileExtension)
      .replace(/[^\w\-\.]/g, '_'); // Заменяем все не-ASCII символы на подчеркивания
    const fileName = `${baseName}_${timestamp}${fileExtension}`;
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
      fileUrl: null, // Не используем прямые URL, только API
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

// Получение файла
router.get('/:fileId', authenticateSupabase, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    console.log(`🔍 GET /api/files/${fileId} - пользователь запрашивает файл`);
    
    // Сначала пытаемся найти в новой системе файлов
    const fileRecord = await storage.getFileRecord(req.params.fileId);
    
    if (fileRecord && !fileRecord.isDeleted) {
      // Обрабатываем файл из новой системы
      if (fileRecord.projectId) {
        const userId = req.user.id;
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
    const userId = req.user.id;
    const hasAccess = await storage.hasProjectAccess(userId, legacyFile.projectId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Нет доступа к файлу' });
    }

    // Для legacy файлов используем файлы из папки uploads
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Путь к файлу в папке uploads
      const filePath = path.join(process.cwd(), 'uploads', legacyFile.fileName || '');
      
      // Проверяем существует ли файл
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Физический файл не найден' });
      }

      const fileBuffer = fs.readFileSync(filePath);
      
      // Определяем правильный MIME-тип по расширению файла
      const mimeType = getMimeTypeFromExtension(legacyFile.fileName || '');
      
      console.log(`📄 Отправляем файл: ${legacyFile.fileName}, MIME: ${mimeType}, размер: ${fileBuffer.length} байт`);
      
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

// Удаление файла
router.delete('/:fileId', authenticateSupabase, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);

    // Сначала пытаемся найти в новой системе файлов
    const fileRecord = await storage.getFileRecord(req.params.fileId);
    
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
    const userId = req.user.id;
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