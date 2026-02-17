-- ПОЛНАЯ СТРУКТУРА БАЗЫ ДАННЫХ ДЛЯ СИСТЕМЫ БРИГАД
-- Система управления бригадами солнечных панелей SCAC

-- ============================================================================
-- 1. ОСНОВНАЯ ТАБЛИЦА БРИГАД
-- ============================================================================
CREATE TABLE crews (
    id SERIAL PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    name VARCHAR NOT NULL,                    -- Название бригады
    unique_number VARCHAR NOT NULL,           -- Уникальный номер бригады (BR-0001)
    leader_name VARCHAR NOT NULL,             -- Имя руководителя бригады
    phone VARCHAR,                            -- Телефон руководителя
    address TEXT,                             -- Адрес базирования бригады
    status VARCHAR CHECK (status IN ('active', 'vacation', 'equipment_issue', 'unavailable')) 
           NOT NULL DEFAULT 'active',         -- Статус бригады
    archived BOOLEAN DEFAULT false,           -- Архивирована ли бригада
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. УЧАСТНИКИ БРИГАД
-- ============================================================================
CREATE TABLE crew_members (
    id SERIAL PRIMARY KEY,
    crew_id INTEGER NOT NULL REFERENCES crews(id),
    first_name VARCHAR NOT NULL,              -- Имя участника
    last_name VARCHAR NOT NULL,               -- Фамилия участника
    address TEXT,                             -- Адрес участника
    unique_number VARCHAR NOT NULL,           -- Уникальный номер участника (WRK-0001)
    phone VARCHAR,                            -- Телефон участника
    role VARCHAR DEFAULT 'worker',            -- Роль: leader, worker, specialist
    member_email VARCHAR,                     -- Email участника
    archived BOOLEAN DEFAULT false,           -- Архивирован ли участник
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. ИСТОРИЯ ИЗМЕНЕНИЙ БРИГАД
-- ============================================================================
CREATE TABLE crew_history (
    id SERIAL PRIMARY KEY,
    crew_id INTEGER NOT NULL REFERENCES crews(id),
    change_type VARCHAR CHECK (change_type IN ('crew_created', 'member_added', 'member_removed')) 
                NOT NULL,                     -- Тип изменения
    member_id INTEGER REFERENCES crew_members(id), -- NULL для crew_created
    member_name VARCHAR,                      -- Имя участника на момент изменения
    member_specialization VARCHAR,            -- Специализация участника
    start_date DATE,                          -- Дата начала работы участника
    end_date DATE,                            -- Дата окончания работы (для удаленных)
    change_description TEXT,                  -- Описание изменения
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR REFERENCES users(id)   -- Кто внес изменение
);

-- ============================================================================
-- 4. СНИМКИ СОСТАВА БРИГАД ДЛЯ ПРОЕКТОВ (КРИТИЧЕСКИ ВАЖНО!)
-- ============================================================================
CREATE TABLE project_crew_snapshots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    crew_id INTEGER NOT NULL,                 -- ID бригады на момент назначения
    snapshot_date TIMESTAMP DEFAULT NOW() NOT NULL,
    crew_data JSONB NOT NULL,                 -- Полные данные о бригаде на момент снимка
    members_data JSONB NOT NULL,              -- Массив всех участников на момент снимка
    created_by VARCHAR NOT NULL REFERENCES users(id)
);

-- ============================================================================
-- 5. СВЯЗУЮЩИЕ ТАБЛИЦЫ И ИНДЕКСЫ
-- ============================================================================

-- Проекты ссылаются на бригады
ALTER TABLE projects ADD COLUMN crew_id INTEGER REFERENCES crews(id);

-- Индексы для оптимизации
CREATE INDEX idx_crews_firm_id ON crews(firm_id);
CREATE INDEX idx_crew_members_crew_id ON crew_members(crew_id);
CREATE INDEX idx_crew_history_crew_id ON crew_history(crew_id);
CREATE INDEX idx_project_crew_snapshots_project_id ON project_crew_snapshots(project_id);

-- ============================================================================
-- 6. ПРИМЕРЫ ДАННЫХ ИЗ РЕАЛЬНОЙ СИСТЕМЫ
-- ============================================================================

-- Пример бригады:
INSERT INTO crews (firm_id, name, unique_number, leader_name, phone, status, address) VALUES
('da75f029-abdb-4afa-bf90-ce591f06971b', 'Montage Team Alpha', 'BR-0001', 'Hans Zimmermann', '+49 171 1234567', 'active', 'Мюнхен, Германия');

-- Пример участников:
INSERT INTO crew_members (crew_id, first_name, last_name, unique_number, role, phone, member_email) VALUES
(1, 'Ганс', 'Циммерман', 'WRK-0001', 'leader', '+49 171 1234567', null),
(1, 'Петер', 'Мюллер', 'WRK-0002', 'worker', '+49 171 2345678', null),
(1, 'Iacob', 'Bujac', 'TEST-001', 'worker', '+49 123 456 789', 'iasabujak@gmail.com');

-- Пример истории изменений:
INSERT INTO crew_history (crew_id, change_type, member_name, change_description, created_by) VALUES
(2, 'member_removed', 'Михаэль Шмидт', 'Участник Михаэль Шмидт исключен из бригады (работал с 2025-01-01 по 2025-07-25)', '41352215');

-- Пример снимка бригады для проекта:
INSERT INTO project_crew_snapshots (project_id, crew_id, crew_data, members_data, created_by) VALUES
(36, 2, 
'{"id": 2, "name": "Montage Team Beta", "phone": "+49 172 9876543", "firmId": "da75f029-abdb-4afa-bf90-ce591f06971b", "status": "active", "leaderName": "Klaus Weber", "uniqueNumber": "BR-0002"}',
'[{"id": 4, "role": "worker", "phone": "+49 172 8765432", "firstName": "Михаэль", "lastName": "Шмидт", "uniqueNumber": "WRK-0004"}]',
'41352215');

-- ============================================================================
-- 7. КЛЮЧЕВЫЕ ВЗАИМОДЕЙСТВИЯ И БИЗНЕС-ЛОГИКА
-- ============================================================================

/*
ОСНОВНЫЕ ВЗАИМОДЕЙСТВИЯ:

1. СОЗДАНИЕ БРИГАДЫ:
   - Создается запись в crews
   - Создается запись в crew_history с типом 'crew_created'

2. ДОБАВЛЕНИЕ УЧАСТНИКА:
   - Создается запись в crew_members  
   - Создается запись в crew_history с типом 'member_added'

3. УДАЛЕНИЕ УЧАСТНИКА:
   - Устанавливается archived = true в crew_members
   - Создается запись в crew_history с типом 'member_removed'

4. НАЗНАЧЕНИЕ БРИГАДЫ НА ПРОЕКТ:
   - Обновляется crew_id в projects
   - КРИТИЧЕСКИ ВАЖНО: Создается снимок в project_crew_snapshots
   - Снимок сохраняет точное состояние бригады на момент назначения
   - Снимок НИКОГДА не изменяется, даже если состав бригады меняется

5. СТАТИСТИКА БРИГАД:
   - Подсчет проектов через project_crew_snapshots
   - Анализ загрузки по датам проектов
   - История изменений через crew_history

СТАТУСЫ БРИГАД:
- active: Активная бригада
- vacation: В отпуске
- equipment_issue: Проблемы с оборудованием  
- unavailable: Недоступна

РОЛИ УЧАСТНИКОВ:
- leader: Руководитель бригады
- worker: Рабочий
- specialist: Специалист

КРИТИЧЕСКОЕ ТРЕБОВАНИЕ:
project_crew_snapshots - это исторические снимки, которые НИКОГДА не изменяются!
Они показывают точный состав бригады на момент назначения на проект.
*/