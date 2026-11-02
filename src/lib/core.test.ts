import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseReportBuffer, parseReportRows } from './parser';
import { buildForecast, forecastSeries, nextMonth } from './forecast';
import { packSizeFromCode } from './packsize';
import type { StoredReport } from './types';

// Real report kept out of git (see .gitignore). The test is skipped if it isn't there.
const SAMPLE = fileURLToPath(
  new URL('../../sample-data/Sales_Local_-_Delivery_Order_Listing_JULY_WMG.xlsx', import.meta.url),
);

describe('parser – real July report', () => {
  it.skipIf(!existsSync(SAMPLE))('reads the Transaction Summary and matches the Grand Total', () => {
    const parsed = parseReportBuffer(readFileSync(SAMPLE), 'july.xlsx');
    expect(parsed.period).toBe('2026-07');
    expect(parsed.items).toHaveLength(98);
    expect(parsed.reportedItemCount).toBe(98);
    expect(parsed.grandTotal).toBeCloseTo(1930387.35, 2);
    expect(parsed.totalAmount).toBeCloseTo(1930387.35, 2);
    expect(parsed.totalQty).toBe(676355);
    expect(parsed.companyName).toBe('WEST MALAYAN GROUP SDN BHD');

    const drs = parsed.items.find((i) => i.code === 'DRS150GX36');
    expect(drs).toEqual({ code: 'DRS150GX36', qty: 45792, amount: 85042.28 });
    const first = parsed.items.find((i) => i.code === '99RGSC200GX12');
    expect(first?.qty).toBe(47760);
    const blank = parsed.items.find((i) => i.code === '');
    expect(blank?.qty).toBe(210);
    // Only the "no code" warning is expected.
    expect(parsed.warnings).toHaveLength(1);
  });
});

describe('parser – synthetic', () => {
  it('throws a helpful error when the summary is missing', () => {
    expect(() => parseReportRows([['hello']], 'x.xlsx')).toThrow(/Transaction Summary/);
  });

  it('merges duplicate codes and handles page breaks', () => {
    const rows = [
      ['Date', ' : ', 'From 1/8/2026 to 31/8/2026'],
      [' Transaction Summary '],
      ['Item Code', null, null, null, 'Qty', null, null, 'Amount', null, 'Item Code', null, null, null, 'Qty', null, null, 'Amount'],
      ['A1X24', null, null, 10, null, null, 100, null, null, 'B2X12', null, null, 5, null, null, 50],
      [null, null, null, null, null, null, 'Sales Delivery Listing', null, null, null, null, null, null, null, 46328.4],
      ['Item Code', null, null, null, 'Qty', null, null, 'Amount', null, 'Item Code', null, null, null, 'Qty', null, null, 'Amount'],
      ['a1x24', null, null, 2, null, null, 20.5, null, null, null, null, null, 7, null, null, 0],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, 'Total Item :', 3],
    ];
    const parsed = parseReportRows(rows, 'aug.xlsx');
    expect(parsed.period).toBe('2026-08');
    expect(parsed.items).toEqual([
      { code: 'A1X24', qty: 12, amount: 120.5 },
      { code: 'B2X12', qty: 5, amount: 50 },
      { code: '', qty: 7, amount: 0 },
    ]);
  });
});

describe('pack size', () => {
  it.each([
    ['DRS150GX36', 36],
    ['CSMS110GX14X2', 28],
    ['CST200G+27GX24', 24],
    ['RGSC200x24', 24],
    ['CSK2SX30G', null],
    ['', null],
  ])('%s → %s', (code, expected) => {
    expect(packSizeFromCode(code)).toBe(expected);
  });
});

