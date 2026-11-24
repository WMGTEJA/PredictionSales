import { get, set } from 'idb-keyval';
import type {
  FulfillmentSummary,
  ItemFulfillment,
  MasterSalesData,
  MonthFulfillment,
  ReportItem,
  SICompanyInfo,
  SIRow,
  SORow,
  StoredReport,
} from './types';

export const SUPABASE_URL = 'https://nqxkywfmkakdkhdwivck.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xeGt5d2Zta2FrZGtoZHdpdmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MTQ1MzUsImV4cCI6MjExMDM5MDUzNX0.3vmwCjUQrqAxPcq2xpOC-P1hzEGGrO52RZ2AP-QzaGM';

export type SourceDbFilter = 'ALL' | 'ACC-0002' | 'ACC-0006';
export type SOTableChoice = 'SO' | 'DO';
export type SITableChoice = 'IV' | 'CS' | 'CN' | 'DN';
export type QtyFieldChoice = 'sqty' | 'qty';
export type DocTypeCode = 'SO' | 'SI' | 'IV' | 'DO' | 'CS' | 'CN' | 'DN';

export interface DataSelectionConfig {
  sourceDb: SourceDbFilter;
  fromPeriod: string; // '' = earliest available
  toPeriod: string;   // '' = latest available
  qtyField: QtyFieldChoice;
  soTables: SOTableChoice[];
  siTables: SITableChoice[];
  stockGroup: string; // 'ALL' or specific stock group
}

export const DEFAULT_DATA_SELECTION: DataSelectionConfig = {
  sourceDb: 'ALL',
  fromPeriod: '',
  toPeriod: '',
  qtyField: 'sqty',
  soTables: ['SO'],
  siTables: ['IV'],
  stockGroup: 'ALL',
};

export interface SupabaseSalesRow {
  id?: number;
  source_db: 'ACC-0002' | 'ACC-0006';
  doc_type: DocTypeCode;
  period: string; // YYYY-MM
  item_code: string;
  item_desc: string;
  stock_group: string;
  company_code: string;
  company_name: string;
  qty: number;      // SQTY
  doc_qty?: number; // QTY
  amount: number;
  synced_at: string;
}

const STORAGE_KEY_SUPABASE_ROWS = 'prediction-sales:supabase-rows-v2';
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPeriodShort(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return `${SHORT_MONTHS[m - 1]} ${y}`;
}

export function formatMonthOnly(period: string): string {
  const [, m] = period.split('-').map(Number);
  if (!m || m < 1 || m > 12) return period;
  return SHORT_MONTHS[m - 1];
}

/**
 * Returns the latest eligible YYYY-MM period under the 50%-of-month rule:
 * - If at least 50% of the current calendar month has elapsed (day >= ceil(daysInMonth / 2)),
 *   the current month is eligible once SQL data exists for it.
 * - Otherwise, hold back the current partial month and cap at the previous month.
 */
export function getAutoMaxPeriod(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1..12
  const day = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const halfwayDay = Math.ceil(daysInMonth / 2);

  if (day >= halfwayDay) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** Returns up to the latest `count` periods (default 10) for rolling dashboard display. */
export function getRollingDisplayPeriods(periods: string[], count = 10): string[] {
  if (periods.length <= count) return periods;
  return periods.slice(-count);
}

/**
 * Formats a YYYY-MM period for compact table column headers & X-axis labels.
 * Shows "Jan" when all displayed periods are in the same year, or "Jan '27" when spanning years.
 */
export function formatPeriodColumnLabel(period: string, displayedPeriods: string[]): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  const years = new Set(displayedPeriods.map((p) => p.slice(0, 4)));
  if (years.size <= 1) return SHORT_MONTHS[m - 1];
  return `${SHORT_MONTHS[m - 1]} '${String(y).slice(-2)}`;
}

/** Lightweight check for the newest synced_at timestamp in Supabase (uses PK index). */
export async function fetchLatestSyncedAt(): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/sales_monthly_records?select=synced_at&order=id.desc&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ synced_at?: string }>;
  return rows[0]?.synced_at ?? null;
}

