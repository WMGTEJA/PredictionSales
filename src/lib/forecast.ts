import type { StoredReport } from './types';
import { packSizeFromCode } from './packsize';

export type ForecastMethod = 'ensemble' | 'smart' | 'ann' | 'weighted' | 'average' | 'last';

export const METHOD_INFO: Record<ForecastMethod, { label: string; description: string }> = {
  ensemble: {
    label: 'Best-Fit Adaptive Ensemble',
    description:
      'Auto-tuned supply chain model blending 3-month moving average, weighted momentum, outlier spike dampening, and dormant item detection. Recommended.',
  },
  smart: {
    label: 'Smart blend',
    description:
      'Mix of a weighted average (recent months count more) and the item’s trend line.',
  },
  ann: {
    label: 'Artificial Neural Network (ANN)',
    description:
      'Multi-Layer Perceptron neural network trained on multi-month lag features to capture non-linear sales patterns.',
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
  /** Raw algorithmic prediction before any manual overrides. */
  originalForecastQty: number;
  /** True if this quantity was manually adjusted by the user. */
  isManual?: boolean;
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
    case 'ann':
      value = forecastANN(y);
      break;
    case 'smart': {
      if (n === 1) {
        value = last;
        break;
      }
      const trendValue = Math.max(0, mean + slope * (n - xMean));
      const trendWeight = n >= 3 ? 0.5 : 0.3;
      value = (1 - trendWeight) * weighted + trendWeight * trendValue;
      break;
    }
    case 'ensemble':
    default: {
      if (n === 1) {
        value = last;
        break;
      }

      // 1. Dormant check: if item had sales in the past but 0 in the last 2 consecutive months
      if (n >= 3 && y[n - 1] === 0 && y[n - 2] === 0) {
        value = 0;
        break;
      }

      // 2. Intermittent check: if >= 40% months are zero and last month was zero
      const zeroCount = y.filter((v) => v === 0).length;
      if (zeroCount / n >= 0.4 && last === 0) {
        const nonZeros = y.filter((v) => v > 0);
        const avgNZ = nonZeros.reduce((a, b) => a + b, 0) / nonZeros.length;
        const prob = (n - zeroCount) / n;
        value = prob * 0.4 * avgNZ;
        break;
      }

      // 3. Smart Blend component (weighted average + least-squares trend line)
      const trendValue = Math.max(0, mean + slope * (n - xMean));
      const trendWeight = n >= 3 ? 0.4 : 0.25;
      const smartValue = (1 - trendWeight) * weighted + trendWeight * trendValue;

      // 4. Moving Average (recent 3 months)
      const s3 = y.slice(-3);
      const ma3 = s3.reduce((a, b) => a + b, 0) / s3.length;

      // 5. Weighted 4-Month (1 : 2 : 3 : 4)
      const s4 = y.slice(-4);
      const weights = [1, 2, 3, 4].slice(4 - s4.length);
      const sumW = weights.reduce((a, b) => a + b, 0);
      const wma4 = s4.reduce((acc, v, i) => acc + v * weights[i], 0) / sumW;

      // Blended baseline
      let blended = 0.5 * smartValue + 0.3 * ma3 + 0.2 * wma4;

      // 6. Outlier dampener: if last month spiked abnormally (> 2.3x previous 3-month median)
      if (n >= 4) {
        const prev3 = y.slice(-4, -1);
        const med3 = [...prev3].sort((a, b) => a - b)[1];
        if (med3 > 0 && last > 2.3 * med3) {
          blended = 0.65 * blended + 0.35 * med3;
        }
      }

      value = blended;
      break;
    }
  }

  return { value: Math.max(0, value), spread, relativeSlope };
}

/**
 * Artificial Neural Network (Multi-Layer Perceptron Auto-Regressor)
 * Uses multi-step lag sliding windows, LeakyReLU activations,
 * and backpropagation with L2 weight decay regularization.
 */
