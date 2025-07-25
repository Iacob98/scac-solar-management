import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  uuid,
  boolean,
  decimal,
  integer,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "leiter"] }).notNull().default("leiter"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Firms table
export const firms = pgTable("firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  invoiceNinjaUrl: varchar("invoice_ninja_url").notNull(),
  token: varchar("token").notNull(),
  address: text("address"),
  taxId: varchar("tax_id"),
  logoUrl: varchar("logo_url"),
  gcalMasterId: varchar("gcal_master_id"), // ID корпоративного календаря фирмы
  // Postmark integration fields
  postmarkServerToken: varchar("postmark_server_token"),
  postmarkFromEmail: varchar("postmark_from_email"),
  postmarkMessageStream: varchar("postmark_message_stream").default("transactional"),
  // Email template fields
  emailSubjectTemplate: varchar("email_subject_template").default("Счет №{{invoiceNumber}} от {{firmName}}"),
  emailBodyTemplate: text("email_body_template").default("Уважаемый {{clientName}},\n\nВо вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.\n\nС уважением,\n{{firmName}}"),
  
  // Google Calendar template fields
  calendarEventTitle: varchar("calendar_event_title").default("Проект: {{projectId}} - Установка солнечных панелей"),
  calendarEventDescription: text("calendar_event_description").default(`🏗️ Установка солнечных панелей

📋 Детали проекта:
• Проект №{{projectId}}
• Статус: {{status}}
• Клиент: {{clientName}}
• Адрес: {{installationAddress}}
• Телефон: {{clientPhone}}

📦 Ожидание оборудования: {{equipmentExpectedDate}}
✅ Оборудование поступило: {{equipmentArrivedDate}}
🚀 Начало работ: {{workStartDate}}
🏁 Окончание работ: {{workEndDate}}
📝 Примечания: {{notes}}

📸 Фото-отчёт бригады:
{{uploadLink}}

---
Система SCAC - Управление проектами`),
  createdAt: timestamp("created_at").defaultNow(),
});

// User-Firm junction table (many-to-many)
export const userFirms = pgTable("user_firms", {
  userId: varchar("user_id").notNull().references(() => users.id),
  firmId: uuid("firm_id").notNull().references(() => firms.id),
});

// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  firmId: uuid("firm_id").notNull().references(() => firms.id),
  ninjaClientId: varchar("ninja_client_id"),
  name: varchar("name").notNull(),
  email: varchar("email"),
  address: text("address"),
  phone: varchar("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Crews table
export const crews = pgTable("crews", {
  id: serial("id").primaryKey(),
  firmId: uuid("firm_id").notNull().references(() => firms.id),
  name: varchar("name").notNull(),
  uniqueNumber: varchar("unique_number").notNull(), // Уникальный номер бригады
  leaderName: varchar("leader_name").notNull(),
  phone: varchar("phone"),
  address: text("address"),
  status: varchar("status", { enum: ["active", "vacation", "equipment_issue", "unavailable"] }).notNull().default("active"),
  archived: boolean("archived").default(false),
  gcalId: varchar("gcal_id"), // ID календаря бригады в Google Calendar
  createdAt: timestamp("created_at").defaultNow(),
});

// Crew Members table - участники бригады
export const crewMembers = pgTable("crew_members", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").notNull().references(() => crews.id),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  address: text("address"),
  uniqueNumber: varchar("unique_number").notNull(), // Уникальный номер участника
  phone: varchar("phone"),
  role: varchar("role").default("worker"), // "leader", "worker", "specialist"
  memberEmail: varchar("member_email"), // Email для доступа к календарю
  googleCalendarId: varchar("google_calendar_id"), // ID календаря Google участника
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  firmId: uuid("firm_id").notNull().references(() => firms.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  leiterId: varchar("leiter_id").notNull().references(() => users.id),
  crewId: integer("crew_id").references(() => crews.id),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: varchar("status", { enum: ["planning", "equipment_waiting", "equipment_arrived", "work_scheduled", "work_in_progress", "work_completed", "invoiced", "send_invoice", "invoice_sent", "paid"] })
    .notNull()
    .default("planning"),
  teamNumber: varchar("team_number"),
  notes: text("notes"),
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: varchar("invoice_url"),
  // Управление датами и оборудованием
  equipmentExpectedDate: date("equipment_expected_date"),
  equipmentArrivedDate: date("equipment_arrived_date"),
  workStartDate: date("work_start_date"),
  workEndDate: date("work_end_date"),
  // Флаги для уведомлений
  needsCallForEquipmentDelay: boolean("needs_call_equipment_delay").default(false),
  needsCallForCrewDelay: boolean("needs_call_crew_delay").default(false),
  needsCallForDateChange: boolean("needs_call_date_change").default(false),
  // Информация о человеке, у которого делается установка
  installationPersonFirstName: varchar("installation_person_first_name"),
  installationPersonLastName: varchar("installation_person_last_name"),
  installationPersonAddress: text("installation_person_address"),
  installationPersonPhone: varchar("installation_person_phone"),
  installationPersonUniqueId: varchar("installation_person_unique_id"),
  // Токен для загрузки фотографий бригадой
  crewUploadToken: varchar("crew_upload_token"),
  crewUploadTokenExpires: timestamp("crew_upload_token_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  productKey: varchar("product_key"),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  isCustom: boolean("is_custom").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  invoiceId: varchar("invoice_id").notNull(), // String ID from Invoice Ninja
  invoiceNumber: varchar("invoice_number").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Files table (legacy - будет удалена в будущем)
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  fileUrl: varchar("file_url").notNull(),
  fileName: varchar("file_name"),
  fileType: varchar("file_type").notNull(), // Убрал enum ограничения для совместимости с PDF файлами
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// File Storage table - новая улучшенная система хранения файлов
export const fileStorage = pgTable("file_storage", {
  id: serial("id").primaryKey(),
  fileId: varchar("file_id").notNull().unique(), // UUID для идентификации файла
  originalName: varchar("original_name").notNull(), // Оригинальное имя файла
  fileName: varchar("file_name").notNull(), // Имя файла на диске
  mimeType: varchar("mime_type").notNull(), // MIME тип файла
  size: integer("size").notNull(), // Размер файла в байтах
  category: varchar("category", { 
    enum: ["project_file", "report", "invoice", "document", "image", "profile"] 
  }).notNull(),
  projectId: integer("project_id").references(() => projects.id), // Опциональная связь с проектом
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id), // Кто загрузил файл
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false), // Мягкое удаление
  deletedAt: timestamp("deleted_at"),
});

// Project Reports table - для фото отчетов выполненных работ
export const projectReports = pgTable("project_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  rating: integer("rating").notNull(), // Оценка от 1 до 5
  reviewText: text("review_text"), // Письменный отзыв
  reviewDocumentUrl: varchar("review_document_url"), // URL PDF или фото отзыва
  completedAt: timestamp("completed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoice Queue table
export const invoiceQueue = pgTable("invoice_queue", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Notes table - примечания к проекту
export const projectNotes = pgTable("project_notes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  priority: varchar("priority", { 
    enum: ['normal', 'important', 'urgent', 'critical'] 
  }).default('normal'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Crew Snapshots table - снимки состава бригады на момент назначения
export const projectCrewSnapshots = pgTable("project_crew_snapshots", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  crewId: integer("crew_id").notNull(),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  crewData: jsonb("crew_data").notNull(), // Данные о бригаде на момент снимка
  membersData: jsonb("members_data").notNull(), // Массив участников на момент снимка
  createdBy: varchar("created_by").notNull().references(() => users.id),
});

// Project History table - для отслеживания всех изменений в проекте
export const projectHistory = pgTable("project_history", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  changeType: varchar("change_type", { 
    enum: ['status_change', 'date_update', 'info_update', 'created', 'equipment_update', 'call_update', 'assignment_change', 'shared', 'file_added', 'file_deleted', 'report_added', 'report_updated', 'report_deleted', 'note_added', 'crew_assigned', 'crew_snapshot_created'] 
  }).notNull(),
  fieldName: varchar("field_name"), // название поля которое изменилось
  oldValue: text("old_value"),
  newValue: text("new_value"),
  description: text("description").notNull(),
  crewSnapshotId: integer("crew_snapshot_id").references(() => projectCrewSnapshots.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Shares table - для совместного доступа к проектам
export const projectShares = pgTable("project_shares", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  sharedBy: varchar("shared_by").notNull().references(() => users.id),
  sharedWith: varchar("shared_with").notNull().references(() => users.id),
  permission: varchar("permission", { enum: ['view', 'edit'] }).default('view'),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    uniqueShare: unique().on(table.projectId, table.sharedWith),
  };
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userFirms: many(userFirms),
  projects: many(projects),
}));

export const firmsRelations = relations(firms, ({ many }) => ({
  userFirms: many(userFirms),
  clients: many(clients),
  crews: many(crews),
  projects: many(projects),
}));

export const userFirmsRelations = relations(userFirms, ({ one }) => ({
  user: one(users, { fields: [userFirms.userId], references: [users.id] }),
  firm: one(firms, { fields: [userFirms.firmId], references: [firms.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  firm: one(firms, { fields: [clients.firmId], references: [firms.id] }),
  projects: many(projects),
}));

export const crewsRelations = relations(crews, ({ one, many }) => ({
  firm: one(firms, { fields: [crews.firmId], references: [firms.id] }),
  projects: many(projects),
  members: many(crewMembers),
}));

export const crewMembersRelations = relations(crewMembers, ({ one }) => ({
  crew: one(crews, { fields: [crewMembers.crewId], references: [crews.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  firm: one(firms, { fields: [projects.firmId], references: [firms.id] }),
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  leiter: one(users, { fields: [projects.leiterId], references: [users.id] }),
  crew: one(crews, { fields: [projects.crewId], references: [crews.id] }),
  services: many(services),
  invoices: many(invoices),
  files: many(projectFiles),
  storageFiles: many(fileStorage),
  reports: many(projectReports),
  history: many(projectHistory),
  shares: many(projectShares),
  notes: many(projectNotes),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  project: one(projects, { fields: [services.projectId], references: [projects.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, { fields: [projectFiles.projectId], references: [projects.id] }),
}));

export const fileStorageRelations = relations(fileStorage, ({ one }) => ({
  project: one(projects, { fields: [fileStorage.projectId], references: [projects.id] }),
  uploadedByUser: one(users, { fields: [fileStorage.uploadedBy], references: [users.id] }),
}));

export const projectReportsRelations = relations(projectReports, ({ one }) => ({
  project: one(projects, { fields: [projectReports.projectId], references: [projects.id] }),
}));

export const projectCrewSnapshotsRelations = relations(projectCrewSnapshots, ({ one }) => ({
  project: one(projects, { fields: [projectCrewSnapshots.projectId], references: [projects.id] }),
  createdByUser: one(users, { fields: [projectCrewSnapshots.createdBy], references: [users.id] }),
}));

export const projectHistoryRelations = relations(projectHistory, ({ one }) => ({
  project: one(projects, { fields: [projectHistory.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectHistory.userId], references: [users.id] }),
  crewSnapshot: one(projectCrewSnapshots, { fields: [projectHistory.crewSnapshotId], references: [projectCrewSnapshots.id] }),
}));

export const projectSharesRelations = relations(projectShares, ({ one }) => ({
  project: one(projects, { fields: [projectShares.projectId], references: [projects.id] }),
  sharedByUser: one(users, { fields: [projectShares.sharedBy], references: [users.id] }),
  sharedWithUser: one(users, { fields: [projectShares.sharedWith], references: [users.id] }),
}));

export const projectNotesRelations = relations(projectNotes, ({ one }) => ({
  project: one(projects, { fields: [projectNotes.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectNotes.userId], references: [users.id] }),
}));

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertFirmSchema = createInsertSchema(firms).omit({ id: true, createdAt: true });
export type InsertFirm = z.infer<typeof insertFirmSchema>;
export type Firm = typeof firms.$inferSelect;

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const insertCrewSchema = createInsertSchema(crews).omit({ id: true, createdAt: true });
export type InsertCrew = z.infer<typeof insertCrewSchema>;
export type Crew = typeof crews.$inferSelect;

export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({ id: true, createdAt: true });
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const insertProjectCrewSnapshotSchema = createInsertSchema(projectCrewSnapshots).omit({ 
  id: true, 
  snapshotDate: true 
});
export type InsertProjectCrewSnapshot = z.infer<typeof insertProjectCrewSnapshotSchema>;
export type ProjectCrewSnapshot = typeof projectCrewSnapshots.$inferSelect;

export const insertProjectHistorySchema = createInsertSchema(projectHistory).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertProjectHistory = z.infer<typeof insertProjectHistorySchema>;
export type ProjectHistory = typeof projectHistory.$inferSelect;

export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({ id: true, uploadedAt: true });
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;

export const insertProjectReportSchema = createInsertSchema(projectReports).omit({ 
  id: true, 
  completedAt: true, 
  createdAt: true 
});
export type InsertProjectReport = z.infer<typeof insertProjectReportSchema>;
export type ProjectReport = typeof projectReports.$inferSelect;

export const insertProjectShareSchema = createInsertSchema(projectShares).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertProjectShare = z.infer<typeof insertProjectShareSchema>;
export type ProjectShare = typeof projectShares.$inferSelect;

export const insertFileStorageSchema = createInsertSchema(fileStorage).omit({ 
  id: true, 
  uploadedAt: true,
  isDeleted: true,
  deletedAt: true 
});
export type InsertFileStorage = z.infer<typeof insertFileStorageSchema>;
export type FileStorage = typeof fileStorage.$inferSelect;

export const insertProjectNoteSchema = createInsertSchema(projectNotes).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type ProjectNote = typeof projectNotes.$inferSelect;

// Google Tokens table - хранит OAuth токены фирмы
export const googleTokens = pgTable("google_tokens", {
  id: serial("id").primaryKey(),
  firmId: uuid("firm_id").notNull().references(() => firms.id).unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiry: timestamp("expiry").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google Calendar Settings table - настройки API для каждой фирмы
export const googleCalendarSettings = pgTable("google_calendar_settings", {
  id: serial("id").primaryKey(),
  firmId: uuid("firm_id").notNull().references(() => firms.id).unique(),
  clientId: varchar("client_id").notNull(),
  clientSecret: varchar("client_secret").notNull(),
  redirectUri: varchar("redirect_uri").notNull(),
  masterCalendarId: varchar("master_calendar_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Calendar Logs table - аудит всех операций с Google API
export const calendarLogs = pgTable("calendar_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(), // create_event, update_event, delete_event, etc.
  projectId: integer("project_id").references(() => projects.id),
  eventId: varchar("event_id"), // Google Calendar event ID
  status: varchar("status", { enum: ["success", "error"] }).notNull(),
  details: jsonb("details"), // Подробности операции
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGoogleTokenSchema = createInsertSchema(googleTokens).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertGoogleToken = z.infer<typeof insertGoogleTokenSchema>;
export type GoogleToken = typeof googleTokens.$inferSelect;

export const insertGoogleCalendarSettingsSchema = createInsertSchema(googleCalendarSettings).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});
export type InsertGoogleCalendarSettings = z.infer<typeof insertGoogleCalendarSettingsSchema>;
export type GoogleCalendarSettings = typeof googleCalendarSettings.$inferSelect;

export const insertCalendarLogSchema = createInsertSchema(calendarLogs).omit({ 
  id: true, 
  timestamp: true,
  createdAt: true 
});
export type InsertCalendarLog = z.infer<typeof insertCalendarLogSchema>;
export type CalendarLog = typeof calendarLogs.$inferSelect;
