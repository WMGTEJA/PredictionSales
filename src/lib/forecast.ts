import type { StoredReport } from './types';
import { packSizeFromCode } from './packsize';

export type ForecastMethod = 'smart' | 'weighted' | 'average' | 'last';

export const METHOD_INFO: Record<ForecastMethod, { label: string; description: string }> = {
  smart: {
    label: 'Smart blend',
    description:
      'Mix of a weighted average (recent months count more) and the item’s trend line. Recommended.',
  },
  weighted: {
    label: 'Weighted average',
    description: 'Last 3 months weighted 1 : 2 : 3 – the most recent month counts the most.',
  },
  average: {
    label: 'Simple average',
    description: 'Plain average of all months the item has been sold.',
  },
  last: {
    label: 'Same as last month',
    description: 'Assumes next month repeats the latest month exactly (baseline).',
  },
};

export type Trend = 'up' | 'down' | 'flat' | 'new' | 'stopped';

export interface ItemForecast {
  key: string;
  code: string;
  desc?: string;
  stockGroup?: string;
  /** Quantity per period, aligned with `ForecastResult.periods` (0 when not sold). */
  qtyHistory: number[];
  amountHistory: number[];
  lastQty: number;
  forecastQty: number;
  low: number;
  high: number;
  /** Average RM per unit in the most recent month with sales. */
  unitPrice: number;
  forecastAmount: number;
  /** Change of forecast vs. last month, as a fraction (0.12 = +12%). null when last month = 0. */
  change: number | null;
  trend: Trend;
  packSize: number | null;
  monthsWithSales: number;
}

export interface ForecastResult {
  periods: string[]; // YYYY-MM, oldest → newest
  nextPeriod: string | null;
  method: ForecastMethod;
  items: ItemForecast[];
  totals: {
    qtyHistory: number[];
    amountHistory: number[];
    forecastQty: number;
    forecastAmount: number;
    low: number;
    high: number;
  };
  /**
   * Back-test: forecast the latest month using only the earlier months and
   * compare with what actually happened. null when fewer than 3 months.
   */
  backtest: { period: string; accuracy: number; forecastQty: number; actualQty: number } | null;
}

