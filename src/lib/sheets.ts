import type { StoredReport, ReportItem } from './types';
import {
  DEFAULT_CSV_EXPORT_URL,
  DEFAULT_SHEET_GID,
  DEFAULT_SHEET_TAB_NAME,
  DEFAULT_SHEET_URL,
  INITIAL_SHEET_REPORTS,
} from '../data/defaultSheetReports';

export const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/**
 * Robust CSV line splitter that respects quoted fields containing commas.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

/**
 * Convert a Google Sheets URL or GID into a CORS-friendly CSV export URL.
 */
export function buildSheetExportUrl(urlOrId: string, gid = DEFAULT_SHEET_GID): string {
  if (urlOrId.includes('/gviz/tq')) return urlOrId;

  const idMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const sheetId = idMatch ? idMatch[1] : urlOrId;

  const gidMatch = urlOrId.match(/[#?&]gid=([0-9]+)/);
  const targetGid = gidMatch ? gidMatch[1] : gid;

  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${targetGid}`;
}

export function parseMonthPeriod(rawMonth: string, defaultYear = 2026): { period: string; short: string } | null {
  const cleaned = rawMonth.trim().toUpperCase();

  // 1. Matches YYYY-MM or YYYY/MM
  const yyyyMm = cleaned.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yyyyMm) {
    const y = parseInt(yyyyMm[1], 10);
    const m = parseInt(yyyyMm[2], 10);
    if (m >= 1 && m <= 12) {
      return {
        period: `${y}-${String(m).padStart(2, '0')}`,
        short: MONTH_NAMES[m - 1],
      };
    }
  }

  // 2. Extracts explicit 4-digit year if present (e.g. "JAN 2026" or "2026-NOV")
  const yearMatch = cleaned.match(/\b(20\d{2})\b/);
  const yr = yearMatch ? parseInt(yearMatch[1], 10) : defaultYear;

  // 3. Matches month name abbreviations or full names (JAN, FEB, MARCH, etc.)
  let mIndex = MONTH_NAMES.findIndex((name) => cleaned.includes(name));
  if (mIndex < 0) {
    const numMatch = cleaned.match(/\b(\d{1,2})\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 1 && num <= 12) mIndex = num - 1;
    }
  }

  if (mIndex >= 0) {
    return {
      period: `${yr}-${String(mIndex + 1).padStart(2, '0')}`,
      short: MONTH_NAMES[mIndex],
    };
  }

  return null;
}

export interface SheetParseResult {
  reports: StoredReport[];
  rowCount: number;
  uniqueItemCount: number;
  months: string[];
}

/**
 * Dynamically parse raw CSV text from Google Sheet into monthly StoredReport objects.
 * Automatically discovers whatever months exist in the sheet's Month column.
 */
export function parseSheetCsv(csvText: string, defaultYear = 2026): SheetParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Spreadsheet data is empty or missing data rows.');
  }

  // Header detection
  const headerCols = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const stockGroupIdx = headerCols.findIndex((h) => h.includes('stock') || h.includes('group'));
  const itemCodeIdx = headerCols.findIndex((h) => h.includes('itemcode') || h.includes('code'));
  const itemDescIdx = headerCols.findIndex((h) => h.includes('desc') || h.includes('description') || h.includes('name'));
  const monthIdx = headerCols.findIndex((h) => h.includes('month') || h.includes('period'));
  const qtyIdx = headerCols.findIndex((h) => h.includes('qty') || h.includes('quantity'));

  const sIdx = stockGroupIdx >= 0 ? stockGroupIdx : 0;
  const cIdx = itemCodeIdx >= 0 ? itemCodeIdx : 1;
  const dIdx = itemDescIdx >= 0 ? itemDescIdx : 2;
  const mIdx = monthIdx >= 0 ? monthIdx : 3;
  const qIdx = qtyIdx >= 0 ? qtyIdx : 4;

  const monthMap = new Map<
    string,
    {
      period: string;
      short: string;
      itemsMap: Map<string, ReportItem>;
    }
  >();

  const allItemCodes = new Set<string>();
  let validRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const rawCode = cols[cIdx]?.trim();
    const rawMonth = cols[mIdx]?.trim();
    if (!rawCode || !rawMonth) continue;

    // Dynamically parse month/period (no hardcoded month lists)
    const parsedMonth = parseMonthPeriod(rawMonth, defaultYear);
    if (!parsedMonth) continue;

    const { period, short: monthShort } = parsedMonth;

    if (!monthMap.has(period)) {
      monthMap.set(period, {
        period,
        short: monthShort,
        itemsMap: new Map(),
      });
    }

    const mData = monthMap.get(period)!;
    const rawQty = cols[qIdx]?.replace(/,/g, '') ?? '0';
    const qty = parseFloat(rawQty) || 0;
    const desc = cols[dIdx]?.trim() || '';
    const stockGroup = cols[sIdx]?.trim() || '';

    allItemCodes.add(rawCode);
    validRows++;

    let item = mData.itemsMap.get(rawCode);
    if (!item) {
      item = {
        code: rawCode,
        desc,
        stockGroup,
        qty: 0,
        amount: 0,
      };
      mData.itemsMap.set(rawCode, item);
    }
    item.qty += qty;
    if (!item.desc && desc) item.desc = desc;
    if (!item.stockGroup && stockGroup) item.stockGroup = stockGroup;
  }

  // Sort periods dynamically in chronological order
  const sortedPeriods = Array.from(monthMap.keys()).sort();
  const nowIso = new Date().toISOString();

  const reports: StoredReport[] = sortedPeriods.map((period) => {
    const mData = monthMap.get(period)!;
    const items = Array.from(mData.itemsMap.values()).sort((a, b) => b.qty - a.qty);
    const totalQty = items.reduce((s, it) => s + it.qty, 0);

    return {
      id: `sheet-${period}`,
      period,
      fileName: `Google Sheets - ${DEFAULT_SHEET_TAB_NAME} (${mData.short})`,
      filePath: DEFAULT_SHEET_URL,
      grandTotal: null,
      itemCount: items.length,
      totalQty,
      totalAmount: 0,
      uploadedAt: nowIso,
      items,
    };
  });

  return {
    reports,
    rowCount: validRows,
    uniqueItemCount: allItemCodes.size,
    months: sortedPeriods,
  };
}

const STORAGE_CACHE_KEY = 'prediction-sales:google-sheet-reports-jan-oct';
const STORAGE_SYNC_TIME_KEY = 'prediction-sales:google-sheet-last-synced';
const STORAGE_CUSTOM_URL_KEY = 'prediction-sales:google-sheet-url';

export function getSavedSheetUrl(): string {
  return localStorage.getItem(STORAGE_CUSTOM_URL_KEY) || DEFAULT_SHEET_URL;
}

export function saveSheetUrl(url: string) {
  localStorage.setItem(STORAGE_CUSTOM_URL_KEY, url);
}

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(STORAGE_SYNC_TIME_KEY) || '2026-11-02T03:40:00.000Z';
}

/**
 * Load cached reports from localStorage or fallback to pre-bundled Jan-Oct snapshot.
 */
export function getInitialSheetReports(): StoredReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= INITIAL_SHEET_REPORTS.length) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read cached sheet reports:', err);
  }
  return INITIAL_SHEET_REPORTS;
}

/**
 * Fetch live data from the Google Sheet via CSV export.
 */
export async function syncGoogleSheet(customUrl?: string): Promise<{
  reports: StoredReport[];
  rowCount: number;
  syncedAt: string;
}> {
  const sheetUrl = customUrl || getSavedSheetUrl();
  const exportUrl = buildSheetExportUrl(sheetUrl);

  const res = await fetch(exportUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/csv, text/plain, */*',
    },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets fetch failed with status ${res.status}: ${res.statusText}`);
  }

  const csvText = await res.text();
  const result = parseSheetCsv(csvText);

  if (result.reports.length === 0) {
    throw new Error('No monthly reports were parsed from Google Sheets.');
  }

  const syncedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(result.reports));
    localStorage.setItem(STORAGE_SYNC_TIME_KEY, syncedAt);
    if (customUrl) saveSheetUrl(customUrl);
  } catch (err) {
    console.warn('Could not cache reports to localStorage:', err);
  }

  return {
    reports: result.reports,
    rowCount: result.rowCount,
    syncedAt,
  };
}

export {
  DEFAULT_SHEET_URL,
  DEFAULT_SHEET_GID,
  DEFAULT_SHEET_TAB_NAME,
  DEFAULT_CSV_EXPORT_URL,
};
