import * as XLSX from 'xlsx';
import type { ForecastResult, ItemForecast } from './forecast';
import { METHOD_INFO } from './forecast';
import { displayCode, periodLabel } from './format';

export interface CleanPredictionExportOptions {
  items: ItemForecast[];
  totals?: ForecastResult['totals'];
  sheetTitle?: string;
  filename?: string;
}

/**
 * Download a clean, styled Excel sheet containing strictly:
 * - Item Code
 * - Description
 * - AI Prediction (Nov, Dec, Jan)
 * - Add 10% from previous month (Nov, Dec, Jan)
 * - Recommended Plan (Nov, Dec, Jan)
 * Formatted with bold merged headers, clean column widths, and comma-formatted numbers.
 */
export function exportCleanPredictionToExcel({
  items,
  totals,
  sheetTitle = 'SO Prediction',
  filename = 'Sales_Order_Prediction.xlsx',
}: CleanPredictionExportOptions) {
  const headersRow1 = [
    'ITEM CODE',
    'DESCRIPTION',
    'AI PREDICTION (3 MONTHS)',
    null,
    null,
    'ADD 10% FROM PREVIOUS MONTH',
    null,
    null,
    'RECOMMENDED PLAN (DECISION)',
    null,
    null,
  ];

  const headersRow2 = [
    null,
    null,
    'Nov 2026',
    'Dec 2026',
    'Jan 2027',
    'Nov (+10%)',
    'Dec (+10%)',
    'Jan (+10%)',
    'Nov Plan',
    'Dec Plan',
    'Jan Plan',
  ];

  const dataRows = items.map((it) => [
    displayCode(it.code),
    it.desc || '-',
    it.novAi,
    it.decAi,
    it.janAi,
    it.novTarget,
    it.decTarget,
    it.janTarget,
    it.novPlan,
    it.decPlan,
    it.janPlan,
  ]);

  const sum = (fn: (it: ItemForecast) => number) => items.reduce((s, it) => s + fn(it), 0);
  const totalsRow = [
    'TOTALS',
    `${items.length} Products`,
    totals?.novAiTotal ?? sum((it) => it.novAi),
    totals?.decAiTotal ?? sum((it) => it.decAi),
    totals?.janAiTotal ?? sum((it) => it.janAi),
    totals?.novTargetTotal ?? sum((it) => it.novTarget),
    totals?.decTargetTotal ?? sum((it) => it.decTarget),
    totals?.janTargetTotal ?? sum((it) => it.janTarget),
    totals?.novPlanTotal ?? sum((it) => it.novPlan),
    totals?.decPlanTotal ?? sum((it) => it.decPlan),
    totals?.janPlanTotal ?? sum((it) => it.janPlan),
  ];

  const aoa = [headersRow1, headersRow2, ...dataRows, totalsRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Number format with comma separation
  const totalRows = aoa.length;
  for (let r = 2; r < totalRows; r++) {
    for (let c = 2; c <= 10; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = '#,##0';
      }
    }
  }

  // 2-tier merged headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // ITEM CODE
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // DESCRIPTION
    { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } }, // AI Prediction
    { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } }, // Target (+10%)
    { s: { r: 0, c: 8 }, e: { r: 0, c: 10 } }, // Recommended Plan
  ];

  // Column widths so nothing is truncated
  ws['!cols'] = [
    { wch: 18 },
    { wch: 38 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  // Auto-filter on the column headers
  ws['!autofilter'] = { ref: `A2:K${totalRows - 1}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  try {
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const zip = (XLSX as any).CFB.read(u8, { type: 'array' });

    // 1. Add bold font definitions and background styles to styles.xml
    const stylesEntry = zip.FileIndex.find((f: any) => f.name === 'styles.xml');
    if (stylesEntry) {
      const decoder = new TextDecoder();
      let xml = decoder.decode(stylesEntry.content);

      xml = xml.replace('<fonts count="1">', '<fonts count="3">');
      xml = xml.replace(
        '</fonts>',
        '<font><b/><sz val="11"/><color rgb="FF37150F"/><name val="Segoe UI"/><family val="2"/></font>' +
        '<font><b/><sz val="11"/><color rgb="FF854D0E"/><name val="Segoe UI"/><family val="2"/></font></fonts>'
      );

      xml = xml.replace('<fills count="2">', '<fills count="4">');
      xml = xml.replace(
        '</fills>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF5EFE6"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill></fills>'
      );

      xml = xml.replace('<cellXfs count="1">', '<cellXfs count="4">');
      xml = xml.replace(
        '</cellXfs>',
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>'
      );

      const encoder = new TextEncoder();
      stylesEntry.content = encoder.encode(xml);
      stylesEntry.size = stylesEntry.content.length;
    }

    // 2. Apply bold style to header rows (1 & 2) and totals row in sheet1.xml
    const sheetEntry = zip.FileIndex.find((f: any) => f.name === 'sheet1.xml');
    if (sheetEntry) {
      const decoder = new TextDecoder();
      let xml = decoder.decode(sheetEntry.content);

      xml = xml.replace(/<row r="([12])"(.*?)>(.*?)<\/row>/g, (_match: string, rNum: string, rAttr: string, cells: string) => {
        const styledCells = cells.replace(/<c r="([A-Z]+[12])"(.*?)>/g, (_cMatch: string, cRef: string, cAttr: string) => {
          const colLetter = cRef.replace(/[0-9]/g, '');
          const isAmber = ['I', 'J', 'K'].includes(colLetter);
          const styleIdx = isAmber ? '2' : '1';
          return `<c r="${cRef}" s="${styleIdx}"${cAttr}>`;
        });
        return `<row r="${rNum}"${rAttr}>${styledCells}</row>`;
      });

      const totalsRowNum = totalRows;
      const totalsRegex = new RegExp(`<row r="${totalsRowNum}"(.*?)>(.*?)<\\/row>`);
      xml = xml.replace(totalsRegex, (_match: string, rAttr: string, cells: string) => {
        const styledCells = cells.replace(new RegExp(`<c r="([A-Z]+${totalsRowNum})"(.*?)>`, 'g'), (_cMatch: string, cRef: string, cAttr: string) => {
          return `<c r="${cRef}" s="3"${cAttr}>`;
        });
        return `<row r="${totalsRowNum}"${rAttr}>${styledCells}</row>`;
      });

      const encoder = new TextEncoder();
      sheetEntry.content = encoder.encode(xml);
      sheetEntry.size = sheetEntry.content.length;
    }

    const finalU8 = (XLSX as any).CFB.write(zip, { fileType: 'zip', type: 'array' });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([finalU8], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
  } catch (err) {
    console.warn('Enhanced zip styling fallback triggered, using default XLSX writer:', err);
  }

  // Fallback to standard sheetjs writer
  XLSX.writeFile(wb, filename);
}

export const exportSalesOrderPredictionToExcel = exportCleanPredictionToExcel;

/** Download the complete forecast as an Excel workbook with all history. */
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
    // 3-Month AI Predictions
    row['Nov 2026 AI (pcs)'] = it.novAi;
    row['Dec 2026 AI (pcs)'] = it.decAi;
    row['Jan 2027 AI (pcs)'] = it.janAi;
    // 3-Month Target (+10% MoM) Predictions
    row['Nov 2026 Target (+10%) (pcs)'] = it.novTarget;
    row['Dec 2026 Target (+10%) (pcs)'] = it.decTarget;
    row['Jan 2027 Target (+10%) (pcs)'] = it.janTarget;
    // 3-Month Recommended Plan (Strategy A Decision Blend)
    row['Nov 2026 Recommended Plan (pcs)'] = it.novPlan;
    row['Dec 2026 Recommended Plan (pcs)'] = it.decPlan;
    row['Jan 2027 Recommended Plan (pcs)'] = it.janPlan;
    row[`Forecast ${next} (pcs)`] = it.forecastQty;
    row['Status'] = it.isManual ? 'Manual Adjustment' : 'AI Prediction';
    if (it.isManual) {
      row['AI Baseline (pcs)'] = it.originalForecastQty;
    }
    row['Low (pcs)'] = it.low;
    row['High (pcs)'] = it.high;
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
