const fs = require('fs');

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

const MONTH_ORDER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'];
const PERIODS = MONTH_ORDER.map((m, idx) => `2026-${String(idx + 1).padStart(2, '0')}`);

// Collect data per item
const items = new Map();

for (let i = 1; i < lines.length; i++) {
  const [stockGroup, itemCode, itemDesc, month, qtyStr] = parseCSVLine(lines[i]);
  if (!itemCode || !month) continue;

  const mIndex = MONTH_ORDER.indexOf(month.toUpperCase().trim());
  if (mIndex < 0) continue;

  const qty = parseFloat((qtyStr || '0').replace(/,/g, '')) || 0;
  const code = itemCode.trim();

  if (!items.has(code)) {
    items.set(code, {
      code,
      desc: itemDesc ? itemDesc.trim() : '',
      stockGroup: stockGroup ? stockGroup.trim() : '',
      qtyHistory: Array(10).fill(0),
    });
  }
  const it = items.get(code);
  it.qtyHistory[mIndex] += qty;
  if (!it.desc && itemDesc) it.desc = itemDesc.trim();
  if (!it.stockGroup && stockGroup) it.stockGroup = stockGroup.trim();
}

function forecastSeries(series, method = 'smart') {
  const first = series.findIndex((v) => v > 0);
  if (first < 0) return { value: 0, spread: 0, relativeSlope: 0 };
  const y = series.slice(first);
  const n = y.length;
  const last = y[n - 1];

  const mean = y.reduce((s, v) => s + v, 0) / n;
  const spread = n > 1 ? Math.sqrt(y.reduce((s, v) => s + (v - mean) ** 2, 0) / n) : 0;

  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  y.forEach((v, x) => {
    num += (x - xMean) * (v - mean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const relativeSlope = mean > 0 ? slope / mean : 0;

  const recent = y.slice(-3);
  const weighted =
    recent.reduce((s, v, i) => s + v * (i + 1), 0) / recent.reduce((s, _v, i) => s + (i + 1), 0);

  let value;
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
      const trendValue = Math.max(0, mean + slope * (n - xMean));
      const trendWeight = n >= 3 ? 0.5 : 0.3;
      value = (1 - trendWeight) * weighted + trendWeight * trendValue;
    }
  }

  return { value: Math.max(0, value), spread, relativeSlope };
}

let totalNovForecast = 0;
let totalOctActual = 0;
const results = [];

for (const it of items.values()) {
  const fc = forecastSeries(it.qtyHistory, 'smart');
  const forecastQty = Math.round(fc.value);
  totalNovForecast += forecastQty;
  totalOctActual += it.qtyHistory[9];
  results.push({
    code: it.code,
    desc: it.desc,
    stockGroup: it.stockGroup,
    octActual: it.qtyHistory[9],
    novForecast: forecastQty,
    low: Math.max(0, Math.round(fc.value - fc.spread)),
    high: Math.round(fc.value + fc.spread),
  });
}

results.sort((a, b) => b.novForecast - a.novForecast);

console.log('Total Actual Oct Qty:', totalOctActual.toLocaleString());
console.log('Total Predicted Nov Qty (smart method):', totalNovForecast.toLocaleString());
console.log('\nTop 10 predicted items for November:');
console.table(results.slice(0, 10));
