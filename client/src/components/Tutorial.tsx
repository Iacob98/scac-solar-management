import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Sun, 
  Users, 
  Calendar, 
  FileText, 
  Receipt, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  X,
  Settings,
  Home,
  UserPlus,
  Building2,
  Wrench
} from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в SCAC Platform',
    description: 'Система управления солнечными проектами',
    icon: <Sun className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <Sun className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
          <h3 className="text-xl font-semibold mb-2">Добро пожаловать!</h3>
          <p className="text-gray-600">
            SCAC Platform - это комплексная система для управления проектами установки солнечных панелей.
            Давайте познакомимся с основными возможностями.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium">Управление фирмами</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm font-medium">Работа с клиентами</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Wrench className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <p className="text-sm font-medium">Управление бригадами</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <p className="text-sm font-medium">Проекты и счета</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Главная панель',
    description: 'Обзор всех проектов и статистики',
    icon: <Home className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <Home className="h-12 w-12 mx-auto mb-3 text-blue-600" />
          <h3 className="text-lg font-semibold mb-2">Главная панель</h3>
          <p className="text-gray-600">
            На главной странице вы найдете статистику по всем проектам, активным бригадам и клиентам.
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">12</div>
              <div className="text-sm text-gray-600">Активных проектов</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">45</div>
              <div className="text-sm text-gray-600">Клиентов</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">8</div>
              <div className="text-sm text-gray-600">Бригад</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'projects',
    title: 'Управление проектами',
    description: 'Создание и отслеживание проектов',
    icon: <FileText className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-green-600" />
          <h3 className="text-lg font-semibold mb-2">Проекты</h3>
          <p className="text-gray-600">
            Создавайте новые проекты установки солнечных панелей, назначайте бригады и отслеживайте прогресс.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <div>
              <p className="font-medium">Создать проект</p>
              <p className="text-sm text-gray-600">Укажите клиента, бригаду и детали установки</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
            <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
            <div>
              <p className="font-medium">Отслеживать выполнение</p>
              <p className="text-sm text-gray-600">Обновляйте статус проекта по мере выполнения</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <div>
              <p className="font-medium">Выставить счет</p>
              <p className="text-sm text-gray-600">Создайте счет в Invoice Ninja после завершения</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'crews',
    title: 'Управление бригадами',
    description: 'Создание и управление монтажными бригадами',
    icon: <Users className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-3 text-purple-600" />
          <h3 className="text-lg font-semibold mb-2">Бригады</h3>
          <p className="text-gray-600">
            Создавайте бригады монтажников, добавляйте участников с их контактными данными.
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  MT
                </div>
                <div>
                  <p className="font-medium">Montage Team Alpha</p>
                  <p className="text-sm text-gray-600">Руководитель: Ганс Циммерман</p>
                </div>
              </div>
              <Badge variant="outline">Активна</Badge>
            </div>
            <div className="text-sm text-gray-600 ml-13">
              <p>• 4 участника</p>
              <p>• Мюнхен, Германия</p>
              <p>• +49 171 1234567</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'clients',
    title: 'Управление клиентами',
    description: 'Добавление и управление клиентами',
    icon: <UserPlus className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <UserPlus className="h-12 w-12 mx-auto mb-3 text-orange-600" />
          <h3 className="text-lg font-semibold mb-2">Клиенты</h3>
          <p className="text-gray-600">
            Добавляйте новых клиентов с их контактными данными для создания проектов.
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                МИ
              </div>
              <div>
                <p className="font-medium">Максим Иванов</p>
                <p className="text-sm text-gray-600">maxim.ivanov@email.com</p>
                <p className="text-sm text-gray-600">+49 176 9876543</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'workflow',
    title: 'Рабочий процесс',
    description: 'Полный цикл работы с проектом',
    icon: <ArrowRight className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <ArrowRight className="h-12 w-12 mx-auto mb-3 text-blue-600" />
          <h3 className="text-lg font-semibold mb-2">Рабочий процесс</h3>
          <p className="text-gray-600">
            Полный цикл работы с проектом от создания до получения оплаты.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { status: 'Планирование', color: 'bg-blue-100 text-blue-800', icon: <Calendar className="h-4 w-4" /> },
            { status: 'В работе', color: 'bg-yellow-100 text-yellow-800', icon: <Settings className="h-4 w-4" /> },
            { status: 'Завершен', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" /> },
            { status: 'Счет выставлен', color: 'bg-purple-100 text-purple-800', icon: <Receipt className="h-4 w-4" /> },
            { status: 'Оплачен', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-4 w-4" /> },
          ].map((step, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${step.color} flex items-center space-x-2`}>
                {step.icon}
                <span>{step.status}</span>
              </div>
              {index < 4 && <ArrowRight className="h-4 w-4 text-gray-400" />}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'complete',
    title: 'Готово!',
    description: 'Вы готовы к работе с системой',
    icon: <CheckCircle className="h-6 w-6" />,
    content: (
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-xl font-semibold mb-2">Поздравляем!</h3>
          <p className="text-gray-600">
            Теперь вы знаете основы работы с SCAC Platform. Начните с создания вашего первого проекта!
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-semibold mb-2">Полезные советы:</h4>
          <ul className="text-sm space-y-1">
            <li>• Регулярно обновляйте статусы проектов</li>
            <li>• Добавляйте подробную информацию о клиентах</li>
            <li>• Используйте автоматическое создание счетов</li>
            <li>• Отслеживайте прогресс через главную панель</li>
          </ul>
        </div>
      </div>
    ),
  },
];

export default function Tutorial({ isOpen, onClose, onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setIsCompleted(false);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleted(true);
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const currentStepData = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                {currentStepData.icon}
              </div>
              <div>
                <DialogTitle>{currentStepData.title}</DialogTitle>
                <DialogDescription>{currentStepData.description}</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Шаг {currentStep + 1} из {tutorialSteps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="min-h-[300px]">
            {currentStepData.content}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex space-x-2">
              {tutorialSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentStep 
                      ? 'bg-blue-600' 
                      : index < currentStep 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex space-x-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад
                </Button>
              )}
              
              <Button onClick={handleNext}>
                {currentStep === tutorialSteps.length - 1 ? (
                  <>
                    Завершить
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Далее
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}