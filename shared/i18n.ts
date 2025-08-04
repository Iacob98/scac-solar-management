import React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        },
        'добро_пожаловать': { ru: 'Добро пожаловать', de: 'Willkommen' },
        'система_управления_проектами_установки_солнечных_панелей': { 
          ru: 'Система управления проектами установки солнечных панелей', 
          de: 'Verwaltungssystem für Solaranlagen-Installationsprojekte' 
        },
        'сегодня': { ru: 'Сегодня', de: 'Heute' },
        'роль': { ru: 'Роль', de: 'Rolle' },
        'начать_туториал': { ru: 'Начать туториал', de: 'Tutorial starten' },
        'быстрые_действия': { ru: 'Быстрые действия', de: 'Schnellaktionen' },
        'управление_проектами_установки_солнечных_панелей': { 
          ru: 'Управление проектами установки солнечных панелей', 
          de: 'Verwaltung von Solaranlagen-Installationsprojekten' 
        },
        'управление_базой_клиентов': { ru: 'Управление базой клиентов', de: 'Kundendatenbank-Verwaltung' },
        'управление_установочными_бригадами': { 
          ru: 'Управление установочными бригадами', 
          de: 'Verwaltung von Installationsteams' 
        },
        'управление_счетами_и_оплатами': { 
          ru: 'Управление счетами и оплатами', 
          de: 'Rechnungs- und Zahlungsverwaltung' 
        },
        'управление_компаниями': { ru: 'Управление компаниями', de: 'Unternehmensverwaltung' },
        'управление_пользователями_системы': { 
          ru: 'Управление пользователями системы', 
          de: 'Systembenutzer-Verwaltung' 
        },
        'руководство': { ru: 'Руководство', de: 'Anleitung' },
        'создать_проект': { ru: 'Создать проект', de: 'Projekt erstellen' },
        'поиск_проектов': { ru: 'Поиск проектов...', de: 'Projekte suchen...' },
        'все_статусы': { ru: 'Все статусы', de: 'Alle Status' },
        'скрыть_завершенные': { ru: 'Скрыть завершенные', de: 'Abgeschlossene ausblenden' },
        'планирование': { ru: 'Планирование', de: 'Planung' },
        'ожидание_оборудования': { ru: 'Ожидание оборудования', de: 'Warten auf Ausrüstung' },
        'оборудование_поступило': { ru: 'Оборудование поступило', de: 'Ausrüstung eingetroffen' },
        'работы_запланированы': { ru: 'Работы запланированы', de: 'Arbeiten geplant' },
        'работы_в_процессе': { ru: 'Работы в процессе', de: 'Arbeiten in Bearbeitung' },
        'работы_завершены': { ru: 'Работы завершены', de: 'Arbeiten abgeschlossen' },
        'счет_выставлен': { ru: 'Счет выставлен', de: 'Rechnung erstellt' },
        'оплачен': { ru: 'Оплачен', de: 'Bezahlt' },
        'создать_бригаду': { ru: 'Создать бригаду', de: 'Team erstellen' },
        'создать': { ru: 'Создать', de: 'Erstellen' },
        'создание': { ru: 'Создание...', de: 'Erstelle...' },
        'календарь_проектов': { ru: 'Календарь проектов', de: 'Projektkalender' },
        'добавить_нового_клиента': { ru: 'Добавить нового клиента', de: 'Neuen Kunden hinzufügen' },
        'добавить_клиента': { ru: 'Добавить клиента', de: 'Kunde hinzufügen' },
        'неизвестный_клиент': { ru: 'Неизвестный клиент', de: 'Unbekannter Kunde' },
        'не_указан_клиент_установки': { 
          ru: 'Не указан клиент установки', 
          de: 'Installationskunde nicht angegeben' 
        },
        'не_назначена': { ru: 'Не назначена', de: 'Nicht zugewiesen' }
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
  const state = useTranslation();
  
  return {
    language: state.language,
    t: state.t,
    setLanguage: state.setLanguage,
    isGerman: state.language === 'de',
    isRussian: state.language === 'ru',
  };
};

// Утилитарная функция для перевода (можно использовать вне компонентов)
export const translate = (key: string, fallback?: string): string => {
  const store = useTranslation.getState();
  return store.t(key, fallback);
};

// Компонент переключателя языка
export const LanguageToggle: React.FC = () => {
  const state = useTranslation();
  
  const handleToggle = () => {
    const newLang = state.language === 'ru' ? 'de' : 'ru';
    console.log('Switching from', state.language, 'to', newLang);
    state.setLanguage(newLang);
  };
  
  return React.createElement(
    'button',
    {
      onClick: handleToggle,
      className: "flex items-center space-x-2 px-3 py-2 rounded-lg border hover:bg-gray-50 transition-colors",
      title: state.language === 'ru' ? 'Переключить на немецкий' : 'Auf Russisch umschalten'
    },
    React.createElement(
      'span',
      { className: "text-sm font-medium" },
      state.language === 'ru' ? '🇷🇺 RU' : '🇩🇪 DE'
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