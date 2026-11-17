/**
 * Market Schedule & Dynamic Weekly Expiry Rollover Engine
 * NIFTY Weekly Options expire on Tuesday (or Monday if Tuesday is an exchange holiday).
 * At 15:30 IST on an expiry day, the current weekly contract expires.
 * After 15:30 IST (and for all evening settlement analysis), the active weekly contract
 * automatically rolls over to the next weekly expiry date.
 */

// Official Exchange Weekly Expiry Schedule (incorporating holiday shifts like 23-Nov-2026)
export const KNOWN_WEEKLY_EXPIRIES: string[] = [
  '2026-10-28',
  '2026-11-03',
  '2026-11-09',
  '2026-11-17',
  '2026-11-23', // Shifted from 24-Nov due to Guru Nanak Jayanti
  '2026-12-01',
  '2026-12-08',
  '2026-12-15',
  '2026-12-22',
  '2026-12-29',
  '2027-01-05',
  '2027-01-12',
  '2027-01-19',
  '2027-01-26',
];

/**
 * Format date string to DD-MMM-YYYY (e.g. "2026-11-23" -> "23-Nov-2026")
 */
export function formatExpiryDisplay(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const clean = dateStr.trim();

  // If already formatted like "23-Nov-2026"
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/i.test(clean)) {
    return clean;
  }

  // Extract date part if enclosed in text like "Current Weekly (23-Nov-2026)" or "Current Weekly (2026-11-23)"
  let rawDate = clean;
  const match = clean.match(/(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{4}-\d{2}-\d{2})/);
  if (match) {
    rawDate = match[1];
  }

  // If extracted part is already DD-MMM-YYYY
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/i.test(rawDate)) {
    return rawDate;
  }

  // Parse YYYY-MM-DD
  const parts = rawDate.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${String(day).padStart(2, '0')}-${months[monthIdx]}-${year}`;
    }
  }

  return rawDate;
}

/**
 * Get current time in Indian Standard Time (IST)
 */
export function getISTNowForSchedule(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

/**
 * Format a Date to YYYY-MM-DD in IST
 */
export function formatDateYMDForSchedule(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculates the active NIFTY weekly expiry date dynamically.
 * If targetDate is provided, it evaluates for that session.
 * Otherwise uses current IST timestamp.
 * If current time is on or after 15:30 IST on an expiry day, it automatically rolls to the next weekly!
 */
export function getActiveWeeklyExpiryDate(currentDate?: Date, symbol: string = 'NIFTY'): string {
  const ist = currentDate || getISTNowForSchedule();
  const todayYMD = formatDateYMDForSchedule(ist);
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const isPostMarketClose = hours > 15 || (hours === 15 && minutes >= 30);

  // Check against known official expiries list first
  const sorted = [...KNOWN_WEEKLY_EXPIRIES].sort();
  for (let i = 0; i < sorted.length; i++) {
    const exp = sorted[i];
    if (exp === todayYMD) {
      // It's expiry day!
      if (isPostMarketClose && i + 1 < sorted.length) {
        // After 15:30 IST, roll over to the next weekly expiry
        return formatExpiryDisplay(sorted[i + 1]);
      }
      return formatExpiryDisplay(exp);
    } else if (exp > todayYMD) {
      // Future weekly expiry
      return formatExpiryDisplay(exp);
    }
  }

  // Algorithmic fallback: Tuesday weekly rollover
  const day = ist.getDay(); // 0: Sun, 1: Mon, 2: Tue, ...
  let diff = (2 - day + 7) % 7;
  if (diff === 0 && isPostMarketClose) {
    diff = 7;
  }
  const nextTuesday = new Date(ist.getTime() + diff * 86400000);
  return formatExpiryDisplay(formatDateYMDForSchedule(nextTuesday));
}
