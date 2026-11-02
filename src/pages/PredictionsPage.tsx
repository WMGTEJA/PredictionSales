import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Download,
  Edit2,
  Minus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { buildForecast, type Trend } from '../lib/forecast';
import { displayCode, fmtInt, periodShort } from '../lib/format';
import { exportForecastToExcel } from '../lib/export';

const TEN_MONTHS = [
  { period: '2026-01', label: 'Jan' },
  { period: '2026-02', label: 'Feb' },
  { period: '2026-03', label: 'Mar' },
  { period: '2026-04', label: 'Apr' },
  { period: '2026-05', label: 'May' },
  { period: '2026-06', label: 'Jun' },
  { period: '2026-07', label: 'Jul' },
  { period: '2026-08', label: 'Aug' },
  { period: '2026-09', label: 'Sep' },
  { period: '2026-10', label: 'Oct' },
];

export default function PredictionsPage() {
  const { reports, manualAdjustments, setManualAdjustment, resetManualAdjustments } = useReports();
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const forecast = useMemo(() => {
    if (reports.length === 0) return null;
    return buildForecast(reports, 'ensemble', manualAdjustments);
  }, [reports, manualAdjustments]);

  const stockGroups = useMemo(() => {
    if (!forecast) return [];
    const set = new Set<string>();
    forecast.items.forEach((it) => {
      if (it.stockGroup) set.add(it.stockGroup);
    });
    return Array.from(set).sort();
  }, [forecast]);

  const filteredItems = useMemo(() => {
    if (!forecast) return [];
    const q = search.toLowerCase().trim();
    return forecast.items.filter((item) => {
      const matchSearch =
        !q ||
        item.code.toLowerCase().includes(q) ||
        (item.desc && item.desc.toLowerCase().includes(q)) ||
        (item.stockGroup && item.stockGroup.toLowerCase().includes(q));
      const matchGroup = selectedGroup === 'all' || item.stockGroup === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [forecast, search, selectedGroup]);

  const adjustedCount = useMemo(() => {
    return Object.keys(manualAdjustments).length;
  }, [manualAdjustments]);

  const handleStartEdit = (code: string, currentVal: number) => {
    setEditingCode(code);
    setEditValue(String(currentVal));
  };

  const handleSaveEdit = (code: string) => {
    const trimmed = editValue.trim();
    if (trimmed === '') {
      setManualAdjustment(code, null);
    } else {
      const parsed = parseInt(trimmed.replace(/,/g, ''), 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setManualAdjustment(code, parsed);
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
      <div className="flex h-full items-center justify-center">
        <div className="text-sm font-bold text-[#37150f]">Loading predictions…</div>
      </div>
    );
  }

  const nextShort = forecast.nextPeriod ? periodShort(forecast.nextPeriod) : 'Nov';

  // Map period index for each of the 10 months (Jan to Oct)
  const periodIndexMap = new Map<string, number>();
  forecast.periods.forEach((p, idx) => periodIndexMap.set(p, idx));

  // Column totals for filtered items across Jan-Oct + Prediction in Pieces
  const monthTotals = TEN_MONTHS.map((m) => {
    const pIdx = periodIndexMap.get(m.period);
    if (pIdx === undefined) return 0;
    return filteredItems.reduce((sum, item) => sum + (item.qtyHistory[pIdx] ?? 0), 0);
  });

  const totalPredicted = filteredItems.reduce(
    (sum, item) => sum + item.forecastQty,
    0,
  );

  const renderTrendDot = (trend: Trend) => {
    if (trend === 'up' || trend === 'new') {
      return (
        <span title="Rising trend" className="inline-flex">
          <ArrowUpRight className="size-3.5 shrink-0 text-[#959242]" />
        </span>
      );
    }
    if (trend === 'down' || trend === 'stopped') {
      return (
        <span title="Falling trend" className="inline-flex">
          <ArrowDownRight className="size-3.5 shrink-0 text-[#be3937]" />
        </span>
      );
    }
    return (
      <span title="Steady trend" className="inline-flex">
        <Minus className="size-3 shrink-0 text-[#c79754]" />
      </span>
    );
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden">
      {/* Top Bubbly Filter & Search Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[24px] border-2 border-[#c79754]/35 bg-white px-4 py-2.5 shadow-xs">
        {/* Left: Search & Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-[#c79754]" />
            <input
              type="text"
              placeholder="Search item code or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-2 border-[#c79754]/30 bg-[#fbf7f0] py-1.5 pl-9 pr-8 text-xs font-bold text-[#37150f] placeholder-[#c79754] focus:border-[#91171d] focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 rounded-full p-0.5 text-[#c79754] hover:text-[#91171d] cursor-pointer"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Stock Group Filter */}
          {stockGroups.length > 0 && (
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="rounded-full border-2 border-[#c79754]/30 bg-[#fbf7f0] px-3.5 py-1.5 text-xs font-extrabold text-[#37150f] hover:border-[#91171d] focus:border-[#91171d] focus:outline-none cursor-pointer"
            >
              <option value="all">All Groups ({stockGroups.length})</option>
              {stockGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}

          {/* Single Best-Fit Model Badge */}
          <div
            className="flex items-center gap-1.5 rounded-full border-2 border-[#c79754]/30 bg-[#fbf7f0] px-3.5 py-1.5 shadow-xs select-none"
            title="Best-Fit Adaptive Ensemble: Automatically balances 3-month moving average, weighted momentum, outlier spike dampening, and dormant detection."
          >
            <Sparkles className="size-3.5 text-[#91171d]" />
            <span className="text-xs font-black text-[#37150f]">
              Best-Fit Adaptive Ensemble
            </span>
          </div>

          {/* Reset All Manual Adjustments Pill if any exist */}
          {adjustedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Reset all ${adjustedCount} custom adjustments back to AI predictions?`)) {
                  resetManualAdjustments();
                }
              }}
              className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer shadow-xs"
              title="Reset all custom adjustments back to AI predictions"
            >
              <span>{adjustedCount} Adjusted</span>
              <RotateCcw className="size-3 text-amber-700" />
            </button>
          )}
        </div>

        {/* Right: Count Pill & Export Button */}
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-[#f5d275]/40 px-3.5 py-1.5 text-xs font-extrabold text-[#37150f]">
            {filteredItems.length} Items (Pcs)
          </span>

          <button
            type="button"
            onClick={() => exportForecastToExcel(forecast)}
            className="flex items-center gap-1.5 rounded-full bg-[#91171d] hover:bg-[#be3937] px-4 py-2 text-xs font-extrabold text-[#f5d275] shadow-xs transition cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 13-Column Scrollable Table Container */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[28px] border-2 border-[#c79754]/35 bg-white shadow-xs">
        <div className="table-scroll flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-xs">
            {/* 13 Columns Total: 1 (Code) + 1 (Desc) + 10 (Jan..Oct) + 1 (Prediction) */}
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[19%]" />
              {TEN_MONTHS.map((m) => (
                <col key={m.period} className="w-[6%]" />
              ))}
              <col className="w-[10%]" />
            </colgroup>

            <thead className="sticky top-0 z-20 bg-[#37150f] text-[11px] font-extrabold uppercase tracking-wider text-[#f5d275] shadow-xs">
              <tr>
                <th className="py-3.5 pl-4 pr-2">Item Code</th>
                <th className="py-3.5 px-2">Item Desc</th>
                {TEN_MONTHS.map((m) => (
                  <th key={m.period} className="py-3.5 px-1.5 text-right">
                    {m.label}
                  </th>
                ))}
                <th className="bg-[#91171d] py-3 pl-2 pr-4 text-right text-[#f5d275]">
                  <div className="flex flex-col items-end">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Sparkles className="size-3 text-[#f5d275]" />
                      {nextShort} Pred
                    </span>
                    <span className="text-[9px] font-normal lowercase tracking-normal text-[#f5d275]/80">
                      click cell to edit
                    </span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#c79754]/15">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-sm font-bold text-[#c79754]">
                    No items match "{search}".
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const predVal = item.forecastQty;
                  const isEditing = editingCode === item.code;

                  return (
                    <tr
                      key={item.key}
                      className="transition-colors hover:bg-[#fbf7f0]"
                    >
                      {/* Col 1: Item Code */}
                      <td className="py-2.5 pl-4 pr-2 font-mono font-bold text-[#37150f] truncate" title={item.code}>
                        <span className="inline-block rounded-lg bg-[#fbf7f0] border border-[#c79754]/30 px-2 py-0.5 text-[11px] font-extrabold text-[#37150f]">
                          {displayCode(item.code)}
                        </span>
                      </td>

                      {/* Col 2: Item Desc */}
                      <td
                        className="py-2.5 px-2 font-semibold text-[#37150f] truncate"
                        title={item.desc || item.code}
                      >
                        {item.desc || <span className="text-[#c79754] italic">—</span>}
                      </td>

                      {/* Cols 3-12: Jan through Oct Qty (Pieces) */}
                      {TEN_MONTHS.map((m) => {
                        const pIdx = periodIndexMap.get(m.period);
                        const val = pIdx !== undefined ? (item.qtyHistory[pIdx] ?? 0) : 0;
                        return (
                          <td
                            key={m.period}
                            className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${
                              val > 0 ? 'font-bold text-[#37150f]' : 'text-[#c79754]/50'
                            }`}
                          >
                            {val > 0 ? fmtInt(val) : '0'}
                          </td>
                        );
                      })}

                      {/* Col 13: Prediction Qty (Pieces) with click-to-edit support */}
                      <td
                        className={`py-2 pl-2 pr-4 text-right font-mono font-black tabular-nums transition-colors ${
                          item.isManual ? 'bg-amber-100/70 text-[#91171d]' : 'bg-[#f5d275]/25 text-[#91171d]'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(item.code);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="w-20 rounded-md border-2 border-[#91171d] bg-white px-1.5 py-0.5 text-right font-mono text-xs font-black text-[#91171d] shadow-xs focus:outline-none"
                              placeholder="Qty"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.code)}
                              className="rounded-full bg-[#91171d] p-1 text-[#f5d275] hover:bg-[#be3937] cursor-pointer"
                              title="Save"
                            >
                              <Check className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="rounded-full bg-[#37150f]/20 p-1 text-[#37150f] hover:bg-[#37150f]/30 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(item.code, predVal)}
                            className="group/cell flex items-center justify-end gap-1.5 cursor-pointer py-0.5"
                            title={
                              item.isManual
                                ? `Manual override: ${fmtInt(predVal)} pcs (AI baseline was ${fmtInt(
                                    item.originalForecastQty,
                                  )} pcs). Click to edit.`
                                : 'Click to manually adjust quantity'
                            }
                          >
                            {renderTrendDot(item.trend)}
                            <span className="hover:underline">{fmtInt(predVal)}</span>

                            {item.isManual ? (
                              <div className="flex items-center gap-1">
                                <span className="rounded bg-amber-500/25 px-1 py-0.2 text-[9px] font-extrabold text-amber-950 uppercase tracking-tight">
                                  Custom
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManualAdjustment(item.code, null);
                                  }}
                                  className="rounded p-0.5 text-amber-800 hover:bg-amber-200 hover:text-red-700 cursor-pointer"
                                  title="Reset to AI baseline"
                                >
                                  <RotateCcw className="size-2.5" />
                                </button>
                              </div>
                            ) : (
                              <Edit2 className="size-3 text-[#c79754] opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky 13-Column Totals Row */}
            <tfoot className="sticky bottom-0 z-20 border-t-2 border-[#c79754]/40 bg-[#fbf7f0] text-xs font-black text-[#37150f]">
              <tr>
                <td className="py-3 pl-4 pr-2 uppercase tracking-wider text-[#91171d]">
                  Total ({filteredItems.length})
                </td>
                <td className="py-3 px-2 text-[11px] font-bold text-[#959242] truncate">
                  All 10 Months (Jan – Oct) & {nextShort} Forecast
                </td>
                {monthTotals.map((tot, idx) => (
                  <td
                    key={TEN_MONTHS[idx].period}
                    className="py-3 px-1.5 text-right font-mono tabular-nums text-[#37150f]"
                  >
                    {fmtInt(tot)}
                  </td>
                ))}
                <td className="bg-[#91171d] py-3 pl-2 pr-4 text-right font-mono text-[#f5d275] tabular-nums">
                  {fmtInt(totalPredicted)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