export async function fetchSupabaseSalesRows(): Promise<SupabaseSalesRow[]> {
  const pageSize = 1000;
  const selectCols =
    'id,source_db,doc_type,period,item_code,item_desc,stock_group,company_code,company_name,qty,doc_qty,amount,synced_at';

  const fetchKeysetPage = async (afterId: number): Promise<SupabaseSalesRow[]> => {
    const url = `${SUPABASE_URL}/rest/v1/sales_monthly_records?select=${selectCols}&id=gt.${afterId}&order=id.asc&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase fetch failed (${res.status}): ${text || res.statusText}`);
    }
    return (await res.json()) as SupabaseSalesRow[];
  };

  const allRows: SupabaseSalesRow[] = [];
  let lastId = 0;

  while (true) {
    const page = await fetchKeysetPage(lastId);
    if (page.length === 0) break;
    allRows.push(...page);
    const tailId = page[page.length - 1]?.id;
    if (page.length < pageSize || typeof tailId !== 'number' || tailId <= lastId) {
      break;
    }
    lastId = tailId;
  }

  if (allRows.length > 0) {
    try {
      await set(STORAGE_KEY_SUPABASE_ROWS, allRows);
    } catch (e) {
      console.warn('Failed to cache Supabase rows to IndexedDB:', e);
    }
  }

  return allRows;
}

