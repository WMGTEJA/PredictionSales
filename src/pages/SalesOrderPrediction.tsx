import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Download,
  Edit2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { buildForecast, ForecastMethod, METHOD_INFO } from '../lib/forecast';
import { fmtCompact, fmtInt } from '../lib/format';
import { exportForecastToExcel } from '../lib/export';
import { Sparkline, TrendBadge } from '../components/ui';

export default function SalesOrderPrediction() {
  const { data, soManualAdjustments, setSoManualAdjustment, resetSoManualAdjustments } =
    useSalesData();
  const soReports = data.so.monthlyReports;

  const [method, setMethod] = useState<ForecastMethod>('ensemble');
  const [search, setSearch] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const forecast = useMemo(() => {
    if (!soReports || soReports.length === 0) return null;
    return buildForecast(soReports, method, soManualAdjustments);
  }, [soReports, method, soManualAdjustments]);

  const filteredItems = useMemo(() => {
    if (!forecast) return [];
    const q = search.toLowerCase().trim();
    if (!q) return forecast.items;
    return forecast.items.filter(
      (it) =>
        it.code.toLowerCase().includes(q) ||
        (it.desc && it.desc.toLowerCase().includes(q)) ||
        (it.stockGroup && it.stockGroup.toLowerCase().includes(q)),
    );
  }, [forecast, search]);

  const adjustedCount = useMemo(() => {
    return Object.keys(soManualAdjustments).length;
  }, [soManualAdjustments]);

  const handleStartEdit = (code: string, currentVal: number) => {
    setEditingCode(code);
    setEditValue(String(currentVal));
  };

  const handleSaveEdit = (code: string) => {
    const trimmed = editValue.trim();
    if (trimmed === '') {
      setSoManualAdjustment(code, null);
    } else {
      const parsed = parseInt(trimmed.replace(/,/g, ''), 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setSoManualAdjustment(code, parsed);
      }
    }
    setEditingCode(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCode(null);
    setEditValue('');
  };

  if (!forecast) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm font-bold text-[#37150f]">Preparing Sales Order Predictions…</div>
      </div>
    );
  }

  const octActual = forecast.totals.qtyHistory[forecast.totals.qtyHistory.length - 1] || 0;
  const novForecast = forecast.totals.forecastQty;
  const growthPct =
    octActual > 0 ? Math.round(((novForecast - octActual) / octActual) * 1000) / 10 : 0;

  return (
    <div className="space-y-4 pb-10">
      {/* Top Banner & Method Selector */}
      <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#c79754]/20 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#91171d] px-3 py-1 text-xs font-black text-[#f5d275]">
              <Sparkles className="size-3.5" />
              <span>Sales Order Forecast • November 2026</span>
            </div>
            <h2 className="mt-2 text-xl font-black text-[#37150f]">
              Predict Upcoming Order Demand
            </h2>
            <p className="text-xs font-bold text-[#37150f]/70">
              Based on full Jan–Oct ordering history across all products with auto-tuned ensemble modeling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Method Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[#37150f]">Model:</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ForecastMethod)}
                className="rounded-xl border border-[#c79754]/40 bg-[#fbf7f0] px-3 py-2 text-xs font-extrabold text-[#37150f] shadow-inner focus:outline-none focus:border-[#91171d]"
              >
                {(Object.keys(METHOD_INFO) as ForecastMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_INFO[m].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Excel Button */}
            <button
              onClick={() => exportForecastToExcel(forecast)}
              className="flex items-center gap-2 rounded-xl bg-[#37150f] hover:bg-[#91171d] px-4 py-2 text-xs font-extrabold text-[#f5d275] transition shadow-sm cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export Nov Excel</span>
            </button>
          </div>
        </div>

        {/* Prediction Summary KPI Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              Nov 2026 Predicted Orders
            </div>
            <div className="mt-1 text-2xl font-black text-[#91171d]">
              {fmtInt(novForecast)}{' '}
              <span className="text-xs font-bold text-[#c79754]">pcs</span>
            </div>
            <div className="text-[10px] font-bold text-[#37150f]/60">
              Spread: {fmtCompact(forecast.totals.low)} – {fmtCompact(forecast.totals.high)} pcs
            </div>
          </div>

          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              Oct 2026 Actual Orders
            </div>
            <div className="mt-1 text-2xl font-black text-[#37150f]">
              {fmtInt(octActual)} <span className="text-xs font-bold text-[#c79754]">pcs</span>
            </div>
            <div className="text-[10px] font-bold text-[#37150f]/60">Latest historical month</div>
          </div>

          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              Forecast vs Oct Trend
            </div>
            <div
              className={`mt-1 text-2xl font-black flex items-center gap-1 ${
                growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {growthPct >= 0 ? (
                <ArrowUpRight className="size-5" />
              ) : (
                <ArrowDownRight className="size-5" />
              )}
              <span>
                {growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`}
              </span>
            </div>
            <div className="text-[10px] font-bold text-[#37150f]/60">Expected monthly shift</div>
          </div>

          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              Products Forecasted
            </div>
            <div className="mt-1 text-2xl font-black text-[#37150f]">
              {forecast.items.length}{' '}
              <span className="text-xs font-bold text-[#c79754]">items</span>
            </div>
            <div className="text-[10px] font-bold text-[#37150f]/60">
              {adjustedCount > 0 ? `${adjustedCount} manual adjustments applied` : 'AI baseline values'}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#c79754]/20 pb-3">
          {/* Search Box */}
          <div className="relative min-w-[280px] sm:min-w-[340px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
            <input
              type="text"
              placeholder="Search product code or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#c79754]/40 bg-[#fbf7f0]/60 py-2 pl-9 pr-8 text-xs font-bold text-[#37150f] focus:border-[#91171d] focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-black"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Reset adjustments button */}
          {adjustedCount > 0 && (
            <button
              onClick={() => resetSoManualAdjustments()}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset {adjustedCount} manual adjustments</span>
            </button>
          )}
        </div>

        {/* Forecast Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#c79754]/30 bg-[#fbf7f0]/80 font-black text-[#37150f]">
                <th className="py-2.5 px-3">Item Code</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-center">10-Mo Trend</th>
                <th className="py-2.5 px-3 text-right">Oct Actual</th>
                <th className="py-2.5 px-3 text-right font-black text-[#91171d]">
                  Nov Predicted (pcs)
                </th>
                <th className="py-2.5 px-3 text-center">Trend</th>
                <th className="py-2.5 px-3 text-right">Pack Size</th>
                <th className="py-2.5 px-3 text-center">Manual Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c79754]/15 font-medium">
              {filteredItems.map((it) => {
                const isEditing = editingCode === it.code;
                return (
                  <tr
                    key={it.code}
                    className={`hover:bg-[#f5d275]/15 transition ${
                      it.isManual ? 'bg-amber-50/60' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-extrabold text-[#91171d]">{it.code}</td>
                    <td className="py-2.5 px-3 max-w-[240px] truncate text-[#37150f]">{it.desc}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-block">
                        <Sparkline history={it.qtyHistory} forecast={it.forecastQty} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#37150f]">
                      {fmtInt(it.lastQty)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <div className="font-black text-sm text-[#91171d]">
                        {fmtInt(it.forecastQty)}
                      </div>
                      <div className="text-[10px] text-[#37150f]/60 font-bold">
                        {fmtCompact(it.low)} – {fmtCompact(it.high)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <TrendBadge trend={it.trend} />
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#37150f]/70 font-bold">
                      {it.packSize ? `${it.packSize} pcs` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(it.code);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                            className="w-20 rounded border border-[#91171d] px-1.5 py-0.5 text-xs text-right font-black"
                          />
                          <button
                            onClick={() => handleSaveEdit(it.code)}
                            className="p-1 text-emerald-700 hover:text-emerald-900"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-500 hover:text-slate-800"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {it.isManual ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                              Adjusted
                            </span>
                          ) : null}
                          <button
                            onClick={() => handleStartEdit(it.code, it.forecastQty)}
                            className="p-1 text-[#37150f]/50 hover:text-[#91171d] cursor-pointer"
                            title="Edit / override predicted quantity"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
