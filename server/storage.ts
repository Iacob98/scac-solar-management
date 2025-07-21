import {
  users,
  firms,
  clients,
  crews,
  crewMembers,
  projects,
  services,
  invoices,
  projectFiles,
  projectReports,
  projectHistory,
  projectShares,
  userFirms,
  fileStorage,
  projectNotes,
  type User,
  type UpsertUser,
  type Firm,
  type InsertFirm,
  type Client,
  type InsertClient,
  type Crew,
  type InsertCrew,
  type CrewMember,
  type InsertCrewMember,
  type Project,
  type InsertProject,
  type Service,
  type InsertService,
  type Invoice,
  type InsertInvoice,
  type ProjectFile,
  type InsertProjectFile,
  type ProjectReport,
  type InsertProjectReport,
  type ProjectHistory,
  type InsertProjectHistory,
  type ProjectShare,
  type InsertProjectShare,
  type FileStorage,
  type InsertFileStorage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(userId: string, profileData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  }>): Promise<User>;
  
  // Firm operations
  getFirms(): Promise<Firm[]>;
  getFirmById(id: string): Promise<Firm | undefined>;
  getFirmsByUserId(userId: string): Promise<Firm[]>;
  createFirm(firm: InsertFirm): Promise<Firm>;
  assignUserToFirm(userId: string, firmId: string): Promise<void>;
  removeUserFromFirm(userId: string, firmId: string): Promise<void>;
  getUsersByFirmId(firmId: string): Promise<User[]>;
  hasUserFirmAccess(userId: string, firmId: string): Promise<boolean>;
  
  // Client operations
  getClientsByFirmId(firmId: string): Promise<Client[]>;
  getClientById(id: number): Promise<Client | undefined>;
  getClientByNinjaId(firmId: string, ninjaClientId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client>;
  
  // Crew operations
  getCrewsByFirmId(firmId: string): Promise<Crew[]>;
  getCrewById(id: number): Promise<Crew | undefined>;
  createCrew(crew: InsertCrew): Promise<Crew>;
  updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew>;
  archiveCrew(id: number): Promise<void>;
  
  // Crew Member operations
  getCrewMembersByCrewId(crewId: number): Promise<CrewMember[]>;
  createCrewMember(member: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: number, member: Partial<InsertCrewMember>): Promise<CrewMember>;
  deleteCrewMember(id: number): Promise<void>;
  
  // Project operations
  getProjectsByFirmId(firmId: string): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project>;
  
  // Service operations
  getServicesByProjectId(projectId: number): Promise<Service[]>;
  getServicesByProject(projectId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  
  // Invoice operations
  getInvoicesByFirmId(firmId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  
  // Additional methods
  getFirmById(firmId: string): Promise<Firm | undefined>;
  getProjectStats(firmId: string): Promise<any>;
  
  // File operations
  getFilesByProjectId(projectId: number): Promise<ProjectFile[]>;
  createFile(file: InsertProjectFile): Promise<ProjectFile>;
  getFileById(id: number): Promise<ProjectFile | undefined>;
  deleteFile(id: number): Promise<void>;
  
  // Report operations
  getReportsByProjectId(projectId: number): Promise<ProjectReport[]>;
  createReport(report: InsertProjectReport): Promise<ProjectReport>;
  getReportById(id: number): Promise<ProjectReport | undefined>;
  updateReport(id: number, report: Partial<InsertProjectReport>): Promise<ProjectReport>;
  deleteReport(id: number): Promise<void>;
  
  // Stats operations
  getProjectStats(firmId: string): Promise<{
    activeProjects: number;
    pendingInvoices: string;
    monthlyRevenue: string;
    activeCrews: number;
  }>;

  // Project History operations
  createProjectHistoryEntry(entry: InsertProjectHistory): Promise<ProjectHistory>;
  getProjectHistory(projectId: number): Promise<ProjectHistory[]>;
  shareProject(projectId: number, sharedBy: string, sharedWith: string, permission?: 'view' | 'edit'): Promise<ProjectShare>;
  getProjectShares(projectId: number): Promise<ProjectShare[]>;
  getUserSharedProjects(userId: string): Promise<number[]>;
  removeProjectShare(projectId: number, sharedWith: string): Promise<void>;
  getFirmUsers(firmId: string): Promise<User[]>;
  
  // New File Storage operations
  createFileRecord(file: InsertFileStorage): Promise<FileStorage>;
  getFileRecord(fileId: string): Promise<FileStorage | undefined>;
  getProjectFiles(projectId: number): Promise<FileStorage[]>;
  deleteFileRecord(fileId: string): Promise<void>;
  hasProjectAccess(userId: string, projectId: number): Promise<boolean>;
  getFileStorageStats(): Promise<{ totalFiles: number; totalSize: number }>;
  addProjectHistory(entry: InsertProjectHistory): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, profileData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  }>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({
        ...profileData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updated) {
      throw new Error("User not found");
    }
    
    return updated;
  }

  // Firm operations
  async getFirms(): Promise<Firm[]> {
    return await db.select().from(firms).orderBy(desc(firms.createdAt));
  }

  async getFirmById(id: string): Promise<Firm | undefined> {
    const [firm] = await db.select().from(firms).where(eq(firms.id, id));
    return firm;
  }

  async getFirmsByUserId(userId: string): Promise<Firm[]> {
    return await db
      .select({
        id: firms.id,
        name: firms.name,
        invoiceNinjaUrl: firms.invoiceNinjaUrl,
        token: firms.token,
        address: firms.address,
        taxId: firms.taxId,
        logoUrl: firms.logoUrl,
        createdAt: firms.createdAt,
      })
      .from(firms)
      .innerJoin(userFirms, eq(firms.id, userFirms.firmId))
      .where(eq(userFirms.userId, userId));
  }

  async createFirm(firm: InsertFirm): Promise<Firm> {
    const [newFirm] = await db.insert(firms).values(firm).returning();
    return newFirm;
  }

  async assignUserToFirm(userId: string, firmId: string): Promise<void> {
    await db.insert(userFirms).values({ userId, firmId }).onConflictDoNothing();
  }

  async removeUserFromFirm(userId: string, firmId: string): Promise<void> {
    await db.delete(userFirms).where(and(
      eq(userFirms.userId, userId),
      eq(userFirms.firmId, firmId)
    ));
  }

  async getUsersByFirmId(firmId: string): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userFirms, eq(users.id, userFirms.userId))
      .where(eq(userFirms.firmId, firmId));
  }

  async hasUserFirmAccess(userId: string, firmId: string): Promise<boolean> {
    const [access] = await db
      .select({ userId: userFirms.userId })
      .from(userFirms)
      .where(and(eq(userFirms.userId, userId), eq(userFirms.firmId, firmId)))
      .limit(1);
    return !!access;
  }

  // Client operations
  async getClientsByFirmId(firmId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.firmId, firmId))
      .orderBy(desc(clients.createdAt));
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async getClientById(id: number): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    return client;
  }

  async getClientByNinjaId(firmId: string, ninjaClientId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.firmId, firmId), eq(clients.ninjaClientId, ninjaClientId)));
    return client;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client> {
    const [updated] = await db
      .update(clients)
      .set(client)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  // Crew operations
  async getCrewsByFirmId(firmId: string): Promise<Crew[]> {
    return await db
      .select()
      .from(crews)
      .where(eq(crews.firmId, firmId))
      .orderBy(desc(crews.createdAt));
  }

  async createCrew(crew: InsertCrew): Promise<Crew> {
    const [newCrew] = await db.insert(crews).values(crew).returning();
    return newCrew;
  }

  async getCrewById(id: number): Promise<Crew | undefined> {
    const [crew] = await db
      .select()
      .from(crews)
      .where(eq(crews.id, id));
    return crew;
  }

  async updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew> {
    const [updated] = await db
      .update(crews)
      .set(crew)
      .where(eq(crews.id, id))
      .returning();
    return updated;
  }

  async archiveCrew(id: number): Promise<void> {
    await db.update(crews).set({ archived: true }).where(eq(crews.id, id));
  }

  async deleteCrew(id: number): Promise<void> {
    await db.delete(crews).where(eq(crews.id, id));
  }

  // Crew Member operations
  async getCrewMembersByCrewId(crewId: number): Promise<CrewMember[]> {
    return await db
      .select()
      .from(crewMembers)
      .where(eq(crewMembers.crewId, crewId))
      .orderBy(desc(crewMembers.createdAt));
  }

  async createCrewMember(member: InsertCrewMember): Promise<CrewMember> {
    const [newMember] = await db.insert(crewMembers).values(member).returning();
    return newMember;
  }

  async updateCrewMember(id: number, member: Partial<InsertCrewMember>): Promise<CrewMember> {
    const [updatedMember] = await db
      .update(crewMembers)
      .set(member)
      .where(eq(crewMembers.id, id))
      .returning();
    
    if (!updatedMember) {
      throw new Error("Crew member not found");
    }
    
    return updatedMember;
  }

  async deleteCrewMember(id: number): Promise<void> {
    await db.delete(crewMembers).where(eq(crewMembers.id, id));
  }

  // Project operations
  async getProjectsByFirmId(firmId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.firmId, firmId))
      .orderBy(desc(projects.createdAt));
  }

  async getProjectById(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  // Service operations
  async getServicesByProjectId(projectId: number): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.projectId, projectId))
      .orderBy(desc(services.createdAt));
  }

  async getServicesByProject(projectId: number): Promise<Service[]> {
    return this.getServicesByProjectId(projectId);
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db
      .update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    return updated;
  }

  async getServiceById(id: number): Promise<Service | undefined> {
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, id));
    return service;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Invoice operations
  async getInvoicesByFirmId(firmId: string): Promise<Invoice[]> {
    return await db
      .select({
        id: invoices.id,
        projectId: invoices.projectId,
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        isPaid: invoices.isPaid,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(eq(projects.firmId, firmId))
      .orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice> {
    const [updated] = await db
      .update(invoices)
      .set(invoice)
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }



  // File operations
  async getFilesByProjectId(projectId: number): Promise<ProjectFile[]> {
    return await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId))
      .orderBy(desc(projectFiles.uploadedAt));
  }

  async createFile(file: InsertProjectFile): Promise<ProjectFile> {
    const [newFile] = await db.insert(projectFiles).values(file).returning();
    return newFile;
  }

  async getFileById(id: number): Promise<ProjectFile | undefined> {
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.id, id));
    return file || undefined;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(projectFiles).where(eq(projectFiles.id, id));
  }

  // Report operations
  async getReportsByProjectId(projectId: number): Promise<ProjectReport[]> {
    return await db
      .select()
      .from(projectReports)
      .where(eq(projectReports.projectId, projectId))
      .orderBy(desc(projectReports.createdAt));
  }

  async createReport(report: InsertProjectReport): Promise<ProjectReport> {
    const [newReport] = await db.insert(projectReports).values(report).returning();
    return newReport;
  }

  async getReportById(id: number): Promise<ProjectReport | undefined> {
    const [report] = await db
      .select()
      .from(projectReports)
      .where(eq(projectReports.id, id));
    return report || undefined;
  }

  async updateReport(id: number, report: Partial<InsertProjectReport>): Promise<ProjectReport> {
    const [updated] = await db
      .update(projectReports)
      .set(report)
      .where(eq(projectReports.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Report not found");
    }
    
    return updated;
  }

  async deleteReport(id: number): Promise<void> {
    await db.delete(projectReports).where(eq(projectReports.id, id));
  }

  // Stats operations
  async getProjectStats(firmId: string): Promise<{
    activeProjects: number;
    pendingInvoices: string;
    monthlyRevenue: string;
    activeCrews: number;
  }> {
    const [activeProjectsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(
        and(
          eq(projects.firmId, firmId),
          eq(projects.status, "work_in_progress" as any)
        )
      );

    const [pendingInvoicesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)` })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(projects.firmId, firmId),
          eq(invoices.isPaid, false)
        )
      );

    const [monthlyRevenueResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)` })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(projects.firmId, firmId),
          eq(invoices.isPaid, true),
          sql`${invoices.createdAt} >= date_trunc('month', current_date)`
        )
      );

    const [activeCrewsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crews)
      .where(
        and(
          eq(crews.firmId, firmId),
          eq(crews.archived, false)
        )
      );

    return {
      activeProjects: activeProjectsResult.count,
      pendingInvoices: pendingInvoicesResult.total,
      monthlyRevenue: monthlyRevenueResult.total,
      activeCrews: activeCrewsResult.count,
    };
  }

  // Project History operations
  async createProjectHistoryEntry(entry: InsertProjectHistory): Promise<ProjectHistory> {
    const [historyEntry] = await db
      .insert(projectHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }

  async getProjectHistory(projectId: number): Promise<ProjectHistory[]> {
    return await db
      .select({
        id: projectHistory.id,
        projectId: projectHistory.projectId,
        userId: projectHistory.userId,
        changeType: projectHistory.changeType,
        fieldName: projectHistory.fieldName,
        oldValue: projectHistory.oldValue,
        newValue: projectHistory.newValue,
        description: projectHistory.description,
        createdAt: projectHistory.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        // Добавляем приоритет примечания для записей типа note_added
        notePriority: projectNotes.priority,
      })
      .from(projectHistory)
      .leftJoin(users, eq(projectHistory.userId, users.id))
      .leftJoin(
        projectNotes, 
        and(
          eq(projectHistory.changeType, 'note_added'),
          eq(projectNotes.projectId, projectHistory.projectId),
          eq(projectNotes.userId, projectHistory.userId),
          // Ищем примечание, созданное в то же время (плюс-минус несколько секунд)
          gte(projectNotes.createdAt, sql`${projectHistory.createdAt} - interval '5 seconds'`),
          lte(projectNotes.createdAt, sql`${projectHistory.createdAt} + interval '5 seconds'`)
        )
      )
      .where(eq(projectHistory.projectId, projectId))
      .orderBy(desc(projectHistory.createdAt));
  }

  // Project Sharing operations
  async shareProject(projectId: number, sharedBy: string, sharedWith: string, permission: 'view' | 'edit' = 'view'): Promise<ProjectShare> {
    const [share] = await db
      .insert(projectShares)
      .values({
        projectId,
        sharedBy,
        sharedWith,
        permission,
      })
      .returning();
    return share;
  }

  async getProjectShares(projectId: number): Promise<ProjectShare[]> {
    return await db
      .select()
      .from(projectShares)
      .where(eq(projectShares.projectId, projectId));
  }

  async getUserSharedProjects(userId: string): Promise<number[]> {
    const shares = await db
      .select({ projectId: projectShares.projectId })
      .from(projectShares)
      .where(eq(projectShares.sharedWith, userId));
    return shares.map(share => share.projectId);
  }

  async removeProjectShare(projectId: number, sharedWith: string): Promise<void> {
    await db
      .delete(projectShares)
      .where(
        and(
          eq(projectShares.projectId, projectId),
          eq(projectShares.sharedWith, sharedWith)
        )
      );
  }

  async getFirmUsers(firmId: string): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userFirms, eq(users.id, userFirms.userId))
      .where(eq(userFirms.firmId, firmId));
  }

  async createProjectHistoryEntry(entry: InsertProjectHistory): Promise<ProjectHistory> {
    const [historyEntry] = await db
      .insert(projectHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }

  // New File Storage methods
  async createFileRecord(file: InsertFileStorage): Promise<FileStorage> {
    const [fileRecord] = await db
      .insert(fileStorage)
      .values(file)
      .returning();
    return fileRecord;
  }

  async getFileRecord(fileId: string): Promise<FileStorage | undefined> {
    const [file] = await db
      .select()
      .from(fileStorage)
      .where(eq(fileStorage.fileId, fileId));
    return file;
  }

  async getProjectFiles(projectId: number): Promise<FileStorage[]> {
    return await db
      .select()
      .from(fileStorage)
      .where(
        and(
          eq(fileStorage.projectId, projectId),
          eq(fileStorage.isDeleted, false)
        )
      )
      .orderBy(desc(fileStorage.uploadedAt));
  }

  async deleteFileRecord(fileId: string): Promise<void> {
    await db
      .update(fileStorage)
      .set({
        isDeleted: true,
        deletedAt: new Date()
      })
      .where(eq(fileStorage.fileId, fileId));
  }

  async hasProjectAccess(userId: string, projectId: number): Promise<boolean> {
    // Админы имеют доступ ко всем проектам
    const user = await this.getUser(userId);
    if (user?.role === 'admin') {
      return true;
    }

    // Проверяем, является ли пользователь лейтером проекта
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    
    if (project?.leiterId === userId) {
      return true;
    }

    // Проверяем, есть ли общий доступ к проекту
    const [sharedProject] = await db
      .select()
      .from(projectShares)
      .where(
        and(
          eq(projectShares.projectId, projectId),
          eq(projectShares.sharedWith, userId)
        )
      );

    return !!sharedProject;
  }

  async getFileStorageStats(): Promise<{ totalFiles: number; totalSize: number }> {
    const stats = await db
      .select({
        totalFiles: sql<number>`count(*)::int`,
        totalSize: sql<number>`sum(${fileStorage.size})::int`
      })
      .from(fileStorage)
      .where(eq(fileStorage.isDeleted, false));

    return stats[0] || { totalFiles: 0, totalSize: 0 };
  }

  async addProjectHistory(entry: InsertProjectHistory): Promise<void> {
    await db
      .insert(projectHistory)
      .values(entry);
  }
}

export const storage = new DatabaseStorage();
