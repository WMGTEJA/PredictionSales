/** One line of monthly sales items. */
export interface ReportItem {
  /** Item code exactly as it appears in the report ("" when the report has no code). */
  code: string;
  /** Quantity in base units (pieces). */
  qty: number;
  /** Amount in RM (0 when not specified in source). */
  amount: number;
  /** Item description / product name from spreadsheet. */
  desc?: string;
  /** Stock category / group (e.g. RS-FG, CS-FG, DUTCH-FG). */
  stockGroup?: string;
}

/** Result of parsing one monthly report. */
export interface ParsedReport {
  fileName: string;
  /** Month the report covers, formatted `YYYY-MM`. */
  period: string;
  dateRangeText: string | null;
  companyName: string | null;
  grandTotal: number | null;
  reportedItemCount: number | null;
  items: ReportItem[];
  totalQty: number;
  totalAmount: number;
  warnings: string[];
}

/** A report that has been loaded/saved in the application. */
export interface StoredReport {
  id: string;
  period: string; // YYYY-MM
  fileName: string;
  filePath: string | null;
  grandTotal: number | null;
  itemCount: number;
  totalQty: number;
  totalAmount: number;
  uploadedAt: string; // ISO timestamp
  items: ReportItem[];
}

/** Raw Sales Order row from Google Sheets tab (gid: 945362967). */
export interface SORow {
  itemCode: string;
  itemDesc: string;
  companyName: string;
  docDate: string; // e.g. "JAN"
  period: string;  // e.g. "2026-01"
  qty: number;
}

/** Aggregated Sales Order item by company. */
export interface SOCompanyItem {
  itemCode: string;
  itemDesc: string;
  companyName: string;
  monthlyQty: Record<string, number>; // "2026-01" -> qty
  totalQty: number;
}

/** Raw Sales Invoice row from Google Sheets tab (gid: 859053528). */
export interface SIRow {
  companyCode: string;
  companyName: string;
  itemCode: string;
  itemDesc: string;
  monthlyQty: Record<string, number>; // "2026-01" -> qty
  totalQty: number;
}

/** Company info in Sales Invoice. */
export interface SICompanyInfo {
  code: string;
  name: string;
  label: string; // "300-10001 - 10083 JENGKA"
}

/** Monthly fulfillment entry for SO vs SI. */
export interface MonthFulfillment {
  period: string; // "2026-01"
  month: string;  // "Jan"
  soQty: number;
  siQty: number;
  fulfillmentPct: number;
  variance: number; // siQty - soQty
}

/** Item fulfillment comparison for SO vs SI. */
export interface ItemFulfillment {
  itemCode: string;
  itemDesc: string;
  soTotal: number;
  siTotal: number;
  fulfillmentPct: number;
  variance: number; // siQty - soQty
  status: 'over' | 'fulfilled' | 'partial' | 'low';
  monthly: MonthFulfillment[];
}

/** Overall fulfillment analysis summary. */
export interface FulfillmentSummary {
  totalSoQty: number;
  totalSiQty: number;
  overallFulfillmentPct: number;
  totalVariance: number;
  monthly: MonthFulfillment[];
  items: ItemFulfillment[];
  stats: {
    totalItems: number;
    fullyFulfilled: number;
    partiallyFulfilled: number;
    lowFulfilled: number;
  };
}

/** Master state for Sales Data. */
export interface MasterSalesData {
  so: {
    rows: SORow[];
    companies: string[];
    items: { code: string; desc: string }[];
    monthlyReports: StoredReport[];
    totalQty: number;
    monthlyTotals: Record<string, number>;
  };
  si: {
    rows: SIRow[];
    companies: SICompanyInfo[];
    items: { code: string; desc: string }[];
    monthlyReports: StoredReport[];
    totalQty: number;
    monthlyTotals: Record<string, number>;
  };
  fulfillment: FulfillmentSummary;
  syncedAt: string;
}
