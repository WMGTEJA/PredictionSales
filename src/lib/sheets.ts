import { get, set } from 'idb-keyval';
import type {
  MasterSalesData,
  SORow,
  SIRow,
  SICompanyInfo,
  StoredReport,
  ItemFulfillment,
  MonthFulfillment,
  FulfillmentSummary,
} from './types';
import { INITIAL_SALES_DATA } from '../data/initialSalesData';

export const SPREADSHEET_ID = '1YELCEtZsFbwstQKGAjTELzwfr4VrPH16IiU4tw1nBEI';
export const SO_GID = '945362967';
export const SI_GID = '859053528';

export const SO_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${SO_GID}#gid=${SO_GID}`;
export const SI_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${SI_GID}#gid=${SI_GID}`;
export const SPREADSHEET_MAIN_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

export const DEFAULT_SHEET_URL = SO_URL;
export const DEFAULT_SHEET_GID = SO_GID;
export const DEFAULT_SHEET_TAB_NAME = 'SO JAN-OCT';

export const SO_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${SO_GID}`;
export const SI_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${SI_GID}`;

export const STORAGE_KEY_MASTER = 'prediction-sales:master-data-v3';
export const STORAGE_KEY_LAST_SYNC = 'prediction-sales:last-synced-at-v3';

export function getSavedSheetUrl(): string {
  return SO_URL;
}

export function saveSheetUrl(_url: string) {}

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null;
}

export function getInitialSheetReports(): StoredReport[] {
  return INITIAL_SALES_DATA.so.monthlyReports;
}

export async function syncGoogleSheet(_customUrl?: string): Promise<{ reports: StoredReport[]; rowCount: number; syncedAt: string }> {
  const master = await fetchLiveMasterData();
  return {
    reports: master.so.monthlyReports,
    rowCount: master.so.rows.length,
    syncedAt: master.syncedAt,
  };
}

export function parseSheetCsv(csvText: string, _defaultYear = 2026): {
  reports: StoredReport[];
  rowCount: number;
  uniqueItemCount: number;
  months: string[];
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Empty CSV');

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const itemCodeIdx = header.findIndex((h) => h.includes('code'));
  const itemDescIdx = header.findIndex((h) => h.includes('desc'));
  const monthIdx = header.findIndex((h) => h.includes('month'));
  const qtyIdx = header.findIndex((h) => h.includes('qty'));
  const stockIdx = header.findIndex((h) => h.includes('stock') || h.includes('group'));

  const cIdx = itemCodeIdx >= 0 ? itemCodeIdx : 1;
  const dIdx = itemDescIdx >= 0 ? itemDescIdx : 2;
  const mIdx = monthIdx >= 0 ? monthIdx : 3;
  const qIdx = qtyIdx >= 0 ? qtyIdx : 4;
  const sIdx = stockIdx >= 0 ? stockIdx : 0;

  const monthMap = new Map<string, Map<string, { code: string; desc: string; stockGroup?: string; qty: number; amount: number }>>();
  const allCodes = new Set<string>();
  let rowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const code = cols[cIdx];
    const rawMonth = cols[mIdx]?.toUpperCase().trim();
    const period = MONTH_MAP[rawMonth] || rawMonth;
    if (!code || !period) continue;

    const qty = parseFloat(cols[qIdx]?.replace(/,/g, '')) || 0;
    const desc = cols[dIdx] || '';
    const stockGroup = cols[sIdx] || '';

    allCodes.add(code);
    rowCount++;

    if (!monthMap.has(period)) monthMap.set(period, new Map());
    const m = monthMap.get(period)!;
    let it = m.get(code);
    if (!it) {
      it = { code, desc, stockGroup, qty: 0, amount: 0 };
      m.set(code, it);
    }
    it.qty += qty;
  }

  const sortedPeriods = Array.from(monthMap.keys()).sort();
  const reports: StoredReport[] = sortedPeriods.map((p) => {
    const items = Array.from(monthMap.get(p)!.values());
    return {
      id: `report-${p}`,
      period: p,
      fileName: `Report ${p}`,
      filePath: null,
      grandTotal: null,
      itemCount: items.length,
      totalQty: items.reduce((s, it) => s + it.qty, 0),
      totalAmount: 0,
      uploadedAt: new Date().toISOString(),
      items,
    };
  });

  return {
    reports,
    rowCount,
    uniqueItemCount: allCodes.size,
    months: sortedPeriods,
  };
}

