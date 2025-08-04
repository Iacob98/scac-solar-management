# ПОДРОБНОЕ ОПИСАНИЕ ВСЕХ СТОЛБЦОВ СИСТЕМЫ БРИГАД

## 1. ТАБЛИЦА CREWS (Основная таблица бригад)

| Столбец | Тип данных | Ограничения | Описание | Пример значения |
|---------|------------|-------------|----------|-----------------|
| `id` | SERIAL | PRIMARY KEY | Уникальный идентификатор бригады | 1, 2, 3... |
| `firm_id` | UUID | NOT NULL, FOREIGN KEY | Ссылка на фирму-владельца | "da75f029-abdb-4afa-bf90-ce591f06971b" |
| `name` | VARCHAR | NOT NULL | Название/имя бригады | "Montage Team Alpha" |
| `unique_number` | VARCHAR | NOT NULL | Уникальный номер бригады | "BR-0001", "BR-0002" |
| `leader_name` | VARCHAR | NOT NULL | Полное имя руководителя бригады | "Hans Zimmermann" |
| `phone` | VARCHAR | NULL | Контактный телефон руководителя | "+49 171 1234567" |
| `address` | TEXT | NULL | Адрес базирования/офиса бригады | "Мюнхен, Шиллерштрассе 15" |
| `status` | VARCHAR | ENUM, DEFAULT 'active' | Текущий статус бригады | "active", "vacation", "equipment_issue", "unavailable" |
| `archived` | BOOLEAN | DEFAULT false | Флаг архивирования бригады | true, false |
| `gcal_id` | VARCHAR | NULL | ID календаря Google для бригады | "calendar_id_from_google" |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата и время создания записи | "2025-01-15 10:30:00" |

## 2. ТАБЛИЦА CREW_MEMBERS (Участники бригад)

| Столбец | Тип данных | Ограничения | Описание | Пример значения |
|---------|------------|-------------|----------|-----------------|
| `id` | SERIAL | PRIMARY KEY | Уникальный идентификатор участника | 1, 2, 3... |
| `crew_id` | INTEGER | NOT NULL, FOREIGN KEY | Ссылка на бригаду | 1, 2, 3 |
| `first_name` | VARCHAR | NOT NULL | Имя участника | "Ганс", "Петер" |
| `last_name` | VARCHAR | NOT NULL | Фамилия участника | "Циммерман", "Мюллер" |
| `address` | TEXT | NULL | Домашний адрес участника | "Мюнхен, Августенштрассе 45" |
| `unique_number` | VARCHAR | NOT NULL | Уникальный номер работника | "WRK-0001", "WRK-0002" |
| `phone` | VARCHAR | NULL | Личный телефон участника | "+49 171 2345678" |
| `role` | VARCHAR | DEFAULT 'worker' | Роль в бригаде | "leader", "worker", "specialist" |
| `member_email` | VARCHAR | NULL | Email для доступа к календарю | "worker@example.com" |
| `google_calendar_id` | VARCHAR | NULL | ID персонального календаря Google | "primary", "calendar_id" |
| `archived` | BOOLEAN | DEFAULT false | Флаг архивирования участника | true, false |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата добавления в систему | "2025-01-15 10:30:00" |

## 3. ТАБЛИЦА CREW_HISTORY (История изменений)

| Столбец | Тип данных | Ограничения | Описание | Пример значения |
|---------|------------|-------------|----------|-----------------|
| `id` | SERIAL | PRIMARY KEY | Уникальный ID записи истории | 1, 2, 3... |
| `crew_id` | INTEGER | NOT NULL, FOREIGN KEY | Ссылка на бригаду | 1, 2, 3 |
| `change_type` | VARCHAR | ENUM, NOT NULL | Тип изменения | "crew_created", "member_added", "member_removed" |
| `member_id` | INTEGER | NULL, FOREIGN KEY | ID участника (NULL для crew_created) | 1, 2, 3, NULL |
| `member_name` | VARCHAR | NULL | Имя участника на момент изменения | "Михаэль Шмидт" |
| `member_specialization` | VARCHAR | NULL | Специализация участника | "Электрик", "Монтажник" |
| `member_google_calendar_id` | VARCHAR | NULL | Google Calendar ID участника | "primary", "calendar_id" |
| `start_date` | DATE | NULL | Дата начала работы участника | "2025-01-01" |
| `end_date` | DATE | NULL | Дата окончания работы | "2025-07-25" |
| `change_description` | TEXT | NULL | Подробное описание изменения | "Участник Михаэль Шмидт исключен из бригады" |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Время записи изменения | "2025-07-25 14:11:31" |
| `created_by` | VARCHAR | FOREIGN KEY | ID пользователя, внесшего изменение | "41352215" |

## 4. ТАБЛИЦА PROJECT_CREW_SNAPSHOTS (Снимки состава - КРИТИЧЕСКИ ВАЖНО!)

