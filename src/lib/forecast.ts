import type { StoredReport } from './types';
import { packSizeFromCode } from './packsize';

export type ForecastMethod = 'auto' | 'ensemble' | 'smart' | 'ann' | 'weighted' | 'average' | 'last';

export const METHOD_INFO: Record<ForecastMethod, { label: string; description: string }> = {
  auto: {
    label: 'Auto-Best Adaptive Model',
    description:
      'Automatically backtests Simple Exponential Smoothing, Damped-Trend Holt, Robust Median, Weighted Momentum, Croston-SBA (for intermittent SKUs), and Year-over-Year Seasonality (when 13+ months exist) per item, blending the lowest-error models.',
  },
  ensemble: {
    label: 'Best-Fit Adaptive Ensemble',
    description:
      'Auto-tuned supply chain model blending 3-month moving average, weighted momentum, outlier spike dampening, and dormant item detection.',
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

  /** 3-Month AI Predictions */
  novAi: number;
  decAi: number;
  janAi: number;

  /** 3-Month Director Target (+10% MoM compounded from Oct Actual) */
  novTarget: number;
  decTarget: number;
  janTarget: number;

  /** 3-Month Smart Decision Blend (Strategy A: Trend-weighted AI + Target) */
  novPlan: number;
  decPlan: number;
  janPlan: number;

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
  next3Periods: [string, string, string]; // [Nov, Dec, Jan]
  method: ForecastMethod;
  items: ItemForecast[];
  totals: {
    qtyHistory: number[];
    amountHistory: number[];
    novAiTotal: number;
    decAiTotal: number;
    janAiTotal: number;
    novTargetTotal: number;
    decTargetTotal: number;
    janTargetTotal: number;
    novPlanTotal: number;
    decPlanTotal: number;
    janPlanTotal: number;
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
    case 'auto':
      value = forecastAutoBest(y);
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

/** Simple Exponential Smoothing (SES) — ideal for stable or noisy demand without a strong trend. */
function forecastSES(y: number[], alpha = 0.30): number {
  const n = y.length;
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, y[0]);

  let level = y[0];
  for (let i = 1; i < n; i++) {
    level = alpha * y[i] + (1 - alpha) * level;
  }
  return Math.max(0, level);
}

/** Robust Median / Trimmed Baseline — resists sudden one-off bulk spikes and troughs. */
function forecastRobustMedian(y: number[]): number {
  const n = y.length;
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, y[0]);

  const medianOf = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  };

  const recent6 = y.slice(-6);
  const medRecent = medianOf(recent6);
  const medAll = medianOf(y);
  return Math.max(0, 0.7 * medRecent + 0.3 * medAll);
}

/** Damped-Trend Holt's Exponential Smoothing (Gardner-McKenzie) with robust initialization. */
function forecastDampedHolt(y: number[]): number {
  const n = y.length;
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, y[0]);

  const alpha = 0.35;
  const beta = 0.15;
  const phi = 0.80;

  let level = (y[0] + y[1]) / 2;
  const rawSlope = y[1] - y[0];
  const maxInitTrend = Math.max(level * 0.5, 1);
  let trend = Math.max(-maxInitTrend, Math.min(maxInitTrend, rawSlope * 0.5));

  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    const prevTrend = trend;
    level = alpha * y[i] + (1 - alpha) * (prevLevel + phi * prevTrend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * prevTrend;
  }

  return Math.max(0, level + phi * trend);
}

/**
 * Year-over-Year Seasonal Adjusted Forecast (requires >= 13 months).
 * Uses the same calendar month last year (and 2 years ago if available),
 * scaled by the item's recent 3-month YoY growth rate.
 */
function forecastSeasonalYoY(y: number[]): number {
  const n = y.length;
  if (n < 13) return forecastSES(y);

  const sameLastYr = y[n - 12];
  const seasonalBase = n >= 24 ? 0.65 * sameLastYr + 0.35 * y[n - 24] : sameLastYr;

  // Recent 3-month YoY growth factor (clamped to avoid extreme distortion)
  const recentWin = Math.min(3, n - 12);
  let recentSum = 0;
  let prevYrSum = 0;
  for (let i = 1; i <= recentWin; i++) {
    recentSum += y[n - i];
    prevYrSum += y[n - 12 - i];
  }
  const growthFactor =
    prevYrSum > 0 ? Math.max(0.5, Math.min(1.8, recentSum / prevYrSum)) : 1;

  const seasonalPred = seasonalBase * growthFactor;
  const recentLevel = forecastSES(y, 0.3);
  return Math.max(0, 0.75 * seasonalPred + 0.25 * recentLevel);
}