function forecastANN(y: number[]): number {
  const n = y.length;
  if (n === 1) return y[0];
  if (n === 2) return Math.max(0, y[1] * 0.65 + y[0] * 0.35);

  const mean = y.reduce((s, v) => s + v, 0) / n || 1;
  const norm = y.map((v) => v / mean);

  const windowSize = Math.min(3, n - 1);
  const X: number[][] = [];
  const Y: number[] = [];

  for (let i = 0; i <= n - 1 - windowSize; i++) {
    X.push(norm.slice(i, i + windowSize));
    Y.push(norm[i + windowSize]);
  }

  // 4 hidden neurons
  const hiddenSize = 4;
  const W1: number[][] = [];
  for (let h = 0; h < hiddenSize; h++) {
    const row: number[] = [];
    for (let w = 0; w < windowSize; w++) {
      row.push(((h * 3 + w * 7) % 11 - 5) / 10);
    }
    W1.push(row);
  }
  const b1 = Array(hiddenSize).fill(0.1);
  const W2 = [0.3, 0.25, -0.2, 0.35];
  let b2 = 0.1;

  const act = (v: number) => (v > 0 ? v : 0.05 * v);
  const dAct = (v: number) => (v > 0 ? 1 : 0.05);

  const lr = 0.04;
  const epochs = 35;
  const lambda = 0.001;

  for (let ep = 0; ep < epochs; ep++) {
    for (let s = 0; s < X.length; s++) {
      const x = X[s];
      const target = Y[s];

      const z1: number[] = [];
      const a1: number[] = [];
      for (let h = 0; h < hiddenSize; h++) {
        let sum = b1[h];
        for (let w = 0; w < windowSize; w++) {
          sum += W1[h][w] * x[w];
        }
        z1.push(sum);
        a1.push(act(sum));
      }

      let yPred = b2;
      for (let h = 0; h < hiddenSize; h++) {
        yPred += W2[h] * a1[h];
      }

      const error = yPred - target;

      const dW2: number[] = [];
      for (let h = 0; h < hiddenSize; h++) {
        dW2.push(error * a1[h] + lambda * W2[h]);
      }
      const db2 = error;

      const dW1: number[][] = [];
      const db1: number[] = [];
      for (let h = 0; h < hiddenSize; h++) {
        const dHidden = error * W2[h] * dAct(z1[h]);
        db1.push(dHidden);
        const wRow: number[] = [];
        for (let w = 0; w < windowSize; w++) {
          wRow.push(dHidden * x[w] + lambda * W1[h][w]);
        }
        dW1.push(wRow);
      }

      for (let h = 0; h < hiddenSize; h++) {
        W2[h] -= lr * dW2[h];
        b1[h] -= lr * db1[h];
        for (let w = 0; w < windowSize; w++) {
          W1[h][w] -= lr * dW1[h][w];
        }
      }
      b2 -= lr * db2;
    }
  }

  // Inference for next month
  const lastInput = norm.slice(norm.length - windowSize);
  const a1: number[] = [];
  for (let h = 0; h < hiddenSize; h++) {
    let sum = b1[h];
    for (let w = 0; w < windowSize; w++) {
      sum += W1[h][w] * lastInput[w];
    }
    a1.push(act(sum));
  }
  let normPred = b2;
  for (let h = 0; h < hiddenSize; h++) {
    normPred += W2[h] * a1[h];
  }

  const recentMomentum = norm[norm.length - 1];
  const boundedPred = Math.max(0, 0.7 * normPred + 0.3 * recentMomentum);
  return Math.max(0, boundedPred * mean);
}

/** Build forecasts for every item across all saved reports. */
export function buildForecast(
  reports: StoredReport[],
  method: ForecastMethod = 'ensemble',
  manualAdjustments: Record<string, number> = {},
): ForecastResult {
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
    const rawForecastQty = Math.round(value);

    // Check if user provided a manual adjustment override
    const hasManual = manualAdjustments[key] !== undefined && !Number.isNaN(manualAdjustments[key]);
    const forecastQty = hasManual ? Math.max(0, Math.round(manualAdjustments[key])) : rawForecastQty;
    const isManual = hasManual;

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
      originalForecastQty: rawForecastQty,
      isManual,
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
