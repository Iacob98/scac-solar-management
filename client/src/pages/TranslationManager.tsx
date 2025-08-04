import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Languages, Download, Upload, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/Layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TranslationManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Проверяем права администратора
  if (user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert>
            <AlertDescription>
              Доступ к управлению переводами доступен только администраторам системы.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  // Загружаем существующие переводы
  const { data: translations = {}, isLoading } = useQuery({
    queryKey: ['/api/translations'],
    queryFn: async () => {
      const response = await apiRequest('/api/translations', 'GET');
      return response.json();
    },
  });

  // Мутация для анализа и создания переводов
  const analyzeTranslationsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/translations/analyze', 'POST');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      toast({
        title: 'Анализ завершен успешно',
        description: `Создано ${data.uniqueTranslations} переводов из ${data.totalTexts} найденных текстов`,
      });
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка анализа',
        description: error.message || 'Не удалось завершить анализ переводов',
        variant: 'destructive',
      });
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    },
  });

  const handleStartAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    // Симуляция прогресса
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 10;
      });
    }, 1000);

    analyzeTranslationsMutation.mutate();
  };

  const translationCount = Object.keys(translations).length;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Управление переводами
            </h1>
            <p className="text-gray-600 mt-1">
              Автоматическое создание немецких переводов для всех русских текстов
            </p>
          </div>
          
          <Badge variant="outline" className="flex items-center gap-2">
            <Languages className="w-4 h-4" />
            Русский ↔ Немецкий
          </Badge>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Всего переводов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {translationCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Пар русский-немецкий
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Статус системы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Готова к работе</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                OpenAI API подключен
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Последний анализ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-gray-900">
                {translationCount > 0 ? 'Завершен' : 'Не проводился'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {translationCount > 0 ? 'Переводы загружены' : 'Необходим первый запуск'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Процесс анализа */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Автоматический анализ и перевод
            </CardTitle>
            <p className="text-sm text-gray-600">
              Система найдет все русские тексты в приложении и создаст немецкие переводы с помощью ИИ
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Анализ файлов и создание переводов...</span>
                  <span>{Math.round(analysisProgress)}%</span>
                </div>
                <Progress value={analysisProgress} className="h-2" />
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing || analyzeTranslationsMutation.isPending}
                className="flex items-center gap-2"
              >
                {isAnalyzing || analyzeTranslationsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isAnalyzing ? 'Анализ в процессе...' : 'Запустить анализ'}
              </Button>
              
              {translationCount > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    const dataStr = JSON.stringify(translations, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'scac-translations.json';
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Экспорт переводов
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Предварительный просмотр переводов */}
        {translationCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Предварительный просмотр переводов</CardTitle>
              <p className="text-sm text-gray-600">
                Показаны первые 10 переводов из {translationCount}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(translations)
                  .slice(0, 10)
                  .map(([key, translation]: [string, any]) => (
                    <div key={key} className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">🇷🇺 Русский</div>
                        <div className="text-sm">{translation.ru}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">🇩🇪 Немецкий</div>
                        <div className="text-sm font-medium">{translation.de}</div>
                      </div>
                    </div>
                  ))}
              </div>
              
              {translationCount > 10 && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  И еще {translationCount - 10} переводов...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Информация о процессе */}
        <Card>
          <CardHeader>
            <CardTitle>Как работает система переводов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h4 className="font-medium">Анализ кода</h4>
                <p className="text-sm text-gray-600">ИИ анализирует все файлы и находит русские тексты, видимые пользователям</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-medium">Профессиональный перевод</h4>
                <p className="text-sm text-gray-600">OpenAI переводит тексты на немецкий язык с учетом контекста солнечной энергетики</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-medium">Автоматическое применение</h4>
                <p className="text-sm text-gray-600">Переводы сохраняются и станут доступны через переключатель языка в интерфейсе</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}