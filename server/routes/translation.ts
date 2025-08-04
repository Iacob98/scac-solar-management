import { Router } from 'express';
import { translationService, type TranslationEntry } from '../services/translationService';
import { isAuthenticated } from '../replitAuth';
import { requireAdmin } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

/**
 * GET /api/translations - Получить все переводы
 */
router.get('/api/translations', isAuthenticated, async (req, res) => {
  try {
    // Загружаем переводы из файла, если он существует
    const translationsPath = path.join(process.cwd(), 'shared', 'translations.json');
    
    try {
      const data = await fs.readFile(translationsPath, 'utf-8');
      const translations = JSON.parse(data);
      res.json(translations);
    } catch (error) {
      // Если файл не существует, возвращаем пустой объект
      res.json({});
    }
  } catch (error) {
    console.error('Error loading translations:', error);
    res.status(500).json({ error: 'Failed to load translations' });
  }
});

/**
 * POST /api/translations/analyze - Анализировать файлы и создать переводы
 */
router.post('/api/translations/analyze', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    console.log('Starting translation analysis...');
    
    const allTranslations: Record<string, { ru: string; de: string }> = {};
    const processedTexts = new Set<string>();
    
    // Список файлов для анализа
    const filesToAnalyze = [
      // Frontend страницы
      'client/src/pages/Home.tsx',
      'client/src/pages/Projects.tsx', 
      'client/src/pages/ProjectsWrapper.tsx',
      'client/src/pages/Clients.tsx',
      'client/src/pages/Crews.tsx',
      'client/src/pages/Invoices.tsx',
      'client/src/pages/Calendar.tsx',
      'client/src/pages/Settings.tsx',
      'client/src/pages/admin/Users.tsx',
      'client/src/pages/admin/FirmsManagement.tsx',
      
      // Компоненты
      'client/src/components/Layout/Sidebar.tsx',
      'client/src/components/Layout/TopHeader.tsx',
      'client/src/components/Projects/ProjectsTable.tsx',
      'client/src/components/Projects/FilterPanel.tsx',
      'client/src/components/Projects/ProjectStatusManager.tsx',
      
      // Backend файлы с пользовательскими сообщениями
      'server/routes.ts',
      'server/services/emailNotifications.ts',
    ];

    let totalTextsFound = 0;
    
    // Анализируем каждый файл
    for (const filePath of filesToAnalyze) {
      try {
        console.log(`Analyzing file: ${filePath}`);
        
        const fullPath = path.join(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Извлекаем русские тексты из файла
        const russianTexts = await translationService.analyzeCodeForRussianTexts(content, filePath);
        
        if (russianTexts.length > 0) {
          console.log(`Found ${russianTexts.length} Russian texts in ${filePath}`);
          totalTextsFound += russianTexts.length;
          
          // Фильтруем уникальные тексты
          const uniqueTexts = russianTexts.filter(text => !processedTexts.has(text));
          uniqueTexts.forEach(text => processedTexts.add(text));
          
          if (uniqueTexts.length > 0) {
            // Переводим найденные тексты
            const translations = await translationService.translateTexts(
              uniqueTexts, 
              path.dirname(filePath)
            );
            
            // Добавляем переводы в общий объект
            translations.forEach(translation => {
              allTranslations[translation.key] = {
                ru: translation.ru,
                de: translation.de
              };
            });
            
            // Небольшая пауза между запросами к OpenAI
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
      } catch (error: any) {
        console.warn(`Could not analyze file ${filePath}:`, error.message);
        // Продолжаем обработку других файлов
      }
    }

    console.log(`Analysis complete. Total texts found: ${totalTextsFound}`);
    console.log(`Unique translations created: ${Object.keys(allTranslations).length}`);

    // Сохраняем переводы в файл
    const translationsPath = path.join(process.cwd(), 'shared', 'translations.json');
    await fs.writeFile(translationsPath, JSON.stringify(allTranslations, null, 2), 'utf-8');
    
    res.json({
      message: 'Translation analysis completed successfully',
      totalTexts: totalTextsFound,
      uniqueTranslations: Object.keys(allTranslations).length,
      translations: allTranslations
    });

  } catch (error: any) {
    console.error('Error during translation analysis:', error);
    res.status(500).json({ 
      error: 'Translation analysis failed',
      details: error.message 
    });
  }
});

/**
 * POST /api/translations - Обновить переводы
 */
router.post('/api/translations', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { translations } = req.body;
    
    if (!translations || typeof translations !== 'object') {
      return res.status(400).json({ error: 'Invalid translations data' });
    }

    const translationsPath = path.join(process.cwd(), 'shared', 'translations.json');
    await fs.writeFile(translationsPath, JSON.stringify(translations, null, 2), 'utf-8');
    
    res.json({ message: 'Translations updated successfully' });
  } catch (error: any) {
    console.error('Error updating translations:', error);
    res.status(500).json({ error: 'Failed to update translations' });
  }
});

export default router;