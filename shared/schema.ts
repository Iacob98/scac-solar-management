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
  archived: boolean("archived").default(false),
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
  status: varchar("status", { enum: ["planning", "in_progress", "done", "invoiced", "paid"] })
    .notNull()
    .default("planning"),
  teamNumber: varchar("team_number"),
  notes: text("notes"),
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: varchar("invoice_url"),
  // Информация о человеке, у которого делается установка
  installationPersonFirstName: varchar("installation_person_first_name"),
  installationPersonLastName: varchar("installation_person_last_name"),
  installationPersonAddress: text("installation_person_address"),
  installationPersonUniqueId: varchar("installation_person_unique_id"),
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

// Project Files table
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  fileUrl: varchar("file_url").notNull(),
  fileType: varchar("file_type", { enum: ["report_photo", "acceptance", "review"] }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Invoice Queue table
export const invoiceQueue = pgTable("invoice_queue", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({ id: true, uploadedAt: true });
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;
