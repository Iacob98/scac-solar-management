import { useLanguageStore } from '@shared/i18n';

/**
 * Хук для работы с переводами
 */
export const useTranslations = () => {
  const { language, translations, setLanguage } = useLanguageStore();

  const t = (key: string, fallback: string) => {
    return translations[key]?.[language] || fallback;
  };

  return {
    t,
    language,
    setLanguage,
    isGerman: language === 'de',
    isRussian: language === 'ru',
  };
};