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
                  console.log('Switching language from', language);
                  setLanguage(language === 'ru' ? 'de' : 'ru');
                  console.log('New language:', language);
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
                  <li><strong>Проекты:</strong> {t('проекты', 'Проекты')}</li>
                  <li><strong>Клиенты:</strong> {t('клиенты', 'Клиенты')}</li>
                  <li><strong>Бригады:</strong> {t('бригады', 'Бригады')}</li>
                  <li><strong>Счета:</strong> {t('счета', 'Счета')}</li>
                  <li><strong>Быстрые действия:</strong> {t('быстрые_действия', 'Быстрые действия')}</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-3 text-lg">📊 Статусы / Status:</h3>
                <ul className="space-y-2 text-sm">
                  <li><strong>Планирование:</strong> {t('планирование', 'Планирование')}</li>
                  <li><strong>Ожидание оборудования:</strong> {t('ожидание_оборудования', 'Ожидание оборудования')}</li>
                  <li><strong>Оборудование поступило:</strong> {t('оборудование_поступило', 'Оборудование поступило')}</li>
                  <li><strong>Работы в процессе:</strong> {t('работы_в_процессе', 'Работы в процессе')}</li>
                  <li><strong>Оплачен:</strong> {t('оплачен', 'Оплачен')}</li>
                </ul>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2">🔧 Инструкция / Instructions:</h3>
              <p className="text-sm">
                1. Нажмите кнопку "Переключить" выше<br/>
                2. Весь текст должен мгновенно измениться<br/>
                3. Переключатель языка в правом верхнем углу работает глобально<br/>
                <br/>
                <em>1. Click "Switch" button above<br/>
                2. All text should instantly change<br/>
                3. Language toggle in top-right works globally</em>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}