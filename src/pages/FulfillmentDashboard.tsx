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
    <div className="w-full space-y-4 sm:space-y-6 pb-12">
      {/* Search and Bubbly Status Pills */}
      <div className="w-full rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
              <input
                type="text"
                placeholder="Search item code or name for SO vs SI…"
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
                className="w-full rounded-full border border-[#c79754]/30 bg-[#fbf7f0]/70 py-2 sm:py-2.5 pl-10 pr-9 text-xs sm:text-sm font-bold text-[#37150f] placeholder:text-[#37150f]/40 focus:border-[#91171d] focus:bg-white focus:outline-none transition-colors"
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
                  className="bubbly-btn absolute right-3 top-1/2 -translate-y-1/2 text-[#37150f]/50 hover:text-[#91171d]"
                  title="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {isItemDropdownOpen && !selectedItemCode && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-[#c79754]/30 bg-white p-1.5 shadow-xl">
                  {availableItems.length === 0 ? (
                    <div className="p-3 text-center text-xs text-stone-500">No items found</div>
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
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-[#f5d275]/20 cursor-pointer transition-colors"
                      >
                        <Package className="size-3.5 shrink-0 text-[#91171d]" />
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

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-[#ebdcc8] bg-[#fbf7f0] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`bubbly-btn rounded-full px-3 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-[#37150f] text-[#f5d275] shadow-sm font-extrabold'
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
                className={`bubbly-btn rounded-full px-3 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'fulfilled'
                    ? 'bg-emerald-700 text-white shadow-sm font-extrabold'
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
                className={`bubbly-btn rounded-full px-3 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'partial'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
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
                className={`bubbly-btn rounded-full px-3 py-1.5 transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'low'
                    ? 'bg-rose-700 text-white shadow-sm font-extrabold'
                    : 'text-rose-800 hover:bg-rose-50'
                }`}
              >
                Low &lt;80% ({fulfillment.stats.lowFulfilled})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Overall KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Orders (SO)</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#91171d]/10 text-[#91171d]">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#91171d] tracking-tight">
            {fmtInt(fulfillment.totalSoQty)}{' '}
            <span className="text-xs font-bold text-[#c79754]">units</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Invoices (SI)</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#be3937]/10 text-[#be3937]">
              <Scale className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#be3937] tracking-tight">
            {fmtInt(fulfillment.totalSiQty)}{' '}
            <span className="text-xs font-bold text-[#c79754]">units</span>
          </div>
        </div>

        {/* KPI 3: Overall Fulfillment Rate */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-emerald-50/40 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">
              Fulfillment Rate
            </span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-emerald-500 text-white">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-emerald-900 tracking-tight">
            {fulfillment.overallFulfillmentPct}%
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Completed SKUs</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#c79754]/20 text-[#37150f]">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#37150f] tracking-tight">
            {fulfillment.stats.fullyFulfilled}{' '}
            <span className="text-xs font-bold text-[#c79754]">/ {fulfillment.stats.totalItems}</span>
          </div>
        </div>
      </div>

      {/* Main Comparison Chart: Single Item or Overall Monthly Trend */}
      {selectedItem ? (
        /* Selected Item Deep Dive Comparison */
        <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-3">
            <div>
              <span className="inline-block rounded-full bg-[#37150f] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                Item Fulfillment
              </span>
              <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                {selectedItem.itemCode}
              </h3>
              <p className="text-xs font-medium text-[#37150f]/70 truncate max-w-md">{selectedItem.itemDesc}</p>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-right">
              <div>
                <div className="text-[10px] font-bold text-[#91171d] uppercase">SO Demand</div>
                <div className="text-base sm:text-lg font-black text-[#91171d]">{fmtInt(selectedItem.soTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#be3937] uppercase">SI Invoiced</div>
                <div className="text-base sm:text-lg font-black text-[#be3937]">{fmtInt(selectedItem.siTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Rate</div>
                <div
                  className={`text-lg sm:text-xl font-black ${
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
          <div className="mt-4 h-60 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={selectedItem.monthly}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4ecdf" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#37150f', fontSize: 11, fontWeight: 700 }}
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
                  tick={{ fill: '#959242', fontSize: 11 }}
                  stroke="#959242"
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 150]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-2xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                        <div className="text-xs font-bold text-[#f5d275]">
                          {d.month} 2026
                        </div>
                        <div className="mt-1 text-xs">SO Demand: {fmtInt(d.soQty)} pcs</div>
                        <div className="text-xs">SI Invoiced: {fmtInt(d.siQty)} pcs</div>
                        <div className="mt-1 font-black text-emerald-400">
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
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="siQty"
                  name="SI Invoiced"
                  fill="#be3937"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="pct"
                  type="linear"
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
        /* Overall Monthly Trend Comparison */
        <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#ebdcc8] pb-3">
            <div>
              <span className="inline-block rounded-full bg-[#37150f] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                SO vs SI Monthly
              </span>
              <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                Demand vs Fulfilled (Jan – Oct 2026)
              </h3>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#91171d]"></span>
                <span className="text-[#37150f]">SO Demand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#be3937]"></span>
                <span className="text-[#37150f]">SI Fulfilled</span>
              </div>
            </div>
          </div>

          <div className="mt-4 h-60 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={fulfillment.monthly}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4ecdf" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#37150f', fontSize: 11, fontWeight: 700 }}
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
                  tick={{ fill: '#959242', fontSize: 11 }}
                  stroke="#959242"
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 150]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-2xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                        <div className="text-xs font-bold text-[#f5d275]">
                          {d.month} 2026
                        </div>
                        <div className="mt-1 text-xs">SO Demand: {fmtInt(d.soQty)} pcs</div>
                        <div className="text-xs">SI Fulfilled: {fmtInt(d.siQty)} pcs</div>
                        <div className="mt-1 font-black text-emerald-400">
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
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="siQty"
                  name="SI Fulfilled"
                  fill="#be3937"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="pct"
                  type="linear"
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
      )}

      {/* Item-by-Item Fulfillment Table */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-3">
          <h3 className="text-base font-black text-[#37150f]">
            Product Fulfillment Comparison
          </h3>

          <div className="flex items-center gap-2 text-xs font-bold self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="bubbly-btn grid size-8 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[#37150f] px-2 font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="bubbly-btn grid size-8 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto table-scroll rounded-xl border border-[#ebdcc8] bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#ebdcc8] bg-[#fbf7f0] font-black text-[#37150f]">
                <th className="py-2.5 px-3 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#ebdcc8] min-w-[110px]">
                  Item Code
                </th>
                <th className="py-2.5 px-3 min-w-[160px]">Description</th>
                <th className="py-2.5 px-3 text-right">SO Demand</th>
                <th className="py-2.5 px-3 text-right">SI Fulfilled</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-2 text-center">Details</th>
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
                    <td className="py-2.5 px-3 font-extrabold text-[#37150f] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#ebdcc8]">
                      {it.itemCode}
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px] truncate text-[#37150f]/80">
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
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-stone-200">
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
                          ? 'Over'
                          : it.status === 'fulfilled'
                          ? '100%'
                          : it.status === 'partial'
                          ? 'Partial'
                          : 'Low'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedItemCode(it.itemCode)}
                        className="bubbly-btn rounded-full bg-[#37150f] hover:bg-[#91171d] px-3 py-1 text-[11px] font-bold text-[#f5d275] transition cursor-pointer"
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
