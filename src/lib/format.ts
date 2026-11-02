const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-07" → "Jul 2026" */
export function periodLabel(period: string, long = false): string {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

/** "2026-07" → "Jul" */
export function periodShort(period: string): string {
  const [, m] = period.split('-').map(Number);
  return MONTHS[m - 1];
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-MY');

export const fmtRM = (n: number, digits = 0) =>
  `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function fmtCompactRM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `RM ${(n / 1_000).toFixed(1)}k`;
  return `RM ${n.toFixed(0)}`;
}

export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return fmtInt(n);
}

export function fmtPct(fraction: number | null, withSign = true): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  const sign = withSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export const displayCode = (code: string) => (code === '' ? '(no code)' : code);
