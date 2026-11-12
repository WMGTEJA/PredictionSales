import { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { buildForecast, ForecastMethod, METHOD_INFO } from '../lib/forecast';
import { fmtInt } from '../lib/format';
import { Sparkline } from '../components/ui';

export default function SalesOrderPrediction() {
  const { data, soManualAdjustments, setSoManualAdjustment, resetSoManualAdjustments } =
    useSalesData();
  const soReports = data.so.monthlyReports;

  const [method, setMethod] = useState<ForecastMethod>('ensemble');
  const [search, setSearch] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

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

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

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
  const target3MoTotal =
    forecast.totals.novTargetTotal + forecast.totals.decTargetTotal + forecast.totals.janTargetTotal;
  const ai3MoTotal =
    forecast.totals.novAiTotal + forecast.totals.decAiTotal + forecast.totals.janAiTotal;

  return (
    <div className="w-full space-y-4 sm:space-y-6 pb-12">
      {/* Top Controls & Forecast Model Selector */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#91171d] px-3 py-1 text-xs font-black text-[#f5d275]">
              <Sparkles className="size-3.5" />
              <span>SO Forecast • Nov 2026 – Jan 2027</span>
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold text-[#37150f]/80">Model:</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ForecastMethod)}
              className="rounded-full border border-[#c79754]/30 bg-[#fbf7f0] px-3.5 py-1.5 text-xs font-bold text-[#37150f] focus:outline-none focus:border-[#91171d] cursor-pointer"
            >
              {(Object.keys(METHOD_INFO) as ForecastMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_INFO[m].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Responsive Bubbly KPI Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: AI 3-Month Total */}
          <div className="bubbly-card rounded-2xl border border-[#ebdcc8] bg-[#fbf7f0]/70 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#37150f]/60">
              AI Forecast (3-Mo)
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-[#37150f]">
              {fmtInt(ai3MoTotal)}{' '}
              <span className="text-xs font-bold text-[#c79754]">units</span>
            </div>
          </div>

          {/* Card 2: Target 3-Month Total */}
          <div className="bubbly-card rounded-2xl border border-[#91171d]/20 bg-rose-50/50 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#91171d]">
              Target (+10% MoM)
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-[#91171d]">
              {fmtInt(target3MoTotal)}{' '}
              <span className="text-xs font-bold text-[#91171d]/60">units</span>
            </div>
          </div>

          {/* Card 3: Oct Actual */}
          <div className="bubbly-card rounded-2xl border border-[#ebdcc8] bg-[#fbf7f0]/70 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#37150f]/60">
              Oct 2026 Actual
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-[#37150f]">
              {fmtInt(octActual)} <span className="text-xs font-bold text-[#c79754]">units</span>
            </div>
          </div>

          {/* Card 4: Forecast Shift & Products */}
          <div className="bubbly-card rounded-2xl border border-[#ebdcc8] bg-[#fbf7f0]/70 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#37150f]/60">
              Products
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-[#37150f]">
              {forecast.items.length}{' '}
              <span className="text-xs font-bold text-[#c79754]">SKUs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Table Container */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
            <input
              type="text"
              placeholder="Search product code or name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-full border border-[#c79754]/30 bg-[#fbf7f0]/70 py-2 pl-10 pr-9 text-xs sm:text-sm font-bold text-[#37150f] focus:border-[#91171d] focus:bg-white focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="bubbly-btn absolute right-3 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-black cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#37150f]/80">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-full border border-[#c79754]/30 bg-[#fbf7f0] px-3 py-1 text-xs font-bold text-[#37150f] focus:outline-none cursor-pointer"
              >
                <option value={20}>20 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={-1}>All ({filteredItems.length})</option>
              </select>
            </div>

            {/* Reset adjustments button */}
            {adjustedCount > 0 && (
              <button
                onClick={() => resetSoManualAdjustments()}
                className="bubbly-btn flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Reset {adjustedCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Forecast Table Container */}
        <div className="mt-3 overflow-hidden rounded-xl border border-[#ebdcc8] bg-white">
          <div className="overflow-x-auto table-scroll max-h-[65vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#ebdcc8] bg-[#fbf7f0] text-[#37150f] font-black text-center sticky top-0 z-20 shadow-sm">
                  <th rowSpan={2} className="py-2.5 px-3 text-left sticky left-0 bg-[#fbf7f0] z-30 border-r border-[#ebdcc8] min-w-[110px]">
                    Item Code
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-left min-w-[170px]">
                    Description
                  </th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center min-w-[90px]">
                    Trend
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-right bg-amber-50/70 border-r border-[#ebdcc8] min-w-[90px]">
                    Oct Actual
                  </th>

                  {/* Group 1: AI Model Prediction */}
                  <th colSpan={3} className="py-1.5 px-2 bg-[#37150f]/10 border-r border-[#ebdcc8] text-xs font-black text-[#37150f]">
                    AI Model (3-Mo)
                  </th>

                  {/* Group 2: Target (+10% MoM) */}
                  <th colSpan={3} className="py-1.5 px-2 bg-[#91171d]/10 border-r border-[#ebdcc8] text-xs font-black text-[#91171d]">
                    Target (+10% MoM)
                  </th>

                  <th rowSpan={2} className="py-2.5 px-3 text-right min-w-[80px]">
                    Pack
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center min-w-[130px]">
                    Action
                  </th>
                </tr>
                <tr className="border-b-2 border-[#ebdcc8] bg-[#fbf7f0]/95 font-black text-[11px] text-[#37150f] sticky top-[28px] z-20 shadow-sm">
                  {/* AI sub-headers */}
                  <th className="py-1.5 px-2.5 text-right bg-[#37150f]/5 min-w-[80px]">Nov</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#37150f]/5 min-w-[80px]">Dec</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#37150f]/5 border-r border-[#ebdcc8] min-w-[80px]">Jan</th>

                  {/* Target sub-headers */}
                  <th className="py-1.5 px-2.5 text-right bg-[#91171d]/5 font-black text-[#91171d] min-w-[85px]">Nov (+10%)</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#91171d]/5 font-black text-[#91171d] min-w-[85px]">Dec (+10%)</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#91171d]/5 font-black text-[#91171d] border-r border-[#ebdcc8] min-w-[85px]">Jan (+10%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebdcc8]/70 font-medium">
                {paginatedItems.map((it) => {
                  const isEditing = editingCode === it.code;
                  return (
                    <tr
                      key={it.code}
                      className={`hover:bg-[#f5d275]/15 transition group ${
                        it.isManual ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      {/* Sticky Item Code */}
                      <td className="py-2 px-3 font-extrabold text-[#91171d] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#ebdcc8]">
                        {it.code}
                      </td>
                      <td className="py-2 px-3 max-w-[220px] truncate text-[#37150f]" title={it.desc}>
                        {it.desc}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="inline-block">
                          <Sparkline history={it.qtyHistory} forecast={it.forecastQty} />
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-[#37150f] bg-amber-50/40 border-r border-[#ebdcc8]">
                        {fmtInt(it.lastQty)}
                      </td>

                      {/* AI Predictions */}
                      <td className="py-2 px-2.5 text-right tabular-nums font-black text-[#37150f] bg-[#37150f]/5">
                        {fmtInt(it.novAi)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums font-medium text-[#37150f]/80 bg-[#37150f]/5">
                        {fmtInt(it.decAi)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums font-medium text-[#37150f]/80 bg-[#37150f]/5 border-r border-[#ebdcc8]">
                        {fmtInt(it.janAi)}
                      </td>

                      {/* Target +10% MoM */}
                      <td className="py-2 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/5">
                        {fmtInt(it.novTarget)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums font-bold text-[#91171d]/90 bg-[#91171d]/5">
                        {fmtInt(it.decTarget)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums font-bold text-[#91171d]/90 bg-[#91171d]/5 border-r border-[#ebdcc8]">
                        {fmtInt(it.janTarget)}
                      </td>

                      <td className="py-2 px-3 text-right tabular-nums text-[#37150f]/70 font-bold whitespace-nowrap">
                        {it.packSize ? `${it.packSize} pcs` : '-'}
                      </td>

                      {/* Action / Quick Apply */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
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
                              placeholder="Qty"
                              className="w-16 rounded-full border border-[#91171d] px-2 py-0.5 text-xs text-right font-black"
                            />
                            <button
                              onClick={() => handleSaveEdit(it.code)}
                              className="bubbly-btn p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                              title="Save"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="bubbly-btn p-1 text-stone-500 hover:text-stone-800 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSoManualAdjustment(it.code, it.novTarget)}
                              className="bubbly-btn rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 cursor-pointer"
                              title="Apply +10% target to Nov"
                            >
                              Use +10%
                            </button>
                            <button
                              onClick={() => handleStartEdit(it.code, it.forecastQty)}
                              className="bubbly-btn p-1 text-[#37150f]/50 hover:text-[#91171d] cursor-pointer"
                              title="Custom edit"
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
              {/* Totals Summary Row */}
              <tfoot>
                <tr className="border-t-2 border-[#ebdcc8] bg-[#fbf7f0] font-black text-[#37150f]">
                  <td className="py-2.5 px-3 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#ebdcc8]">
                    TOTALS
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-xs font-bold text-[#37150f]/70">
                    {filteredItems.length} products
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums bg-amber-50/80 border-r border-[#ebdcc8]">
                    {fmtInt(octActual)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums bg-[#37150f]/10">
                    {fmtInt(forecast.totals.novAiTotal)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums bg-[#37150f]/10">
                    {fmtInt(forecast.totals.decAiTotal)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums bg-[#37150f]/10 border-r border-[#ebdcc8]">
                    {fmtInt(forecast.totals.janAiTotal)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10">
                    {fmtInt(forecast.totals.novTargetTotal)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10">
                    {fmtInt(forecast.totals.decTargetTotal)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10 border-r border-[#ebdcc8]">
                    {fmtInt(forecast.totals.janTargetTotal)}
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-center text-[10px] text-[#37150f]/50">
                    Units in pcs
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Compact Pagination Bar */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#ebdcc8] pt-3 text-xs font-bold text-[#37150f]/80">
            <div>
              {(currentPage - 1) * pageSize + 1}–{Math.min(filteredItems.length, currentPage * pageSize)} of {filteredItems.length} products
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="bubbly-btn grid size-8 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="bubbly-btn grid size-8 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
                title="Next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
