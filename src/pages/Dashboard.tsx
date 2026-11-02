import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Calendar,
  Flame,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { buildForecast } from '../lib/forecast';
import { fmtCompact, fmtInt, periodLabel, periodShort } from '../lib/format';

export default function Dashboard() {
  const { reports, loading, syncing, syncNow, manualAdjustments } = useReports();

  const forecast = useMemo(() => {
    if (reports.length === 0) return null;
    return buildForecast(reports, 'ensemble', manualAdjustments);
  }, [reports, manualAdjustments]);

  if (loading && reports.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border-2 border-[#c79754]/30 bg-white px-6 py-3.5 text-[#37150f] shadow-sm">
          <RefreshCw className="size-5 animate-spin text-[#91171d]" />
          <span className="text-sm font-bold">Loading sales data…</span>
        </div>
      </div>
    );
  }

  if (!forecast || reports.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[#c79754]/40 bg-white p-10 text-center">
        <div className="mb-3 grid size-14 place-items-center rounded-full bg-[#f5d275]/30 text-[#91171d]">
          <Package className="size-7" />
        </div>
        <h2 className="text-lg font-extrabold text-[#37150f]">No Data Found</h2>
        <button
          onClick={() => syncNow()}
          disabled={syncing}
          className="mt-4 flex items-center gap-2 rounded-full bg-[#91171d] px-6 py-2.5 text-xs font-extrabold text-[#f5d275] shadow-sm hover:bg-[#be3937] transition cursor-pointer"
        >
          <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Sheet'}
        </button>
      </div>
    );
  }

  const periods = forecast.periods;
  const firstPeriod = periods[0] ? periodShort(periods[0]) : 'Jan';
  const lastPeriod = periods[periods.length - 1] ? periodShort(periods[periods.length - 1]) : 'Oct';
  const nextShort = forecast.nextPeriod ? periodShort(forecast.nextPeriod) : 'Nov';
  const nextLabel = forecast.nextPeriod ? periodLabel(forecast.nextPeriod, true) : 'November 2026';

  const unitSuffix = 'pcs';

  const totalVolume = forecast.totals.qtyHistory.reduce((s, v) => s + v, 0);
  const avgMonthlyVolume = Math.round(totalVolume / (periods.length || 1));

  let peakIndex = 0;
  let peakValue = 0;
  forecast.totals.qtyHistory.forEach((val, idx) => {
    if (val > peakValue) {
      peakValue = val;
      peakIndex = idx;
    }
  });
  const peakPeriodLabel = periods[peakIndex] ? periodShort(periods[peakIndex]) : '-';

  const lastActual = forecast.totals.qtyHistory[forecast.totals.qtyHistory.length - 1] ?? 0;

  // Build unified Jan-Oct + Nov chart series so the trend line flows cleanly across all months
  const chartData = [
    ...periods.map((p, i) => {
      const val = forecast.totals.qtyHistory[i];
      const isLast = i === periods.length - 1;
      return {
        period: periodShort(p),
        fullPeriod: periodLabel(p, true),
        actualBar: val,
        forecastBar: null as number | null,
        trendLine: val,
        forecastBridge: isLast ? val : (null as number | null),
        rawQty: forecast.totals.qtyHistory[i],
        isForecast: false,
      };
    }),
    {
      period: `${nextShort} ★`,
      fullPeriod: `${nextLabel} (Prediction)`,
      actualBar: null as number | null,
      forecastBar: forecast.totals.forecastQty,
      trendLine: null as number | null,
      forecastBridge: forecast.totals.forecastQty,
      rawQty: forecast.totals.forecastQty,
      isForecast: true,
    },
  ];

  // Ensure second-to-last point connects to the forecast point via forecastBridge
  if (chartData.length >= 2) {
    chartData[chartData.length - 2].forecastBridge = lastActual;
  }

  return (
    <div className="flex h-full w-full flex-col gap-3.5 overflow-hidden">
      {/* Top Row: 4 Clean Bubbly KPI Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* 1. Total Jan-Oct */}
        <div className="flex items-center justify-between rounded-[24px] border-2 border-[#c79754]/30 bg-white px-5 py-3.5 shadow-xs">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#c79754]">
              {firstPeriod} – {lastPeriod} Total
            </div>
            <div className="mt-0.5 text-2xl font-black tracking-tight text-[#37150f] tabular-nums">
              {fmtCompact(totalVolume)}{' '}
              <span className="text-xs font-bold text-[#c79754]">{unitSuffix}</span>
            </div>
          </div>
          <div className="grid size-11 place-items-center rounded-2xl bg-[#f5d275]/35 text-[#91171d]">
            <Package className="size-5 stroke-[2.2]" />
          </div>
        </div>

        {/* 2. Monthly Average */}
        <div className="flex items-center justify-between rounded-[24px] border-2 border-[#c79754]/30 bg-white px-5 py-3.5 shadow-xs">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#959242]">
              Monthly Avg
            </div>
            <div className="mt-0.5 text-2xl font-black tracking-tight text-[#37150f] tabular-nums">
              {fmtCompact(avgMonthlyVolume)}{' '}
              <span className="text-xs font-bold text-[#959242]">{unitSuffix}</span>
            </div>
          </div>
          <div className="grid size-11 place-items-center rounded-2xl bg-[#959242]/15 text-[#959242]">
            <Calendar className="size-5 stroke-[2.2]" />
          </div>
        </div>

        {/* 3. Peak Month */}
        <div className="flex items-center justify-between rounded-[24px] border-2 border-[#c79754]/30 bg-white px-5 py-3.5 shadow-xs">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#d47837]">
              Peak ({peakPeriodLabel})
            </div>
            <div className="mt-0.5 text-2xl font-black tracking-tight text-[#37150f] tabular-nums">
              {fmtCompact(peakValue)}{' '}
              <span className="text-xs font-bold text-[#d47837]">{unitSuffix}</span>
            </div>
          </div>
          <div className="grid size-11 place-items-center rounded-2xl bg-[#d47837]/15 text-[#d47837]">
            <Flame className="size-5 stroke-[2.2]" />
          </div>
        </div>

        {/* 4. Predicted Nov */}
        <div className="flex items-center justify-between rounded-[24px] border-2 border-[#91171d] bg-gradient-to-r from-[#91171d] via-[#be3937] to-[#d47837] px-5 py-3.5 text-white shadow-md shadow-[#91171d]/20">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#f5d275]">
              {nextShort} Prediction
            </div>
            <div className="mt-0.5 text-2xl font-black tracking-tight text-white tabular-nums">
              {fmtCompact(forecast.totals.forecastQty)}{' '}
              <span className="text-xs font-bold text-[#f5d275]">{unitSuffix}</span>
            </div>
          </div>
          <div className="grid size-11 place-items-center rounded-2xl bg-[#f5d275]/20 text-[#f5d275]">
            <TrendingUp className="size-5 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Main Trend Graph Card (Fills Remaining Viewport Height) */}
      <div className="flex flex-1 min-h-0 flex-col justify-between rounded-[28px] border-2 border-[#c79754]/35 bg-white p-5 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#37150f]">
              Monthly Sales Trend
            </h1>
            <span className="rounded-full bg-[#f5d275]/40 px-3 py-1 text-xs font-extrabold text-[#37150f]">
              {firstPeriod} – {lastPeriod} + {nextShort} Forecast
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-xs font-bold text-[#37150f]">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#c79754]" />
                Jan – Oct Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#91171d]" />
                Trend Line
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#d47837]" />
                {nextShort} Prediction
              </span>
            </div>

            <Link
              to="/predictions"
              className="flex items-center gap-2 rounded-full bg-[#91171d] hover:bg-[#be3937] px-4 py-2 text-xs font-extrabold text-[#f5d275] shadow-xs transition"
            >
              <Sparkles className="size-3.5" />
              <span>13-Col Predictions</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Chart Area (Flexible Height, No Scroll) */}
        <div className="flex-1 min-h-0 w-full py-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 14, right: 18, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5d275" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f5d275" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f2e8d5" vertical={false} />
              <XAxis
                dataKey="period"
                stroke="#37150f"
                fontSize={12}
                fontWeight={700}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#c79754"
                fontSize={12}
                fontWeight={700}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => fmtCompact(val)}
              />
              <Tooltip
                cursor={{ fill: '#fbf7f0' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-2xl border-2 border-[#c79754]/40 bg-[#37150f] px-4 py-2.5 text-xs text-white shadow-lg">
                      <div className="font-extrabold text-[#f5d275]">{d.fullPeriod}</div>
                      <div className="mt-1 font-mono text-sm font-black text-white">
                        {fmtInt(d.rawQty)} {unitSuffix}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="trendLine"
                fill="url(#trendAreaGrad)"
                stroke="none"
              />
              <Bar
                dataKey="actualBar"
                fill="#c79754"
                fillOpacity={0.45}
                radius={[10, 10, 0, 0]}
                maxBarSize={42}
              />
              <Bar
                dataKey="forecastBar"
                fill="#d47837"
                radius={[10, 10, 0, 0]}
                maxBarSize={42}
              />
              <Line
                type="monotone"
                dataKey="trendLine"
                stroke="#91171d"
                strokeWidth={3.5}
                dot={{ r: 4.5, fill: '#91171d', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#be3937' }}
              />
              <Line
                type="monotone"
                dataKey="forecastBridge"
                stroke="#d47837"
                strokeWidth={3.5}
                strokeDasharray="6 4"
                dot={{ r: 5.5, fill: '#d47837', stroke: '#37150f', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom 11-Pill Strip (Jan-Oct + Nov Prediction) */}
        <div className="grid shrink-0 grid-cols-11 gap-1.5 border-t border-[#c79754]/25 pt-3">
          {periods.map((p, idx) => {
            const qty = forecast.totals.qtyHistory[idx];
            const isPeak = idx === peakIndex;
            return (
              <div
                key={p}
                className={`flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-center transition ${
                  isPeak
                    ? 'bg-[#d47837]/15 border border-[#d47837]/50 text-[#37150f]'
                    : 'bg-[#fbf7f0] border border-[#c79754]/20 text-[#37150f]'
                }`}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#91171d]">
                  {periodShort(p)}
                </span>
                <span className="mt-0.5 text-xs font-black tabular-nums">
                  {fmtCompact(qty)}
                </span>
              </div>
            );
          })}

          {/* Nov Predicted Pill */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#91171d] to-[#be3937] py-2 px-1 text-center text-white shadow-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f5d275]">
              {nextShort} ★
            </span>
            <span className="mt-0.5 text-xs font-black tabular-nums text-white">
              {fmtCompact(forecast.totals.forecastQty)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
