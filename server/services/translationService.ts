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
   * Переводит массив русских текстов на немецкий язык
   */
  async translateTexts(texts: string[], category?: string): Promise<TranslationEntry[]> {
    try {
      const prompt = `
Переведи следующие русские тексты на немецкий язык для системы управления солнечными панелями (SCAC Platform).
Контекст: это профессиональная система для управления проектами установки солнечных панелей, клиентами, бригадами и счетами.

Переводы должны быть:
- Профессиональными и точными
- Подходящими для делового контекста
- Понятными для немецких пользователей в солнечной энергетике

Верни результат в JSON формате:
{
  "translations": [
    {
      "ru": "оригинальный русский текст",
      "de": "немецкий перевод"
    }
  ]
}

Тексты для перевода:
${texts.map((text, index) => `${index + 1}. ${text}`).join('\n')}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Ты профессиональный переводчик, специализирующийся на технических текстах в области возобновляемой энергетики. Переводи точно и профессионально."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return result.translations.map((translation: any, index: number) => ({
        key: this.generateKey(translation.ru),
        ru: translation.ru,
        de: translation.de,
        category
      }));

    } catch (error: any) {
      console.error('Error translating texts:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Генерирует ключ для перевода на основе русского текста
   */
  private generateKey(russianText: string): string {
    return russianText
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // удаляем знаки препинания
      .replace(/\s+/g, '_') // заменяем пробелы на подчеркивания
      .substring(0, 50); // ограничиваем длину
  }

  /**
   * Анализирует код и извлекает все русские тексты
   */
  async analyzeCodeForRussianTexts(codeContent: string, fileName: string): Promise<string[]> {
    try {
      const prompt = `
Проанализируй следующий код (${fileName}) и найди ВСЕ русские текстовые строки, которые видит пользователь.
Включи:
- Тексты кнопок, заголовков, подписей
- Сообщения об ошибках
- Подсказки и описания
- Текст в меню и навигации
- Статусы и метки
- Placeholder тексты

НЕ включай:
- Комментарии в коде
- console.log сообщения
- Переменные и функции
- API endpoints

Верни только массив найденных русских текстов в JSON формате:
{
  "texts": ["текст1", "текст2", ...]
}

Код для анализа:
${codeContent}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Ты эксперт по анализу кода для интернационализации. Находи только видимые пользователю русские тексты."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.texts || [];

    } catch (error) {
      console.error(`Error analyzing code in ${fileName}:`, error);
      return [];
    }
  }
}

export const translationService = new TranslationService();