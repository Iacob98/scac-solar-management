/**
 * CraftOS Digital Desks Sync Service
 *
 * Authenticates via OAuth2 PKCE to Azure B2C, fetches appointments
 * from CraftOS API, syncs them to local DB, and tracks changes.
 */

import crypto from "crypto";
import { db } from "../db";
import { storage } from "../storage";
import {
  craftosAppointments,
  craftosSyncConfig,
  crews,
  clients,
  projects,
  notifications,
  profiles,
  type CraftosSyncConfig,
  type CraftosAppointment,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
export {
  getAppointmentStatus,
  getISOWeek,
  parseCustomerName,
  normalizeCrewName,
  kwRangeToOffsets,
} from "./craftosUtils";
import {
  getAppointmentStatus,
  getISOWeek,
  normalizeCrewName,
  parseCustomerName,
  type CraftosAppointmentRaw,
} from "./craftosUtils";

// --- CraftOS OAuth2 constants ---
const TENANT = "enpalcraftos.onmicrosoft.com";
const POLICY = "b2c_1a_signup_signin_craft";
const CLIENT_ID = "fe852089-fe08-46bd-b3b7-7d5c9cd70a0a";
const REDIRECT_URI = "https://desks.craftos.enpal.io";
const SCOPES = `openid profile offline_access https://${TENANT}/api/digital-desks/DD.Write https://${TENANT}/api/digital-desks/DD.Read`;
const BASE_B2C = `https://enpalcraftos.b2clogin.com/${TENANT}/${POLICY}`;
const AUTHORIZE_URL = `${BASE_B2C}/oauth2/v2.0/authorize`;
const TOKEN_URL = `${BASE_B2C}/oauth2/v2.0/token`;
const API_BASE = "https://api.core.enpal.io/crft/digitaldesks/api/v1";

// --- Helpers ---

function generatePKCE() {
  const verifier = crypto.randomBytes(64).toString("base64url").slice(0, 128);
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

interface CraftosTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}

// CraftosAppointmentRaw is imported from ./craftosUtils

interface WorkOrderCustomer {
  firstName?: string;
  lastName?: string;
  address?: {
    address1?: string;
    telephone?: string;
    phone?: string;
  };
}

// getAppointmentStatus imported from ./craftosUtils

// --- Main Service ---

export class CraftosSyncService {
  private syncTimers: Map<number, NodeJS.Timeout> = new Map();

  /**
   * Full OAuth2 PKCE authentication flow against Azure B2C.
   */
  async authenticate(email: string, password: string): Promise<CraftosTokens> {
    const { verifier, challenge } = generatePKCE();
    const nonce = crypto.randomBytes(16).toString("hex");

    // Step 1: Load authorize page
    const authParams = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      response_mode: "fragment",
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      nonce,
      state: "sync_state",
    });

    const authResp = await fetch(`${AUTHORIZE_URL}?${authParams}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    const authHtml = await authResp.text();

    // Step 2: Parse CSRF and transId
    const csrfMatch = authHtml.match(/"csrf"\s*:\s*"([^"]+)"/);
    const transMatch = authHtml.match(/"transId"\s*:\s*"([^"]+)"/);

    if (!csrfMatch || !transMatch) {
      console.error("[CraftOS] Auth page response length:", authHtml.length, "status:", authResp.status);
      throw new Error("CraftOS auth: could not parse CSRF/transId from B2C page");
    }

    const csrf = csrfMatch[1];
    const transId = transMatch[1];

    // Step 3: Submit credentials via SelfAsserted
    const selfAssertedUrl = `${BASE_B2C}/SelfAsserted?tx=${encodeURIComponent(transId)}&p=${POLICY}`;

    // Extract cookies properly — getSetCookie() returns individual Set-Cookie headers
    const rawCookies = authResp.headers.getSetCookie?.() || [];
    const cookies = rawCookies.length > 0
      ? rawCookies.map(c => c.split(";")[0]).join("; ")
      : (authResp.headers.get("set-cookie") || "").split(/,(?=\s*\w+=)/).map(c => c.split(";")[0].trim()).join("; ");

    console.log(`[CraftOS] Step 3: SelfAsserted with ${rawCookies.length} cookies, csrf=${csrf.slice(0, 10)}...`);

    const loginResp = await fetch(selfAssertedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-TOKEN": csrf,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookies,
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      body: new URLSearchParams({
        signInName: email,
        password: password,
        request_type: "RESPONSE",
      }),
      redirect: "manual",
    });

    // B2C returns 200 on success, but may also return 200 with error JSON
    if (loginResp.status !== 200) {
      const text = await loginResp.text();
      console.error(`[CraftOS] SelfAsserted failed: status=${loginResp.status}, body=${text.slice(0, 300)}`);
      throw new Error(`CraftOS auth: login failed (${loginResp.status}): ${text.slice(0, 200)}`);
    }

    // Check for error in response body (B2C returns 200 with error message for wrong credentials)
    const loginBody = await loginResp.text();
    if (loginBody && loginBody.includes('"status"') && loginBody.includes('"400"')) {
      console.error(`[CraftOS] SelfAsserted returned error in body: ${loginBody.slice(0, 300)}`);
      throw new Error("CraftOS auth: неверный email или пароль");
    }

    // Also merge any new cookies from login response
    const loginCookies = loginResp.headers.getSetCookie?.() || [];
    const allCookieMap = new Map<string, string>();
    // Parse existing cookies
    cookies.split("; ").forEach(c => {
      const [name] = c.split("=", 1);
      if (name) allCookieMap.set(name, c);
    });
    // Override with new cookies from login
    loginCookies.forEach(c => {
      const cookieValue = c.split(";")[0];
      const [name] = cookieValue.split("=", 1);
      if (name) allCookieMap.set(name, cookieValue);
    });
    const mergedCookies = Array.from(allCookieMap.values()).join("; ");

    // Step 4: Follow confirmed redirect to get auth code
    const confirmedUrl = `${BASE_B2C}/api/CombinedSigninAndSignup/confirmed?` +
      new URLSearchParams({
        rememberMe: "false",
        csrf_token: csrf,
        tx: transId,
        p: POLICY,
      });

    console.log(`[CraftOS] Step 4: confirmed redirect with ${allCookieMap.size} cookies`);

    const confirmedResp = await fetch(confirmedUrl, {
      headers: {
        Cookie: mergedCookies,
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      redirect: "manual",
    });

    const location = confirmedResp.headers.get("location") || "";
    let authCode: string | null = null;

    if (location.includes("#")) {
      const fragment = location.split("#")[1];
      const params = new URLSearchParams(fragment);
      authCode = params.get("code");
    } else if (location.includes("?")) {
      const url = new URL(location);
      authCode = url.searchParams.get("code");
    }

    if (!authCode) {
      throw new Error(`CraftOS auth: could not extract auth code from redirect: ${location.slice(0, 200)}`);
    }

    // Step 5: Exchange code for tokens
    const tokenResp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code: authCode,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        scope: SCOPES,
      }),
    });

    const tokens: CraftosTokens = await tokenResp.json() as CraftosTokens;

    if (!tokens.access_token) {
      throw new Error(`CraftOS auth: token exchange failed: ${JSON.stringify(tokens).slice(0, 300)}`);
    }

    return tokens;
  }

  /**
   * Get a valid access token for a firm's config, re-authenticating if needed.
   */
  async getValidToken(config: CraftosSyncConfig): Promise<string> {
    // Check if existing token is still valid (with 5 min buffer)
    if (config.accessToken && config.tokenExpiresAt) {
      const expiresAt = new Date(config.tokenExpiresAt);
      if (expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return config.accessToken;
      }
    }

    // Re-authenticate
    console.log(`[CraftOS] Authenticating for firm ${config.firmId}...`);
    const tokens = await this.authenticate(config.email, config.password);

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Save tokens
    await db
      .update(craftosSyncConfig)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || config.refreshToken,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(craftosSyncConfig.id, config.id));

    return tokens.access_token;
  }

  /**
   * Fetch all teams from CraftOS API.
   */
  async fetchTeams(token: string): Promise<Array<{ id: string; name: string }>> {
    const resp = await fetch(`${API_BASE}/Teams`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) throw new Error(`CraftOS fetchTeams: ${resp.status}`);
    return await resp.json() as Array<{ id: string; name: string }>;
  }

  /**
   * Fetch work order types from CraftOS API.
   */
  async fetchWorkOrderTypes(token: string): Promise<Array<{ id: string; name: string }>> {
    const resp = await fetch(`${API_BASE}/configuration/workorder-types`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) throw new Error(`CraftOS fetchWorkOrderTypes: ${resp.status}`);
    return await resp.json() as Array<{ id: string; name: string }>;
  }

  /**
   * Fetch appointments for a given week.
   */
  async fetchAppointmentsForWeek(
    token: string,
    week: number,
    teamIds: string[],
    woTypeIds: string[]
  ): Promise<CraftosAppointmentRaw[]> {
    const resp = await fetch(`${API_BASE}/appointment-progress`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        week,
        teams: teamIds,
        workOrderTypes: woTypeIds,
      }),
    });

    if (!resp.ok) {
      console.warn(`[CraftOS] appointment-progress week ${week}: ${resp.status}`);
      return [];
    }

    return await resp.json() as CraftosAppointmentRaw[];
  }

  /**
   * Fetch work order details to get full customer info (phone, proper name).
   */
  async fetchWorkOrderDetails(
    token: string,
    caseId: string,
    woTypeId: string
  ): Promise<WorkOrderCustomer | null> {
    try {
      const resp = await fetch(`${API_BASE}/WorkOrder/${caseId}/${woTypeId}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!resp.ok) return null;

      const data = await resp.json() as { customer?: WorkOrderCustomer };
      return data.customer || null;
    } catch {
      return null;
    }
  }

  // parseCustomerName imported from ./craftosUtils

  /**
   * Main sync: fetches all relevant weeks, compares with DB, creates/updates.
   */
  async syncForFirm(firmId: number, options?: { weekFrom?: number; weekTo?: number }): Promise<{
    newCount: number;
    updatedCount: number;
    dateChanges: number;
    statusChanges: number;
    errors: string[];
    weeksFetched: number[];
  }> {
    const result = { newCount: 0, updatedCount: 0, dateChanges: 0, statusChanges: 0, errors: [] as string[], weeksFetched: [] as number[] };

    // Get sync config
    const [config] = await db
      .select()
      .from(craftosSyncConfig)
      .where(eq(craftosSyncConfig.firmId, firmId));

    if (!config || !config.enabled) {
      result.errors.push("Sync not configured or disabled");
      return result;
    }

    let token: string;
    try {
      token = await this.getValidToken(config);
    } catch (err: any) {
      const errMsg = `Auth failed: ${err.message}`;
      result.errors.push(errMsg);
      await this.updateSyncStatus(config.id, "error", errMsg);
      return result;
    }

    // Fetch teams and work order types
    let teams: Array<{ id: string; name: string }>;
    let woTypes: Array<{ id: string; name: string }>;
    try {
      [teams, woTypes] = await Promise.all([
        this.fetchTeams(token),
        this.fetchWorkOrderTypes(token),
      ]);
    } catch (err: any) {
      const errMsg = `Failed to fetch teams/woTypes: ${err.message}`;
      result.errors.push(errMsg);
      await this.updateSyncStatus(config.id, "error", errMsg);
      return result;
    }

    const teamIds = teams.map((t) => t.id);
    const woTypeIds = woTypes.map((t) => t.id);

    // Convert absolute KW numbers to relative offsets for CraftOS API
    // CraftOS API: week=0 is current, week=-1 is last week, week=+1 is next week
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const absFrom = options?.weekFrom ?? Math.max(1, currentWeek - 4);
    const absTo = options?.weekTo ?? Math.min(53, currentWeek + 8);
    const weeksToFetch: number[] = [];
    for (let kw = absFrom; kw <= absTo; kw++) {
      weeksToFetch.push(kw - currentWeek); // convert to offset
    }
    result.weeksFetched = Array.from({ length: absTo - absFrom + 1 }, (_, i) => absFrom + i);

    // Collect all appointments
    const allAppointments = new Map<string, CraftosAppointmentRaw>();

    for (const week of weeksToFetch) {
      try {
        const apts = await this.fetchAppointmentsForWeek(token, week, teamIds, woTypeIds);
        for (const apt of apts) {
          if (apt.externalCaseId && !allAppointments.has(apt.externalCaseId)) {
            allAppointments.set(apt.externalCaseId, apt);
          }
        }
      } catch (err: any) {
        result.errors.push(`Week ${week}: ${err.message}`);
      }
    }

    console.log(`[CraftOS] Firm ${firmId}: fetched ${allAppointments.size} unique appointments`);

    // Get existing appointments from DB
    const existingApts = await db
      .select()
      .from(craftosAppointments)
      .where(eq(craftosAppointments.firmId, firmId));

    const existingMap = new Map<string, CraftosAppointment>();
    for (const apt of existingApts) {
      existingMap.set(apt.externalCaseId, apt);
    }

    // Get all crews for this firm (for team name matching, normalized)
    const firmCrews = await db.select().from(crews).where(eq(crews.firmId, firmId));
    const crewByName = new Map<string, number>();
    for (const crew of firmCrews) {
      crewByName.set(normalizeCrewName(crew.name), crew.id);
    }

    // Get all admins for notifications
    const admins = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, "admin"));

    // Process each appointment
    for (const [caseId, rawApt] of Array.from(allAppointments.entries())) {
      try {
        const existing = existingMap.get(caseId);
        const { firstName, lastName } = parseCustomerName(rawApt.customer || "");

        // Use data from appointment directly (work order details API not available)
        const phone = "";
        const detailFirstName = firstName;
        const detailLastName = lastName;
        const detailAddress = rawApt.customerAddress?.address || "";

        if (existing) {
          // Check for changes
          const changes: string[] = [];
          const updates: Record<string, unknown> = { lastSyncedAt: new Date(), rawData: rawApt };

          // Date change detection
          const newDate = rawApt.appointmentDate ? new Date(rawApt.appointmentDate) : null;
          const oldDate = existing.appointmentDate ? new Date(existing.appointmentDate) : null;

          if (newDate && oldDate && newDate.getTime() !== oldDate.getTime()) {
            changes.push(`Дата: ${oldDate.toLocaleDateString("de-DE")} → ${newDate.toLocaleDateString("de-DE")}`);
            updates.previousAppointmentDate = oldDate;
            updates.appointmentDate = newDate;
            updates.appointmentEndDate = rawApt.appointmentEndDate ? new Date(rawApt.appointmentEndDate) : null;
            updates.dateChangedAt = new Date();
            result.dateChanges++;

            // Update linked project if exists
            if (existing.projectId) {
              await db.update(projects).set({
                workStartDate: rawApt.appointmentDate.slice(0, 10),
                workEndDate: rawApt.appointmentEndDate?.slice(0, 10) || null,
                needsCallForDateChange: true,
                updatedAt: new Date(),
              }).where(eq(projects.id, existing.projectId));
            }
          }

          // Status change detection
          const realStatus = getAppointmentStatus(rawApt);
          if (realStatus && realStatus !== existing.status) {
            changes.push(`Статус: ${existing.status} → ${realStatus}`);
            updates.previousStatus = existing.status;
            updates.status = realStatus;
            updates.statusChangedAt = new Date();
            result.statusChanges++;
          }

          // Team change detection
          if (rawApt.team?.name && rawApt.team.name !== existing.teamName) {
            changes.push(`Бригада: ${existing.teamName} → ${rawApt.team.name}`);
            updates.teamName = rawApt.team.name;
            updates.teamId = rawApt.team.id;
          }

          if (changes.length > 0) {
            await db
              .update(craftosAppointments)
              .set(updates)
              .where(eq(craftosAppointments.id, existing.id));

            result.updatedCount++;

            // Send notifications to admins
            for (const admin of admins) {
              const isDateChange = changes.some((c) => c.startsWith("Дата:"));
              await storage.createNotification({
                userId: admin.id,
                projectId: existing.projectId || undefined,
                type: isDateChange ? "craftos_date_change" : "craftos_status_change",
                title: isDateChange
                  ? `CraftOS: изменена дата (${caseId})`
                  : `CraftOS: изменён статус (${caseId})`,
                message: `${detailLastName} ${detailFirstName}: ${changes.join(", ")}`,
                link: existing.projectId ? `/projects/${existing.projectId}` : undefined,
              });
            }
          } else {
            // No changes, just update sync timestamp
            await db
              .update(craftosAppointments)
              .set({ lastSyncedAt: new Date() })
              .where(eq(craftosAppointments.id, existing.id));
          }
        } else {
          // New appointment — insert
          const [newApt] = await db
            .insert(craftosAppointments)
            .values({
              firmId,
              externalId: rawApt.externalId,
              externalCaseId: caseId,
              appointmentDate: rawApt.appointmentDate ? new Date(rawApt.appointmentDate) : null,
              appointmentEndDate: rawApt.appointmentEndDate ? new Date(rawApt.appointmentEndDate) : null,
              workOrderType: rawApt.workOrderType?.name || null,
              appointmentType: rawApt.appointmentType || null,
              status: getAppointmentStatus(rawApt) || null,
              customerName: rawApt.customer || null,
              firstName: detailFirstName,
              lastName: detailLastName,
              address: detailAddress,
              zipCode: rawApt.customerAddress?.zipCode || null,
              city: rawApt.customerAddress?.city || null,
              phone: phone || null,
              teamName: rawApt.team?.name || null,
              teamId: rawApt.team?.id || null,
              coordinates: rawApt.customerAddress?.latLong || null,
              rawData: rawApt,
            })
            .returning();

          result.newCount++;

          // Notify admins about new appointment
          for (const admin of admins) {
            await storage.createNotification({
              userId: admin.id,
              type: "craftos_new_appointment",
              title: `CraftOS: новое назначение (${caseId})`,
              message: `${detailLastName} ${detailFirstName}, ${rawApt.customerAddress?.city || ""} — ${rawApt.appointmentDate?.slice(0, 10) || "без даты"}, бригада: ${rawApt.team?.name || "не назначена"}`,
              link: undefined,
            });
          }
        }
      } catch (err: any) {
        result.errors.push(`${caseId}: ${err.message}`);
      }
    }

    // Update sync status
    await this.updateSyncStatus(
      config.id,
      result.errors.length > 0 ? "partial" : "success",
      result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null
    );

    console.log(
      `[CraftOS] Firm ${firmId} sync done: ${result.newCount} new, ${result.updatedCount} updated, ` +
      `${result.dateChanges} date changes, ${result.statusChanges} status changes, ${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Create a project from a CraftOS appointment.
   */
  async createProjectFromAppointment(
    appointmentId: number,
    leiterId: string,
    firmId: number
  ): Promise<{ projectId: number } | { error: string }> {
    const [apt] = await db
      .select()
      .from(craftosAppointments)
      .where(eq(craftosAppointments.id, appointmentId));

    if (!apt) return { error: "Appointment not found" };
    if (apt.projectId) return { error: "Project already created for this appointment" };

    // Find or create client
    let clientId: number;
    const clientName = `${apt.lastName || ""} ${apt.firstName || ""}`.trim() || apt.customerName || "Unknown";

    const existingClients = await storage.getClientsByFirmId(String(firmId));
    const matchingClient = existingClients.find(
      (c) => c.name.toLowerCase() === clientName.toLowerCase()
    );

    if (matchingClient) {
      clientId = matchingClient.id;
    } else {
      const newClient = await storage.createClient({
        firmId,
        name: clientName,
        address: [apt.address, apt.zipCode, apt.city].filter(Boolean).join(", "),
        phone: apt.phone || undefined,
      });
      clientId = newClient.id;
    }

    // Match crew by name (normalize: remove spaces, lowercase)
    let crewId: number | undefined;
    if (apt.teamName) {
      const firmCrews = await db.select().from(crews).where(eq(crews.firmId, firmId));
      const normalizedTeam = normalizeCrewName(apt.teamName);
      const matchedCrew = firmCrews.find(
        (c) => normalizeCrewName(c.name) === normalizedTeam
      );
      if (matchedCrew) crewId = matchedCrew.id;
    }

    // Create project
    const project = await storage.createProject({
      firmId,
      clientId,
      leiterId,
      crewId: crewId || undefined,
      status: "planning",
      workStartDate: apt.appointmentDate
        ? new Date(apt.appointmentDate).toISOString().slice(0, 10)
        : undefined,
      workEndDate: apt.appointmentEndDate
        ? new Date(apt.appointmentEndDate).toISOString().slice(0, 10)
        : undefined,
      teamNumber: apt.externalCaseId,
      installationPersonFirstName: apt.firstName || undefined,
      installationPersonLastName: apt.lastName || undefined,
      installationPersonAddress: [apt.address, apt.zipCode, apt.city].filter(Boolean).join(", "),
      installationPersonPhone: apt.phone || undefined,
      installationPersonUniqueId: apt.externalCaseId,
      notes: `Импорт из CraftOS. Тип: ${apt.workOrderType || ""}, Тип назначения: ${apt.appointmentType || ""}`,
    });

    // Link appointment to project
    await db
      .update(craftosAppointments)
      .set({ projectId: project.id })
      .where(eq(craftosAppointments.id, appointmentId));

    // Create history entry
    await storage.createProjectHistoryEntry({
      projectId: project.id,
      userId: leiterId,
      changeType: "created",
      fieldName: "project",
      description: `Проект создан из CraftOS назначения ${apt.externalCaseId}`,
    });

    return { projectId: project.id };
  }

  /**
   * Bulk create projects from all unlinked appointments.
   */
  async bulkCreateProjects(
    firmId: number,
    leiterId: string
  ): Promise<{ created: number; errors: string[] }> {
    const unlinked = await db
      .select()
      .from(craftosAppointments)
      .where(
        and(
          eq(craftosAppointments.firmId, firmId),
          eq(craftosAppointments.projectId, null as any)
        )
      );

    let created = 0;
    const errors: string[] = [];

    for (const apt of unlinked) {
      const result = await this.createProjectFromAppointment(apt.id, leiterId, firmId);
      if ("projectId" in result) {
        created++;
      } else {
        errors.push(`${apt.externalCaseId}: ${result.error}`);
      }
    }

    return { created, errors };
  }

  /**
   * Start periodic sync for all enabled firms.
   */
  async startPeriodicSync(): Promise<void> {
    const configs = await db.select().from(craftosSyncConfig).where(eq(craftosSyncConfig.enabled, true));

    for (const config of configs) {
      this.scheduleSyncForFirm(config);
    }

    console.log(`[CraftOS] Periodic sync started for ${configs.length} firm(s)`);
  }

  /**
   * Schedule sync for a specific firm.
   */
  scheduleSyncForFirm(config: CraftosSyncConfig): void {
    // Clear existing timer
    const existing = this.syncTimers.get(config.firmId);
    if (existing) clearInterval(existing);

    const intervalMs = (config.syncIntervalMinutes || 60) * 60 * 1000;

    const timer = setInterval(async () => {
      try {
        console.log(`[CraftOS] Scheduled sync for firm ${config.firmId}`);
        await this.syncForFirm(config.firmId);
      } catch (err: any) {
        console.error(`[CraftOS] Scheduled sync error for firm ${config.firmId}:`, err.message);
      }
    }, intervalMs);

    this.syncTimers.set(config.firmId, timer);
    console.log(`[CraftOS] Scheduled sync for firm ${config.firmId} every ${config.syncIntervalMinutes || 60} min`);
  }

  /**
   * Stop sync for a specific firm.
   */
  stopSyncForFirm(firmId: number): void {
    const timer = this.syncTimers.get(firmId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(firmId);
    }
  }

  /**
   * Stop all periodic syncs.
   */
  stopAll(): void {
    for (const [firmId, timer] of Array.from(this.syncTimers.entries())) {
      clearInterval(timer);
    }
    this.syncTimers.clear();
  }

  private async updateSyncStatus(configId: number, status: string, error: string | null): Promise<void> {
    await db
      .update(craftosSyncConfig)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error,
        updatedAt: new Date(),
      })
      .where(eq(craftosSyncConfig.id, configId));
  }
}

// getISOWeek imported from ./craftosUtils

// Singleton
export const craftosSyncService = new CraftosSyncService();
