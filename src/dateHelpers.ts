/**
 * Parsers for dates that arrive in patient links from clinical systems.
 *
 * SystmOne, EMIS and manual links have historically produced a mix of:
 *   - DD/MM/YYYY  (e.g. "02/04/2026")
 *   - D/M/YYYY    (e.g. "2/4/2026")
 *   - YYYY-MM-DD  (ISO short)
 *   - Full ISO with time (e.g. "2026-04-02T10:15:00Z")
 *   - DD-MMM-YYYY (e.g. "02-Apr-2026") — seen in a few SystmOne exports
 *   - DD.MM.YYYY  (e.g. "02.04.2026") — European locales
 *
 * Previously these fell through to `new Date(dateParam)` which silently
 * returned Invalid Date for most non-ISO formats, so the "out of date"
 * banner never fired. parsePatientDate normalises them into a Date or
 * returns null so callers can choose how to render the fallback.
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const buildDate = (year: number, monthIndex: number, day: number): Date | null => {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    year < 1900 ||
    year > 2100 ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(year, monthIndex, day);
  // Guards against 31/02 etc. which the Date constructor silently rolls.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

export function parsePatientDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // DD-MMM-YYYY or D-MMM-YYYY (hyphen or space separated)
  const namedMonth = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/);
  if (namedMonth) {
    const day = Number.parseInt(namedMonth[1], 10);
    const monthIndex = MONTH_NAMES[namedMonth[2].toLowerCase()];
    const year = Number.parseInt(namedMonth[3], 10);
    if (monthIndex !== undefined) {
      const built = buildDate(year, monthIndex, day);
      if (built) return built;
    }
  }

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = Number.parseInt(dmy[1], 10);
    const month = Number.parseInt(dmy[2], 10);
    const year = Number.parseInt(dmy[3], 10);
    const built = buildDate(year, month - 1, day);
    if (built) return built;
  }

  // YYYY-MM-DD (ISO short)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number.parseInt(iso[1], 10);
    const month = Number.parseInt(iso[2], 10);
    const day = Number.parseInt(iso[3], 10);
    const built = buildDate(year, month - 1, day);
    if (built) return built;
  }

  // Full ISO (with time) — rely on the Date constructor as a last resort.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * True if the issued date is more than `monthsThreshold` months before
 * `referenceDate` (default: now). Returns false when the input can't
 * be parsed — callers that want to distinguish "unknown" from "fresh"
 * should use parsePatientDate directly.
 */
export function isIssuedDateStale(
  input: string | null | undefined,
  monthsThreshold = 6,
  referenceDate: Date = new Date(),
): boolean {
  const issued = parsePatientDate(input);
  if (!issued) return false;
  const cutoff = new Date(referenceDate);
  cutoff.setMonth(cutoff.getMonth() - monthsThreshold);
  return issued < cutoff;
}
