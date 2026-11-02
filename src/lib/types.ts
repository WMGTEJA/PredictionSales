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
  /** Raw "From d/m/yyyy to d/m/yyyy" text from the report header, if found. */
  dateRangeText: string | null;
  companyName: string | null;
  /** "Grand Total Amount (RM)" printed in the report, used for validation. */
  grandTotal: number | null;
  /** "Total Item :" printed at the end of the summary, used for validation. */
  reportedItemCount: number | null;
  items: ReportItem[];
  totalQty: number;
  totalAmount: number;
  /** Problems worth showing to the user. */
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