/** Croston / Syntetos-Boylan Approximation (SBA) for intermittent demand. */
function forecastCrostonSBA(y: number[]): number {
  const alpha = 0.25;
  let z: number | null = null;
  let p: number | null = null;
  let interval = 1;

  for (const val of y) {
    if (val > 0) {
      if (z === null || p === null) {
        z = val;
        p = interval;
      } else {
        z = alpha * val + (1 - alpha) * z;
        p = alpha * interval + (1 - alpha) * p;
      }
      interval = 1;
    } else {
      interval += 1;
    }
  }

  if (z === null || p === null || p <= 0) return 0;
  return Math.max(0, (1 - alpha / 2) * (z / p));
}

/** Weighted momentum with outlier spike dampener. */
function forecastWeightedMomentum(y: number[]): number {
  const n = y.length;
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, y[0]);

  const s3 = y.slice(-3);
  const ma3 = s3.reduce((a, b) => a + b, 0) / s3.length;

  const s4 = y.slice(-4);
  const weights = [1, 2, 3, 4].slice(4 - s4.length);
  const sumW = weights.reduce((a, b) => a + b, 0);
  let blended = s4.reduce((acc, v, i) => acc + v * weights[i], 0) / sumW;
  blended = 0.55 * blended + 0.45 * ma3;

  if (n >= 4) {
    const prev3 = y.slice(-4, -1);
    const med3 = [...prev3].sort((a, b) => a - b)[1];
    if (med3 > 0 && y[n - 1] > 2.3 * med3) {
      blended = 0.65 * blended + 0.35 * med3;
    }
  }
  return Math.max(0, blended);
}

type ForecastCandidate = {
  fn: (series: number[]) => number;
  minHistory: number;
};

type SelectedModelBlend = Array<{ fn: (series: number[]) => number; weight: number }>;

