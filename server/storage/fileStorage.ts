import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { fileStorage } from '../../shared/schema';

type FileRecord = typeof fileStorage.$inferSelect;

export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  projectId?: number;
  category: 'project_file' | 'report' | 'invoice' | 'document' | 'image';
}

export class FileStorage {
  private baseDir: string;

  constructor(baseDir: string = './uploads') {
    this.baseDir = baseDir;
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  /**
   * Сохраняет файл на диск
   * @param buffer - данные файла
   * @param originalName - оригинальное имя файла
   * @param mimeType - MIME тип файла
   * @param category - категория файла
   * @param projectId - ID проекта (опционально)
   * @returns метаданные сохраненного файла
   */
  async saveFile(
    buffer: Buffer, 
    originalName: string, 
    mimeType: string, 
    category: FileMetadata['category'],
    projectId?: number
  ): Promise<FileMetadata> {
    const fileId = randomUUID();
    const extension = path.extname(originalName);
    const fileName = `${fileId}${extension}`;
    const filePath = path.join(this.baseDir, fileName);

    await fs.writeFile(filePath, buffer);

    const metadata: FileMetadata = {
      id: fileId,
      originalName,
      fileName,
      mimeType,
      size: buffer.length,
      uploadedAt: new Date(),
      projectId,
      category
    };

    return metadata;
  }

  /**
   * Получает файл с диска
   * @param fileName - имя файла для получения
   * @returns данные файла
   */
  async getFile(fileName: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, fileName);
    
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`Файл не найден: ${fileName}`);
    }
  }

  /**
   * Удаляет файл с диска
   * @param fileName - имя файла для удаления
   */
  async deleteFile(fileName: string): Promise<void> {
    const filePath = path.join(this.baseDir, fileName);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Игнорируем ошибку если файл уже не существует
      console.warn(`Файл не найден при удалении: ${fileName}`);
    }
  }

  /**
   * Проверяет существование файла
   * @param fileName - имя файла для проверки
   * @returns true если файл существует
   */
  async fileExists(fileName: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, fileName);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получает размер файла
   * @param fileName - имя файла
   * @returns размер файла в байтах
   */
  async getFileSize(fileName: string): Promise<number> {
    const filePath = path.join(this.baseDir, fileName);
    
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      throw new Error(`Не удалось получить размер файла: ${fileName}`);
    }
  }

  /**
   * Получает статистику использования хранилища
   * @returns информация о хранилище
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    baseDir: string;
  }> {
    try {
      const files = await fs.readdir(this.baseDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        baseDir: this.baseDir
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        baseDir: this.baseDir
      };
    }
  }

  /**
   * Очищает все файлы из хранилища (ОСТОРОЖНО!)
   */
  async clearStorage(): Promise<void> {
    try {
      const files = await fs.readdir(this.baseDir);
      
      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('Ошибка при очистке хранилища:', error);
      throw new Error('Не удалось очистить хранилище');
    }
  }

  async saveInvoicePDF(pdfBuffer: Buffer, invoiceNumber: string, projectId: number, uploadedBy: string): Promise<FileRecord> {
    const fileId = randomUUID();
    const fileName = `invoice_${invoiceNumber}_${Date.now()}.pdf`;
    const filePath = path.join(this.baseDir, fileName);

    // Сохраняем PDF файл на диск
    await fs.writeFile(filePath, pdfBuffer);

    // Создаем запись в базе данных
    const [fileRecord] = await db
      .insert(fileStorage)
      .values({
        fileId,
        originalName: `Счет ${invoiceNumber}.pdf`,
        fileName,
        mimeType: 'application/pdf',
        size: pdfBuffer.length,
        category: 'invoice',
        projectId,
        uploadedBy: parseInt(uploadedBy),
        uploadedAt: new Date(),
        isDeleted: false
      })
      .returning();

    return fileRecord;
  }
}

// Экспортируем глобальный экземпляр
export const fileStorageService = new FileStorage();
export const fileStorage = fileStorageService; // Backward compatibility