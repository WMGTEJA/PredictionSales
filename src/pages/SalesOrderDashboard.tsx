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
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Layers,
  Package,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { PERIOD_KEYS, PERIOD_TO_SHORT } from '../lib/sheets';
import { fmtCompact, fmtInt } from '../lib/format';

export default function SalesOrderDashboard() {
  const { data } = useSalesData();
  const so = data.so;

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedItemCode, setSelectedItemCode] = useState<string>('');
  const [itemSearchInput, setItemSearchInput] = useState<string>('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState<boolean>(false);

  // Pagination for table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Filtered rows based on Company selection
  const filteredRows = useMemo(() => {
    if (selectedCompany === 'all') return so.rows;
    return so.rows.filter((r) => r.companyName === selectedCompany);
  }, [so.rows, selectedCompany]);

  // Aggregate item monthly totals under current company filter
  const itemAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        desc: string;
        monthly: Record<string, number>;
        totalQty: number;
        companyCount: Set<string>;
      }
    >();

    for (const r of filteredRows) {
      let it = map.get(r.itemCode);
      if (!it) {
        it = {
          code: r.itemCode,
          desc: r.itemDesc,
          monthly: {},
          totalQty: 0,
          companyCount: new Set(),
        };
        PERIOD_KEYS.forEach((p) => (it!.monthly[p] = 0));
        map.set(r.itemCode, it);
      }
      it.monthly[r.period] = (it.monthly[r.period] || 0) + r.qty;
      it.totalQty += r.qty;
      it.companyCount.add(r.companyName);
    }

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredRows]);

  // Available items for search / dropdown
  const filteredItemList = useMemo(() => {
    const q = itemSearchInput.toLowerCase().trim();
    if (!q) return so.items;
    return so.items.filter(
      (it) => it.code.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q),
    );
  }, [so.items, itemSearchInput]);

  // Selected item details (if one is picked)
  const selectedItemData = useMemo(() => {
    if (!selectedItemCode) return null;
    const agg = itemAggregates.find((it) => it.code === selectedItemCode);
    const itemMeta = so.items.find((it) => it.code === selectedItemCode);
    const desc = agg?.desc || itemMeta?.desc || selectedItemCode;

    // Monthly breakdown for chart
    const monthlyList = PERIOD_KEYS.map((p) => {
      const q = agg?.monthly[p] || 0;
      return {
        period: p,
        month: PERIOD_TO_SHORT[p],
        qty: q,
      };
    });

    // Breakdown by company for this item
    const companyOrdersMap = new Map<string, number>();
    for (const r of so.rows) {
      if (r.itemCode === selectedItemCode) {
        if (selectedCompany === 'all' || r.companyName === selectedCompany) {
          companyOrdersMap.set(
            r.companyName,
            (companyOrdersMap.get(r.companyName) || 0) + r.qty,
          );
        }
      }
    }
    const companyOrders = Array.from(companyOrdersMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    const totalQty = agg?.totalQty || 0;
    const avgMonthly = Math.round(totalQty / 10);
    const peak = [...monthlyList].sort((a, b) => b.qty - a.qty)[0];

    return {
      code: selectedItemCode,
      desc,
      totalQty,
      avgMonthly,
      peakMonth: peak && peak.qty > 0 ? `${peak.month} (${fmtInt(peak.qty)})` : 'N/A',
      monthlyList,
      companyOrders,
    };
  }, [selectedItemCode, itemAggregates, so.items, so.rows, selectedCompany]);

  // Overall monthly totals under company filter
  const overallMonthlyTrend = useMemo(() => {
    const totals: Record<string, number> = {};
    PERIOD_KEYS.forEach((p) => (totals[p] = 0));
    for (const r of filteredRows) {
      totals[r.period] = (totals[r.period] || 0) + r.qty;
    }
    return PERIOD_KEYS.map((p) => ({
      period: p,
      month: PERIOD_TO_SHORT[p],
      qty: totals[p] || 0,
    }));
  }, [filteredRows]);

  // Top 10 items under filter
  const top10Items = useMemo(() => {
    return itemAggregates.slice(0, 10);
  }, [itemAggregates]);

  // Table items search filter
  const tableDisplayItems = useMemo(() => {
    if (selectedItemCode) {
      return itemAggregates.filter((it) => it.code === selectedItemCode);
    }
    const q = itemSearchInput.toLowerCase().trim();
    if (!q) return itemAggregates;
    return itemAggregates.filter(
      (it) => it.code.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q),
    );
  }, [itemAggregates, selectedItemCode, itemSearchInput]);

  const totalPages = Math.ceil(tableDisplayItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tableDisplayItems.slice(start, start + pageSize);
  }, [tableDisplayItems, currentPage, pageSize]);

  // Total summary metrics
  const totalVolume = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.qty, 0);
  }, [filteredRows]);

  return (
    <div className="w-full space-y-4 sm:space-y-6 pb-12">
      {/* Streamlined Bubbly Filter Bar */}
      <div className="w-full rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
              <input
                type="text"
                placeholder="Search item code or name…"
                value={
                  selectedItemCode
                    ? `${selectedItemCode} • ${so.items.find((i) => i.code === selectedItemCode)?.desc || ''}`
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

              {/* Item Autocomplete Dropdown */}
              {isItemDropdownOpen && !selectedItemCode && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-[#c79754]/30 bg-white p-1.5 shadow-xl">
                  {filteredItemList.length === 0 ? (
                    <div className="p-3 text-center text-xs text-stone-500">No items found</div>
                  ) : (
                    filteredItemList.slice(0, 25).map((it) => (
                      <button
                        key={it.code}
                        type="button"
                        onClick={() => {
                          setSelectedItemCode(it.code);
                          setItemSearchInput('');
                          setIsItemDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-[#f5d275]/20 cursor-pointer transition-colors"
                      >
                        <Package className="size-3.5 shrink-0 text-[#91171d]" />
                        <div className="flex-1 truncate">
                          <span className="font-extrabold text-[#37150f]">{it.code}</span>
                          <span className="ml-1.5 text-[#37150f]/70 truncate">{it.desc}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Company Dropdown Pill */}
            <div className="relative sm:w-64">
              <Building2 className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none rounded-full border border-[#c79754]/30 bg-[#fbf7f0]/70 py-2 sm:py-2.5 pl-10 pr-8 text-xs sm:text-sm font-bold text-[#37150f] focus:border-[#91171d] focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="all">All Companies ({so.companies.length})</option>
                {so.companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Tags */}
          {(selectedCompany !== 'all' || selectedItemCode) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
              {selectedCompany !== 'all' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#91171d]/10 px-3 py-1 text-xs font-bold text-[#91171d]">
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{selectedCompany}</span>
                  <button
                    onClick={() => setSelectedCompany('all')}
                    className="hover:text-black cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {selectedItemCode && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5d275]/60 px-3 py-1 text-xs font-bold text-[#37150f]">
                  <span>{selectedItemCode}</span>
                  <button
                    onClick={() => setSelectedItemCode('')}
                    className="hover:text-black cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedCompany('all');
                  setSelectedItemCode('');
                  setItemSearchInput('');
                  setCurrentPage(1);
                }}
                className="bubbly-btn text-xs font-bold text-[#91171d] hover:underline cursor-pointer px-1"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Responsive Bubbly KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Total Volume</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#91171d]/10 text-[#91171d]">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#37150f] tracking-tight">
            {fmtInt(totalVolume)} <span className="text-xs font-bold text-[#c79754]">units</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Active Products</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#be3937]/10 text-[#be3937]">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#37150f] tracking-tight">
            {itemAggregates.length} <span className="text-xs font-bold text-[#c79754]">SKUs</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Monthly Avg</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#959242]/15 text-[#959242]">
              <Calendar className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#37150f] tracking-tight">
            {fmtCompact(Math.round(totalVolume / 10))}{' '}
            <span className="text-xs font-bold text-[#c79754]">/mo</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bubbly-card rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">Customers</span>
            <div className="grid size-8 sm:size-9 place-items-center rounded-2xl bg-[#c79754]/20 text-[#37150f]">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl md:text-3xl font-black text-[#37150f] tracking-tight">
            {selectedCompany === 'all' ? so.companies.length : 1}{' '}
            <span className="text-xs font-bold text-[#c79754]">active</span>
          </div>
        </div>
      </div>

      {/* Main Graph & Deep Dive Section */}
      {selectedItemData ? (
        /* Single Item Deep Dive */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Trend Chart (2 cols) */}
          <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#ebdcc8] pb-3">
              <div>
                <span className="inline-block rounded-full bg-[#91171d] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                  Item Trend
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                  {selectedItemData.code}
                </h3>
                <p className="text-xs font-medium text-[#37150f]/70 truncate max-w-md">{selectedItemData.desc}</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[11px] font-bold text-[#c79754] uppercase">10-Mo Total</div>
                <div className="text-xl font-black text-[#91171d]">
                  {fmtInt(selectedItemData.totalQty)} pcs
                </div>
              </div>
            </div>

            <div className="mt-4 h-60 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={selectedItemData.monthlyList}
                  margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4ecdf" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#37150f', fontSize: 11, fontWeight: 700 }}
                    stroke="#c79754"
                  />
                  <YAxis
                    tick={{ fill: '#37150f', fontSize: 11 }}
                    stroke="#c79754"
                    tickFormatter={(v) => fmtCompact(v)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-2xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                          <div className="text-xs font-bold text-[#f5d275]">
                            {d.month} 2026 ({d.period})
                          </div>
                          <div className="mt-1 text-sm font-black">
                            Orders: {fmtInt(d.qty)} pcs
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="qty"
                    name="Orders"
                    fill="#91171d"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={44}
                  />
                  <Line
                    type="linear"
                    dataKey="qty"
                    stroke="#f5d275"
                    strokeWidth={3}
                    dot={{ fill: '#be3937', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#37150f]/70 border-t border-[#ebdcc8] pt-2.5">
              <span>Avg: {fmtInt(selectedItemData.avgMonthly)} pcs/mo</span>
              <span>Peak: {selectedItemData.peakMonth}</span>
            </div>
          </div>

          {/* Companies Ordering This Item */}
          <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
            <h4 className="text-sm font-black text-[#37150f] flex items-center gap-2">
              <Building2 className="size-4 text-[#91171d]" />
              Ordering Customers ({selectedItemData.companyOrders.length})
            </h4>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1 table-scroll">
              {selectedItemData.companyOrders.map((co, idx) => (
                <div
                  key={co.name}
                  className="flex items-center justify-between rounded-xl border border-[#ebdcc8] bg-[#fbf7f0]/60 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="grid size-5 place-items-center rounded-full bg-[#91171d]/10 text-[10px] font-black text-[#91171d] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-[#37150f] truncate">{co.name}</span>
                  </div>
                  <span className="font-black text-[#91171d] shrink-0 ml-2">
                    {fmtInt(co.qty)} pcs
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Overall Monthly Sales Order Trend View */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Overall Trend Chart (2 cols) */}
          <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#ebdcc8] pb-3">
              <div>
                <span className="inline-block rounded-full bg-[#37150f] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                  Sales Order Trend
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                  Monthly Volume (Jan – Oct 2026)
                </h3>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold text-[#c79754] uppercase">Total Units</div>
                <div className="text-xl font-black text-[#91171d]">{fmtInt(totalVolume)} pcs</div>
              </div>
            </div>

            <div className="mt-4 h-60 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={overallMonthlyTrend}
                  margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4ecdf" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#37150f', fontSize: 11, fontWeight: 700 }}
                    stroke="#c79754"
                  />
                  <YAxis
                    tick={{ fill: '#37150f', fontSize: 11 }}
                    stroke="#c79754"
                    tickFormatter={(v) => fmtCompact(v)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-2xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                          <div className="text-xs font-bold text-[#f5d275]">
                            {d.month} 2026 ({d.period})
                          </div>
                          <div className="mt-1 text-sm font-black">
                            Total: {fmtInt(d.qty)} pcs
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="qty"
                    name="Orders"
                    fill="#91171d"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={44}
                  />
                  <Line
                    type="linear"
                    dataKey="qty"
                    stroke="#f5d275"
                    strokeWidth={3}
                    dot={{ fill: '#be3937', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 10 Ordered Items */}
          <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-5 shadow-sm">
            <h4 className="text-sm font-black text-[#37150f] flex items-center gap-2">
              <TrendingUp className="size-4 text-[#91171d]" />
              Top 10 Products (2026)
            </h4>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1 table-scroll">
              {top10Items.map((it, idx) => (
                <button
                  key={it.code}
                  type="button"
                  onClick={() => setSelectedItemCode(it.code)}
                  className="bubbly-btn w-full flex items-center justify-between rounded-xl border border-[#ebdcc8] bg-[#fbf7f0]/60 p-2.5 text-xs text-left hover:border-[#91171d] hover:bg-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="grid size-5 place-items-center rounded-full bg-[#91171d] text-[10px] font-black text-[#f5d275] shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-extrabold text-[#37150f] truncate">{it.code}</div>
                      <div className="text-[10px] text-[#37150f]/70 truncate">{it.desc}</div>
                    </div>
                  </div>
                  <span className="font-black text-[#91171d] shrink-0 ml-2">
                    {fmtCompact(it.totalQty)} pcs
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Monthly Breakdown Data Table */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#ebdcc8] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ebdcc8] pb-3">
          <h3 className="text-base font-black text-[#37150f]">
            Monthly Orders by Product
          </h3>

          {/* Compact Pagination */}
          <div className="flex items-center gap-2 text-xs font-bold self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="bubbly-btn grid size-8 place-items-center rounded-full border border-[#ebdcc8] bg-[#fbf7f0] hover:bg-[#f5d275]/40 disabled:opacity-40 cursor-pointer"
              title="Previous page"
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
              title="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Responsive Table with Sticky Item Code Column */}
        <div className="mt-3 overflow-x-auto table-scroll rounded-xl border border-[#ebdcc8] bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#ebdcc8] bg-[#fbf7f0] font-black text-[#37150f]">
                <th className="py-2.5 px-3 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#ebdcc8]">
                  Item Code
                </th>
                <th className="py-2.5 px-3 min-w-[160px]">Description</th>
                {PERIOD_KEYS.map((p) => (
                  <th key={p} className="py-2.5 px-2 text-right whitespace-nowrap">
                    {PERIOD_TO_SHORT[p]}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebdcc8]/70 font-medium">
              {paginatedItems.map((it) => (
                <tr
                  key={it.code}
                  className={`hover:bg-[#f5d275]/15 transition group ${
                    selectedItemCode === it.code ? 'bg-[#f5d275]/25 font-bold' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-extrabold text-[#91171d] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#ebdcc8]">
                    {it.code}
                  </td>
                  <td className="py-2.5 px-3 max-w-[220px] truncate text-[#37150f]">{it.desc}</td>
                  {PERIOD_KEYS.map((p) => (
                    <td key={p} className="py-2.5 px-2 text-right tabular-nums text-[#37150f]">
                      {it.monthly[p] ? fmtInt(it.monthly[p]) : '-'}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right font-black text-[#91171d] tabular-nums">
                    {fmtInt(it.totalQty)}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemCode(it.code);
                        window.scrollTo({ top: 120, behavior: 'smooth' });
                      }}
                      className="bubbly-btn rounded-full bg-[#37150f] hover:bg-[#91171d] px-3 py-1 text-[11px] font-bold text-[#f5d275] transition cursor-pointer"
                    >
                      Trend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