export async function getCachedSupabaseRows(): Promise<SupabaseSalesRow[] | null> {
  try {
    const rows = await get<SupabaseSalesRow[]>(STORAGE_KEY_SUPABASE_ROWS);
    return Array.isArray(rows) && rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

export function extractFilterOptions(allRows: SupabaseSalesRow[]): {
  periods: string[];
  stockGroups: string[];
} {
  const periodSet = new Set<string>();
  const groupSet = new Set<string>();
  for (const r of allRows) {
    if (r.period) periodSet.add(r.period);
    const g = (r.stock_group || '').trim();
    if (g) groupSet.add(g);
  }
  return {
    periods: Array.from(periodSet).sort(),
    stockGroups: Array.from(groupSet).sort(),
  };
}

export function buildMasterDataFromSupabaseRows(
  allRows: SupabaseSalesRow[],
  config: DataSelectionConfig = DEFAULT_DATA_SELECTION,
): MasterSalesData {
  const soSet = new Set<string>(config.soTables);
  const siSet = new Set<string>(config.siTables);
  // Backward compatibility if any rows still have doc_type === 'SI'
  if (siSet.has('IV')) siSet.add('SI');

  const effectiveToPeriod = config.toPeriod || getAutoMaxPeriod();

  const rows = allRows.filter((r) => {
    if (config.sourceDb !== 'ALL' && r.source_db !== config.sourceDb) return false;
    if (config.fromPeriod && r.period < config.fromPeriod) return false;
    if (effectiveToPeriod && r.period > effectiveToPeriod) return false;
    if (config.stockGroup !== 'ALL' && (r.stock_group || '').trim() !== config.stockGroup) return false;
    return true;
  });

  const periodSet = new Set<string>();
  let latestSync = '';
  for (const r of rows) {
    if (r.period) periodSet.add(r.period);
    if (r.synced_at && r.synced_at > latestSync) latestSync = r.synced_at;
  }
  const periods = Array.from(periodSet).sort();
  const syncedAt = latestSync || new Date().toISOString();

  // --- Sales Orders ---
  const soRawRows: SORow[] = [];
  const soCompanies = new Set<string>();
  const soItemDesc = new Map<string, string>();
  const soMonthlyTotals: Record<string, number> = {};
  const soMonthItemMap = new Map<string, Map<string, ReportItem>>();
  for (const p of periods) {
    soMonthlyTotals[p] = 0;
    soMonthItemMap.set(p, new Map());
  }

  // --- Sales Invoices ---
  const siCompanyMap = new Map<string, SICompanyInfo>();
  const siRowMap = new Map<string, SIRow>();
  const siItemDesc = new Map<string, string>();
  const siMonthlyTotals: Record<string, number> = {};
  const siMonthItemMap = new Map<string, Map<string, ReportItem>>();
  for (const p of periods) {
    siMonthlyTotals[p] = 0;
    siMonthItemMap.set(p, new Map());
  }

  let soTotalQty = 0;
  let siTotalQty = 0;

  for (const r of rows) {
    const rawQty = config.qtyField === 'qty' ? Number(r.doc_qty ?? r.qty) : Number(r.qty);
    const qtyVal = Number.isFinite(rawQty) ? rawQty : 0;
    const amountVal = Number(r.amount) || 0;
    const code = (r.item_code || '').trim();
    const desc = (r.item_desc || '').trim();
    const stockGroup = (r.stock_group || '').trim();
    const compCode = (r.company_code || '').trim();
    const compName = (r.company_name || '').trim();
    const period = r.period;
    if (!code || !period) continue;

    if (soSet.has(r.doc_type)) {
      if (compName) soCompanies.add(compName);
      if (desc && !soItemDesc.has(code)) soItemDesc.set(code, desc);
      soRawRows.push({
        itemCode: code,
        itemDesc: desc,
        companyName: compName,
        docDate: formatMonthOnly(period).toUpperCase(),
        period,
        qty: qtyVal,
      });

      soTotalQty += qtyVal;
      soMonthlyTotals[period] = (soMonthlyTotals[period] || 0) + qtyVal;

      const mMap = soMonthItemMap.get(period)!;
      const existing = mMap.get(code);
      if (existing) {
        existing.qty += qtyVal;
        existing.amount += amountVal;
        if (!existing.desc && desc) existing.desc = desc;
        if (!existing.stockGroup && stockGroup) existing.stockGroup = stockGroup;
      } else {
        mMap.set(code, { code, desc, stockGroup, qty: qtyVal, amount: amountVal });
      }
    }

    if (siSet.has(r.doc_type)) {
      // Credit Notes (CN) subtract from net sales
      const sign = r.doc_type === 'CN' ? -1 : 1;
      const qty = sign * qtyVal;
      const amount = sign * amountVal;

      const cKey = compCode || compName || 'UNKNOWN';
      const label = compCode && compName ? `${compCode} - ${compName}` : compName || compCode;
      if (!siCompanyMap.has(cKey)) {
        siCompanyMap.set(cKey, { code: compCode || cKey, name: compName || cKey, label });
      }
      if (desc && !siItemDesc.has(code)) siItemDesc.set(code, desc);

      const siRowKey = `${cKey}::${code}`;
      let siRow = siRowMap.get(siRowKey);
      if (!siRow) {
        siRow = {
          companyCode: compCode || cKey,
          companyName: compName || cKey,
          itemCode: code,
          itemDesc: desc,
          monthlyQty: {},
          totalQty: 0,
        };
        siRowMap.set(siRowKey, siRow);
      }
      siRow.monthlyQty[period] = (siRow.monthlyQty[period] || 0) + qty;
      siRow.totalQty += qty;

      siTotalQty += qty;
      siMonthlyTotals[period] = (siMonthlyTotals[period] || 0) + qty;

      const mMap = siMonthItemMap.get(period)!;
      const existing = mMap.get(code);
      if (existing) {
        existing.qty += qty;
        existing.amount += amount;
        if (!existing.desc && desc) existing.desc = desc;
        if (!existing.stockGroup && stockGroup) existing.stockGroup = stockGroup;
      } else {
        mMap.set(code, { code, desc, stockGroup, qty, amount });
      }
    }
  }

  const soMonthlyReports: StoredReport[] = periods.map((p) => {
    const items = Array.from(soMonthItemMap.get(p)!.values());
    return {
      id: `so-${config.sourceDb}-${p}`,
      period: p,
      fileName: `Sales Order (${formatPeriodShort(p)})`,
      filePath: null,
      grandTotal: null,
      itemCount: items.length,
      totalQty: items.reduce((s, it) => s + it.qty, 0),
      totalAmount: Math.round(items.reduce((s, it) => s + it.amount, 0) * 100) / 100,
      uploadedAt: syncedAt,
      items,
    };
  });

  const siMonthlyReports: StoredReport[] = periods.map((p) => {
    const items = Array.from(siMonthItemMap.get(p)!.values());
    return {
      id: `si-${config.sourceDb}-${p}`,
      period: p,
      fileName: `Sales Invoice (${formatPeriodShort(p)})`,
      filePath: null,
      grandTotal: null,
      itemCount: items.length,
      totalQty: items.reduce((s, it) => s + it.qty, 0),
      totalAmount: Math.round(items.reduce((s, it) => s + it.amount, 0) * 100) / 100,
      uploadedAt: syncedAt,
      items,
    };
  });

  // --- Fulfillment (SO vs SI) — rolling latest 10 display periods ---
  const displayPeriods = getRollingDisplayPeriods(periods, 10);
  const allItemCodes = new Set<string>([...soItemDesc.keys(), ...siItemDesc.keys()]);
  const itemFulfillments: ItemFulfillment[] = [];
  let fulfillmentSoTotal = 0;
  let fulfillmentSiTotal = 0;

  for (const code of allItemCodes) {
    const desc = soItemDesc.get(code) || siItemDesc.get(code) || code;
    let soItemTotal = 0;
    let siItemTotal = 0;

    const monthly: MonthFulfillment[] = displayPeriods.map((p) => {
      const soQ = soMonthItemMap.get(p)?.get(code)?.qty || 0;
      const siQ = siMonthItemMap.get(p)?.get(code)?.qty || 0;
      soItemTotal += soQ;
      siItemTotal += siQ;
      const pct = soQ > 0 ? Math.round((siQ / soQ) * 1000) / 10 : siQ > 0 ? 100 : 0;
      return {
        period: p,
        month: formatPeriodColumnLabel(p, displayPeriods),
        soQty: soQ,
        siQty: siQ,
        fulfillmentPct: pct,
        variance: Math.round((siQ - soQ) * 100) / 100,
      };
    });

    if (soItemTotal === 0 && siItemTotal === 0) continue;

    fulfillmentSoTotal += soItemTotal;
    fulfillmentSiTotal += siItemTotal;

    const overallPct =
      soItemTotal > 0 ? Math.round((siItemTotal / soItemTotal) * 1000) / 10 : siItemTotal > 0 ? 100 : 0;
    let status: 'over' | 'fulfilled' | 'partial' | 'low' = 'fulfilled';
    if (overallPct > 100) status = 'over';
    else if (overallPct >= 99.5) status = 'fulfilled';
    else if (overallPct >= 80) status = 'partial';
    else status = 'low';

    itemFulfillments.push({
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

  itemFulfillments.sort((a, b) => b.soTotal + b.siTotal - (a.soTotal + a.siTotal));

  const monthlySummary: MonthFulfillment[] = displayPeriods.map((p) => {
    const soQ = soMonthlyTotals[p] || 0;
    const siQ = siMonthlyTotals[p] || 0;
    const pct = soQ > 0 ? Math.round((siQ / soQ) * 1000) / 10 : 0;
    return {
      period: p,
      month: formatPeriodColumnLabel(p, displayPeriods),
      soQty: soQ,
      siQty: Math.round(siQ * 100) / 100,
      fulfillmentPct: pct,
      variance: Math.round((siQ - soQ) * 100) / 100,
    };
  });

  const fulfillment: FulfillmentSummary = {
    totalSoQty: fulfillmentSoTotal,
    totalSiQty: Math.round(fulfillmentSiTotal * 100) / 100,
    overallFulfillmentPct:
      fulfillmentSoTotal > 0 ? Math.round((fulfillmentSiTotal / fulfillmentSoTotal) * 1000) / 10 : 0,
    totalVariance: Math.round((fulfillmentSiTotal - fulfillmentSoTotal) * 100) / 100,
    monthly: monthlySummary,
    items: itemFulfillments,
    stats: {
      totalItems: itemFulfillments.length,
      fullyFulfilled: itemFulfillments.filter((i) => i.status === 'fulfilled' || i.status === 'over').length,
      partiallyFulfilled: itemFulfillments.filter((i) => i.status === 'partial').length,
      lowFulfilled: itemFulfillments.filter((i) => i.status === 'low').length,
    },
  };

  return {
    so: {
      rows: soRawRows,
      companies: Array.from(soCompanies).sort(),
      items: Array.from(soItemDesc.entries())
        .map(([code, desc]) => ({ code, desc }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      monthlyReports: soMonthlyReports,
      totalQty: soTotalQty,
      monthlyTotals: soMonthlyTotals,
    },
    si: {
      rows: Array.from(siRowMap.values()),
      companies: Array.from(siCompanyMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      items: Array.from(siItemDesc.entries())
        .map(([code, desc]) => ({ code, desc }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      monthlyReports: siMonthlyReports,
      totalQty: siTotalQty,
      monthlyTotals: siMonthlyTotals,
    },
    fulfillment,
    syncedAt,
  };
}
