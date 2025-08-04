import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranslationEntry {
  key: string;
  ru: string;
  de: string;
  category?: string;
}

export class TranslationService {
  
  /**
   * Анализирует код файла и извлекает русские тексты
   */
  async analyzeCodeForRussianTexts(content: string, filePath: string): Promise<string[]> {
    const russianTexts: string[] = [];
    
    // Регулярные выражения для поиска русских текстов
    const patterns = [
      // Строки в кавычках с русскими символами
      /"([^"]*[а-яё][^"]*?)"/gi,
      /'([^']*[а-яё][^']*?)'/gi,
      // Template literals с русскими символами
      /`([^`]*[а-яё][^`]*?)`/gi,
      // JSX текст (между тегами)
      />([^<]*[а-яё][^<]*?)</gi,
      // Placeholder и alt тексты
      /placeholder\s*=\s*["']([^"']*[а-яё][^"']*?)["']/gi,
      /alt\s*=\s*["']([^"']*[а-яё][^"']*?)["']/gi,
      /title\s*=\s*["']([^"']*[а-яё][^"']*?)["']/gi,
      // Объекты с русскими значениями
      /:\s*["']([^"']*[а-яё][^"']*?)["']/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1].trim();
        
        // Фильтруем слишком короткие, технические строки и дубликаты
        if (text.length > 2 && 
            !text.match(/^[a-zA-Z0-9\-_]+$/) && // не техническая строка
            !text.match(/^[\d\s\-\.\,\:\;]+$/) && // не только цифры и знаки
            /[а-яё]/i.test(text) && // содержит русские символы
            !russianTexts.includes(text)) {
          russianTexts.push(text);
        }
      }
    }

    return russianTexts;
  }

  /**
   * Переводит массив текстов на немецкий язык
   */
  async translateTexts(texts: string[], context: string = ''): Promise<TranslationEntry[]> {
    if (!openai.apiKey) {
      throw new Error('OpenAI API key не настроен');
    }

    const translations: TranslationEntry[] = [];
    
    // Переводим небольшими батчами для лучшего качества
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const prompt = `Переведи следующие русские тексты на немецкий язык. 
Контекст: это тексты из системы управления проектами солнечных панелей для немецкого рынка.

Правила перевода:
- Используй профессиональную терминологию
- Сохраняй деловой тон
- Переводи точно и по смыслу
- Для технических терминов используй принятые в немецкой отрасли обозначения

Тексты для перевода:
${batch.map((text, idx) => `${i + idx + 1}. "${text}"`).join('\n')}

Ответь в формате JSON:
{
  "translations": [
    {"original": "текст на русском", "translation": "перевод на немецкий"},
    ...
  ]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        
        if (result.translations && Array.isArray(result.translations)) {
          for (const item of result.translations) {
            if (item.original && item.translation) {
              translations.push({
                key: this.generateKey(item.original),
                ru: item.original,
                de: item.translation
              });
            }
          }
        }

        // Пауза между батчами
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.error(`Ошибка перевода батча ${i / batchSize + 1}:`, error);
        
        // Фоллбэк: переводим по одному
        for (const text of batch) {
          try {
            const translation = await this.translateSingleText(text);
            translations.push({
              key: this.generateKey(text),
              ru: text,
              de: translation
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (singleError) {
            console.error(`Не удалось перевести "${text}":`, singleError);
          }
        }
      }
    }

    return translations;
  }

  /**
   * Переводит один текст
   */
  private async translateSingleText(text: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "user",
        content: `Переведи на немецкий язык в контексте системы управления солнечными панелями: "${text}"`
      }],
      temperature: 0.3,
      max_tokens: 200,
    });

    return response.choices[0].message.content?.trim() || text;
  }

  /**
   * Генерирует ключ для перевода
   */
  private generateKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^а-яё\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

}

export const translationService = new TranslationService();