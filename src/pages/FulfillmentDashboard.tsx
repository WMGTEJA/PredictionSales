import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Package,
  Scale,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { fmtCompact, fmtInt } from '../lib/format';

export default function FulfillmentDashboard() {
  const { data } = useSalesData();
  const fulfillment = data.fulfillment;

  const [selectedItemCode, setSelectedItemCode] = useState<string>('');
  const [itemSearchInput, setItemSearchInput] = useState<string>('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'fulfilled' | 'partial' | 'low'>('all');

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

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-12">
      {/* Search and Bubbly Status Pills */}
      <div className="w-full rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#c79754]" />
              <input
                type="text"
                placeholder="Search item code or description for SO vs SI…"
                value={
                  selectedItemCode
                    ? `${selectedItemCode} • ${selectedItem?.itemDesc || ''}`
                    : itemSearchInput
                }
                onChange={(e) => {
                  setSelectedItemCode('');
                  setItemSearchInput(e.target.value);
                  setIsItemDropdownOpen(true);
                }}
                onFocus={() => setIsItemDropdownOpen(true)}
                className="w-full rounded-full border border-[#c79754]/30 bg-[#fbf7f0]/70 py-2.5 sm:py-3 pl-11 pr-10 text-sm sm:text-base font-bold text-[#37150f] placeholder:text-[#37150f]/40 focus:border-[#91171d] focus:bg-white focus:outline-none transition-colors"
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
                  className="bubbly-btn absolute right-3.5 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-[#91171d] p-1"
                  title="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {isItemDropdownOpen && !selectedItemCode && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-[#c79754]/30 bg-white p-2 shadow-xl">
                  {availableItems.length === 0 ? (
                    <div className="p-3 text-center text-sm font-semibold text-stone-500">No items found</div>
                  ) : (
                    availableItems.slice(0, 25).map((it) => (
                      <button
                        key={it.itemCode}
                        type="button"
                        onClick={() => {
                          setSelectedItemCode(it.itemCode);
                          setItemSearchInput('');
                          setIsItemDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm hover:bg-[#f5d275]/20 cursor-pointer transition-colors"
                      >
                        <Package className="size-4 shrink-0 text-[#91171d]" />
                        <div className="flex-1 truncate">
                          <span className="font-extrabold text-[#37150f]">{it.itemCode}</span>
                          <span className="ml-2 text-[#37150f]/75 font-medium truncate">{it.itemDesc}</span>
                        </div>
                        <span
                          className={`text-xs font-black shrink-0 px-2.5 py-1 rounded-full ${
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

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-full border border-[#ebdcc8] bg-[#fbf7f0] p-1.5 text-xs sm:text-sm font-bold">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`bubbly-btn rounded-full px-3.5 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-[#37150f] text-[#f5d275] shadow-sm font-black'
                    : 'text-[#37150f]/75 hover:bg-white/60'
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
                className={`bubbly-btn rounded-full px-3.5 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'fulfilled'
                    ? 'bg-emerald-700 text-white shadow-sm font-black'
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
                className={`bubbly-btn rounded-full px-3.5 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'partial'
                    ? 'bg-amber-600 text-white shadow-sm font-black'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                Partial ({fulfillment.stats.partiallyFulfilled})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('low');
                  setCurrentPage(1);
                }}
                className={`bubbly-btn rounded-full px-3.5 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'low'
                    ? 'bg-rose-700 text-white shadow-sm font-black'
                    : 'text-rose-800 hover:bg-rose-50'
                }`}
              >
                Low &lt;80% ({fulfillment.stats.lowFulfilled})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Bubbly KPI Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/70">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">Orders (SO)</span>
            <div className="grid size-9 sm:size-10 place-items-center rounded-2xl bg-[#91171d]/10 text-[#91171d]">
              <Package className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black text-[#91171d] tracking-tight">
            {fmtInt(fulfillment.totalSoQty)}{' '}
            <span className="text-xs sm:text-sm font-bold text-[#c79754]">units</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/70">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">Invoices (SI)</span>
            <div className="grid size-9 sm:size-10 place-items-center rounded-2xl bg-[#be3937]/10 text-[#be3937]">
              <Scale className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black text-[#be3937] tracking-tight">
            {fmtInt(fulfillment.totalSiQty)}{' '}
            <span className="text-xs sm:text-sm font-bold text-[#c79754]">units</span>
          </div>
        </div>

        {/* KPI 3: Overall Fulfillment Rate */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-emerald-50/40 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
              Fulfillment Rate
            </span>
            <div className="grid size-9 sm:size-10 place-items-center rounded-2xl bg-emerald-500 text-white">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-900 tracking-tight">
            {fulfillment.overallFulfillmentPct}%
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/70">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">Completed SKUs</span>
            <div className="grid size-9 sm:size-10 place-items-center rounded-2xl bg-[#c79754]/20 text-[#37150f]">
              <TrendingUp className="size-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black text-[#37150f] tracking-tight">
            {fulfillment.stats.fullyFulfilled}{' '}
            <span className="text-xs sm:text-sm font-bold text-[#c79754]">/ {fulfillment.stats.totalItems}</span>
          </div>
        </div>
      </div>

      {/* Main Comparison Chart: Single Item or Overall Monthly Trend */}
      {selectedItem ? (
        /* Selected Item Deep Dive Comparison */
        <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-4">
            <div>
              <span className="inline-block rounded-full bg-[#37150f] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#f5d275]">
                Item Fulfillment
              </span>
              <h3 className="mt-1.5 text-lg sm:text-xl font-black text-[#37150f]">
                {selectedItem.itemCode}
              </h3>
              <p className="text-sm font-medium text-[#37150f]/75 truncate max-w-lg">{selectedItem.itemDesc}</p>
            </div>
            <div className="flex items-center gap-4 sm:gap-7 text-right">
              <div>
                <div className="text-xs font-bold text-[#91171d] uppercase tracking-wider">SO Demand</div>
                <div className="text-lg sm:text-2xl font-black text-[#91171d]">{fmtInt(selectedItem.soTotal)}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-[#be3937] uppercase tracking-wider">SI Invoiced</div>
                <div className="text-lg sm:text-2xl font-black text-[#be3937]">{fmtInt(selectedItem.siTotal)}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Rate</div>
                <div
                  className={`text-xl sm:text-3xl font-black ${
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

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebdcc8]/60 pb-3 mt-3">
            <div className="text-xs font-bold text-[#37150f]/70">
              Monthly Demand vs Invoiced
            </div>
            <div className="flex items-center gap-4 text-xs sm:text-sm font-bold">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#91171d]"></span>
                <span className="text-[#37150f]">SO Demand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#be3937]"></span>
                <span className="text-[#37150f]">SI Invoiced</span>
              </div>
            </div>
          </div>

          {/* Chart for this item */}
          <div className="mt-4 h-64 sm:h-76 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={selectedItem.monthly}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4ecdf" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#37150f', fontSize: 12, fontWeight: 700 }}
                  stroke="#c79754"
                />
                <YAxis
                  tick={{ fill: '#37150f', fontSize: 12, fontWeight: 600 }}
                  stroke="#c79754"
                  tickFormatter={(v) => fmtCompact(v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-2xl border border-[#c79754]/40 bg-[#37150f] p-3.5 text-white shadow-xl min-w-[200px]">
                        <div className="text-xs font-bold text-[#f5d275] border-b border-white/10 pb-1 mb-2">
                          {d.month} 2026
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#91171d]"></span>
                            <span>SO Demand:</span>
                          </span>
                          <span className="tabular-nums font-bold">{fmtInt(d.soQty)} pcs</span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3 mt-1">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#be3937]"></span>
                            <span>SI Invoiced:</span>
                          </span>
                          <span className="tabular-nums font-bold">{fmtInt(d.siQty)} pcs</span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3 mt-1">
                          <span className="text-stone-300">Variance:</span>
                          <span className={`tabular-nums font-bold ${d.variance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {d.variance >= 0 ? `+${fmtInt(d.variance)}` : `${fmtInt(d.variance)}`} pcs
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                          <span className="text-xs font-bold text-[#f5d275]">Fulfillment:</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-black ${
                              d.fulfillmentPct >= 100
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : d.fulfillmentPct >= 80
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {d.fulfillmentPct}%
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="soQty"
                  name="SO Demand"
                  fill="#91171d"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="siQty"
                  name="SI Invoiced"
                  fill="#be3937"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* Overall Monthly Trend Comparison */
        <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-4">
            <div>
              <span className="inline-block rounded-full bg-[#37150f] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#f5d275]">
                SO vs SI Monthly
              </span>
              <h3 className="mt-1.5 text-lg sm:text-xl font-black text-[#37150f]">
                Demand vs Fulfilled (Jan – Oct 2026)
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs sm:text-sm font-bold">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#91171d]"></span>
                <span className="text-[#37150f]">SO Demand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-[#be3937]"></span>
                <span className="text-[#37150f]">SI Fulfilled</span>
              </div>
            </div>
          </div>

          <div className="mt-4 h-64 sm:h-76 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fulfillment.monthly}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4ecdf" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#37150f', fontSize: 12, fontWeight: 700 }}
                  stroke="#c79754"
                />
                <YAxis
                  tick={{ fill: '#37150f', fontSize: 12, fontWeight: 600 }}
                  stroke="#c79754"
                  tickFormatter={(v) => fmtCompact(v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-2xl border border-[#c79754]/40 bg-[#37150f] p-3.5 text-white shadow-xl min-w-[200px]">
                        <div className="text-xs font-bold text-[#f5d275] border-b border-white/10 pb-1 mb-2">
                          {d.month} 2026
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#91171d]"></span>
                            <span>SO Demand:</span>
                          </span>
                          <span className="tabular-nums font-bold">{fmtInt(d.soQty)} pcs</span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3 mt-1">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#be3937]"></span>
                            <span>SI Fulfilled:</span>
                          </span>
                          <span className="tabular-nums font-bold">{fmtInt(d.siQty)} pcs</span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold gap-3 mt-1">
                          <span className="text-stone-300">Variance:</span>
                          <span className={`tabular-nums font-bold ${d.variance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {d.variance >= 0 ? `+${fmtInt(d.variance)}` : `${fmtInt(d.variance)}`} pcs
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                          <span className="text-xs font-bold text-[#f5d275]">Fulfillment:</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-black ${
                              d.fulfillmentPct >= 100
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : d.fulfillmentPct >= 80
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {d.fulfillmentPct}%
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="soQty"
                  name="SO Demand"
                  fill="#91171d"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="siQty"
                  name="SI Fulfilled"
                  fill="#be3937"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Item-by-Item Fulfillment Table */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-4">
          <h3 className="text-lg font-black text-[#37150f]">
            Product Fulfillment Comparison
          </h3>

          <div className="flex items-center gap-2 text-sm font-bold self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="bubbly-btn grid size-8.5 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <span className="text-[#37150f] px-2 font-extrabold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="bubbly-btn grid size-8.5 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        </div>

        <div className="mt-3.5 overflow-x-auto table-scroll rounded-xl border border-[#ebdcc8] bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#ebdcc8] bg-[#fbf7f0] font-black text-[#37150f]">
                <th className="py-3 px-3.5 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#ebdcc8] min-w-[120px] whitespace-nowrap">
                  Item Code
                </th>
                <th className="py-3 px-3.5 min-w-[180px]">Description</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">SO Demand</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">SI Fulfilled</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Rate</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Variance</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-2.5 text-center whitespace-nowrap">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebdcc8]/70 font-medium">
              {paginatedItems.map((it) => {
                return (
                  <tr
                    key={it.itemCode}
                    className={`hover:bg-[#f5d275]/15 transition ${
                      selectedItemCode === it.itemCode ? 'bg-[#f5d275]/25 font-bold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-extrabold text-[#37150f] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#ebdcc8] whitespace-nowrap">
                      {it.itemCode}
                    </td>
                    <td className="py-2.5 px-3.5 max-w-[240px] truncate text-[#37150f] font-semibold">
                      {it.itemDesc}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-extrabold text-[#91171d] tabular-nums">
                      {fmtInt(it.soTotal)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-extrabold text-[#be3937] tabular-nums">
                      {fmtInt(it.siTotal)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="h-2 w-14 overflow-hidden rounded-full bg-stone-200">
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
                      className={`py-2.5 px-3.5 text-right font-bold tabular-nums ${
                        it.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {it.variance >= 0 ? `+${fmtInt(it.variance)}` : fmtInt(it.variance)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wider ${
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
                          ? 'Over'
                          : it.status === 'fulfilled'
                          ? '100%'
                          : it.status === 'partial'
                          ? 'Partial'
                          : 'Low'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedItemCode(it.itemCode)}
                        className="bubbly-btn rounded-full bg-[#37150f] hover:bg-[#91171d] px-3.5 py-1 text-xs font-bold text-[#f5d275] transition cursor-pointer"
                      >
                        View
                      </button>
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