| Столбец | Тип данных | Ограничения | Описание | Пример значения |
|---------|------------|-------------|----------|-----------------|
| `id` | SERIAL | PRIMARY KEY | Уникальный ID снимка | 1, 2, 3... |
| `project_id` | INTEGER | NOT NULL, FOREIGN KEY | Ссылка на проект | 36, 44, 45 |
| `crew_id` | INTEGER | NOT NULL | ID бригады на момент снимка | 1, 2, 3 |
| `snapshot_date` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Дата и время создания снимка | "2025-07-24 08:53:58" |
| `crew_data` | JSONB | NOT NULL | Полные данные бригады в JSON | См. пример ниже |
| `members_data` | JSONB | NOT NULL | Массив всех участников в JSON | См. пример ниже |
| `created_by` | VARCHAR | NOT NULL, FOREIGN KEY | ID пользователя, создавшего снимок | "41352215" |

### Пример crew_data (JSONB):
```json
{
  "id": 2,
  "name": "Montage Team Beta",
  "phone": "+49 172 9876543",
  "firmId": "da75f029-abdb-4afa-bf90-ce591f06971b",
  "gcalId": null,
  "status": "active",
  "address": "Мюнхен, Германия",
  "leaderName": "Klaus Weber",
  "uniqueNumber": "BR-0002"
}
```

### Пример members_data (JSONB):
```json
[
  {
    "id": 4,
    "role": "worker",
    "phone": "+49 172 8765432",
    "address": "Мюнхен, Изарштрассе 88",
    "lastName": "Шмидт",
    "firstName": "Михаэль",
    "memberEmail": null,
    "uniqueNumber": "WRK-0004",
    "googleCalendarId": null
  },
  {
    "id": 6,
    "role": "worker", 
    "phone": "+49 123 456 789",
    "address": "Тестовый адрес для демонстрации",
    "lastName": "Bujac",
    "firstName": "Iacob",
    "memberEmail": "iasabujak@gmail.com",
    "uniqueNumber": "TEST-001",
    "googleCalendarId": "primary"
  }
]
```

## 5. СВЯЗАННЫЕ ТАБЛИЦЫ

### ТАБЛИЦА PROJECTS (Проекты) - связь с бригадами:
| Столбец | Тип данных | Описание |
|---------|------------|----------|
| `crew_id` | INTEGER | FOREIGN KEY на crews.id - назначенная бригада |

### ТАБЛИЦА FIRMS (Фирмы) - настройки интеграции:
| Столбец | Тип данных | Описание |
|---------|------------|----------|
| `gcal_master_id` | VARCHAR | ID корпоративного календаря фирмы |
| `calendar_event_title` | VARCHAR | Шаблон заголовка события |
| `calendar_event_description` | TEXT | Шаблон описания события |

## 6. ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ

```sql
CREATE INDEX idx_crews_firm_id ON crews(firm_id);
CREATE INDEX idx_crew_members_crew_id ON crew_members(crew_id);
CREATE INDEX idx_crew_history_crew_id ON crew_history(crew_id);
CREATE INDEX idx_project_crew_snapshots_project_id ON project_crew_snapshots(project_id);
CREATE INDEX idx_crew_members_unique_number ON crew_members(unique_number);
CREATE INDEX idx_crews_unique_number ON crews(unique_number);
```

## 7. ОГРАНИЧЕНИЯ И ТРИГГЕРЫ

### ПРОВЕРОЧНЫЕ ОГРАНИЧЕНИЯ:
```sql
-- Статусы бригад
ALTER TABLE crews ADD CONSTRAINT check_crew_status 
CHECK (status IN ('active', 'vacation', 'equipment_issue', 'unavailable'));

-- Роли участников  
ALTER TABLE crew_members ADD CONSTRAINT check_member_role
CHECK (role IN ('leader', 'worker', 'specialist'));

-- Типы изменений в истории
ALTER TABLE crew_history ADD CONSTRAINT check_change_type
CHECK (change_type IN ('crew_created', 'member_added', 'member_removed'));
```

### УНИКАЛЬНЫЕ ОГРАНИЧЕНИЯ:
```sql
-- Уникальность номеров бригад в рамках фирмы
ALTER TABLE crews ADD CONSTRAINT unique_crew_number_per_firm 
UNIQUE (firm_id, unique_number);

-- Уникальность номеров участников в системе
ALTER TABLE crew_members ADD CONSTRAINT unique_member_number 
UNIQUE (unique_number);

-- Уникальность email участников
ALTER TABLE crew_members ADD CONSTRAINT unique_member_email 
UNIQUE (member_email) WHERE member_email IS NOT NULL;
```

## 8. КРИТИЧЕСКИЕ БИЗНЕС-ПРАВИЛА

1. **project_crew_snapshots НЕИЗМЕНЯЕМЫ** - никогда не UPDATE/DELETE
2. **Мягкое удаление** - archived = true вместо DELETE
3. **Уникальность номеров** - каждый номер уникален в своей области
4. **История изменений** - все изменения логируются в crew_history
5. **Транзакционность** - операции с несколькими таблицами в транзакциях