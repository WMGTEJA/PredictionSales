import { useMemo, useState } from 'react';
import {
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
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Package,
  Scale,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSalesData } from '../hooks/useSalesData';
import { fmtCompact, fmtInt } from '../lib/format';

export default function FulfillmentDashboard() {
  const { data } = useSalesData();
  const fulfillment = data.fulfillment;

  const [selectedItemCode, setSelectedItemCode] = useState<string>('');
  const [itemSearchInput, setItemSearchInput] = useState<string>('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'fulfilled' | 'partial' | 'low'>('all');
  const [expandedRowCode, setExpandedRowCode] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Selected item deep dive data
  const selectedItem = useMemo(() => {
    if (!selectedItemCode) return null;
    return fulfillment.items.find((it) => it.itemCode === selectedItemCode) || null;
  }, [fulfillment.items, selectedItemCode]);

  // Available items for dropdown search
  const availableItems = useMemo(() => {
    const q = itemSearchInput.toLowerCase().trim();
    if (!q) return fulfillment.items;
    return fulfillment.items.filter(
      (it) =>
        it.itemCode.toLowerCase().includes(q) || it.itemDesc.toLowerCase().includes(q),
    );
  }, [fulfillment.items, itemSearchInput]);

  // Filtered items for table
  const tableItems = useMemo(() => {
    let list = fulfillment.items;
    if (statusFilter === 'fulfilled') {
      list = list.filter((it) => it.status === 'fulfilled' || it.status === 'over');
    } else if (statusFilter === 'partial') {
      list = list.filter((it) => it.status === 'partial');
    } else if (statusFilter === 'low') {
      list = list.filter((it) => it.status === 'low');
    }

    if (selectedItemCode) {
      list = list.filter((it) => it.itemCode === selectedItemCode);
    } else if (itemSearchInput.trim()) {
      const q = itemSearchInput.toLowerCase().trim();
      list = list.filter(
        (it) => it.itemCode.toLowerCase().includes(q) || it.itemDesc.toLowerCase().includes(q),
      );
    }

    return list;
  }, [fulfillment.items, statusFilter, selectedItemCode, itemSearchInput]);

  const totalPages = Math.ceil(tableItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tableItems.slice(start, start + pageSize);
  }, [tableItems, currentPage, pageSize]);

  // Export Fulfillment to Excel
  const handleExportExcel = () => {
    const rows = fulfillment.items.map((it) => {
      const row: Record<string, string | number> = {
        'Item Code': it.itemCode,
        'Item Description': it.itemDesc,
        'Total SO Demand (pcs)': it.soTotal,
        'Total SI Fulfilled (pcs)': it.siTotal,
        'Fulfillment Rate (%)': it.fulfillmentPct,
        'Variance (pcs)': it.variance,
        Status:
          it.status === 'over'
            ? 'Overfulfilled (>100%)'
            : it.status === 'fulfilled'
            ? 'Fully Fulfilled (100%)'
            : it.status === 'partial'
            ? 'Partial (80-99%)'
            : 'Low (<80%)',
      };
      it.monthly.forEach((m) => {
        row[`${m.month} SO Qty`] = m.soQty;
        row[`${m.month} SI Qty`] = m.siQty;
        row[`${m.month} Fulfillment %`] = m.fulfillmentPct;
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SO vs SI Fulfillment');
    XLSX.writeFile(wb, `SO_vs_SI_Fulfillment_Report_2026.xlsx`);
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Search and Filter Banner */}
      <div className="rounded-[22px] border-2 border-[#c79754]/30 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative min-w-[300px] sm:min-w-[420px]">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#37150f]/70">
                Search Item for Fulfillment Analysis
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
                <input
                  type="text"
                  placeholder="Search item code or description…"
                  value={
                    selectedItemCode
                      ? `${selectedItemCode} - ${selectedItem?.itemDesc || ''}`
                      : itemSearchInput
                  }
                  onChange={(e) => {
                    setSelectedItemCode('');
                    setItemSearchInput(e.target.value);
                    setIsItemDropdownOpen(true);
                  }}
                  onFocus={() => setIsItemDropdownOpen(true)}
                  className="w-full rounded-xl border border-[#c79754]/40 bg-[#fbf7f0]/60 py-2.5 pl-10 pr-9 text-xs font-bold text-[#37150f] placeholder:text-[#37150f]/40 focus:border-[#91171d] focus:bg-white focus:outline-none"
                />
                {(selectedItemCode || itemSearchInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemCode('');
                      setItemSearchInput('');
                      setIsItemDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-[#91171d]"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {isItemDropdownOpen && !selectedItemCode && (
                <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#c79754]/40 bg-white p-1 shadow-xl">
                  {availableItems.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">No items found</div>
                  ) : (
                    availableItems.slice(0, 30).map((it) => (
                      <button
                        key={it.itemCode}
                        type="button"
                        onClick={() => {
                          setSelectedItemCode(it.itemCode);
                          setItemSearchInput('');
                          setIsItemDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f5d275]/20 cursor-pointer"
                      >
                        <Package className="mt-0.5 size-3.5 shrink-0 text-[#91171d]" />
                        <div className="flex-1 truncate">
                          <span className="font-extrabold text-[#37150f]">{it.itemCode}</span>
                          <span className="ml-1.5 text-[#37150f]/70 truncate">{it.itemDesc}</span>
                        </div>
                        <span
                          className={`text-[10px] font-black shrink-0 px-2 py-0.5 rounded-full ${
                            it.fulfillmentPct >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : it.fulfillmentPct >= 80
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {it.fulfillmentPct}%
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Quick Status Filters */}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#37150f]/70">
                Fulfillment Status
              </label>
              <div className="flex items-center gap-1.5 rounded-xl border border-[#c79754]/30 bg-[#fbf7f0]/80 p-1 text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-[#37150f] text-[#f5d275] shadow-sm'
                      : 'text-[#37150f]/70 hover:bg-white/60'
                  }`}
                >
                  All ({fulfillment.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('fulfilled');
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                    statusFilter === 'fulfilled'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  Fulfilled ≥100% ({fulfillment.stats.fullyFulfilled})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('partial');
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                    statusFilter === 'partial'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  Partial 80–99% ({fulfillment.stats.partiallyFulfilled})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('low');
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                    statusFilter === 'low'
                      ? 'bg-rose-700 text-white shadow-sm'
                      : 'text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  Low &lt;80% ({fulfillment.stats.lowFulfilled})
                </button>
              </div>
            </div>
          </div>

          {/* Export Report Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 rounded-xl bg-[#37150f] hover:bg-[#91171d] px-4 py-2.5 text-xs font-extrabold text-[#f5d275] transition shadow-sm cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export Fulfillment Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Overall KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* KPI 1 */}
        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sales Order (SO)</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#91171d]/10 text-[#91171d]">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#91171d]">
            {fmtInt(fulfillment.totalSoQty)}{' '}
            <span className="text-xs font-bold text-[#c79754]">pcs</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#37150f]/60">Total customer demand</div>
        </div>

        {/* KPI 2 */}
        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Total Invoiced (SI)</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#be3937]/10 text-[#be3937]">
              <Scale className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#be3937]">
            {fmtInt(fulfillment.totalSiQty)}{' '}
            <span className="text-xs font-bold text-[#c79754]">pcs</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#37150f]/60">Total billed & delivered</div>
        </div>

        {/* KPI 3: Overall Fulfillment Rate */}
        <div className="rounded-[22px] border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Overall Fulfillment Rate
            </span>
            <div className="grid size-8 place-items-center rounded-xl bg-emerald-500 text-white">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-900">
            {fulfillment.overallFulfillmentPct}%
          </div>
          <div className="mt-1 text-[11px] font-bold text-emerald-700">
            {fulfillment.totalVariance >= 0
              ? `+${fmtInt(fulfillment.totalVariance)} pcs over-demand`
              : `${fmtInt(fulfillment.totalVariance)} pcs unfulfilled`}
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Item Fulfillment Ratio</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#c79754]/20 text-[#37150f]">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#37150f]">
            {fulfillment.stats.fullyFulfilled}{' '}
            <span className="text-sm font-bold text-[#c79754]">/ {fulfillment.stats.totalItems}</span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#37150f]/60">
            Products fully fulfilled (≥100%)
          </div>
        </div>
      </div>

      {/* Main Comparison Chart: Single Item or Overall Monthly Trend */}
      {selectedItem ? (
        /* Selected Item Deep Dive Comparison */
        <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#c79754]/20 pb-3">
            <div>
              <span className="inline-block rounded-full bg-[#37150f] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                Item Fulfillment Breakdown
              </span>
              <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                {selectedItem.itemCode}
              </h3>
              <p className="text-xs font-bold text-[#37150f]/70">{selectedItem.itemDesc}</p>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-[10px] font-bold text-[#91171d] uppercase">SO Demand</div>
                <div className="text-lg font-black text-[#91171d]">{fmtInt(selectedItem.soTotal)} pcs</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#be3937] uppercase">SI Invoiced</div>
                <div className="text-lg font-black text-[#be3937]">{fmtInt(selectedItem.siTotal)} pcs</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Fulfillment %</div>
                <div
                  className={`text-xl font-black ${
                    selectedItem.fulfillmentPct >= 100
                      ? 'text-emerald-700'
                      : selectedItem.fulfillmentPct >= 80
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {selectedItem.fulfillmentPct}%
                </div>
              </div>
            </div>
          </div>

          {/* Chart for this item */}
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={selectedItem.monthly}
                margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1e6d4" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#37150f', fontSize: 12, fontWeight: 700 }}
                  stroke="#c79754"
                />
                <YAxis
                  yAxisId="qty"
                  tick={{ fill: '#37150f', fontSize: 11 }}
                  stroke="#c79754"
                  tickFormatter={(v) => fmtCompact(v)}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 20) * 20)]}
                  tick={{ fill: '#959242', fontSize: 11, fontWeight: 700 }}
                  stroke="#959242"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                        <div className="text-xs font-bold text-[#f5d275]">
                          {d.month} 2026 ({d.period})
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-4 text-xs">
                          <span className="text-[#f5d275]">SO Demand:</span>
                          <span className="font-extrabold">{fmtInt(d.soQty)} pcs</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-[#f5d275]">SI Fulfilled:</span>
                          <span className="font-extrabold">{fmtInt(d.siQty)} pcs</span>
                        </div>
                        <div className="mt-1.5 border-t border-white/20 pt-1 text-xs font-black text-emerald-400">
                          Fulfillment: {d.fulfillmentPct}%
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="soQty"
                  name="SO Demand"
                  fill="#91171d"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="siQty"
                  name="SI Fulfilled"
                  fill="#be3937"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="fulfillmentPct"
                  name="Fulfillment %"
                  stroke="#959242"
                  strokeWidth={3}
                  dot={{ fill: '#37150f', r: 4, strokeWidth: 2, stroke: '#f5d275' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* Overall Monthly Fulfillment Trend */
        <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#c79754]/20 pb-3">
            <div>
              <span className="inline-block rounded-full bg-[#37150f] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                Monthly Fulfillment Trend
              </span>
              <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                Sales Order (Demand) vs Sales Invoice (Delivered)
              </h3>
              <p className="text-xs font-bold text-[#37150f]/60">
                Comparing monthly ordered quantities with actual billed quantities and fulfillment rate
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-extrabold">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-[#91171d]"></span>
                <span>SO Demand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-[#be3937]"></span>
                <span>SI Fulfilled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#959242]"></span>
                <span>Fulfillment % (Right Axis)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={fulfillment.monthly}
                margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1e6d4" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#37150f', fontSize: 12, fontWeight: 700 }}
                  stroke="#c79754"
                />
                <YAxis
                  yAxisId="qty"
                  tick={{ fill: '#37150f', fontSize: 11 }}
                  stroke="#c79754"
                  tickFormatter={(v) => fmtCompact(v)}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[50, 160]}
                  tick={{ fill: '#959242', fontSize: 11, fontWeight: 700 }}
                  stroke="#959242"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                        <div className="text-xs font-bold text-[#f5d275]">
                          {d.month} 2026 ({d.period})
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-4 text-xs">
                          <span className="text-[#f5d275]">SO Demand:</span>
                          <span className="font-extrabold">{fmtInt(d.soQty)} pcs</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-[#f5d275]">SI Fulfilled:</span>
                          <span className="font-extrabold">{fmtInt(d.siQty)} pcs</span>
                        </div>
                        <div className="mt-1.5 border-t border-white/20 pt-1 text-xs font-black text-emerald-400">
                          Fulfillment: {d.fulfillmentPct}%
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="soQty"
                  name="SO Demand"
                  fill="#91171d"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="siQty"
                  name="SI Fulfilled"
                  fill="#be3937"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="fulfillmentPct"
                  name="Fulfillment %"
                  stroke="#959242"
                  strokeWidth={3}
                  dot={{ fill: '#37150f', r: 4, strokeWidth: 2, stroke: '#f5d275' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-[#37150f]/60 font-bold">
            Tip: Click on any item below or search above to view its monthly fulfillment trend graph!
          </p>
        </div>
      )}

      {/* Item-by-Item Fulfillment Table */}
      <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#c79754]/20 pb-3">
          <div>
            <h3 className="text-base font-black text-[#37150f]">
              Product Fulfillment Comparison Matrix
            </h3>
            <p className="text-xs font-bold text-[#37150f]/60">
              Comparing demand (Sales Orders) against billed delivery (Sales Invoices) across all products
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="grid size-8 place-items-center rounded-lg border border-[#c79754]/40 bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[#37150f]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="grid size-8 place-items-center rounded-lg border border-[#c79754]/40 bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#c79754]/30 bg-[#fbf7f0]/80 font-black text-[#37150f]">
                <th className="py-2.5 px-3">Item Code</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">SO Demand (pcs)</th>
                <th className="py-2.5 px-3 text-right">SI Fulfilled (pcs)</th>
                <th className="py-2.5 px-3 text-right">Fulfillment %</th>
                <th className="py-2.5 px-3 text-right">Variance (pcs)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-2 text-center">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c79754]/15 font-medium">
              {paginatedItems.map((it) => {
                const isExpanded = expandedRowCode === it.itemCode;
                return (
                  <>
                    <tr
                      key={it.itemCode}
                      className={`hover:bg-[#f5d275]/15 transition ${
                        selectedItemCode === it.itemCode ? 'bg-[#f5d275]/25 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-extrabold text-[#37150f]">{it.itemCode}</td>
                      <td className="py-2.5 px-3 max-w-[240px] truncate text-[#37150f]/80">
                        {it.itemDesc}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#91171d] tabular-nums">
                        {fmtInt(it.soTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#be3937] tabular-nums">
                        {fmtInt(it.siTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${
                                it.fulfillmentPct >= 100
                                  ? 'bg-emerald-500'
                                  : it.fulfillmentPct >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, it.fulfillmentPct)}%` }}
                            />
                          </div>
                          <span
                            className={`font-black ${
                              it.fulfillmentPct >= 100
                                ? 'text-emerald-700'
                                : it.fulfillmentPct >= 80
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {it.fulfillmentPct}%
                          </span>
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                          it.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {it.variance >= 0 ? `+${fmtInt(it.variance)}` : fmtInt(it.variance)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            it.status === 'over'
                              ? 'bg-blue-100 text-blue-800'
                              : it.status === 'fulfilled'
                              ? 'bg-emerald-100 text-emerald-800'
                              : it.status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {it.status === 'over'
                            ? 'Overfulfilled'
                            : it.status === 'fulfilled'
                            ? '100% Fulfilled'
                            : it.status === 'partial'
                            ? '80–99% Partial'
                            : 'Low <80%'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemCode(it.itemCode);
                              window.scrollTo({ top: 120, behavior: 'smooth' });
                            }}
                            className="rounded-lg bg-[#37150f] hover:bg-[#91171d] px-2 py-1 text-[10px] font-black text-[#f5d275] transition cursor-pointer"
                          >
                            Trend
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowCode(isExpanded ? null : it.itemCode)
                            }
                            className="grid size-6 place-items-center rounded-lg border border-[#c79754]/40 bg-[#fbf7f0] hover:bg-[#f5d275]/40 text-[#37150f] cursor-pointer"
                            title="Expand monthly breakdown"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Monthly Sub-Table */}
                    {isExpanded && (
                      <tr className="bg-[#fbf7f0]/90">
                        <td colSpan={8} className="p-3">
                          <div className="rounded-xl border border-[#c79754]/30 bg-white p-3 shadow-inner">
                            <div className="mb-2 text-xs font-black text-[#37150f]">
                              Monthly Fulfillment Breakdown for {it.itemCode}:
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                              {it.monthly.map((m) => (
                                <div
                                  key={m.period}
                                  className="rounded-lg border border-[#c79754]/20 bg-[#fbf7f0]/40 p-2 text-[11px]"
                                >
                                  <div className="font-black text-[#37150f]">
                                    {m.month} 2026
                                  </div>
                                  <div className="mt-1 flex justify-between text-[10px]">
                                    <span className="text-[#91171d] font-bold">SO: {fmtInt(m.soQty)}</span>
                                    <span className="text-[#be3937] font-bold">SI: {fmtInt(m.siQty)}</span>
                                  </div>
                                  <div className="mt-1 flex justify-between font-black text-[10px] border-t border-[#c79754]/20 pt-1">
                                    <span>Rate:</span>
                                    <span
                                      className={
                                        m.fulfillmentPct >= 100
                                          ? 'text-emerald-700'
                                          : m.fulfillmentPct >= 80
                                          ? 'text-amber-700'
                                          : 'text-rose-700'
                                      }
                                    >
                                      {m.fulfillmentPct}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