describe('forecast', () => {
  it('computes next month across year end', () => {
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(nextMonth('2026-07')).toBe('2026-08');
  });

  it('handles short series', () => {
    expect(forecastSeries([], 'smart').value).toBe(0);
    expect(forecastSeries([0, 0, 50], 'smart').value).toBe(50);
    expect(forecastSeries([100, 100, 100], 'smart').value).toBeCloseTo(100);
  });

  it('follows an upward trend', () => {
    const f = forecastSeries([100, 120, 140], 'smart').value;
    expect(f).toBeGreaterThan(130);
    expect(f).toBeLessThan(165);
  });

  it('never goes negative', () => {
    expect(forecastSeries([300, 100, 0], 'smart').value).toBeGreaterThanOrEqual(0);
    expect(forecastSeries([300, 100, 0], 'ann').value).toBeGreaterThanOrEqual(0);
  });

  it('runs ANN neural network forecast accurately', () => {
    const annResult = forecastSeries([100, 110, 120, 130, 140], 'ann').value;
    expect(annResult).toBeGreaterThan(120);
    expect(annResult).toBeLessThan(170);

    const zeroResult = forecastSeries([], 'ann').value;
    expect(zeroResult).toBe(0);
  });

  it('builds item forecasts, trends and back-test', () => {
    const mk = (period: string, items: [string, number, number][]): StoredReport => ({
      id: period,
      period,
      fileName: '',
      filePath: null,
      grandTotal: null,
      itemCount: items.length,
      totalQty: 0,
      totalAmount: 0,
      uploadedAt: '',
      items: items.map(([code, qty, amount]) => ({ code, qty, amount })),
    });
    const result = buildForecast([
      mk('2026-09', [['A', 140, 1400], ['NEW', 10, 10]]),
      mk('2026-07', [['A', 100, 1000], ['OLD', 50, 50]]),
      mk('2026-08', [['a', 120, 1200]]),
    ]);
    expect(result.periods).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(result.nextPeriod).toBe('2026-10');
    const a = result.items.find((i) => i.key === 'A')!;
    expect(a.qtyHistory).toEqual([100, 120, 140]);
    expect(a.trend).toBe('up');
    expect(a.unitPrice).toBe(10);
    expect(result.items.find((i) => i.key === 'NEW')!.trend).toBe('new');
    expect(result.items.find((i) => i.key === 'OLD')!.trend).toBe('stopped');
    expect(result.backtest?.period).toBe('2026-09');
  });
});

describe('google sheet parser & november forecast', () => {
  it('parses Google Sheet CSV columns: Stock Group, Item Code, Item Desc, Month, Qty', async () => {
    const { parseSheetCsv } = await import('./sheets');
    const sampleCsv = `Stock Group,Item Code,Item Desc,Month,Qty
0002,RSAOS100G,AGLIO ALIO SEASONING MIX 100G,JAN,10.00
0002,RSAOS100G,AGLIO ALIO SEASONING MIX 100G,JAN,5.00
CS-FG,CSAJ200Gx24,CIK SURI ASAM JAWA 200G x 24,JAN,50.00
0002,RSAOS100G,AGLIO ALIO SEASONING MIX 100G,OCT,40.00
CS-FG,CSAJ200Gx24,CIK SURI ASAM JAWA 200G x 24,OCT,100.00`;

    const parsed = parseSheetCsv(sampleCsv, 2026);
    expect(parsed.rowCount).toBe(5);
    expect(parsed.uniqueItemCount).toBe(2);
    expect(parsed.reports).toHaveLength(2);

    const jan = parsed.reports.find((r) => r.period === '2026-01')!;
    expect(jan).toBeDefined();
    const rsaosJan = jan.items.find((i) => i.code === 'RSAOS100G')!;
    expect(rsaosJan.qty).toBe(15);
    expect(rsaosJan.desc).toBe('AGLIO ALIO SEASONING MIX 100G');
    expect(rsaosJan.stockGroup).toBe('0002');

    const oct = parsed.reports.find((r) => r.period === '2026-10')!;
    expect(oct).toBeDefined();
    const rsaosOct = oct.items.find((i) => i.code === 'RSAOS100G')!;
    expect(rsaosOct.qty).toBe(40);
  });

  it('generates November 2026 forecast when given Jan to Oct data', async () => {
    const { INITIAL_SHEET_REPORTS } = await import('../data/defaultSheetReports');
    expect(INITIAL_SHEET_REPORTS).toHaveLength(10);
    expect(INITIAL_SHEET_REPORTS[0].period).toBe('2026-01');
    expect(INITIAL_SHEET_REPORTS[9].period).toBe('2026-10');

    const result = buildForecast(INITIAL_SHEET_REPORTS, 'smart');
    expect(result.periods).toHaveLength(10);
    expect(result.periods[0]).toBe('2026-01');
    expect(result.periods[9]).toBe('2026-10');
    expect(result.nextPeriod).toBe('2026-11'); // November 2026!
    expect(result.totals.forecastQty).toBeGreaterThan(500000);
    expect(result.items.length).toBeGreaterThan(100);

    const topItem = result.items[0];
    expect(topItem.forecastQty).toBeGreaterThan(0);
    expect(topItem.stockGroup).toBeDefined();
    expect(topItem.desc).toBeDefined();
  });

  it('runs Best-Fit Adaptive Ensemble and supports manual overrides', async () => {
    const { INITIAL_SHEET_REPORTS } = await import('../data/defaultSheetReports');
    const result = buildForecast(INITIAL_SHEET_REPORTS, 'ensemble', {
      '99RGSC200GX12': 88888,
    });
    expect(result.nextPeriod).toBe('2026-11');
    const item = result.items.find((it) => it.code === '99RGSC200GX12');
    expect(item).toBeDefined();
    expect(item?.forecastQty).toBe(88888);
    expect(item?.isManual).toBe(true);
    expect(item?.originalForecastQty).toBeGreaterThan(0);
  });
});
