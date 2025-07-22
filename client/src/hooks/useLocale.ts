import { useState, useEffect } from 'react';
import { Language, getLocale, DEFAULT_LANGUAGE } from '@shared/locales';

// Хук для работы с локализацией
export function useLocale() {
  const [language, setLanguage] = useState<Language>(() => {
    // Получаем язык из localStorage или используем по умолчанию
    const saved = localStorage.getItem('language') as Language;
    return saved && ['ru', 'en'].includes(saved) ? saved : DEFAULT_LANGUAGE;
  });

  const locale = getLocale(language);

  // Сохраняем язык в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
  };

  return {
    language,
    locale,
    changeLanguage,
    t: locale, // сокращенный алиас для удобства
  };
}