export const MONTH_MAP: Record<string, string> = {
  JAN: '2026-01',
  FEB: '2026-02',
  MAR: '2026-03',
  APR: '2026-04',
  MAY: '2026-05',
  JUN: '2026-06',
  JUL: '2026-07',
  AUG: '2026-08',
  SEP: '2026-09',
  OCT: '2026-10',
};

export const PERIOD_TO_SHORT: Record<string, string> = {
  '2026-01': 'Jan',
  '2026-02': 'Feb',
  '2026-03': 'Mar',
  '2026-04': 'Apr',
  '2026-05': 'May',
  '2026-06': 'Jun',
  '2026-07': 'Jul',
  '2026-08': 'Aug',
  '2026-09': 'Sep',
  '2026-10': 'Oct',
};

export const PERIOD_KEYS = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];

/**
 * Robust CSV line splitter that handles quotes and embedded commas.
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
 * Parse Sales Order CSV text (gid: 945362967).
 * Columns: Item Code, Item Desc, Company Name, Doc Date, SO Qty
 */
export function parseSOCsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Sales Order CSV is empty.');

  const rows: SORow[] = [];
  const companySet = new Set<string>();
  const itemMap = new Map<string, string>();
  const monthlyReportsMap: Record<string, Map<string, { code: string; desc: string; qty: number; amount: number }>> = {};
  const monthlyTotals: Record<string, number> = {};

  PERIOD_KEYS.forEach((p) => {
    monthlyReportsMap[p] = new Map();
    monthlyTotals[p] = 0;
  });

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const itemCode = cols[0];
    const itemDesc = cols[1] || '';
    const companyName = cols[2] || '';
    const rawMonth = cols[3]?.toUpperCase().trim();
    const period = MONTH_MAP[rawMonth];
    if (!period || !itemCode) continue;

    const qty = parseFloat(cols[4]?.replace(/,/g, '')) || 0;

    rows.push({
      itemCode,
      itemDesc,
      companyName,
      docDate: rawMonth,
      period,
      qty,
    });

    if (companyName) companySet.add(companyName);
    if (!itemMap.has(itemCode)) itemMap.set(itemCode, itemDesc);

    monthlyTotals[period] = (monthlyTotals[period] || 0) + qty;
    const m = monthlyReportsMap[period];
    let repIt = m.get(itemCode);
    if (!repIt) {
      repIt = { code: itemCode, desc: itemDesc, qty: 0, amount: 0 };
      m.set(itemCode, repIt);
    }
    repIt.qty += qty;
  }

  const totalQty = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
  const nowIso = new Date().toISOString();

  const monthlyReports: StoredReport[] = PERIOD_KEYS.map((p) => {
    const items = Array.from(monthlyReportsMap[p].values());
    return {
      id: `so-${p}`,
      period: p,
      fileName: `Sales Order (${PERIOD_TO_SHORT[p]})`,
      filePath: SO_URL,
      grandTotal: null,
      itemCount: items.length,
      totalQty: items.reduce((s, it) => s + it.qty, 0),
      totalAmount: 0,
      uploadedAt: nowIso,
      items,
    };
  });

  return {
    rows,
    companies: Array.from(companySet).sort(),
    items: Array.from(itemMap.entries())
      .map(([code, desc]) => ({ code, desc }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    monthlyReports,
    totalQty,
    monthlyTotals,
  };
}

/**
 * Parse Sales Invoice CSV text (gid: 859053528).
 * Columns: Company, Company Name, Item Code, Item Desc, Jan-26 to Oct-26, Total Qty
 */
export function parseSICsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Sales Invoice CSV is empty.');

  const rows: SIRow[] = [];
  const companyMap = new Map<string, SICompanyInfo>();
  const itemMap = new Map<string, string>();
  const monthlyReportsMap: Record<string, Map<string, { code: string; desc: string; qty: number; amount: number }>> = {};
  const monthlyTotals: Record<string, number> = {};

  PERIOD_KEYS.forEach((p) => {
    monthlyReportsMap[p] = new Map();
    monthlyTotals[p] = 0;
  });

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const companyCode = cols[0] || '';
    const companyName = cols[1] || '';
    const itemCode = cols[2];
    const itemDesc = cols[3] || '';
    if (!itemCode) continue;

    const monthlyQty: Record<string, number> = {};
    let rowTotal = 0;
    for (let mIdx = 0; mIdx < 10; mIdx++) {
      const q = parseFloat(cols[4 + mIdx]?.replace(/,/g, '')) || 0;
      const p = PERIOD_KEYS[mIdx];
      monthlyQty[p] = q;
      rowTotal += q;
      monthlyTotals[p] = (monthlyTotals[p] || 0) + q;

      const m = monthlyReportsMap[p];
      let repIt = m.get(itemCode);
      if (!repIt) {
        repIt = { code: itemCode, desc: itemDesc, qty: 0, amount: 0 };
        m.set(itemCode, repIt);
      }
      repIt.qty += q;
    }

    rows.push({
      companyCode,
      companyName,
      itemCode,
      itemDesc,
      monthlyQty,
      totalQty: Math.round(rowTotal * 100) / 100,
    });

    if (companyCode || companyName) {
      const key = `${companyCode}___${companyName}`;
      if (!companyMap.has(key)) {
        companyMap.set(key, {
          code: companyCode,
          name: companyName,
          label: companyCode ? `${companyCode} - ${companyName}` : companyName,
        });
      }
    }

    if (!itemMap.has(itemCode)) itemMap.set(itemCode, itemDesc);
  }

  const totalQty = Math.round(Object.values(monthlyTotals).reduce((a, b) => a + b, 0) * 100) / 100;
  const nowIso = new Date().toISOString();

  const monthlyReports: StoredReport[] = PERIOD_KEYS.map((p) => {
    const items = Array.from(monthlyReportsMap[p].values());
    return {
      id: `si-${p}`,
      period: p,
      fileName: `Sales Invoice (${PERIOD_TO_SHORT[p]})`,
      filePath: SI_URL,
      grandTotal: null,
      itemCount: items.length,
      totalQty: items.reduce((s, it) => s + it.qty, 0),
      totalAmount: 0,
      uploadedAt: nowIso,
      items,
    };
  });

  return {
    rows,
    companies: Array.from(companyMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
    items: Array.from(itemMap.entries())
      .map(([code, desc]) => ({ code, desc }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    monthlyReports,
    totalQty,
    monthlyTotals,
  };
}

/**
 * Calculate Fulfillment (SO vs SI) for items only.
 */
export function buildFulfillmentSummary(
  soData: ReturnType<typeof parseSOCsv>,
  siData: ReturnType<typeof parseSICsv>,
): FulfillmentSummary {
  const allItemCodes = new Set<string>();
  const itemDescMap = new Map<string, string>();

  soData.items.forEach((it) => {
    allItemCodes.add(it.code);
    itemDescMap.set(it.code, it.desc);
  });
  siData.items.forEach((it) => {
    allItemCodes.add(it.code);
    if (!itemDescMap.has(it.code)) itemDescMap.set(it.code, it.desc);
  });

  const soReportsMap: Record<string, Map<string, number>> = {};
  const siReportsMap: Record<string, Map<string, number>> = {};

  PERIOD_KEYS.forEach((p, idx) => {
    const soRep = soData.monthlyReports[idx];
    const siRep = siData.monthlyReports[idx];
    const sMap = new Map<string, number>();
    const iMap = new Map<string, number>();
    soRep?.items.forEach((it) => sMap.set(it.code, it.qty));
    siRep?.items.forEach((it) => iMap.set(it.code, it.qty));
    soReportsMap[p] = sMap;
    siReportsMap[p] = iMap;
  });

  const items: ItemFulfillment[] = [];

  for (const code of allItemCodes) {
    const desc = itemDescMap.get(code) || code;
    let soItemTotal = 0;
    let siItemTotal = 0;

    const monthly: MonthFulfillment[] = PERIOD_KEYS.map((p) => {
      const soQ = soReportsMap[p]?.get(code) || 0;
      const siQ = siReportsMap[p]?.get(code) || 0;
      soItemTotal += soQ;
      siItemTotal += siQ;
      const pct = soQ > 0 ? Math.round((siQ / soQ) * 1000) / 10 : siQ > 0 ? 100 : 0;
      return {
        period: p,
        month: PERIOD_TO_SHORT[p],
        soQty: soQ,
        siQty: siQ,
        fulfillmentPct: pct,
        variance: Math.round((siQ - soQ) * 100) / 100,
      };
    });

    const overallPct = soItemTotal > 0 ? Math.round((siItemTotal / soItemTotal) * 1000) / 10 : siItemTotal > 0 ? 100 : 0;

    let status: 'over' | 'fulfilled' | 'partial' | 'low' = 'fulfilled';
    if (overallPct > 100) status = 'over';
    else if (overallPct >= 99.5) status = 'fulfilled';
    else if (overallPct >= 80) status = 'partial';
    else status = 'low';

    items.push({
      itemCode: code,
      itemDesc: desc,
      soTotal: soItemTotal,
      siTotal: Math.round(siItemTotal * 100) / 100,
      fulfillmentPct: overallPct,
      variance: Math.round((siItemTotal - soItemTotal) * 100) / 100,
      status,
      monthly,
    });
  }

  items.sort((a, b) => b.soTotal + b.siTotal - (a.soTotal + a.siTotal));

  const monthlySummary: MonthFulfillment[] = PERIOD_KEYS.map((p) => {
    const soQ = soData.monthlyTotals[p] || 0;
    const siQ = siData.monthlyTotals[p] || 0;
    const pct = soQ > 0 ? Math.round((siQ / soQ) * 1000) / 10 : 0;
    return {
      period: p,
      month: PERIOD_TO_SHORT[p],
      soQty: soQ,
      siQty: Math.round(siQ * 100) / 100,
      fulfillmentPct: pct,
      variance: Math.round((siQ - soQ) * 100) / 100,
    };
  });

  const overallFulfillmentPct =
    soData.totalQty > 0 ? Math.round((siData.totalQty / soData.totalQty) * 1000) / 10 : 0;

  return {
    totalSoQty: soData.totalQty,
    totalSiQty: siData.totalQty,
    overallFulfillmentPct,
    totalVariance: Math.round((siData.totalQty - soData.totalQty) * 100) / 100,
    monthly: monthlySummary,
    items,
    stats: {
      totalItems: items.length,
      fullyFulfilled: items.filter((i) => i.status === 'fulfilled' || i.status === 'over').length,
      partiallyFulfilled: items.filter((i) => i.status === 'partial').length,
      lowFulfilled: items.filter((i) => i.status === 'low').length,
    },
  };
}

/**
 * Fetch live data concurrently from both Google Sheets tabs.
 */
export async function fetchLiveMasterData(): Promise<MasterSalesData> {
  const [soRes, siRes] = await Promise.all([
    fetch(SO_EXPORT_URL, { headers: { Accept: 'text/csv, text/plain, */*' } }),
    fetch(SI_EXPORT_URL, { headers: { Accept: 'text/csv, text/plain, */*' } }),
  ]);

  if (!soRes.ok) {
    throw new Error(`Failed to fetch Sales Order spreadsheet (status ${soRes.status}: ${soRes.statusText})`);
  }
  if (!siRes.ok) {
    throw new Error(`Failed to fetch Sales Invoice spreadsheet (status ${siRes.status}: ${siRes.statusText})`);
  }

  const [soCsv, siCsv] = await Promise.all([soRes.text(), siRes.text()]);

  const soParsed = parseSOCsv(soCsv);
  const siParsed = parseSICsv(siCsv);
  const fulfillment = buildFulfillmentSummary(soParsed, siParsed);
  const syncedAt = new Date().toISOString();

  const masterData: MasterSalesData = {
    so: soParsed,
    si: siParsed,
    fulfillment,
    syncedAt,
  };

  try {
    await set(STORAGE_KEY_MASTER, masterData);
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncedAt);
  } catch (err) {
    console.warn('Could not cache master sales data to IndexedDB:', err);
  }

  return masterData;
}

/**
 * Retrieve cached data from IndexedDB, falling back to the bundled snapshot.
 */
export async function getCachedMasterData(): Promise<MasterSalesData> {
  try {
    const cached = await get<MasterSalesData>(STORAGE_KEY_MASTER);
    if (cached && cached.so && cached.si && cached.fulfillment) {
      return cached;
    }
  } catch (e) {
    console.warn('Failed to load master sales data from IndexedDB cache:', e);
  }
  return INITIAL_SALES_DATA;
}