/** Adaptive Ensemble candidate (smart trend + 3-mo MA + 4-mo WMA + outlier dampener + intermittent decay). */
function forecastEnsembleCandidate(y: number[]): number {
  const n = y.length;
  if (n === 0) return 0;
  if (n === 1) return Math.max(0, y[0]);
  const last = y[n - 1];

  if (n >= 3 && y[n - 1] === 0 && y[n - 2] === 0) return 0;

  const zeroCount = y.filter((v) => v === 0).length;
  if (zeroCount / n >= 0.4 && last === 0) {
    const nonZeros = y.filter((v) => v > 0);
    const avgNZ = nonZeros.reduce((a, b) => a + b, 0) / nonZeros.length;
    const prob = (n - zeroCount) / n;
    return Math.max(0, prob * 0.4 * avgNZ);
  }

  const mean = y.reduce((s, v) => s + v, 0) / n;
  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  y.forEach((v, x) => {
    num += (x - xMean) * (v - mean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const weighted =
    y.reduce((s, v, i) => s + v * (i + 1), 0) / y.reduce((s, _v, i) => s + (i + 1), 0);

  const trendValue = Math.max(0, mean + slope * (n - xMean));
  const trendWeight = n >= 3 ? 0.4 : 0.25;
  const smartValue = (1 - trendWeight) * weighted + trendWeight * trendValue;

  const s3 = y.slice(-3);
  const ma3 = s3.reduce((a, b) => a + b, 0) / s3.length;

  const s4 = y.slice(-4);
  const weights = [1, 2, 3, 4].slice(4 - s4.length);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const wma4 = s4.reduce((acc, v, i) => acc + v * weights[i], 0) / sumW;

  let blended = 0.5 * smartValue + 0.3 * ma3 + 0.2 * wma4;

  if (n >= 4) {
    const prev3 = y.slice(-4, -1);
    const med3 = [...prev3].sort((a, b) => a - b)[1];
    if (med3 > 0 && last > 2.3 * med3) {
      blended = 0.65 * blended + 0.35 * med3;
    }
  }
  return Math.max(0, blended);
}

/**
 * Selects the best 1–2 forecasting models for an item's real historical series
 * using recency-weighted rolling 1-step backtesting across up to 4 recent months.
 */
function selectAutoBestModels(y: number[]): SelectedModelBlend | null {
  const n = y.length;
  if (n === 0) return null;
  if (n === 1) return [{ fn: (s) => Math.max(0, s[s.length - 1] ?? 0), weight: 1 }];

  // Dormant item: 0 sales in last 2 consecutive months
  if (n >= 3 && y[n - 1] === 0 && y[n - 2] === 0) {
    return [{ fn: () => 0, weight: 1 }];
  }

  if (n < 4) {
    return [{ fn: forecastWeightedMomentum, weight: 1 }];
  }

  const zeroRatio = y.filter((v) => v === 0).length / n;

  // Intermittent SKU that had zero sales last month: use specialized intermittent models only
  // so smooth/momentum models don't over-predict sporadic items.
  if (zeroRatio >= 0.4 && y[n - 1] === 0) {
    return [{ fn: forecastEnsembleCandidate, weight: 1 }];
  }

  const candidates: ForecastCandidate[] = [
    { fn: forecastEnsembleCandidate, minHistory: 2 },
    { fn: forecastSES, minHistory: 2 },
    { fn: forecastDampedHolt, minHistory: 2 },
    { fn: forecastRobustMedian, minHistory: 2 },
    { fn: forecastWeightedMomentum, minHistory: 2 },
  ];
  if (zeroRatio >= 0.25) {
    candidates.push({ fn: forecastCrostonSBA, minHistory: 2 });
  }
  if (n >= 15) {
    candidates.push({ fn: forecastSeasonalYoY, minHistory: 13 });
  }

  const evalCount = Math.min(6, n - 2);
  const scored: Array<{ fn: (series: number[]) => number; wMae: number }> = [];

  for (const cand of candidates) {
    let errSum = 0;
    let weightSum = 0;
    const startIdx = n - evalCount;
    for (let k = startIdx; k < n; k++) {
      if (k < cand.minHistory) continue;
      const recencyWeight = k - startIdx + 1;
      const pred = cand.fn(y.slice(0, k));
      errSum += recencyWeight * Math.abs(y[k] - pred);
      weightSum += recencyWeight;
    }
    if (weightSum > 0) {
      scored.push({ fn: cand.fn, wMae: errSum / weightSum });
    }
  }

  if (scored.length === 0) {
    return [{ fn: forecastWeightedMomentum, weight: 1 }];
  }

  // Smooth inverse-squared-error ensemble across all eligible candidates.
  // A gentle floor prevents overfitting to a tiny 3–6 month validation window while
  // still giving dominant weight to whichever model clearly matches the item's pattern.
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  const floor = Math.max(1, 0.05 * meanY);
  const rawWeights = scored.map((s) => 1 / (s.wMae + floor) ** 2);
  const totalW = rawWeights.reduce((a, b) => a + b, 0);

  return scored.map((s, idx) => ({
    fn: s.fn,
    weight: rawWeights[idx] / totalW,
  }));
}

function evalModelBlend(blend: SelectedModelBlend | null, series: number[]): number {
  if (!blend || blend.length === 0) return 0;
  let sum = 0;
  for (const { fn, weight } of blend) {
    sum += weight * fn(series);
  }
  return Math.max(0, sum);
}

/**
 * Per-SKU Auto-Best Model:
 * Evaluates candidate models via recency-weighted rolling 1-step backtesting
 * and blends the top 1–2 lowest-error forecasts for this item's demand pattern.
 */
function forecastAutoBest(y: number[]): number {
  const blend = selectAutoBestModels(y);
  return evalModelBlend(blend, y);
}

/** Expand a continuous list of YYYY-MM periods from start to end (inclusive). */
function expandPeriodRange(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const result: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 240) {
    result.push(cur);
    if (cur === end) break;
    cur = nextMonth(cur);
    guard++;
  }
  return result;
}

/** Build forecasts for every item across all saved reports. */
export function buildForecast(
  reports: StoredReport[],
  method: ForecastMethod = 'auto',
  manualAdjustments: Record<string, number> = {},
): ForecastResult {
  const sorted = [...reports].sort((a, b) => a.period.localeCompare(b.period));
  // Ensure a continuous monthly timeline (fills any missing middle months with 0)
  // so seasonality (lag-12) and dormancy checks are always aligned to real calendar months.
  const periods =
    sorted.length >= 2
      ? expandPeriodRange(sorted[0].period, sorted[sorted.length - 1].period)
      : sorted.map((r) => r.period);
  const periodToIdx = new Map<string, number>();
  periods.forEach((p, idx) => periodToIdx.set(p, idx));

  const nextPeriod = periods.length ? nextMonth(periods[periods.length - 1]) : null;
  const p2 = nextPeriod ? nextMonth(nextPeriod) : null;
  const p3 = p2 ? nextMonth(p2) : null;
  const next3Periods: [string, string, string] = [
    nextPeriod ?? '2026-11',
    p2 ?? '2026-12',
    p3 ?? '2027-01',
  ];

  // Collect qty / amount per item per period.
  const byItem = new Map<
    string,
    { code: string; desc?: string; stockGroup?: string; qty: number[]; amount: number[] }
  >();
  for (const report of sorted) {
    const p = periodToIdx.get(report.period);
    if (p === undefined) continue;
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
  }

  const items: ItemForecast[] = [];
  for (const [key, e] of byItem) {
    const lastQty = e.qty[e.qty.length - 1] ?? 0;

    // 1. Month 1 (Nov) AI Forecast
    const firstActive = e.qty.findIndex((v) => v > 0);
    const activeSeries = firstActive >= 0 ? e.qty.slice(firstActive) : [];
    const autoBlend = method === 'auto' ? selectAutoBestModels(activeSeries) : null;

    const { value: novVal, spread, relativeSlope } = forecastSeries(e.qty, method);
    const rawForecastQty = Math.max(0, Math.round(novVal));

    // Check if user provided a manual adjustment override for Nov
    const hasManual = manualAdjustments[key] !== undefined && !Number.isNaN(manualAdjustments[key]);
    const novAi = hasManual ? Math.max(0, Math.round(manualAdjustments[key])) : rawForecastQty;
    const isManual = hasManual;

    // 2. Month 2 (Dec) & Month 3 (Jan) AI Forecasts
    // For 'auto', reuse the winning model blend chosen on REAL history so we never
    // backtest against synthetic predictions or manual overrides.
    let decAi: number;
    let janAi: number;
    if (method === 'auto') {
      const decVal = evalModelBlend(autoBlend, [...activeSeries, novAi]);
      decAi = Math.max(0, Math.round(decVal));
      const janVal = evalModelBlend(autoBlend, [...activeSeries, novAi, decAi]);
      janAi = Math.max(0, Math.round(janVal));
    } else {
      const seriesWithNov = [...e.qty, novAi];
      const { value: decVal } = forecastSeries(seriesWithNov, method);
      decAi = Math.max(0, Math.round(decVal));

      const seriesWithDec = [...seriesWithNov, decAi];
      const { value: janVal } = forecastSeries(seriesWithDec, method);
      janAi = Math.max(0, Math.round(janVal));
    }

    // 4. Director Target (+10% MoM increase based on Oct Actual)
    // Nov Target: based on Oct Actual + 10%. If Oct was 0, fall back to Nov AI + 10%
    const novTarget = lastQty > 0 ? Math.round(lastQty * 1.10) : (novAi > 0 ? Math.round(novAi * 1.10) : 0);
    // Dec Target: based on Nov Target + 10%
    const decTarget = novTarget > 0 ? Math.round(novTarget * 1.10) : 0;
    // Jan Target: based on Dec Target + 10%
    const janTarget = decTarget > 0 ? Math.round(decTarget * 1.10) : 0;

    const forecastQty = novAi;

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

    // 5. Strategy A Decision Blend (Trend-guided blend of AI and Target):
    // - Up: 70% Target + 30% AI (growth momentum justifies chasing target)
    // - Flat / New: 50% Target + 50% AI (balanced operational forecast)
    // - Down / Stopped: 100% AI (protects from overstocking falling or dead stock)
    let targetWeight = 0.5;
    if (trend === 'up') {
      targetWeight = 0.7;
    } else if (trend === 'down' || trend === 'stopped') {
      targetWeight = 0;
    } else {
      targetWeight = 0.5;
    }

    const novPlan = Math.max(0, Math.round(targetWeight * novTarget + (1 - targetWeight) * novAi));
    const decPlan = Math.max(0, Math.round(targetWeight * decTarget + (1 - targetWeight) * decAi));
    const janPlan = Math.max(0, Math.round(targetWeight * janTarget + (1 - targetWeight) * janAi));

    items.push({
      key,
      code: e.code,
      desc: e.desc,
      stockGroup: e.stockGroup,
      qtyHistory: e.qty,
      amountHistory: e.amount.map((a) => Math.round(a * 100) / 100),
      lastQty,
      novAi,
      decAi,
      janAi,
      novTarget,
      decTarget,
      janTarget,
      novPlan,
      decPlan,
      janPlan,
      forecastQty,
      originalForecastQty: rawForecastQty,
      isManual,
      low: Math.max(0, Math.round(novVal - spread)),
      high: Math.round(novVal + spread),
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
    novAiTotal: sum(items.map((it) => it.novAi)),
    decAiTotal: sum(items.map((it) => it.decAi)),
    janAiTotal: sum(items.map((it) => it.janAi)),
    novTargetTotal: sum(items.map((it) => it.novTarget)),
    decTargetTotal: sum(items.map((it) => it.decTarget)),
    janTargetTotal: sum(items.map((it) => it.janTarget)),
    novPlanTotal: sum(items.map((it) => it.novPlan)),
    decPlanTotal: sum(items.map((it) => it.decPlan)),
    janPlanTotal: sum(items.map((it) => it.janPlan)),
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

  return { periods, nextPeriod, next3Periods, method, items, totals, backtest };
}
