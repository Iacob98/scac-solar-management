import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@shared/i18n';

/**
 * Хук для загрузки и использования переводов
 */
export const useTranslations = () => {
  const { t, setTranslations, language } = useTranslation();

  // Загружаем переводы с сервера
  const { data: serverTranslations = {} } = useQuery({
    queryKey: ['/api/translations'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/translations');
        if (!response.ok) throw new Error('Failed to fetch translations');
        return response.json();
      } catch (error) {
        console.warn('Failed to load translations from server:', error);
        return {};
      }
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    cacheTime: 10 * 60 * 1000, // 10 минут
  });

  // Обновляем переводы в store при получении данных с сервера
  useEffect(() => {
    if (Object.keys(serverTranslations).length > 0) {
      setTranslations(serverTranslations);
    }
  }, [serverTranslations, setTranslations]);

  return {
    t,
    language,
    isGerman: language === 'de',
    isRussian: language === 'ru',
  };
};