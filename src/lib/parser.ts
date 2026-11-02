import * as XLSX from 'xlsx';
import type { ParsedReport, ReportItem } from './types';

type Cell = string | number | boolean | Date | null | undefined;
type Row = Cell[];

const DATE_RANGE_RE =
  /from\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+to\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i;

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

function toNumber(cell: Cell): number | null {
  if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  if (typeof cell === 'string') {
    const cleaned = cell.replace(/,/g, '').trim();
    if (cleaned !== '' && /^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  }
  return null;
}

function isBlank(cell: Cell): boolean {
  return text(cell) === '';
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Parse the rows of a "Sales Local – Delivery Order Listing" report.
 *
 * Only the "Transaction Summary" block at the end of the report is used: it
 * lists every item code with its total quantity and amount for the month,
 * laid out in two side-by-side column groups ("Item Code | Qty | Amount").
 */
export function parseReportRows(rows: Row[], fileName: string): ParsedReport {
  const warnings: string[] = [];

  // ---- Header: date range & company --------------------------------------
  let dateRangeText: string | null = null;
  let period: string | null = null;
  let companyName: string | null = null;

  for (const row of rows.slice(0, 40)) {
    for (const cell of row) {
      const t = text(cell);
      if (!dateRangeText) {
        const m = DATE_RANGE_RE.exec(t);
        if (m) {
          dateRangeText = m[0];
          const [, , fromMonth, fromYear, , toMonth, toYear] = m;
          period = `${fromYear}-${pad(Number(fromMonth))}`;
          if (fromMonth !== toMonth || fromYear !== toYear) {
            warnings.push(
              `The report covers more than one month (${m[0]}). It will be saved as ${period} – please check.`,
            );
          }
        }
      }
      if (!companyName && /SDN\.?\s*BHD|BERHAD/i.test(t) && t.length > 10) {
        companyName = t.replace(/\s*\(.*$/, '').trim();
      }
    }
  }

  // ---- Grand total ---------------------------------------------------------
  let grandTotal: number | null = null;
  for (const row of rows) {
    const idx = row.findIndex((c) => /grand\s+total/i.test(text(c)));
    if (idx >= 0) {
      for (let j = idx + 1; j < row.length; j++) {
        const n = toNumber(row[j]);
        if (n !== null) {
          grandTotal = n;
          break;
        }
      }
    }
  }

  // ---- Transaction summary -------------------------------------------------
  const start = rows.findIndex((row) => row.some((c) => /^transaction\s+summary$/i.test(text(c))));
  if (start < 0) {
    throw new Error(
      'Could not find the "Transaction Summary" section in this file. Please upload the Delivery Order Listing report exported as Excel.',
    );
  }

  const merged = new Map<string, ReportItem>();
  let blocks: Array<[number, number]> | null = null;
  let reportedItemCount: number | null = null;

  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    // End of summary: "Total Item : 98"
    const totalIdx = row.findIndex((c) => /^total\s+item/i.test(text(c)));
    if (totalIdx >= 0) {
      for (let j = totalIdx + 1; j < row.length; j++) {
        const n = toNumber(row[j]);
        if (n !== null) {
          reportedItemCount = n;
          break;
        }
      }
      break;
    }

    // Column header row (repeats on every page): locate each column group.
    const codeHeaderCols = row
      .map((c, idx) => (/^item\s*code$/i.test(text(c)) ? idx : -1))
      .filter((idx) => idx >= 0);
    if (codeHeaderCols.length > 0) {
      blocks = codeHeaderCols.map((s, k) => [s, codeHeaderCols[k + 1] ?? Number.MAX_SAFE_INTEGER]);
      continue;
    }
    if (!blocks) continue;

    for (const [s, e] of blocks) {
      const numbers: number[] = [];
      for (let j = s + 1; j < Math.min(e, row.length); j++) {
        if (isBlank(row[j])) continue;
        const n = toNumber(row[j]);
        if (n === null) {
          numbers.length = 99; // contains text → not an item row
          break;
        }
        numbers.push(n);
      }
      if (numbers.length !== 2) continue;

      const code = text(row[s]);
      const [qty, amount] = numbers;
      const key = code.toUpperCase();
      const existing = merged.get(key);
      if (existing) {
        existing.qty += qty;
        existing.amount = round2(existing.amount + amount);
      } else {
        merged.set(key, { code, qty, amount });
      }
    }
  }

  const items = [...merged.values()];
  if (items.length === 0) {
    throw new Error('The "Transaction Summary" section was found but no items could be read from it.');
  }

  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const totalAmount = round2(items.reduce((s, it) => s + it.amount, 0));

  // ---- Validation ----------------------------------------------------------
  if (!period) {
    warnings.push('Could not detect the report month from the header. Please choose it manually.');
  }
  if (grandTotal !== null && Math.abs(grandTotal - totalAmount) > 0.05) {
    warnings.push(
      `Summary amounts add up to RM ${totalAmount.toLocaleString()} but the report's Grand Total is RM ${grandTotal.toLocaleString()}.`,
    );
  }
  if (reportedItemCount !== null && reportedItemCount !== items.length) {
    warnings.push(`The report says ${reportedItemCount} items but ${items.length} were read.`);
  }
  const blank = items.find((it) => it.code === '');
  if (blank) {
    warnings.push(`One line has no item code (qty ${blank.qty.toLocaleString()}). It is kept as "(no code)".`);
  }

  return {
    fileName,
    period: period ?? '',
    dateRangeText,
    companyName,
    grandTotal,
    reportedItemCount,
    items,
    totalQty,
    totalAmount,
    warnings,
  };
}

/** Parse an uploaded .xlsx / .xls file. */
export async function parseReportFile(file: File): Promise<ParsedReport> {
  const buffer = await file.arrayBuffer();
  return parseReportBuffer(buffer, file.name);
}

export function parseReportBuffer(buffer: ArrayBuffer | Uint8Array, fileName: string): ParsedReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('This Excel file has no sheets.');
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  return parseReportRows(rows, fileName);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
