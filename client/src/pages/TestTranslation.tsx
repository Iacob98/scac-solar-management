import { useTranslation } from '@shared/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MainLayout } from '@/components/Layout/MainLayout';

export default function TestTranslation() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Тест системы переводов - Translation System Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
              <strong>Текущий язык / Current Language: {language === 'ru' ? '🇷🇺 Русский' : '🇩🇪 Немецкий'}</strong>
              <Button 
                onClick={() => {
                  const newLang = language === 'ru' ? 'de' : 'ru';
                  console.log('Switching language from', language, 'to', newLang);
                  setLanguage(newLang);
                  // Force re-render by triggering a state update
                  setTimeout(() => {
                    console.log('Language after switch:', useTranslation.getState().language);
                  }, 100);
                }}
                variant="outline"
                className="ml-4"
              >
                Переключить / Switch → {language === 'ru' ? '🇩🇪 Deutsch' : '🇷🇺 Русский'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-3 text-lg">🏠 Навигация / Navigation:</h3>
                <ul className="space-y-2 text-sm">
                  <li><strong>Проекты:</strong> <span className="text-green-600">{t('проекты', 'Проекты')}</span></li>
                  <li><strong>Клиенты:</strong> <span className="text-green-600">{t('клиенты', 'Клиенты')}</span></li>
                  <li><strong>Бригады:</strong> <span className="text-green-600">{t('бригады', 'Бригады')}</span></li>
                  <li><strong>Счета:</strong> <span className="text-green-600">{t('счета', 'Счета')}</span></li>
                  <li><strong>Быстрые действия:</strong> <span className="text-green-600">{t('быстрые_действия', 'Быстрые действия')}</span></li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-3 text-lg">📊 Статусы / Status:</h3>
                <ul className="space-y-2 text-sm">
                  <li><strong>Планирование:</strong> <span className="text-blue-600">{t('планирование', 'Планирование')}</span></li>
                  <li><strong>Ожидание оборудования:</strong> <span className="text-blue-600">{t('ожидание_оборудования', 'Ожидание оборудования')}</span></li>
                  <li><strong>Оборудование поступило:</strong> <span className="text-blue-600">{t('оборудование_поступило', 'Оборудование поступило')}</span></li>
                  <li><strong>Работы в процессе:</strong> <span className="text-blue-600">{t('работы_в_процессе', 'Работы в процессе')}</span></li>
                  <li><strong>Оплачен:</strong> <span className="text-blue-600">{t('оплачен', 'Оплачен')}</span></li>
                </ul>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2">🔧 Инструкция / Instructions:</h3>
              <p className="text-sm">
                1. Нажмите кнопку "Переключить" выше<br/>
                2. <strong>Цветные слова должны мгновенно измениться</strong><br/>
                3. Переключатель языка в правом верхнем углу работает глобально<br/>
                <br/>
                <em>1. Click "Switch" button above<br/>
                2. <strong>Colored words should instantly change</strong><br/>
                3. Language toggle in top-right works globally</em>
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold mb-2">🐛 Debug Info:</h3>
              <div className="text-xs font-mono space-y-1">
                <div>Language State: <strong>{language}</strong></div>
                <div>Test Translation: <strong className="text-red-600">{t('проекты', 'FALLBACK')}</strong></div>
                <div>Timestamp: {Date.now()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}