import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import React from 'react';

export type Language = 'ru' | 'de';

// Интерфейс для хранилища переводов
interface TranslationStore {
  language: Language;
  translations: Record<string, { ru: string; de: string }>;
  setLanguage: (language: Language) => void;
  setTranslations: (translations: Record<string, { ru: string; de: string }>) => void;
  t: (key: string, fallback?: string) => string;
}

// Zustand store для управления языком и переводами
export const useTranslation = create<TranslationStore>()(
  persist(
    (set, get) => ({
      language: 'ru' as Language,
      translations: {
        // Базовые переводы загружены из файла
        'проекты': { ru: 'Проекты', de: 'Projekte' },
        'клиенты': { ru: 'Клиенты', de: 'Kunden' },
        'бригады': { ru: 'Бригады', de: 'Teams' },
        'счета': { ru: 'Счета', de: 'Rechnungen' },
        'календарь': { ru: 'Календарь', de: 'Kalender' },
        'статистика': { ru: 'Статистика', de: 'Statistiken' },
        'администрирование': { ru: 'Администрирование', de: 'Administration' },
        'управление_переводами': { ru: 'Управление переводами', de: 'Übersetzungsverwaltung' },
        'настройки': { ru: 'Настройки', de: 'Einstellungen' },
        'выход': { ru: 'Выход', de: 'Ausloggen' },
        'выберите_фирму': { ru: 'Выберите фирму', de: 'Firma wählen' },
        'администратор': { ru: 'Администратор', de: 'Administrator' },
        'руководитель_проектов': { ru: 'Руководитель проектов', de: 'Projektleiter' },
        'управление_фирмами': { ru: 'Управление фирмами', de: 'Firmenverwaltung' },
        'пользователи': { ru: 'Пользователи', de: 'Benutzer' },
        'фирмы': { ru: 'Фирмы', de: 'Firmen' },
        'выберите_фирму_в_верхнем_меню_для_просмотра_статистики': {
          ru: 'Выберите фирму в верхнем меню для просмотра статистики',
          de: 'Wählen Sie eine Firma im oberen Menü aus, um Statistiken anzuzeigen'
        }
      },
      
      setLanguage: (language: Language) => set({ language }),
      
      setTranslations: (translations: Record<string, { ru: string; de: string }>) => 
        set({ translations }),
      
      t: (key: string, fallback?: string) => {
        const { language, translations } = get();
        const translation = translations[key];
        
        if (translation && translation[language]) {
          return translation[language];
        }
        
        // Если перевода нет, возвращаем fallback или исходный ключ
        return fallback || key;
      },
    }),
    {
      name: 'scac-language-storage',
      partialize: (state: TranslationStore) => ({ 
        language: state.language,
        translations: state.translations 
      }),
    }
  )
);

// Хук для получения текущего языка и функции перевода
export const useI18n = () => {
  const { language, t, setLanguage } = useTranslation();
  
  return {
    language,
    t,
    setLanguage,
    isGerman: language === 'de',
    isRussian: language === 'ru',
  };
};

// Утилитарная функция для перевода (можно использовать вне компонентов)
export const translate = (key: string, fallback?: string): string => {
  const store = useTranslation.getState();
  return store.t(key, fallback);
};

// Компонент переключателя языка
export const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useI18n();
  
  return React.createElement(
    'button',
    {
      onClick: () => setLanguage(language === 'ru' ? 'de' : 'ru'),
      className: "flex items-center space-x-2 px-3 py-2 rounded-lg border hover:bg-gray-50 transition-colors",
      title: language === 'ru' ? 'Переключить на немецкий' : 'Auf Russisch umschalten'
    },
    React.createElement(
      'span',
      { className: "text-sm font-medium" },
      language === 'ru' ? '🇷🇺 RU' : '🇩🇪 DE'
    )
  );
};

// Базовые переводы системы (будут расширены автоматически)
export const baseTranslations = {
  // Навигация
  'проекты': { ru: 'Проекты', de: 'Projekte' },
  'клиенты': { ru: 'Клиенты', de: 'Kunden' },
  'бригады': { ru: 'Бригады', de: 'Teams' },
  'счета': { ru: 'Счета', de: 'Rechnungen' },
  'календарь': { ru: 'Календарь', de: 'Kalender' },
  'статистика': { ru: 'Статистика', de: 'Statistiken' },
  
  // Статусы проектов
  'планирование': { ru: 'Планирование', de: 'Planung' },
  'ожидание_оборудования': { ru: 'Ожидание оборудования', de: 'Warten auf Ausrüstung' },
  'оборудование_поступило': { ru: 'Оборудование поступило', de: 'Ausrüstung angekommen' },
  'работы_запланированы': { ru: 'Работы запланированы', de: 'Arbeiten geplant' },
  'работы_в_процессе': { ru: 'Работы в процессе', de: 'Arbeiten in Bearbeitung' },
  'работы_завершены': { ru: 'Работы завершены', de: 'Arbeiten abgeschlossen' },
  'счет_выставлен': { ru: 'Счет выставлен', de: 'Rechnung gestellt' },
  'оплачен': { ru: 'Оплачен', de: 'Bezahlt' },
  
  // Общие элементы
  'создать': { ru: 'Создать', de: 'Erstellen' },
  'сохранить': { ru: 'Сохранить', de: 'Speichern' },
  'отменить': { ru: 'Отменить', de: 'Abbrechen' },
  'удалить': { ru: 'Удалить', de: 'Löschen' },
  'редактировать': { ru: 'Редактировать', de: 'Bearbeiten' },
  'просмотр': { ru: 'Просмотр', de: 'Ansicht' },
  'загрузка': { ru: 'Загрузка...', de: 'Wird geladen...' },
  'ошибка': { ru: 'Ошибка', de: 'Fehler' },
  'успех': { ru: 'Успешно', de: 'Erfolgreich' },
  
  // Администрирование
  'администрирование': { ru: 'Администрирование', de: 'Administration' },
  'управление_фирмами': { ru: 'Управление фирмами', de: 'Firmenverwaltung' },
  'пользователи': { ru: 'Пользователи', de: 'Benutzer' },
  'фирмы': { ru: 'Фирмы', de: 'Firmen' },
};