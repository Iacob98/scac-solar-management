import { describe, it, expect } from "vitest";
import {
  getAppointmentStatus,
  getISOWeek,
  parseCustomerName,
  normalizeCrewName,
  kwRangeToOffsets,
  CraftosAppointmentRaw,
} from "../craftosUtils";

// --- getAppointmentStatus ---

describe("getAppointmentStatus", () => {
  const makeRaw = (
    status: string,
    appointmentStatus?: string
  ): CraftosAppointmentRaw =>
    ({
      status,
      additionalInformation: appointmentStatus
        ? { appointmentStatus }
        : undefined,
    }) as any;

  it("returns additionalInformation.appointmentStatus when present", () => {
    expect(getAppointmentStatus(makeRaw("Stopped", "Completed"))).toBe("Completed");
  });

  it("returns additionalInformation.appointmentStatus over status", () => {
    expect(getAppointmentStatus(makeRaw("Active", "Scheduled"))).toBe("Scheduled");
  });

  it("falls back to status when no additionalInformation", () => {
    expect(getAppointmentStatus(makeRaw("NotStarted"))).toBe("NotStarted");
  });

  it("falls back to status when appointmentStatus is empty", () => {
    const raw = { status: "Active", additionalInformation: { appointmentStatus: "" } } as any;
    expect(getAppointmentStatus(raw)).toBe("Active");
  });

  it("returns empty string when both are missing", () => {
    expect(getAppointmentStatus({ status: "" } as any)).toBe("");
  });

  it("handles Cannot Complete status", () => {
    expect(getAppointmentStatus(makeRaw("Stopped", "Cannot Complete"))).toBe("Cannot Complete");
  });

  it("handles In Progress status", () => {
    expect(getAppointmentStatus(makeRaw("Active", "In Progress"))).toBe("In Progress");
  });
});

// --- getISOWeek ---

describe("getISOWeek", () => {
  it("returns 1 for first week of 2026", () => {
    expect(getISOWeek(new Date("2025-12-29"))).toBe(1);
  });

  it("returns 12 for mid-March 2026", () => {
    expect(getISOWeek(new Date("2026-03-18"))).toBe(12);
  });

  it("returns 52 or 53 for end of year", () => {
    const w = getISOWeek(new Date("2026-12-28"));
    expect(w).toBeGreaterThanOrEqual(52);
    expect(w).toBeLessThanOrEqual(53);
  });

  it("handles week boundaries (Sunday→Monday = new week)", () => {
    const sunday = getISOWeek(new Date("2026-03-15"));
    const monday = getISOWeek(new Date("2026-03-16"));
    expect(monday).toBe(sunday + 1);
  });

  it("same week for Mon-Sun", () => {
    const mon = getISOWeek(new Date("2026-03-16"));
    const fri = getISOWeek(new Date("2026-03-20"));
    const sun = getISOWeek(new Date("2026-03-22"));
    expect(mon).toBe(fri);
    expect(mon).toBe(sun);
  });
});

// --- parseCustomerName ---

describe("parseCustomerName", () => {
  it('parses "Lastname, Firstname" format', () => {
    expect(parseCustomerName("Maier, Peter")).toEqual({
      firstName: "Peter",
      lastName: "Maier",
    });
  });

  it("handles name without comma", () => {
    expect(parseCustomerName("Peter Maier")).toEqual({
      firstName: "",
      lastName: "Peter Maier",
    });
  });

  it("handles empty string", () => {
    expect(parseCustomerName("")).toEqual({
      firstName: "",
      lastName: "",
    });
  });

  it("trims whitespace", () => {
    expect(parseCustomerName("  Müller ,  Hans  ")).toEqual({
      firstName: "Hans",
      lastName: "Müller",
    });
  });

  it("handles single name", () => {
    expect(parseCustomerName("Schmidt")).toEqual({
      firstName: "",
      lastName: "Schmidt",
    });
  });

  it("handles name with title", () => {
    expect(parseCustomerName("Dr. Schramm, Klaus")).toEqual({
      firstName: "Klaus",
      lastName: "Dr. Schramm",
    });
  });
});

// --- normalizeCrewName ---

describe("normalizeCrewName", () => {
  it("matches HP CEP MT 10 with HP CEP MT10", () => {
    expect(normalizeCrewName("HP CEP MT 10")).toBe(normalizeCrewName("HP CEP MT10"));
  });

  it("matches HP CEP MT 1 with HP CEP MT1", () => {
    expect(normalizeCrewName("HP CEP MT 1")).toBe(normalizeCrewName("HP CEP MT1"));
  });

  it("matches case-insensitively", () => {
    expect(normalizeCrewName("hp cep mt 10")).toBe(normalizeCrewName("HP CEP MT 10"));
  });

  it("handles extra spaces", () => {
    expect(normalizeCrewName("HP  CEP  MT  10")).toBe(normalizeCrewName("HP CEP MT10"));
  });

  it("does not match different teams", () => {
    expect(normalizeCrewName("HP CEP MT 1")).not.toBe(normalizeCrewName("HP CEP MT 10"));
  });
});

// --- kwRangeToOffsets ---

describe("kwRangeToOffsets", () => {
  it("converts default range correctly", () => {
    const offsets = kwRangeToOffsets(8, 20, 12);
    expect(offsets[0]).toBe(-4);    // KW 8 = offset -4
    expect(offsets[4]).toBe(0);     // KW 12 = offset 0
    expect(offsets[offsets.length - 1]).toBe(8); // KW 20 = offset +8
    expect(offsets.length).toBe(13);
  });

  it("handles full year range", () => {
    const offsets = kwRangeToOffsets(1, 53, 12);
    expect(offsets[0]).toBe(-11);
    expect(offsets[11]).toBe(0);
    expect(offsets[offsets.length - 1]).toBe(41);
    expect(offsets.length).toBe(53);
  });

  it("handles single week (current)", () => {
    const offsets = kwRangeToOffsets(12, 12, 12);
    expect(offsets).toEqual([0]);
  });

  it("handles all-past range", () => {
    const offsets = kwRangeToOffsets(1, 12, 12);
    expect(offsets[0]).toBe(-11);
    expect(offsets[offsets.length - 1]).toBe(0);
    expect(offsets.every((o) => o <= 0)).toBe(true);
  });

  it("handles all-future range", () => {
    const offsets = kwRangeToOffsets(13, 20, 12);
    expect(offsets[0]).toBe(1);
    expect(offsets.every((o) => o > 0)).toBe(true);
  });
});
