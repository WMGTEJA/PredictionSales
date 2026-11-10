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
    <div className="space-y-4 pb-10">
      {/* Top Banner & Method Selector */}
      <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#c79754]/20 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#91171d] px-3 py-1 text-xs font-black text-[#f5d275]">
              <Sparkles className="size-3.5" />
              <span>Sales Order Multi-Month Forecast • Nov 2026 – Jan 2027</span>
            </div>
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
          </div>
        </div>

        {/* Prediction Summary KPI Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {/* Card 1: AI 3-Month Total */}
          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              🤖 Model Prediction Total (Nov–Jan)
            </div>
            <div className="mt-1 text-2xl font-black text-[#37150f]">
              {fmtInt(ai3MoTotal)}{' '}
              <span className="text-xs font-bold text-[#c79754]">units</span>
            </div>
          </div>

          {/* Card 2: Target 3-Month Total */}
          <div className="rounded-xl border border-[#91171d]/20 bg-rose-50/50 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#91171d]/80">
              🎯 Manual 10% Addition
            </div>
            <div className="mt-1 text-2xl font-black text-[#91171d]">
              {fmtInt(target3MoTotal)}{' '}
              <span className="text-xs font-bold text-[#91171d]/60">units</span>
            </div>
          </div>

          {/* Card 3: Oct Actual */}
          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              Oct 2026 Actual Orders
            </div>
            <div className="mt-1 text-2xl font-black text-[#37150f]">
              {fmtInt(octActual)} <span className="text-xs font-bold text-[#c79754]">units</span>
            </div>
          </div>

          {/* Card 4: Forecast Shift & Products */}
          <div className="rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/70 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#37150f]/60">
              Products Forecasted
            </div>
            <div className="mt-1 text-2xl font-black text-[#37150f]">
              {forecast.items.length}{' '}
              <span className="text-xs font-bold text-[#c79754]">SKUs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#c79754]/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:w-auto sm:min-w-[320px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
            <input
              type="text"
              placeholder="Search product code or description…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-[#c79754]/40 bg-[#fbf7f0]/60 py-2 pl-9 pr-8 text-xs font-bold text-[#37150f] focus:border-[#91171d] focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-black cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#37150f]/80">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-[#c79754]/40 bg-[#fbf7f0] px-2 py-1 text-xs font-extrabold text-[#37150f] focus:outline-none"
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
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset {adjustedCount}</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Forecast Table Container */}
        <div className="mt-2 overflow-hidden rounded-xl border border-[#c79754]/30 bg-white">
          <div className="overflow-x-auto table-scroll max-h-[65vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#c79754]/30 bg-[#fbf7f0] text-[#37150f] font-black text-center sticky top-0 z-20 shadow-sm">
                  <th rowSpan={2} className="py-2.5 px-3 text-left sticky left-0 bg-[#fbf7f0] z-30 border-r border-[#c79754]/20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] min-w-[110px]">
                    Item Code
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-left min-w-[180px]">
                    Description
                  </th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center min-w-[90px]">
                    10-Mo Trend
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-right bg-amber-50/70 border-r border-[#c79754]/20 min-w-[90px]">
                    Oct Actual
                  </th>

                  {/* Group 1: AI Model Prediction */}
                  <th colSpan={3} className="py-1.5 px-2 bg-[#37150f]/10 border-r border-[#c79754]/30 text-xs font-black text-[#37150f]">
                    🤖 Model Prediction (3 Months)
                  </th>

                  {/* Group 2: Director Target (+10% MoM) */}
                  <th colSpan={3} className="py-1.5 px-2 bg-[#91171d]/10 border-r border-[#c79754]/30 text-xs font-black text-[#91171d]">
                    🎯 Manual 10% Addition
                  </th>

                  <th rowSpan={2} className="py-2.5 px-3 text-right min-w-[80px]">
                    Pack Size
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center min-w-[140px]">
                    Manual Override / Quick +10%
                  </th>
                </tr>
                <tr className="border-b-2 border-[#c79754]/30 bg-[#fbf7f0]/95 font-black text-[11px] text-[#37150f] sticky top-[29px] z-20 shadow-sm">
                  {/* AI sub-headers */}
                  <th className="py-1.5 px-2.5 text-right bg-[#37150f]/5 min-w-[85px]">Nov (AI)</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#37150f]/5 min-w-[85px]">Dec (AI)</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#37150f]/5 border-r border-[#c79754]/30 min-w-[85px]">Jan (AI)</th>

                  {/* Target sub-headers */}
                  <th className="py-1.5 px-2.5 text-right bg-[#91171d]/5 font-black text-[#91171d] min-w-[90px]">Nov (+10%)</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#91171d]/5 font-black text-[#91171d] min-w-[90px]">Dec (+10%)</th>
                  <th className="py-1.5 px-2.5 text-right bg-[#91171d]/5 font-black text-[#91171d] border-r border-[#c79754]/30 min-w-[90px]">Jan (+10%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c79754]/15 font-medium">
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
                    <td className="py-2 px-3 font-extrabold text-[#91171d] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#c79754]/20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
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
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-[#37150f] bg-amber-50/40 border-r border-[#c79754]/20">
                      {fmtInt(it.lastQty)}
                    </td>

                    {/* AI Predictions */}
                    <td className="py-2 px-2.5 text-right tabular-nums font-black text-[#37150f] bg-[#37150f]/5">
                      {fmtInt(it.novAi)}
                    </td>
                    <td className="py-2 px-2.5 text-right tabular-nums font-medium text-[#37150f]/80 bg-[#37150f]/5">
                      {fmtInt(it.decAi)}
                    </td>
                    <td className="py-2 px-2.5 text-right tabular-nums font-medium text-[#37150f]/80 bg-[#37150f]/5 border-r border-[#c79754]/20">
                      {fmtInt(it.janAi)}
                    </td>

                    {/* Target +10% MoM */}
                    <td className="py-2 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/5">
                      {fmtInt(it.novTarget)}
                    </td>
                    <td className="py-2 px-2.5 text-right tabular-nums font-bold text-[#91171d]/90 bg-[#91171d]/5">
                      {fmtInt(it.decTarget)}
                    </td>
                    <td className="py-2 px-2.5 text-right tabular-nums font-bold text-[#91171d]/90 bg-[#91171d]/5 border-r border-[#c79754]/20">
                      {fmtInt(it.janTarget)}
                    </td>

                    <td className="py-2 px-3 text-right tabular-nums text-[#37150f]/70 font-bold whitespace-nowrap">
                      {it.packSize ? `${it.packSize} pcs` : '-'}
                    </td>

                    {/* Action / Manual Override */}
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
                            className="w-16 rounded border border-[#91171d] px-1.5 py-0.5 text-xs text-right font-black"
                          />
                          <button
                            onClick={() => handleSaveEdit(it.code)}
                            className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                            title="Save custom quantity"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick 10% Apply Button */}
                          <button
                            type="button"
                            onClick={() => setSoManualAdjustment(it.code, it.novTarget)}
                            className="rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-800 transition cursor-pointer"
                            title="Set Nov prediction to +10% target"
                          >
                            Use +10%
                          </button>

                          {/* Custom Edit Button */}
                          <button
                            onClick={() => handleStartEdit(it.code, it.forecastQty)}
                            className="p-1 text-[#37150f]/50 hover:text-[#91171d] cursor-pointer"
                            title="Custom quantity edit"
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
              <tr className="border-t-2 border-[#c79754]/40 bg-[#fbf7f0] font-black text-[#37150f]">
                <td className="py-2.5 px-3 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#c79754]/20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                  TOTALS
                </td>
                <td colSpan={2} className="py-2.5 px-3 text-xs font-extrabold text-[#37150f]/70">
                  {filteredItems.length} products
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums bg-amber-50/80 border-r border-[#c79754]/20">
                  {fmtInt(octActual)}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums bg-[#37150f]/10">
                  {fmtInt(forecast.totals.novAiTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums bg-[#37150f]/10">
                  {fmtInt(forecast.totals.decAiTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums bg-[#37150f]/10 border-r border-[#c79754]/20">
                  {fmtInt(forecast.totals.janAiTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10">
                  {fmtInt(forecast.totals.novTargetTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10">
                  {fmtInt(forecast.totals.decTargetTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10 border-r border-[#c79754]/20">
                  {fmtInt(forecast.totals.janTargetTotal)}
                </td>
                <td colSpan={2} className="py-2.5 px-3 text-center text-[10px] text-[#37150f]/50">
                  All units in pieces (pcs)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom Pagination Bar */}
      {pageSize !== -1 && totalPages > 1 && (
        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#c79754]/20 pt-3 text-xs font-bold text-[#37150f]/80">
          <div>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(filteredItems.length, currentPage * pageSize)} of {filteredItems.length} products
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 rounded-lg border border-[#c79754]/40 bg-[#fbf7f0] px-3 py-1.5 hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-[#c79754]/40 bg-[#fbf7f0] px-3 py-1.5 hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
