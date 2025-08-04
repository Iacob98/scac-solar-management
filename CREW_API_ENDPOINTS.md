# API ENDPOINTS ДЛЯ СИСТЕМЫ БРИГАД

## Основные операции с бригадами

### 1. Получить все бригады фирмы
```
GET /api/crews?firmId=<uuid>
```
Возвращает список всех бригад с участниками

### 2. Создать новую бригаду
```
POST /api/crews
{
  "firmId": "uuid",
  "name": "Название бригады",
  "uniqueNumber": "BR-0001",
  "leaderName": "Имя руководителя",
  "phone": "+49 123 456789",
  "address": "Адрес",
  "status": "active"
}
```

### 3. Добавить участника в бригаду
```
POST /api/crews/:crewId/members
{
  "firstName": "Имя",
  "lastName": "Фамилия", 
  "uniqueNumber": "WRK-0001",
  "role": "worker",
  "phone": "+49 123 456789",
  "memberEmail": "email@example.com"
}
```

### 4. Получить статистику бригады
```
GET /api/crews/:crewId/stats
```
Возвращает:
- Количество проектов
- Текущую загрузку
- Историю изменений

### 5. Назначить бригаду на проект (КРИТИЧЕСКИ ВАЖНО!)
```
POST /api/projects/:projectId/assign-crew
{
  "crewId": 123
}
```
Создает снимок состава бригады в project_crew_snapshots

### 6. Получить историю изменений бригады
```
GET /api/crews/:crewId/history
```

### 7. Обновить статус бригады
```
PATCH /api/crews/:crewId/status
{
  "status": "vacation"
}
```

## Управление участниками

### 1. Обновить данные участника
```
PATCH /api/crew-members/:memberId
{
  "firstName": "Новое имя",
  "phone": "+49 987 654321"
}
```

### 2. Архивировать участника
```
DELETE /api/crew-members/:memberId
```
Устанавливает archived = true и создает запись в истории

### 3. Получить участников бригады
```
GET /api/crews/:crewId/members
```

## Снимки бригад для проектов

### 1. Получить снимок бригады для проекта
```
GET /api/projects/:projectId/crew-snapshot
```
Возвращает исторический состав бригады на момент назначения

### 2. Получить все снимки проекта
```
GET /api/projects/:projectId/crew-snapshots
```

## Интеграция с Google Calendar

### 1. Создать календарь для бригады
```
POST /api/crews/:crewId/calendar
```

### 2. Добавить событие в календарь бригады
```
POST /api/crews/:crewId/calendar/events
{
  "title": "Проект #123",
  "startDate": "2025-01-15",
  "endDate": "2025-01-16",
  "description": "Установка солнечных панелей"
}
```

## Аналитика и отчеты

### 1. Статистика по всем бригадам
```
GET /api/crews/stats/summary?firmId=<uuid>&from=2025-01-01&to=2025-12-31
```

### 2. Загрузка бригад по периоду
```
GET /api/crews/workload?firmId=<uuid>&from=2025-01-01&to=2025-12-31
```

### 3. Эффективность бригад
```
GET /api/crews/efficiency?firmId=<uuid>
```

## ВАЖНЫЕ ПРИНЦИПЫ РЕАЛИЗАЦИИ:

1. **Неизменяемость снимков**: project_crew_snapshots НИКОГДА не изменяются
2. **История изменений**: Все изменения записываются в crew_history
3. **Мягкое удаление**: Участники архивируются, а не удаляются
4. **Валидация**: Проверка уникальности номеров бригад и участников
5. **Транзакции**: Операции с несколькими таблицами выполняются в транзакциях