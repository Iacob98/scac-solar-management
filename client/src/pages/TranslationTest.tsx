import { useTranslation } from '@shared/i18n';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TranslationTest() {
  const { t, language, setLanguage } = useTranslation();

  const testStrings = [
    { key: 'проекты', fallback: 'Проекты' },
    { key: 'клиенты', fallback: 'Клиенты' },
    { key: 'бригады', fallback: 'Бригады' },
    { key: 'счета', fallback: 'Счета' },
    { key: 'календарь', fallback: 'Календарь' },
    { key: 'статистика', fallback: 'Статистика' },
    { key: 'администрирование', fallback: 'Администрирование' },
    { key: 'управление_переводами', fallback: 'Управление переводами' },
    { key: 'настройки', fallback: 'Настройки' },
    { key: 'выход', fallback: 'Выход' },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Тестирование системы переводов</h1>
          <div className="flex items-center gap-2">
            <Badge variant={language === 'ru' ? 'default' : 'outline'}>
              Текущий язык: {language === 'ru' ? '🇷🇺 Русский' : '🇩🇪 Немецкий'}
            </Badge>
            <Button
              onClick={() => setLanguage(language === 'ru' ? 'de' : 'ru')}
              variant="outline"
            >
              Переключить на {language === 'ru' ? 'немецкий' : 'русский'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {testStrings.map(({ key, fallback }) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Ключ:</div>
                    <div className="font-mono text-sm">{key}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Перевод:</div>
                    <div className="font-medium">{t(key, fallback)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Оригинал:</div>
                    <div className="text-gray-600">{fallback}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Информация о системе переводов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <strong>Активный язык:</strong> {language === 'ru' ? 'Русский' : 'Немецкий'}
              </div>
              <div>
                <strong>Статус переключателя:</strong> 
                <Badge variant="outline" className="ml-2">Работает</Badge>
              </div>
              <div>
                <strong>Количество базовых переводов:</strong> {testStrings.length}
              </div>
              <div className="text-sm text-gray-600">
                Переключите язык кнопкой выше, чтобы увидеть, как меняются переводы в реальном времени.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}