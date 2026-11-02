import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus, PauseCircle, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Trend } from '../lib/forecast';

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = 'brand',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  accent?: 'brand' | 'emerald' | 'amber' | 'sky';
}) {
  const accents = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className={clsx('grid size-9 place-items-center rounded-xl', accents[accent])}>{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

const TREND_STYLE: Record<Trend, { cls: string; label: string; icon: ReactNode }> = {
  up: { cls: 'bg-emerald-50 text-emerald-700', label: 'Rising', icon: <ArrowUpRight className="size-3.5" /> },
  down: { cls: 'bg-rose-50 text-rose-700', label: 'Falling', icon: <ArrowDownRight className="size-3.5" /> },
  flat: { cls: 'bg-slate-100 text-slate-600', label: 'Steady', icon: <Minus className="size-3.5" /> },
  new: { cls: 'bg-sky-50 text-sky-700', label: 'New', icon: <Sparkles className="size-3.5" /> },
  stopped: { cls: 'bg-amber-50 text-amber-700', label: 'No sales', icon: <PauseCircle className="size-3.5" /> },
};

export function TrendBadge({ trend }: { trend: Trend }) {
  const s = TREND_STYLE[trend];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', s.cls)}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

export function ChangeText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  const pct = value * 100;
  const cls = pct > 0.5 ? 'text-emerald-600' : pct < -0.5 ? 'text-rose-600' : 'text-slate-500';
  return (
    <span className={clsx('font-medium tabular-nums', cls)}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

/** Tiny inline chart: history in slate, forecast point in emerald. */
export function Sparkline({ history, forecast }: { history: number[]; forecast: number }) {
  const values = [...history, forecast];
  const w = 84;
  const h = 26;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pt = (v: number, i: number) => [i * step, h - 3 - (v / max) * (h - 6)] as const;
  const hist = history.map((v, i) => pt(v, i));
  const f = pt(forecast, values.length - 1);
  const last = hist[hist.length - 1] ?? f;

  return (
    <svg width={w} height={h} className="overflow-visible">
      {hist.length > 1 && (
        <polyline
          points={hist.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <line x1={last[0]} y1={last[1]} x2={f[0]} y2={f[1]} stroke="#10b981" strokeWidth="1.75" strokeDasharray="3 2" />
      <circle cx={f[0]} cy={f[1]} r="2.75" fill="#10b981" />
    </svg>
  );
}
