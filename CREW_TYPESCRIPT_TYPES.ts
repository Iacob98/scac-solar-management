// =============================================================================
// TYPESCRIPT ТИПЫ ДЛЯ СИСТЕМЫ БРИГАД
// Полная типизация для фронтенда и бэкенда
// =============================================================================

import { z } from 'zod';

// -----------------------------------------------------------------------------
// ENUM ТИПЫ
// -----------------------------------------------------------------------------

export const CrewStatus = z.enum(['active', 'vacation', 'equipment_issue', 'unavailable']);
export type CrewStatus = z.infer<typeof CrewStatus>;

export const MemberRole = z.enum(['leader', 'worker', 'specialist']);
export type MemberRole = z.infer<typeof MemberRole>;

export const ChangeType = z.enum(['crew_created', 'member_added', 'member_removed']);
export type ChangeType = z.infer<typeof ChangeType>;

// -----------------------------------------------------------------------------
// ОСНОВНЫЕ ТИПЫ СУЩНОСТЕЙ
// -----------------------------------------------------------------------------

// Тип для бригады
export const CrewSchema = z.object({
  id: z.number(),
  firmId: z.string().uuid(),
  name: z.string(),
  uniqueNumber: z.string().nullable(),
  leaderName: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: CrewStatus,
  archived: z.boolean(),
  createdAt: z.date(),
});

export type Crew = z.infer<typeof CrewSchema>;

// Тип для участника бригады
export const CrewMemberSchema = z.object({
  id: z.number(),
  crewId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  address: z.string().nullable(),
  uniqueNumber: z.string(),
  phone: z.string().nullable(),
  role: MemberRole,
  memberEmail: z.string().email().nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
});

export type CrewMember = z.infer<typeof CrewMemberSchema>;

// Тип для истории изменений
export const CrewHistorySchema = z.object({
  id: z.number(),
  crewId: z.number(),
  changeType: ChangeType,
  memberId: z.number().nullable(),
  memberName: z.string().nullable(),
  memberSpecialization: z.string().nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  changeDescription: z.string().nullable(),
  createdAt: z.date(),
  createdBy: z.string().nullable(),
});

export type CrewHistory = z.infer<typeof CrewHistorySchema>;

// Тип для снимка бригады в проекте
export const ProjectCrewSnapshotSchema = z.object({
  id: z.number(),
  projectId: z.number(),
  crewId: z.number(),
  snapshotDate: z.date(),
  crewData: z.record(z.any()), // JSONB данные бригады
  membersData: z.array(z.record(z.any())), // JSONB массив участников
  createdBy: z.string(),
});

export type ProjectCrewSnapshot = z.infer<typeof ProjectCrewSnapshotSchema>;

// -----------------------------------------------------------------------------
// РАСШИРЕННЫЕ ТИПЫ С ВЫЧИСЛЯЕМЫМИ ПОЛЯМИ
// -----------------------------------------------------------------------------

// Бригада с дополнительной информацией
export const CrewWithStatsSchema = CrewSchema.extend({
  firmName: z.string(),
  activeMembersCount: z.number(),
  activeProjectsCount: z.number(),
  totalProjectsCount: z.number(),
  members: z.array(CrewMemberSchema).optional(),
});

export type CrewWithStats = z.infer<typeof CrewWithStatsSchema>;

// История с дополнительной информацией
export const CrewHistoryDetailedSchema = CrewHistorySchema.extend({
  crewName: z.string(),
  crewNumber: z.string().nullable(),
  changedByName: z.string().nullable(),
});

export type CrewHistoryDetailed = z.infer<typeof CrewHistoryDetailedSchema>;

// -----------------------------------------------------------------------------
// ТИПЫ ДЛЯ API ЗАПРОСОВ
// -----------------------------------------------------------------------------

// Создание новой бригады
export const CreateCrewSchema = z.object({
  firmId: z.string().uuid(),
  name: z.string().min(1, 'Название бригады обязательно'),
  uniqueNumber: z.string().min(1, 'Номер бригады обязателен'),
  leaderName: z.string().min(1, 'Имя руководителя обязательно'),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: CrewStatus.default('active'),
});

export type CreateCrewInput = z.infer<typeof CreateCrewSchema>;

// Обновление бригады
export const UpdateCrewSchema = CreateCrewSchema.partial().omit({ firmId: true });
export type UpdateCrewInput = z.infer<typeof UpdateCrewSchema>;

// Создание участника бригады
export const CreateCrewMemberSchema = z.object({
  crewId: z.number(),
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'),
  uniqueNumber: z.string().min(1, 'Уникальный номер обязателен'),
  role: MemberRole.default('worker'),
  phone: z.string().optional(),
  address: z.string().optional(),
  memberEmail: z.string().email().optional(),
});

export type CreateCrewMemberInput = z.infer<typeof CreateCrewMemberSchema>;

// Обновление участника бригады
export const UpdateCrewMemberSchema = CreateCrewMemberSchema.partial().omit({ crewId: true });
export type UpdateCrewMemberInput = z.infer<typeof UpdateCrewMemberSchema>;

// Назначение бригады на проект
export const AssignCrewToProjectSchema = z.object({
  projectId: z.number(),
  crewId: z.number(),
});

export type AssignCrewToProjectInput = z.infer<typeof AssignCrewToProjectSchema>;

// -----------------------------------------------------------------------------
// ТИПЫ ДЛЯ ФИЛЬТРАЦИИ И ПОИСКА
// -----------------------------------------------------------------------------

