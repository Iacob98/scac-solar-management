import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { fileStorage as fileStorageTable } from '../../shared/schema';
import { supabase } from '../supabaseClient';

type FileRecord = typeof fileStorageTable.$inferSelect;

const BUCKET = 'files';
const LOCAL_UPLOADS_DIR = './uploads';

export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  projectId?: number;
  category: 'project_file' | 'report' | 'invoice' | 'document' | 'image' | 'profile';
  storagePath?: string;
}

export class FileStorage {
  private baseDir: string;

  constructor(baseDir: string = LOCAL_UPLOADS_DIR) {
    this.baseDir = baseDir;
  }

  /**
   * Builds the storage path: {category}/{fileName}
   */
  private buildStoragePath(category: string, fileName: string): string {
    // Map category to folder name
    const folderMap: Record<string, string> = {
      'project_file': 'project-files',
      'report': 'project-files',
      'invoice': 'invoices',
      'document': 'project-files',
      'image': 'project-files',
      'profile': 'avatars',
    };
    const folder = folderMap[category] || 'project-files';
    return `${folder}/${fileName}`;
  }

  /**
   * Saves a file to Supabase Storage
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
    const storagePath = this.buildStoragePath(category, fileName);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error(`[FileStorage] Supabase upload error for ${storagePath}:`, error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    console.log(`[FileStorage] Uploaded to Supabase: ${storagePath} (${buffer.length} bytes)`);

    return {
      id: fileId,
      originalName,
      fileName,
      mimeType,
      size: buffer.length,
      uploadedAt: new Date(),
      projectId,
      category,
      storagePath,
    };
  }

  /**
   * Gets a file from Supabase Storage, with local fallback for old files
   */
  async getFile(fileName: string, storagePath?: string): Promise<Buffer> {
    // If we have a storagePath, try Supabase first
    if (storagePath) {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .download(storagePath);

        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
        console.warn(`[FileStorage] Supabase download failed for ${storagePath}: ${error?.message}`);
      } catch (err: any) {
        console.warn(`[FileStorage] Supabase download error for ${storagePath}:`, err.message);
      }
    }

    // Try to find in Supabase by guessing common paths
    if (!storagePath) {
      const guesses = [
        `project-files/${fileName}`,
        `invoices/${fileName}`,
        `avatars/${fileName}`,
      ];
      for (const guess of guesses) {
        try {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .download(guess);
          if (!error && data) {
            const arrayBuffer = await data.arrayBuffer();
            console.log(`[FileStorage] Found file in Supabase at: ${guess}`);
            return Buffer.from(arrayBuffer);
          }
        } catch {
          // continue to next guess
        }
      }
    }

    // Fallback: try local ./uploads/ directory (for old files)
    const filePath = path.join(this.baseDir, fileName);
    try {
      const buffer = await fs.readFile(filePath);
      console.log(`[FileStorage] Fallback: read from local disk: ${filePath}`);
      return buffer;
    } catch {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  /**
   * Deletes a file from Supabase Storage
   */
  async deleteFile(fileName: string, storagePath?: string): Promise<void> {
    if (storagePath) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (error) {
        console.warn(`[FileStorage] Supabase delete warning for ${storagePath}: ${error.message}`);
      } else {
        console.log(`[FileStorage] Deleted from Supabase: ${storagePath}`);
        return;
      }
    }

    // Try all possible paths if no storagePath given
    const paths = [
      `project-files/${fileName}`,
      `invoices/${fileName}`,
      `avatars/${fileName}`,
    ];
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (error) {
      console.warn(`[FileStorage] Supabase delete warning: ${error.message}`);
    }

    // Also try to delete local file (cleanup)
    try {
      const filePath = path.join(this.baseDir, fileName);
      await fs.unlink(filePath);
    } catch {
      // File may not exist locally, that's fine
    }
  }

  /**
   * Checks if a file exists in Supabase Storage or locally
   */
  async fileExists(fileName: string, storagePath?: string): Promise<boolean> {
    if (storagePath) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);
      if (!error && data) return true;
    }

    // Check local fallback
    const filePath = path.join(this.baseDir, fileName);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets storage stats (Supabase-aware)
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    baseDir: string;
  }> {
    // Count local files as a baseline
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
        baseDir: this.baseDir,
      };
    } catch {
      return { totalFiles: 0, totalSize: 0, baseDir: this.baseDir };
    }
  }

  /**
   * Saves an invoice PDF to Supabase Storage and creates a DB record
   */
  async saveInvoicePDF(
    pdfBuffer: Buffer,
    invoiceNumber: string,
    projectId: number,
    uploadedBy: string
  ): Promise<FileRecord> {
    const fileId = randomUUID();
    const fileName = `invoice_${invoiceNumber}_${Date.now()}.pdf`;
    const storagePath = this.buildStoragePath('invoice', fileName);

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error(`[FileStorage] Supabase upload error for invoice PDF:`, error.message);
      throw new Error(`Failed to upload invoice PDF: ${error.message}`);
    }

    console.log(`[FileStorage] Invoice PDF uploaded to Supabase: ${storagePath}`);

    // Create DB record
    const [fileRecord] = await db
      .insert(fileStorageTable)
      .values({
        fileId,
        originalName: `Счет ${invoiceNumber}.pdf`,
        fileName,
        mimeType: 'application/pdf',
        size: pdfBuffer.length,
        category: 'invoice',
        projectId,
        uploadedBy,
        storagePath,
        uploadedAt: new Date(),
        isDeleted: false,
      })
      .returning();

    return fileRecord;
  }
}

// Export global instance
export const fileStorageService = new FileStorage();
export const fileStorage = fileStorageService; // Backward compatibility
