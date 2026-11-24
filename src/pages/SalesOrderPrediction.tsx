import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { buildForecast } from '../lib/forecast';
import { fmtInt } from '../lib/format';
import { formatMonthOnly, formatPeriodShort } from '../lib/supabase';
import { Sparkline } from '../components/ui';
import { exportSalesOrderPredictionToExcel } from '../lib/export';

export default function SalesOrderPrediction() {
  const { data, soManualAdjustments, resetSoManualAdjustments } =
    useSalesData();
  const soReports = data.so.monthlyReports;

  const method = 'auto' as const;
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const forecast = useMemo(() => {
    if (!soReports || soReports.length === 0) return null;
    return buildForecast(soReports, method, soManualAdjustments);
  }, [soReports, soManualAdjustments]);

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

  if (!forecast) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-base font-bold text-[#37150f]">Preparing Sales Order Predictions…</div>
      </div>
    );
  }

  const octActual = forecast.totals.qtyHistory[forecast.totals.qtyHistory.length - 1] || 0;
  const target3MoTotal =
    forecast.totals.novTargetTotal + forecast.totals.decTargetTotal + forecast.totals.janTargetTotal;
  const ai3MoTotal =
    forecast.totals.novAiTotal + forecast.totals.decAiTotal + forecast.totals.janAiTotal;
  const plan3MoTotal =
    forecast.totals.novPlanTotal + forecast.totals.decPlanTotal + forecast.totals.janPlanTotal;

  const lastPeriod = forecast.periods[forecast.periods.length - 1];
  const lastPeriodLabel = lastPeriod ? formatPeriodShort(lastPeriod) : 'Latest';
  const lastMonthShort = lastPeriod ? formatMonthOnly(lastPeriod) : 'Latest';
  const [m1Label, m2Label, m3Label] = forecast.next3Periods.map((p) => formatMonthOnly(p));
  const forecastRangeLabel = `${formatPeriodShort(forecast.next3Periods[0])} – ${formatPeriodShort(forecast.next3Periods[2])}`;

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-12">
      {/* Top Controls & Forecast Model Badge */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#91171d] px-4 py-1.5 text-xs sm:text-sm font-black text-[#f5d275]">
              <Sparkles className="size-4" />
              <span>SO Forecast • {forecastRangeLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="rounded-full border border-[#c79754]/30 bg-[#fbf7f0] px-4 py-1.5 text-xs sm:text-sm font-bold text-[#37150f]">
              Model: Auto-Best (Adaptive Multi-Model + YoY Seasonal)
              {forecast.backtest ? ` • ${Math.round(forecast.backtest.accuracy * 100)}% backtest acc.` : ''}
            </span>
          </div>
        </div>

        {/* Prominent Bubbly KPI Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-5">
          {/* Card 1: Latest Actual */}
          <div className="bubbly-card rounded-2xl border border-[#ebdcc8] bg-[#fbf7f0]/70 p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#37150f]/70">
              {lastPeriodLabel} Actual
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-black text-[#37150f] tracking-tight">
              {fmtInt(octActual)} <span className="text-xs sm:text-sm font-bold text-[#c79754]">units</span>
            </div>
          </div>

          {/* Card 2: AI 3-Month Total */}
          <div className="bubbly-card rounded-2xl border border-[#ebdcc8] bg-[#fbf7f0]/70 p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#37150f]/70">
              AI Forecast (3-Mo)
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-black text-[#37150f] tracking-tight">
              {fmtInt(ai3MoTotal)}{' '}
              <span className="text-xs sm:text-sm font-bold text-[#c79754]">units</span>
            </div>
          </div>

          {/* Card 3: Target 3-Month Total */}
          <div className="bubbly-card rounded-2xl border border-[#91171d]/20 bg-rose-50/50 p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#91171d]">
              Target (+10% MoM)
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-black text-[#91171d] tracking-tight">
              {fmtInt(target3MoTotal)}{' '}
              <span className="text-xs sm:text-sm font-bold text-[#91171d]/70">units</span>
            </div>
          </div>

          {/* Card 4: Recommended Plan 3-Month Total */}
          <div className="bubbly-card rounded-2xl border border-amber-300 bg-amber-50/80 p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#854d0e]">
              Recommended Plan
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-black text-[#854d0e] tracking-tight">
              {fmtInt(plan3MoTotal)}{' '}
              <span className="text-xs sm:text-sm font-bold text-[#854d0e]/70">units</span>
            </div>
          </div>          
        </div>
      </div>

      {/* Search and Table Container */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#c79754]" />
            <input
              type="text"
              placeholder="Search product code or description…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-full border border-[#c79754]/30 bg-[#fbf7f0]/70 py-2.5 sm:py-3 pl-11 pr-10 text-sm sm:text-base font-bold text-[#37150f] focus:border-[#91171d] focus:bg-white focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="bubbly-btn absolute right-3.5 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-black cursor-pointer p-1"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2 text-sm font-bold text-[#37150f]/80">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-full border border-[#c79754]/30 bg-[#fbf7f0] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#37150f] focus:outline-none cursor-pointer"
              >
                <option value={20}>20 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={-1}>All ({filteredItems.length})</option>
              </select>
            </div>

            {/* Export Prediction Button */}
            <button
              type="button"
              onClick={() => {
                exportSalesOrderPredictionToExcel({
                  items: filteredItems,
                  totals: forecast.totals,
                  next3Periods: forecast.next3Periods,
                  sheetTitle: 'SO Prediction',
                  filename: `Sales_Order_Prediction_${forecast.nextPeriod ?? 'next'}.xlsx`,
                });
              }}
              className="bubbly-btn flex items-center gap-2 rounded-full bg-[#91171d] hover:bg-[#be3937] px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-extrabold text-[#f5d275] shadow-sm shadow-[#91171d]/20 transition-all cursor-pointer whitespace-nowrap"
              title="Download clean Sales Order Prediction Excel table"
            >
              <Download className="size-4" />
              <span>Export Prediction</span>
            </button>

            {/* Reset adjustments button */}
            {adjustedCount > 0 && (
              <button
                onClick={() => resetSoManualAdjustments()}
                className="bubbly-btn flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset {adjustedCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Forecast Table Container with Improved Typography */}
        <div className="mt-3.5 overflow-hidden rounded-xl border border-[#ebdcc8] bg-white">
          <div className="overflow-x-auto table-scroll max-h-[65vh]">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-[#fbf7f0] shadow-sm">
                <tr className="border-b border-[#ebdcc8] bg-[#fbf7f0] text-[#37150f] font-black text-center">
                  <th rowSpan={2} className="py-3 px-3.5 text-left sticky left-0 bg-[#fbf7f0] z-30 border-r border-[#ebdcc8] min-w-[120px] whitespace-nowrap">
                    Item Code
                  </th>
                  <th rowSpan={2} className="py-3 px-3.5 text-left min-w-[180px]">
                    Description
                  </th>
                  <th rowSpan={2} className="py-3 px-2.5 text-center min-w-[95px]">
                    Trend
                  </th>
                  <th rowSpan={2} className="py-3 px-3.5 text-right bg-amber-50/70 border-r border-[#ebdcc8] min-w-[95px]">
                    {lastMonthShort} Actual
                  </th>

                  {/* Group 1: AI Model Prediction */}
                  <th colSpan={3} className="py-2 px-3 bg-[#37150f]/10 border-r border-[#ebdcc8] text-xs sm:text-sm font-black text-[#37150f]">
                    AI Prediction
                  </th>

                  {/* Group 2: Target (+10% MoM) */}
                  <th colSpan={3} className="py-2 px-3 bg-[#91171d]/10 border-r border-[#ebdcc8] text-xs sm:text-sm font-black text-[#91171d]">
                    Add 10% from the previous month
                  </th>

                  {/* Group 3: Recommended Plan (Strategy A Decision Blend) */}
                  <th colSpan={3} className="py-2 px-3 bg-amber-500/15 border-r border-[#ebdcc8] text-xs sm:text-sm font-black text-[#854d0e]">
                    Recommended Plan (Decision)
                  </th>

                  <th rowSpan={2} className="py-3 px-3.5 text-right min-w-[85px]">
                    Pack
                  </th>
                </tr>
                <tr className="border-b-2 border-[#ebdcc8] bg-[#fbf7f0] font-black text-xs sm:text-sm text-[#37150f]">
                  {/* AI sub-headers */}
                  <th className="py-2 px-3 text-right bg-[#37150f]/5 min-w-[85px]">{m1Label} (units)</th>
                  <th className="py-2 px-3 text-right bg-[#37150f]/5 min-w-[85px]">{m2Label} (units)</th>
                  <th className="py-2 px-3 text-right bg-[#37150f]/5 border-r border-[#ebdcc8] min-w-[85px]">{m3Label} (units)</th>

                  {/* Target sub-headers */}
                  <th className="py-2 px-3 text-right bg-[#91171d]/5 font-black text-[#91171d] min-w-[90px]">{m1Label} (+10%) (units)</th>
                  <th className="py-2 px-3 text-right bg-[#91171d]/5 font-black text-[#91171d] min-w-[90px]">{m2Label} (+10%) (units)</th> 
                  <th className="py-2 px-3 text-right bg-[#91171d]/5 font-black text-[#91171d] border-r border-[#ebdcc8] min-w-[90px]">{m3Label} (+10%) (units)</th>

                  {/* Recommended Plan sub-headers */}
                  <th className="py-2 px-3 text-right bg-amber-500/10 font-black text-[#854d0e] min-w-[90px]">{m1Label} Plan (units)</th>
                  <th className="py-2 px-3 text-right bg-amber-500/10 font-black text-[#854d0e] min-w-[90px]">{m2Label} Plan (units)</th>
                  <th className="py-2 px-3 text-right bg-amber-500/10 font-black text-[#854d0e] border-r border-[#ebdcc8] min-w-[90px]">{m3Label} Plan (units)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebdcc8]/70 font-medium">
                {paginatedItems.map((it) => {
                  return (
                    <tr
                      key={it.code}
                      className={`hover:bg-[#f5d275]/15 transition group ${
                        it.isManual ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      {/* Sticky Item Code */}
                      <td className="py-2.5 px-3.5 font-extrabold text-[#91171d] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#ebdcc8] whitespace-nowrap">
                        {it.code}
                      </td>
                      <td className="py-2.5 px-3.5 max-w-[240px] truncate text-[#37150f] font-semibold" title={it.desc}>
                        {it.desc}
                      </td>
                      <td className="py-2.5 px-2.5 text-center">
                        <div className="inline-block">
                          <Sparkline history={it.qtyHistory} forecast={it.forecastQty} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-[#37150f] bg-amber-50/40 border-r border-[#ebdcc8]">
                        {fmtInt(it.lastQty)}
                      </td>

                      {/* AI Predictions */}
                      <td className="py-2.5 px-3 text-right tabular-nums font-black text-[#37150f] bg-[#37150f]/5">
                        {fmtInt(it.novAi)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#37150f]/85 bg-[#37150f]/5">
                        {fmtInt(it.decAi)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#37150f]/85 bg-[#37150f]/5 border-r border-[#ebdcc8]">
                        {fmtInt(it.janAi)}
                      </td>

                      {/* Target +10% MoM */}
                      <td className="py-2.5 px-3 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/5">
                        {fmtInt(it.novTarget)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#91171d] bg-[#91171d]/5">
                        {fmtInt(it.decTarget)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#91171d] bg-[#91171d]/5 border-r border-[#ebdcc8]">
                        {fmtInt(it.janTarget)}
                      </td>

                      {/* Recommended Plan (Strategy A Smart Blend) */}
                      <td className="py-2.5 px-3 text-right tabular-nums font-black text-[#854d0e] bg-amber-500/10">
                        {fmtInt(it.novPlan)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#854d0e] bg-amber-500/10">
                        {fmtInt(it.decPlan)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#854d0e] bg-amber-500/10 border-r border-[#ebdcc8]">
                        {fmtInt(it.janPlan)}
                      </td>

                      <td className="py-2.5 px-3.5 text-right tabular-nums text-[#37150f]/75 font-bold whitespace-nowrap">
                        {it.packSize ? `${it.packSize} pcs` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals Summary Row */}
              <tfoot>
                <tr className="border-t-2 border-[#ebdcc8] bg-[#fbf7f0] font-black text-[#37150f] text-sm">
                  <td className="py-3 px-3.5 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#ebdcc8]">
                    TOTALS
                  </td>
                  <td colSpan={2} className="py-3 px-3.5 text-xs sm:text-sm font-bold text-[#37150f]/75">
                    {filteredItems.length} products
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums bg-amber-50/80 border-r border-[#ebdcc8]">
                    {fmtInt(octActual)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums bg-[#37150f]/10">
                    {fmtInt(forecast.totals.novAiTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums bg-[#37150f]/10">
                    {fmtInt(forecast.totals.decAiTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums bg-[#37150f]/10 border-r border-[#ebdcc8]">
                    {fmtInt(forecast.totals.janAiTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10">
                    {fmtInt(forecast.totals.novTargetTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10">
                    {fmtInt(forecast.totals.decTargetTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-black text-[#91171d] bg-[#91171d]/10 border-r border-[#ebdcc8]">
                    {fmtInt(forecast.totals.janTargetTotal)}
                  </td>
                  {/* Recommended Plan Totals */}
                  <td className="py-3 px-3 text-right tabular-nums font-black text-[#854d0e] bg-amber-500/15">
                    {fmtInt(forecast.totals.novPlanTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-black text-[#854d0e] bg-amber-500/15">
                    {fmtInt(forecast.totals.decPlanTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-black text-[#854d0e] bg-amber-500/15 border-r border-[#ebdcc8]">
                    {fmtInt(forecast.totals.janPlanTotal)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-xs text-[#37150f]/60 font-semibold">
                    Units in pcs
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Compact Pagination Bar */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#ebdcc8] pt-3.5 text-sm font-bold text-[#37150f]/80">
            <div>
              {(currentPage - 1) * pageSize + 1}–{Math.min(filteredItems.length, currentPage * pageSize)} of {filteredItems.length} products
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="bubbly-btn grid size-8.5 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="size-4.5" />
              </button>
              <span className="px-2 font-extrabold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="bubbly-btn grid size-8.5 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
                title="Next"
              >
                <ChevronRight className="size-4.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
