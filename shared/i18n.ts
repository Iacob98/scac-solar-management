import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Типы для языков
export type Language = 'ru' | 'de';

// Типы для переводов
export interface Translations {
  [key: string]: {
    ru: string;
    de: string;
  };
}

// Состояние языкового store
interface LanguageState {
  language: Language;
  translations: Translations;
  setLanguage: (language: Language) => void;
  setTranslations: (translations: Translations) => void;
}

// Встроенные переводы
const defaultTranslations: Translations = {
  // Навигация и меню
  главная: { ru: 'Главная', de: 'Startseite' },
  проекты_меню: { ru: 'Проекты', de: 'Projekte' },
  клиенты_меню: { ru: 'Клиенты', de: 'Kunden' },
  бригады_меню: { ru: 'Бригады', de: 'Teams' },
  статистика_меню: { ru: 'Статистика', de: 'Statistiken' },
  календарь_меню: { ru: 'Календарь', de: 'Kalender' },
  счета_меню: { ru: 'Счета', de: 'Rechnungen' },
  
  // Администрирование
  администрирование: { ru: 'Администрирование', de: 'Administration' },
  управление_фирмами: { ru: 'Управление фирмами', de: 'Firmenverwaltung' },
  пользователи_админ: { ru: 'Пользователи', de: 'Benutzer' },
  
  // Формы и действия
  выберите_фирму: { ru: 'Выберите фирму', de: 'Firma auswählen' },
  название_бригады: { ru: 'Название бригады', de: 'Team-Name' },
  руководитель: { ru: 'Руководитель', de: 'Leiter' },
  телефон: { ru: 'Телефон', de: 'Telefon' },
  адрес: { ru: 'Адрес', de: 'Adresse' },
  статус: { ru: 'Статус', de: 'Status' },
  
  // Статусы бригад
  активна: { ru: 'Активна', de: 'Aktiv' },
  в_отпуске: { ru: 'В отпуске', de: 'Im Urlaub' },
  проблемы_с_техникой: { ru: 'Проблемы с техникой', de: 'Technische Probleme' },
  недоступна: { ru: 'Недоступна', de: 'Nicht verfügbar' },
  
  // Действия
  сохранение: { ru: 'Сохранение...', de: 'Speichern...' },
  сохранить: { ru: 'Сохранить', de: 'Speichern' },
  выйти: { ru: 'Выйти', de: 'Abmelden' },
  
  // Участники бригады
  участники_бригады: { ru: 'Участники бригады', de: 'Team-Mitglieder' },
  
  // История проектов
  изменения_статуса: { ru: 'Изменение статуса', de: 'Statusänderung' },
  изменение_даты: { ru: 'Изменение даты', de: 'Datumsänderung' },
  обновление_информации: { ru: 'Обновление информации', de: 'Informationsaktualisierung' },
  создание: { ru: 'Создание', de: 'Erstellung' },
  оборудование: { ru: 'Оборудование', de: 'Ausrüstung' },
  звонок_клиенту: { ru: 'Звонок клиенту', de: 'Kundenanruf' },
  назначение_команды: { ru: 'Назначение команды', de: 'Team-Zuweisung' },
  общий_доступ: { ru: 'Общий доступ', de: 'Geteilter Zugriff' },
  файл_добавлен: { ru: 'Файл добавлен', de: 'Datei hinzugefügt' },
  файл_удален: { ru: 'Файл удален', de: 'Datei gelöscht' },
  отчет_создан: { ru: 'Отчет создан', de: 'Bericht erstellt' },
  отчет_обновлен: { ru: 'Отчет обновлен', de: 'Bericht aktualisiert' },
  отчет_удален: { ru: 'Отчет удален', de: 'Bericht gelöscht' },
  примечание_добавлено: { ru: 'Примечание добавлено', de: 'Notiz hinzugefügt' },
  бригада_назначена: { ru: 'Бригада назначена', de: 'Team zugewiesen' },
  снимок_бригады: { ru: 'Снимок бригады', de: 'Team-Snapshot' },
  
  // Загрузка фото
  загрузка_фото_отчета: { ru: 'Загрузка фото-отчёта', de: 'Foto-Bericht hochladen' },
  проект_двоеточие: { ru: 'Проект:', de: 'Projekt:' },
  бригада_двоеточие: { ru: 'Бригада:', de: 'Team:' },
  ссылка_действует_до: { ru: 'Ссылка действует до:', de: 'Link gültig bis:' },
  
  // Общие
  последние_проекты: { ru: 'Последние проекты', de: 'Letzte Projekte' },
  статистика_проектов: { ru: 'Статистика проектов', de: 'Projekt-Statistiken' },
  активные_проекты: { ru: 'Активные проекты', de: 'Aktive Projekte' },
  завершенные_проекты: { ru: 'Завершенные проекты', de: 'Abgeschlossene Projekte' },
  всего_клиентов: { ru: 'Всего клиентов', de: 'Gesamt Kunden' },
  активные_бригады: { ru: 'Активные бригады', de: 'Aktive Teams' },
};

// Создаем языковой store
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'ru',
      translations: defaultTranslations,
      setLanguage: (language: Language) => {
        set({ language });
        // Сохраняем в localStorage для синхронизации
        localStorage.setItem('language', language);
      },
      setTranslations: (translations: Translations) => {
        set({ 
          translations: { 
            ...get().translations, 
            ...translations 
          } 
        });
      },
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({ language: state.language }),
    }
  )
);