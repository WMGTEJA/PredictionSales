import * as XLSX from 'xlsx';
import type { ForecastResult } from './forecast';
import { METHOD_INFO } from './forecast';
import { displayCode, periodLabel } from './format';

/** Download the forecast as an Excel workbook. */
export function exportForecastToExcel(result: ForecastResult) {
  const next = result.nextPeriod ? periodLabel(result.nextPeriod) : 'Next month';

  const rows = result.items.map((it) => {
    const row: Record<string, string | number | null> = {
      'Stock Group': it.stockGroup || '-',
      'Item Code': displayCode(it.code),
      'Item Description': it.desc || '-',
    };
    result.periods.forEach((p, i) => {
      row[`${periodLabel(p)} Qty (pcs)`] = it.qtyHistory[i];
    });
    row[`Forecast ${next} (pcs)`] = it.forecastQty;
    row['Low (pcs)'] = it.low;
    row['High (pcs)'] = it.high;
    row['Pcs / carton (est.)'] = it.packSize;
    row[`Forecast ${next} (ctn, est.)`] = it.packSize ? Math.round((it.forecastQty / it.packSize) * 10) / 10 : null;
    row['Change vs last month'] = it.change === null ? null : Math.round(it.change * 1000) / 10;
    row['Trend'] = it.trend;
    if (it.forecastAmount > 0) {
      row['Unit price (RM)'] = Math.round(it.unitPrice * 10000) / 10000;
      row[`Forecast ${next} amount (RM)`] = it.forecastAmount;
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));

  const info = XLSX.utils.aoa_to_sheet([
    ['Sales forecast'],
    ['Forecast month', next],
    ['Based on', result.periods.map((p) => periodLabel(p)).join(', ')],
    ['Method', METHOD_INFO[result.method].label],
    ['', METHOD_INFO[result.method].description],
    ['Total forecast (pcs)', result.totals.forecastQty],
    ['Total forecast (RM)', result.totals.forecastAmount],
    ['Generated', new Date().toLocaleString('en-MY')],
  ]);
  info['!cols'] = [{ wch: 22 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Forecast by item');
  XLSX.utils.book_append_sheet(wb, info, 'About');
  XLSX.writeFile(wb, `Sales_Forecast_${result.nextPeriod ?? 'next'}.xlsx`);
}