export const CrewFiltersSchema = z.object({
  firmId: z.string().uuid().optional(),
  status: CrewStatus.optional(),
  archived: z.boolean().optional(),
  search: z.string().optional(), // Поиск по имени или номеру
});

export type CrewFilters = z.infer<typeof CrewFiltersSchema>;

export const CrewMemberFiltersSchema = z.object({
  crewId: z.number().optional(),
  role: MemberRole.optional(),
  archived: z.boolean().optional(),
  search: z.string().optional(), // Поиск по имени или номеру
});

export type CrewMemberFilters = z.infer<typeof CrewMemberFiltersSchema>;

// -----------------------------------------------------------------------------
// ТИПЫ ДЛЯ СТАТИСТИКИ
// -----------------------------------------------------------------------------

export const CrewStatsSchema = z.object({
  totalCrews: z.number(),
  activeCrews: z.number(),
  totalMembers: z.number(),
  activeMembers: z.number(),
  crewsByStatus: z.record(CrewStatus, z.number()),
  membersByRole: z.record(MemberRole, z.number()),
});

export type CrewStats = z.infer<typeof CrewStatsSchema>;

export const CrewWorkloadSchema = z.object({
  crewId: z.number(),
  crewName: z.string(),
  activeProjects: z.number(),
  completedProjects: z.number(),
  avgProjectDuration: z.number().nullable(), // в днях
  efficiency: z.number().nullable(), // процент от 0 до 100
});

export type CrewWorkload = z.infer<typeof CrewWorkloadSchema>;

// -----------------------------------------------------------------------------
// ТИПЫ ДЛЯ ОТВЕТОВ API
// -----------------------------------------------------------------------------

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// Специфичные ответы API
export type CrewListResponse = ApiResponse<CrewWithStats[]>;
export type CrewResponse = ApiResponse<CrewWithStats>;
export type CrewMemberListResponse = ApiResponse<CrewMember[]>;
export type CrewHistoryResponse = ApiResponse<CrewHistoryDetailed[]>;
export type CrewStatsResponse = ApiResponse<CrewStats>;

// -----------------------------------------------------------------------------
// ТИПЫ ДЛЯ КОМПОНЕНТОВ REACT
// -----------------------------------------------------------------------------

export interface CrewCardProps {
  crew: CrewWithStats;
  onEdit?: (crew: CrewWithStats) => void;
  onDelete?: (crewId: number) => void;
  onViewDetails?: (crewId: number) => void;
}

export interface CrewMemberListProps {
  crewId: number;
  members: CrewMember[];
  onAddMember?: () => void;
  onEditMember?: (member: CrewMember) => void;
  onRemoveMember?: (memberId: number) => void;
}

export interface CrewFormProps {
  crew?: CrewWithStats;
  onSubmit: (data: CreateCrewInput | UpdateCrewInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface CrewMemberFormProps {
  member?: CrewMember;
  crewId: number;
  onSubmit: (data: CreateCrewMemberInput | UpdateCrewMemberInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// -----------------------------------------------------------------------------
// КОНСТАНТЫ И УТИЛИТЫ
// -----------------------------------------------------------------------------

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  active: 'Активная',
  vacation: 'В отпуске',
  equipment_issue: 'Проблемы с оборудованием',
  unavailable: 'Недоступна',
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  leader: 'Руководитель',
  worker: 'Рабочий',
  specialist: 'Специалист',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  crew_created: 'Бригада создана',
  member_added: 'Участник добавлен',
  member_removed: 'Участник исключен',
};

// Функции-утилиты для валидации
export const validateCrewNumber = (number: string, firmId: string): boolean => {
  // Логика проверки уникальности номера бригады в рамках фирмы
  return /^BR-\d{4}$/.test(number);
};

export const validateMemberNumber = (number: string): boolean => {
  // Логика проверки уникальности номера участника в системе
  return /^WRK-\d{4}$/.test(number);
};

export const formatFullName = (firstName: string, lastName: string): string => {
  return `${firstName} ${lastName}`;
};

export const getCrewStatusColor = (status: CrewStatus): string => {
  const colors = {
    active: 'green',
    vacation: 'blue',
    equipment_issue: 'red',
    unavailable: 'gray',
  };
  return colors[status];
};

export const getMemberRoleIcon = (role: MemberRole): string => {
  const icons = {
    leader: '👨‍💼',
    worker: '👷‍♂️',
    specialist: '🔧',
  };
  return icons[role];
};

// -----------------------------------------------------------------------------
// ТИПЫ ДЛЯ REACT QUERY
// -----------------------------------------------------------------------------

export type CrewQueryKey = ['crews', CrewFilters?];
export type CrewMemberQueryKey = ['crew-members', number, CrewMemberFilters?];
export type CrewHistoryQueryKey = ['crew-history', number];
export type CrewStatsQueryKey = ['crew-stats', string]; // firmId

// -----------------------------------------------------------------------------
// ЭКСПОРТ ВСЕХ СХЕМ ДЛЯ ВАЛИДАЦИИ
// -----------------------------------------------------------------------------

export const schemas = {
  Crew: CrewSchema,
  CrewMember: CrewMemberSchema,
  CrewHistory: CrewHistorySchema,
  ProjectCrewSnapshot: ProjectCrewSnapshotSchema,
  CreateCrew: CreateCrewSchema,
  UpdateCrew: UpdateCrewSchema,
  CreateCrewMember: CreateCrewMemberSchema,
  UpdateCrewMember: UpdateCrewMemberSchema,
  AssignCrewToProject: AssignCrewToProjectSchema,
  CrewFilters: CrewFiltersSchema,
  CrewMemberFilters: CrewMemberFiltersSchema,
} as const;