-- =============================================================================
-- ПОЛНАЯ SQL СХЕМА СИСТЕМЫ БРИГАД
-- Основана на реальной структуре базы данных SCAC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ТАБЛИЦА CREWS (Основная таблица бригад)
-- -----------------------------------------------------------------------------
CREATE TABLE crews (
    id INTEGER PRIMARY KEY DEFAULT nextval('crews_id_seq'::regclass),
    firm_id UUID NOT NULL REFERENCES firms(id),
    name CHARACTER VARYING NOT NULL,
    unique_number CHARACTER VARYING(50),
    leader_name CHARACTER VARYING NOT NULL,
    phone CHARACTER VARYING,
    address TEXT,
    status CHARACTER VARYING DEFAULT 'active'::character varying
        CHECK (status IN ('active', 'vacation', 'equipment_issue', 'unavailable')),
    archived BOOLEAN DEFAULT false,
    gcal_id CHARACTER VARYING,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Индексы для оптимизации
CREATE INDEX idx_crews_firm_id ON crews(firm_id);
CREATE INDEX idx_crews_status ON crews(status);
CREATE INDEX idx_crews_archived ON crews(archived);

-- -----------------------------------------------------------------------------
-- 2. ТАБЛИЦА CREW_MEMBERS (Участники бригад)
-- -----------------------------------------------------------------------------
CREATE TABLE crew_members (
    id INTEGER PRIMARY KEY DEFAULT nextval('crew_members_id_seq'::regclass),
    crew_id INTEGER NOT NULL REFERENCES crews(id),
    first_name CHARACTER VARYING(255) NOT NULL,
    last_name CHARACTER VARYING(255) NOT NULL,
    address TEXT,
    unique_number CHARACTER VARYING(50) NOT NULL,
    phone CHARACTER VARYING(50),
    role CHARACTER VARYING(50) DEFAULT 'worker'::character varying
        CHECK (role IN ('leader', 'worker', 'specialist')),
    member_email CHARACTER VARYING,
    google_calendar_id CHARACTER VARYING,
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Индексы для оптимизации
CREATE INDEX idx_crew_members_crew_id ON crew_members(crew_id);
CREATE INDEX idx_crew_members_unique_number ON crew_members(unique_number);
CREATE INDEX idx_crew_members_role ON crew_members(role);
CREATE INDEX idx_crew_members_archived ON crew_members(archived);

-- Уникальные ограничения
ALTER TABLE crew_members ADD CONSTRAINT unique_crew_member_number UNIQUE (unique_number);

-- -----------------------------------------------------------------------------
-- 3. ТАБЛИЦА CREW_HISTORY (История изменений бригад)
-- -----------------------------------------------------------------------------
CREATE TABLE crew_history (
    id INTEGER PRIMARY KEY DEFAULT nextval('crew_history_id_seq'::regclass),
    crew_id INTEGER NOT NULL REFERENCES crews(id),
    change_type CHARACTER VARYING NOT NULL
        CHECK (change_type IN ('crew_created', 'member_added', 'member_removed')),
    member_id INTEGER REFERENCES crew_members(id),
    member_name CHARACTER VARYING,
    member_specialization CHARACTER VARYING,
    member_google_calendar_id CHARACTER VARYING,
    start_date DATE,
    end_date DATE,
    change_description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    created_by CHARACTER VARYING REFERENCES users(id)
);

-- Индексы для оптимизации
CREATE INDEX idx_crew_history_crew_id ON crew_history(crew_id);
CREATE INDEX idx_crew_history_change_type ON crew_history(change_type);
CREATE INDEX idx_crew_history_created_at ON crew_history(created_at);
CREATE INDEX idx_crew_history_member_id ON crew_history(member_id);

-- -----------------------------------------------------------------------------
-- 4. ТАБЛИЦА PROJECT_CREW_SNAPSHOTS (Снимки состава - КРИТИЧЕСКИ ВАЖНО!)
-- -----------------------------------------------------------------------------
CREATE TABLE project_crew_snapshots (
    id INTEGER PRIMARY KEY DEFAULT nextval('project_crew_snapshots_id_seq'::regclass),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    crew_id INTEGER NOT NULL,  -- НЕ FOREIGN KEY - может ссылаться на удаленную бригаду
    snapshot_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crew_data JSONB NOT NULL,    -- Полные данные бригады на момент снимка
    members_data JSONB NOT NULL, -- Массив всех участников на момент снимка
    created_by CHARACTER VARYING NOT NULL REFERENCES users(id)
);

-- Индексы для оптимизации
CREATE INDEX idx_project_crew_snapshots_project_id ON project_crew_snapshots(project_id);
CREATE INDEX idx_project_crew_snapshots_crew_id ON project_crew_snapshots(crew_id);
CREATE INDEX idx_project_crew_snapshots_snapshot_date ON project_crew_snapshots(snapshot_date);

-- GIN индекс для быстрого поиска по JSON данным
CREATE INDEX idx_project_crew_snapshots_crew_data ON project_crew_snapshots USING GIN (crew_data);
CREATE INDEX idx_project_crew_snapshots_members_data ON project_crew_snapshots USING GIN (members_data);

-- =============================================================================
-- ПРИМЕРЫ СТРУКТУРЫ JSONB ДАННЫХ
-- =============================================================================

-- ПРИМЕР crew_data JSONB:
/*
{
  "id": 2,
  "name": "Montage Team Beta",
  "phone": "+49 172 9876543",
  "firmId": "da75f029-abdb-4afa-bf90-ce591f06971b",
  "gcalId": null,
  "status": "active",
  "address": "Мюнхен, Германия",
  "leaderName": "Klaus Weber",
  "uniqueNumber": "BR-0002",
  "archived": false,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
*/

-- ПРИМЕР members_data JSONB:
/*
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
    "googleCalendarId": null,
    "archived": false,
    "createdAt": "2025-01-10T09:15:00.000Z"
  },
  {
    "id": 6,
    "role": "specialist",
    "phone": "+49 123 456 789",
    "address": "Тестовый адрес для демонстрации",
    "lastName": "Bujac",
    "firstName": "Iacob",
    "memberEmail": "iasabujak@gmail.com",
    "uniqueNumber": "TEST-001",
    "googleCalendarId": "primary",
    "archived": false,
    "createdAt": "2024-12-20T14:20:00.000Z"
  }
]
*/

-- =============================================================================
-- ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- =============================================================================

-- Триггер для автоматического создания записи в истории при создании бригады
CREATE OR REPLACE FUNCTION crew_created_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO crew_history (
        crew_id, 
        change_type, 
        change_description, 
        created_by
    ) VALUES (
        NEW.id,
        'crew_created',
        'Бригада "' || NEW.name || '" создана',
        COALESCE(current_setting('app.current_user_id', true), 'system')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crew_created
    AFTER INSERT ON crews
    FOR EACH ROW
    EXECUTE FUNCTION crew_created_trigger();

-- Триггер для автоматического создания записи в истории при добавлении участника
CREATE OR REPLACE FUNCTION crew_member_added_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO crew_history (
        crew_id,
        change_type,
        member_id,
        member_name,
        change_description,
        created_by
    ) VALUES (
        NEW.crew_id,
        'member_added',
        NEW.id,
        NEW.first_name || ' ' || NEW.last_name,
        'Участник ' || NEW.first_name || ' ' || NEW.last_name || ' добавлен в бригаду',
        COALESCE(current_setting('app.current_user_id', true), 'system')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crew_member_added
    AFTER INSERT ON crew_members
    FOR EACH ROW
    EXECUTE FUNCTION crew_member_added_trigger();

-- Триггер для записи в историю при архивировании участника
CREATE OR REPLACE FUNCTION crew_member_archived_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.archived = false AND NEW.archived = true THEN
        INSERT INTO crew_history (
            crew_id,
            change_type,
            member_id,
            member_name,
            end_date,
            change_description,
            created_by
        ) VALUES (
            NEW.crew_id,
            'member_removed',
            NEW.id,
            NEW.first_name || ' ' || NEW.last_name,
            CURRENT_DATE,
            'Участник ' || NEW.first_name || ' ' || NEW.last_name || ' исключен из бригады',
            COALESCE(current_setting('app.current_user_id', true), 'system')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crew_member_archived
    AFTER UPDATE ON crew_members
    FOR EACH ROW
    EXECUTE FUNCTION crew_member_archived_trigger();

-- =============================================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ
-- =============================================================================

-- Функция для получения актуального состава бригады
CREATE OR REPLACE FUNCTION get_current_crew_composition(crew_id_param INTEGER)
RETURNS TABLE (
    crew_info JSONB,
    members_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        row_to_json(c)::jsonb as crew_info,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', cm.id,
                    'firstName', cm.first_name,
                    'lastName', cm.last_name,
                    'uniqueNumber', cm.unique_number,
                    'role', cm.role,
                    'phone', cm.phone,
                    'memberEmail', cm.member_email,
                    'googleCalendarId', cm.google_calendar_id,
                    'address', cm.address,
                    'archived', cm.archived,
                    'createdAt', cm.created_at
                )
            ) FILTER (WHERE cm.id IS NOT NULL),
            '[]'::jsonb
        ) as members_info
    FROM crews c
    LEFT JOIN crew_members cm ON c.id = cm.crew_id AND cm.archived = false
    WHERE c.id = crew_id_param AND c.archived = false
    GROUP BY c.id, c.firm_id, c.name, c.unique_number, c.leader_name, 
             c.phone, c.address, c.status, c.archived, c.gcal_id, c.created_at;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания снимка бригады для проекта
CREATE OR REPLACE FUNCTION create_crew_snapshot(
    project_id_param INTEGER,
    crew_id_param INTEGER,
    created_by_param VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    snapshot_id INTEGER;
    crew_data_json JSONB;
    members_data_json JSONB;
BEGIN
    -- Получаем текущее состояние бригады
    SELECT crew_info, members_info 
    INTO crew_data_json, members_data_json
    FROM get_current_crew_composition(crew_id_param);
    
    -- Создаем снимок
    INSERT INTO project_crew_snapshots (
        project_id,
        crew_id,
        crew_data,
        members_data,
        created_by
    ) VALUES (
        project_id_param,
        crew_id_param,
        crew_data_json,
        members_data_json,
        created_by_param
    ) RETURNING id INTO snapshot_id;
    
    RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ПРЕДСТАВЛЕНИЯ ДЛЯ УДОБНОГО ДОСТУПА К ДАННЫМ
-- =============================================================================

-- Представление для получения полной информации о бригадах
CREATE OR REPLACE VIEW crews_with_stats AS
SELECT 
    c.*,
    f.name as firm_name,
    COUNT(DISTINCT cm.id) FILTER (WHERE cm.archived = false) as active_members_count,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status IN ('work_in_progress', 'work_scheduled')) as active_projects_count,
    COUNT(DISTINCT pcs.id) as total_projects_count
FROM crews c
JOIN firms f ON c.firm_id = f.id
LEFT JOIN crew_members cm ON c.id = cm.crew_id
LEFT JOIN projects p ON c.id = p.crew_id
LEFT JOIN project_crew_snapshots pcs ON c.id = pcs.crew_id
WHERE c.archived = false
GROUP BY c.id, c.firm_id, c.name, c.unique_number, c.leader_name, c.phone, 
         c.address, c.status, c.archived, c.gcal_id, c.created_at, f.name;

-- Представление для истории бригад с именами пользователей
CREATE OR REPLACE VIEW crew_history_detailed AS
SELECT 
    ch.*,
    c.name as crew_name,
    c.unique_number as crew_number,
    u.firstName || ' ' || u.lastName as changed_by_name
FROM crew_history ch
JOIN crews c ON ch.crew_id = c.id
LEFT JOIN users u ON ch.created_by = u.id
ORDER BY ch.created_at DESC;

-- =============================================================================
-- ПРАВА ДОСТУПА И БЕЗОПАСНОСТЬ
-- =============================================================================

-- Политики безопасности на уровне строк (RLS)
-- Если используется RLS, можно добавить политики для ограничения доступа по фирмам

-- =============================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ ДЛЯ ТЕСТИРОВАНИЯ
-- =============================================================================

-- Пример начальных данных (раскомментировать при необходимости)
/*
-- Пример бригады
INSERT INTO crews (firm_id, name, unique_number, leader_name, phone, status, address) VALUES
('da75f029-abdb-4afa-bf90-ce591f06971b', 'Montage Team Alpha', 'BR-0001', 'Hans Zimmermann', '+49 171 1234567', 'active', 'Мюнхен, Шиллерштрассе 15');

-- Пример участников
INSERT INTO crew_members (crew_id, first_name, last_name, unique_number, role, phone, address) VALUES
(1, 'Ганс', 'Циммерман', 'WRK-0001', 'leader', '+49 171 1234567', 'Мюнхен, Шиллерштрассе 15'),
(1, 'Петер', 'Мюллер', 'WRK-0002', 'worker', '+49 171 2345678', 'Мюнхен, Августенштрассе 45'),
(1, 'Михаэль', 'Шмидт', 'WRK-0003', 'specialist', '+49 171 3456789', 'Мюнхен, Изарштрассе 88');
*/

-- =============================================================================
-- КОММЕНТАРИИ И ДОКУМЕНТАЦИЯ
-- =============================================================================

COMMENT ON TABLE crews IS 'Основная таблица бригад монтажников солнечных панелей';
COMMENT ON TABLE crew_members IS 'Участники бригад с ролями и контактной информацией';
COMMENT ON TABLE crew_history IS 'История всех изменений в составе бригад';
COMMENT ON TABLE project_crew_snapshots IS 'КРИТИЧЕСКИ ВАЖНО: Неизменяемые снимки состава бригад на момент назначения на проекты';

COMMENT ON COLUMN project_crew_snapshots.crew_data IS 'JSON с полными данными бригады на момент снимка - НИКОГДА НЕ ИЗМЕНЯЕТСЯ';
COMMENT ON COLUMN project_crew_snapshots.members_data IS 'JSON массив всех участников на момент снимка - НИКОГДА НЕ ИЗМЕНЯЕТСЯ';

-- =============================================================================
-- ПОЛЕЗНЫЕ ЗАПРОСЫ ДЛЯ РАЗРАБОТКИ
-- =============================================================================

-- Получить бригады с количеством участников
/*
SELECT 
    c.id,
    c.name,
    c.unique_number,
    c.leader_name,
    c.status,
    COUNT(cm.id) FILTER (WHERE cm.archived = false) as active_members
FROM crews c
LEFT JOIN crew_members cm ON c.id = cm.crew_id
WHERE c.archived = false
GROUP BY c.id, c.name, c.unique_number, c.leader_name, c.status
ORDER BY c.name;
*/

-- Получить историю изменений бригады
/*
SELECT 
    ch.created_at,
    ch.change_type,
    ch.member_name,
    ch.change_description,
    u.firstName || ' ' || u.lastName as changed_by
FROM crew_history ch
LEFT JOIN users u ON ch.created_by = u.id
WHERE ch.crew_id = 1
ORDER BY ch.created_at DESC;
*/

-- Получить снимки бригады для всех проектов
/*
SELECT 
    pcs.snapshot_date,
    p.id as project_id,
    pcs.crew_data->>'name' as crew_name_at_time,
    jsonb_array_length(pcs.members_data) as members_count_at_time
FROM project_crew_snapshots pcs
JOIN projects p ON pcs.project_id = p.id
WHERE pcs.crew_id = 1
ORDER BY pcs.snapshot_date DESC;
*/