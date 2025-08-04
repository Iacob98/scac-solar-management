// Debug script to test translation state
import { useTranslation } from '@shared/i18n';

console.log('=== Translation Debug ===');
const state = useTranslation.getState();
console.log('Current language:', state.language);
console.log('Available translations:', Object.keys(state.translations).slice(0, 10));
console.log('Test translation (проекты):', state.t('проекты', 'FALLBACK'));
console.log('Test translation (планирование):', state.t('планирование', 'FALLBACK')); 
console.log('===========================');

// Test language switch
window.testLanguageSwitch = () => {
  const currentLang = state.language;
  const newLang = currentLang === 'ru' ? 'de' : 'ru';
  console.log(`Switching from ${currentLang} to ${newLang}`);
  state.setLanguage(newLang);
  console.log('New language:', useTranslation.getState().language);
};

console.log('Run window.testLanguageSwitch() to test language switching');