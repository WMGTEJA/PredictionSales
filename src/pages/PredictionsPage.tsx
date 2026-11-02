import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Minus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { buildForecast, type ForecastMethod, type Trend } from '../lib/forecast';
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
  const { reports, unitMode } = useReports();
  const [method, setMethod] = useState<ForecastMethod>('smart');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');

  const forecast = useMemo(() => {
    if (reports.length === 0) return null;
    return buildForecast(reports, method);
  }, [reports, method]);

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

  const convQty = (qty: number, packSize: number | null) => {
    if (unitMode === 'ctn') {
      const divisor = packSize && packSize > 0 ? packSize : 15;
      return Math.round(qty / divisor);
    }
    return Math.round(qty);
  };

  // Column totals for filtered items across Jan-Oct + Prediction
  const monthTotals = TEN_MONTHS.map((m) => {
    const pIdx = periodIndexMap.get(m.period);
    if (pIdx === undefined) return 0;
    return filteredItems.reduce((sum, item) => sum + convQty(item.qtyHistory[pIdx] ?? 0, item.packSize), 0);
  });

  const totalPredicted = filteredItems.reduce(
    (sum, item) => sum + convQty(item.forecastQty, item.packSize),
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
      {/* Top Bubbly Filter & Search Bar (Shrink-0, No Scroll) */}
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

          {/* Forecast Method Selector */}
          <div className="flex items-center gap-1.5 rounded-full border-2 border-[#c79754]/30 bg-[#fbf7f0] px-3 py-1">
            <SlidersHorizontal className="size-3.5 text-[#91171d]" />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ForecastMethod)}
              className="bg-transparent text-xs font-extrabold text-[#37150f] focus:outline-none cursor-pointer"
            >
              <option value="smart">Smart Trend (Jan–Oct)</option>
              <option value="weighted">Weighted Avg (Jan–Oct)</option>
              <option value="average">Simple Average</option>
              <option value="last">Last Month (Oct)</option>
            </select>
          </div>
        </div>

        {/* Right: Count Pill & Export Button */}
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-[#f5d275]/40 px-3.5 py-1.5 text-xs font-extrabold text-[#37150f]">
            {filteredItems.length} Items • {unitMode === 'ctn' ? 'Cartons' : 'Pieces'}
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

      {/* 13-Column Scrollable Table Container (Fitted to Page) */}
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
                <th className="bg-[#91171d] py-3.5 pl-2 pr-4 text-right text-[#f5d275]">
                  <span className="inline-flex items-center justify-end gap-1">
                    <Sparkles className="size-3 text-[#f5d275]" />
                    {nextShort} Pred
                  </span>
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
                  const predVal = convQty(item.forecastQty, item.packSize);
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

                      {/* Cols 3-12: Jan through Oct Qty */}
                      {TEN_MONTHS.map((m) => {
                        const pIdx = periodIndexMap.get(m.period);
                        const raw = pIdx !== undefined ? (item.qtyHistory[pIdx] ?? 0) : 0;
                        const val = convQty(raw, item.packSize);
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

                      {/* Col 13: Prediction Qty */}
                      <td className="bg-[#f5d275]/25 py-2.5 pl-2 pr-4 text-right font-mono font-black text-[#91171d] tabular-nums">
                        <div className="inline-flex items-center justify-end gap-1">
                          {renderTrendDot(item.trend)}
                          <span>{fmtInt(predVal)}</span>
                        </div>
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
