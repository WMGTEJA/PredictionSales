const fs = require('fs');
const path = require('path');

const text = fs.readFileSync('scratch/sheet_data.csv', 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

function parseCSVLine(line) {
  const result = [];
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
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const MONTH_ORDER = [
  { short: 'JAN', period: '2026-01', label: 'Jan 2026' },
  { short: 'FEB', period: '2026-02', label: 'Feb 2026' },
  { short: 'MAR', period: '2026-03', label: 'Mar 2026' },
  { short: 'APR', period: '2026-04', label: 'Apr 2026' },
  { short: 'MAY', period: '2026-05', label: 'May 2026' },
  { short: 'JUN', period: '2026-06', label: 'Jun 2026' },
  { short: 'JUL', period: '2026-07', label: 'Jul 2026' },
  { short: 'AUG', period: '2026-08', label: 'Aug 2026' },
  { short: 'SEP', period: '2026-09', label: 'Sep 2026' },
  { short: 'OCT', period: '2026-10', label: 'Oct 2026' },
];

const monthMap = new Map();
MONTH_ORDER.forEach((m) => {
  monthMap.set(m.short, {
    period: m.period,
    label: m.label,
    itemsMap: new Map(),
  });
});

for (let i = 1; i < lines.length; i++) {
  const [stockGroup, itemCode, itemDesc, month, qtyStr] = parseCSVLine(lines[i]);
  if (!itemCode || !month) continue;

  const mKey = month.toUpperCase().trim();
  const mData = monthMap.get(mKey);
  if (!mData) continue;

  const code = itemCode.trim();
  const desc = itemDesc ? itemDesc.trim() : '';
  const sg = stockGroup ? stockGroup.trim() : '';
  const qty = parseFloat((qtyStr || '0').replace(/,/g, '')) || 0;

  if (!mData.itemsMap.has(code)) {
    mData.itemsMap.set(code, {
      code,
      desc,
      stockGroup: sg,
      qty: 0,
      amount: 0,
    });
  }
  const it = mData.itemsMap.get(code);
  it.qty += qty;
  if (!it.desc && desc) it.desc = desc;
  if (!it.stockGroup && sg) it.stockGroup = sg;
}

const reports = MONTH_ORDER.map((m) => {
  const mData = monthMap.get(m.short);
  const items = Array.from(mData.itemsMap.values()).sort((a, b) => b.qty - a.qty);
  const totalQty = items.reduce((s, it) => s + it.qty, 0);

  return {
    id: `sheet-${m.period}`,
    period: m.period,
    fileName: `Google Sheets - SO JAN-OCT (${m.short})`,
    filePath: `https://docs.google.com/spreadsheets/d/1YELCEtZsFbwstQKGAjTELzwfr4VrPH16IiU4tw1nBEI/edit#gid=1334404777`,
    grandTotal: null,
    itemCount: items.length,
    totalQty,
    totalAmount: 0,
    uploadedAt: '2026-11-02T03:40:00.000Z',
    items,
  };
});

const tsContent = `// Auto-generated snapshot of Google Sheet 'SO JAN-OCT'
import type { StoredReport } from '../lib/types';

export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1YELCEtZsFbwstQKGAjTELzwfr4VrPH16IiU4tw1nBEI/edit?gid=1334404777#gid=1334404777';
export const DEFAULT_SHEET_GID = '1334404777';
export const DEFAULT_SHEET_TAB_NAME = 'SO JAN-OCT';
export const DEFAULT_CSV_EXPORT_URL = 'https://docs.google.com/spreadsheets/d/1YELCEtZsFbwstQKGAjTELzwfr4VrPH16IiU4tw1nBEI/gviz/tq?tqx=out:csv&gid=1334404777';

export const INITIAL_SHEET_REPORTS: StoredReport[] = ${JSON.stringify(reports, null, 2)};
`;

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/defaultSheetReports.ts', tsContent, 'utf8');
console.log('Successfully generated src/data/defaultSheetReports.ts with', reports.length, 'monthly reports.');