export function nextMonth(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // month index m == next month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Forecast the next value of a series. Leading months before the item existed are ignored.
 * Also returns the monthly trend as a fraction of the average (0.1 = growing ~10% a month).
 */
export function forecastSeries(
  series: number[],
  method: ForecastMethod,
): { value: number; spread: number; relativeSlope: number } {
  const first = series.findIndex((v) => v > 0);
  if (first < 0) return { value: 0, spread: 0, relativeSlope: 0 };
  const y = series.slice(first);
  const n = y.length;
  const last = y[n - 1];

  const mean = y.reduce((s, v) => s + v, 0) / n;
  const spread = n > 1 ? Math.sqrt(y.reduce((s, v) => s + (v - mean) ** 2, 0) / n) : 0;

  // Least-squares trend line over the item's history.
  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  y.forEach((v, x) => {
    num += (x - xMean) * (v - mean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const relativeSlope = mean > 0 ? slope / mean : 0;

  // Chronologically weighted average across all active months (1 : 2 : ... : n)
  const weighted =
    y.reduce((s, v, i) => s + v * (i + 1), 0) / y.reduce((s, _v, i) => s + (i + 1), 0);

  let value: number;
  switch (method) {
    case 'last':
      value = last;
      break;
    case 'average':
      value = mean;
      break;
    case 'weighted':
      value = weighted;
      break;
    case 'smart':
    default: {
      if (n === 1) {
        value = last;
        break;
      }
      // Trend line projected one month ahead, blended with the weighted average
      // so that one unusual month doesn't swing the forecast too much.
      const trendValue = Math.max(0, mean + slope * (n - xMean));
      const trendWeight = n >= 3 ? 0.5 : 0.3;
      value = (1 - trendWeight) * weighted + trendWeight * trendValue;
    }
  }

  return { value: Math.max(0, value), spread, relativeSlope };
}

/** Build forecasts for every item across all saved reports. */
export function buildForecast(reports: StoredReport[], method: ForecastMethod = 'smart'): ForecastResult {
  const sorted = [...reports].sort((a, b) => a.period.localeCompare(b.period));
  const periods = sorted.map((r) => r.period);
  const nextPeriod = periods.length ? nextMonth(periods[periods.length - 1]) : null;

  // Collect qty / amount per item per period.
  const byItem = new Map<
    string,
    { code: string; desc?: string; stockGroup?: string; qty: number[]; amount: number[] }
  >();
  sorted.forEach((report, p) => {
    for (const it of report.items) {
      const key = it.code.trim().toUpperCase();
      let entry = byItem.get(key);
      if (!entry) {
        entry = {
          code: it.code,
          desc: it.desc,
          stockGroup: it.stockGroup,
          qty: Array(periods.length).fill(0),
          amount: Array(periods.length).fill(0),
        };
        byItem.set(key, entry);
      }
      entry.code = it.code; // keep the most recent spelling
      if (!entry.desc && it.desc) entry.desc = it.desc;
      if (!entry.stockGroup && it.stockGroup) entry.stockGroup = it.stockGroup;
      entry.qty[p] += it.qty;
      entry.amount[p] += it.amount;
    }
  });

  const items: ItemForecast[] = [];
  for (const [key, e] of byItem) {
    const { value, spread, relativeSlope } = forecastSeries(e.qty, method);
    const forecastQty = Math.round(value);
    const lastQty = e.qty[e.qty.length - 1] ?? 0;

    // Unit price from the latest month that had both qty and amount.
    let unitPrice = 0;
    for (let p = e.qty.length - 1; p >= 0; p--) {
      if (e.qty[p] > 0) {
        unitPrice = e.amount[p] / e.qty[p];
        break;
      }
    }

    // Trend describes the item's sales history (not the chosen forecast method).
    const monthsWithSales = e.qty.filter((v) => v > 0).length;
    const firstSold = e.qty.findIndex((v) => v > 0);
    let trend: Trend;
    if (periods.length > 1 && firstSold === periods.length - 1) trend = 'new';
    else if (lastQty === 0 && monthsWithSales > 0) trend = 'stopped';
    else if (relativeSlope > 0.05) trend = 'up';
    else if (relativeSlope < -0.05) trend = 'down';
    else trend = 'flat';

    items.push({
      key,
      code: e.code,
      desc: e.desc,
      stockGroup: e.stockGroup,
      qtyHistory: e.qty,
      amountHistory: e.amount.map((a) => Math.round(a * 100) / 100),
      lastQty,
      forecastQty,
      low: Math.max(0, Math.round(value - spread)),
      high: Math.round(value + spread),
      unitPrice,
      forecastAmount: Math.round(forecastQty * unitPrice * 100) / 100,
      change: lastQty > 0 ? forecastQty / lastQty - 1 : null,
      trend,
      packSize: packSizeFromCode(e.code),
      monthsWithSales,
    });
  }

  items.sort((a, b) => b.forecastQty - a.forecastQty);

  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const totals = {
    qtyHistory: periods.map((_, p) => sum(items.map((it) => it.qtyHistory[p]))),
    amountHistory: periods.map((_, p) => Math.round(sum(items.map((it) => it.amountHistory[p])) * 100) / 100),
    forecastQty: sum(items.map((it) => it.forecastQty)),
    forecastAmount: Math.round(sum(items.map((it) => it.forecastAmount)) * 100) / 100,
    low: sum(items.map((it) => it.low)),
    high: sum(items.map((it) => it.high)),
  };

  // Back-test on the latest month (needs at least 2 earlier months to be meaningful).
  let backtest: ForecastResult['backtest'] = null;
  if (periods.length >= 3) {
    let absErr = 0;
    let actualTotal = 0;
    let forecastTotal = 0;
    for (const it of items) {
      const actual = it.qtyHistory[periods.length - 1];
      const predicted = Math.round(forecastSeries(it.qtyHistory.slice(0, -1), method).value);
      absErr += Math.abs(actual - predicted);
      actualTotal += actual;
      forecastTotal += predicted;
    }
    backtest = {
      period: periods[periods.length - 1],
      accuracy: actualTotal > 0 ? Math.max(0, 1 - absErr / actualTotal) : 0,
      forecastQty: forecastTotal,
      actualQty: actualTotal,
    };
  }

  return { periods, nextPeriod, method, items, totals, backtest };
}
