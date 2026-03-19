/**
 * Pure utility functions for CraftOS sync.
 * Extracted for testability (no DB dependency).
 */

export interface CraftosAppointmentRaw {
  id: string;
  externalId: string;
  externalCaseId: string;
  appointmentDate: string;
  appointmentEndDate: string;
  appointmentScheduledDate?: string;
  appointmentScheduledEndDate?: string;
  workOrderType: { id: string; name: string };
  appointmentType: string;
  customer: string;
  customerAddress: {
    address: string;
    zipCode: string;
    city: string;
    latLong: string;
  };
  team: { id: string; name: string; location?: string };
  status: string;
  progress?: number;
  additionalInformation?: {
    appointmentStatus?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Get the real appointment status from CraftOS data.
 * additionalInformation.appointmentStatus is the Terminstatus (Completed, Scheduled, etc.)
 * status field is the desk progress status (Stopped, Active, NotStarted)
 */
export function getAppointmentStatus(raw: CraftosAppointmentRaw): string {
  return raw.additionalInformation?.appointmentStatus || raw.status || '';
}

/**
 * Parse "Lastname, Firstname" into separate parts.
 */
export function parseCustomerName(name: string): { firstName: string; lastName: string } {
  if (name.includes(",")) {
    const [last, first] = name.split(",", 2);
    return { firstName: (first || "").trim(), lastName: (last || "").trim() };
  }
  return { firstName: "", lastName: name.trim() };
}

/**
 * Convert a UTC date to German local date (Europe/Berlin CET/CEST).
 */
function toGermanDate(date: Date): Date {
  const berlinStr = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const [y, m, d] = berlinStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Get ISO week number from a date, using German timezone.
 * CraftOS uses Europe/Berlin, so we match their week calculation.
 */
export function getISOWeek(date: Date): number {
  const d = toGermanDate(date);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Normalize crew name for matching (lowercase, no spaces).
 */
export function normalizeCrewName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/**
 * Convert absolute KW range to CraftOS API week offsets.
 */
export function kwRangeToOffsets(
  absFrom: number,
  absTo: number,
  currentWeek: number
): number[] {
  const offsets: number[] = [];
  for (let kw = absFrom; kw <= absTo; kw++) {
    offsets.push(kw - currentWeek);
  }
  return offsets;
}
