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
  FileSpreadsheet,
  Package,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { PERIOD_KEYS, PERIOD_TO_SHORT } from '../lib/sheets';
import { fmtCompact, fmtInt } from '../lib/format';

export default function SalesInvoiceDashboard() {
  const { data } = useSalesData();
  const si = data.si;

  // Filters
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>('all');
  const [selectedItemCode, setSelectedItemCode] = useState<string>('');
  const [itemSearchInput, setItemSearchInput] = useState<string>('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState<boolean>(false);

  // Pagination for table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Filter rows by company
  const filteredRows = useMemo(() => {
    if (selectedCompanyKey === 'all') return si.rows;
    const [compCode, compName] = selectedCompanyKey.split('___');
    return si.rows.filter(
      (r) => r.companyCode === compCode && r.companyName === compName,
    );
  }, [si.rows, selectedCompanyKey]);

  // Aggregate item monthly totals under current company filter
  const itemAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        desc: string;
        monthly: Record<string, number>;
        totalQty: number;
        companyCount: number;
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
          companyCount: 0,
        };
        PERIOD_KEYS.forEach((p) => (it!.monthly[p] = 0));
        map.set(r.itemCode, it);
      }
      PERIOD_KEYS.forEach((p) => {
        it!.monthly[p] = (it!.monthly[p] || 0) + (r.monthlyQty[p] || 0);
      });
      it.totalQty += r.totalQty;
      it.companyCount++;
    }

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredRows]);

  // Available items for dropdown/search
  const filteredItemList = useMemo(() => {
    const q = itemSearchInput.toLowerCase().trim();
    if (!q) return si.items;
    return si.items.filter(
      (it) => it.code.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q),
    );
  }, [si.items, itemSearchInput]);

  // Selected item deep dive data
  const selectedItemData = useMemo(() => {
    if (!selectedItemCode) return null;
    const agg = itemAggregates.find((it) => it.code === selectedItemCode);
    const itemMeta = si.items.find((it) => it.code === selectedItemCode);
    const desc = agg?.desc || itemMeta?.desc || selectedItemCode;

    // Monthly breakdown for chart
    const monthlyList = PERIOD_KEYS.map((p) => {
      const q = agg?.monthly[p] || 0;
      return {
        period: p,
        month: PERIOD_TO_SHORT[p],
        qty: Math.round(q * 100) / 100,
      };
    });

    // Breakdown by company for this item
    const companyOrders: { code: string; name: string; qty: number }[] = [];
    for (const r of si.rows) {
      if (r.itemCode === selectedItemCode) {
        if (
          selectedCompanyKey === 'all' ||
          `${r.companyCode}___${r.companyName}` === selectedCompanyKey
        ) {
          companyOrders.push({
            code: r.companyCode,
            name: r.companyName,
            qty: r.totalQty,
          });
        }
      }
    }
    companyOrders.sort((a, b) => b.qty - a.qty);

    const totalQty = agg?.totalQty || 0;
    const avgMonthly = Math.round((totalQty / 10) * 100) / 100;
    const peak = [...monthlyList].sort((a, b) => b.qty - a.qty)[0];

    return {
      code: selectedItemCode,
      desc,
      totalQty,
      avgMonthly,
      peakMonth: peak && peak.qty > 0 ? `${peak.month} (${fmtInt(peak.qty)} pcs)` : 'N/A',
      monthlyList,
      companyOrders,
    };
  }, [selectedItemCode, itemAggregates, si.items, si.rows, selectedCompanyKey]);

  // Overall monthly totals under filter
  const overallMonthlyTrend = useMemo(() => {
    const totals: Record<string, number> = {};
    PERIOD_KEYS.forEach((p) => (totals[p] = 0));
    for (const r of filteredRows) {
      PERIOD_KEYS.forEach((p) => {
        totals[p] = (totals[p] || 0) + (r.monthlyQty[p] || 0);
      });
    }
    return PERIOD_KEYS.map((p) => ({
      period: p,
      month: PERIOD_TO_SHORT[p],
      qty: Math.round((totals[p] || 0) * 100) / 100,
    }));
  }, [filteredRows]);

  // Top 10 invoiced items
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

  // Total volume
  const totalVolume = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.totalQty, 0);
  }, [filteredRows]);

  return (
    <div className="space-y-4 pb-10">
      {/* Filters Bar */}
      <div className="rounded-[22px] border-2 border-[#c79754]/30 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Company Filter (Code + Name) */}
            <div className="relative w-full sm:w-auto sm:min-w-[280px]">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#37150f]/70">
                Filter by Company (Code & Name)
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
                <select
                  value={selectedCompanyKey}
                  onChange={(e) => {
                    setSelectedCompanyKey(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full appearance-none rounded-xl border border-[#c79754]/40 bg-[#fbf7f0]/60 py-2.5 pl-10 pr-8 text-xs font-bold text-[#37150f] shadow-inner focus:border-[#91171d] focus:bg-white focus:outline-none"
                >
                  <option value="all">🏢 All Companies ({si.companies.length} active)</option>
                  {si.companies.map((c) => (
                    <option key={`${c.code}___${c.name}`} value={`${c.code}___${c.name}`}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Item Search Bar */}
            <div className="relative w-full sm:w-auto sm:min-w-[320px] flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#37150f]/70">
                Choose Item / Search Product Code
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#c79754]" />
                <input
                  type="text"
                  placeholder="Search item code or description…"
                  value={
                    selectedItemCode
                      ? `${selectedItemCode} - ${si.items.find((i) => i.code === selectedItemCode)?.desc || ''}`
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
                  {filteredItemList.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">No items found</div>
                  ) : (
                    filteredItemList.slice(0, 30).map((it) => (
                      <button
                        key={it.code}
                        type="button"
                        onClick={() => {
                          setSelectedItemCode(it.code);
                          setItemSearchInput('');
                          setIsItemDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f5d275]/20 cursor-pointer"
                      >
                        <Package className="mt-0.5 size-3.5 shrink-0 text-[#91171d]" />
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
          </div>

          {/* Active Filter Badges */}
          <div className="flex items-center gap-2 text-xs">
            {selectedCompanyKey !== 'all' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#91171d]/10 px-3 py-1 font-bold text-[#91171d]">
                <span>Company: {selectedCompanyKey.replace('___', ' - ')}</span>
                <button
                  onClick={() => setSelectedCompanyKey('all')}
                  className="hover:text-black cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {selectedItemCode && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5d275]/50 px-3 py-1 font-bold text-[#37150f]">
                <span>Item: {selectedItemCode}</span>
                <button
                  onClick={() => setSelectedItemCode('')}
                  className="hover:text-black cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Invoiced Sales</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#91171d]/10 text-[#91171d]">
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#37150f]">
            {fmtInt(totalVolume)} <span className="text-xs font-bold text-[#c79754]">units</span>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Invoiced Products</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#be3937]/10 text-[#be3937]">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#37150f]">
            {itemAggregates.length} <span className="text-xs font-bold text-[#c79754]">SKUs</span>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Monthly Invoiced</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#959242]/10 text-[#959242]">
              <Calendar className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#37150f]">
            {fmtCompact(Math.round(totalVolume / 10))}{' '}
            <span className="text-xs font-bold text-[#c79754]">units/mo</span>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#c79754]/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#37150f]/60">
            <span className="text-xs font-bold uppercase tracking-wider">Invoiced Companies</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#c79754]/20 text-[#37150f]">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#37150f]">
            {selectedCompanyKey === 'all' ? si.companies.length : 1}
          </div>
        </div>
      </div>

      {/* Main Graph Area: Single Item Trend Graph or Overall Trend */}
      {selectedItemData ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Trend Chart (2 cols) */}
          <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#c79754]/20 pb-3">
              <div>
                <span className="inline-block rounded-full bg-[#be3937] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                  Invoiced Sales Trend
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                  {selectedItemData.code}
                </h3>
                <p className="text-xs font-bold text-[#37150f]/70">{selectedItemData.desc}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#c79754] uppercase">Jan–Oct Invoiced</div>
                <div className="text-xl font-black text-[#91171d]">
                  {fmtInt(selectedItemData.totalQty)} pcs
                </div>
              </div>
            </div>

            {/* The Graph */}
            <div className="mt-4 h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={selectedItemData.monthlyList}
                  margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1e6d4" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#37150f', fontSize: 12, fontWeight: 700 }}
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
                        <div className="rounded-xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                          <div className="text-xs font-bold text-[#f5d275]">
                            {d.month} 2026 ({d.period})
                          </div>
                          <div className="mt-1 text-sm font-black">
                            Invoiced: {fmtInt(d.qty)} pcs
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="qty"
                    name="Invoiced"
                    fill="#be3937"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                  <Line
                    type="linear"
                    dataKey="qty"
                    stroke="#f5d275"
                    strokeWidth={3}
                    dot={{ fill: '#91171d', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#37150f]/70 border-t border-[#c79754]/20 pt-2.5">
              <span>Monthly Avg: {fmtInt(selectedItemData.avgMonthly)} pcs</span>
              <span>Peak Month: {selectedItemData.peakMonth}</span>
            </div>
          </div>

          {/* Companies Invoiced for This Item */}
          <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
            <h4 className="text-sm font-black text-[#37150f] flex items-center gap-2">
              <Building2 className="size-4 text-[#91171d]" />
              Invoiced Customers for this Item
            </h4>
            <p className="mt-1 text-xs text-[#37150f]/60 font-bold">
              {selectedItemData.companyOrders.length} accounts billed
            </p>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
              {selectedItemData.companyOrders.map((co, idx) => (
                <div
                  key={`${co.code}-${co.name}`}
                  className="flex items-center justify-between rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/60 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="grid size-5 place-items-center rounded-full bg-[#be3937]/10 text-[10px] font-black text-[#be3937]">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-extrabold text-[#37150f] truncate">{co.name}</div>
                      <div className="text-[10px] text-[#37150f]/60 font-mono">{co.code}</div>
                    </div>
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
        /* Overall Invoiced Trend */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#c79754]/20 pb-3">
              <div>
                <span className="inline-block rounded-full bg-[#37150f] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#f5d275]">
                  Sales Invoice Trend
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-black text-[#37150f]">
                  Monthly Invoiced Sales Volume (Jan – Oct 2026)
                </h3>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#c79754] uppercase">Total Pieces</div>
                <div className="text-xl font-black text-[#91171d]">{fmtInt(totalVolume)} pcs</div>
              </div>
            </div>

            <div className="mt-4 h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={overallMonthlyTrend}
                  margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1e6d4" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#37150f', fontSize: 12, fontWeight: 700 }}
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
                        <div className="rounded-xl border border-[#c79754]/40 bg-[#37150f] p-3 text-white shadow-xl">
                          <div className="text-xs font-bold text-[#f5d275]">
                            {d.month} 2026 ({d.period})
                          </div>
                          <div className="mt-1 text-sm font-black">
                            Invoiced: {fmtInt(d.qty)} pcs
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="qty"
                    name="Invoiced"
                    fill="#be3937"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                  <Line
                    type="linear"
                    dataKey="qty"
                    stroke="#f5d275"
                    strokeWidth={3}
                    dot={{ fill: '#91171d', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 10 Invoiced Items */}
          <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
            <h4 className="text-sm font-black text-[#37150f] flex items-center gap-2">
              <TrendingUp className="size-4 text-[#91171d]" />
              Top 10 Invoiced Products
            </h4>
            <p className="mt-1 text-xs text-[#37150f]/60 font-bold">Highest volume billed in 2026</p>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
              {top10Items.map((it, idx) => (
                <button
                  key={it.code}
                  type="button"
                  onClick={() => setSelectedItemCode(it.code)}
                  className="w-full flex items-center justify-between rounded-xl border border-[#c79754]/20 bg-[#fbf7f0]/60 p-2.5 text-xs text-left hover:border-[#91171d] hover:bg-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="grid size-5 place-items-center rounded-full bg-[#be3937] text-[10px] font-black text-[#f5d275] shrink-0">
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

      {/* Full Monthly Breakdown Table */}
      <div className="rounded-[24px] border-2 border-[#c79754]/35 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#c79754]/20 pb-3">
          <div>
            <h3 className="text-base font-black text-[#37150f]">
              Monthly Sales Invoice Details by Product
            </h3>
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

        <div className="mt-4 overflow-x-auto table-scroll rounded-xl border border-[#c79754]/25 bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-[#c79754]/30 bg-[#fbf7f0]/90 font-black text-[#37150f]">
                <th className="py-2.5 px-3 sticky left-0 bg-[#fbf7f0] z-10 border-r border-[#c79754]/20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                  Item Code
                </th>
                <th className="py-2.5 px-3 min-w-[170px]">Description</th>
                {PERIOD_KEYS.map((p) => (
                  <th key={p} className="py-2.5 px-2 text-right whitespace-nowrap">
                    {PERIOD_TO_SHORT[p]}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total (pcs)</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c79754]/15 font-medium">
              {paginatedItems.map((it) => (
                <tr
                  key={it.code}
                  className={`hover:bg-[#f5d275]/15 transition group ${
                    selectedItemCode === it.code ? 'bg-[#f5d275]/25 font-bold' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-extrabold text-[#be3937] sticky left-0 bg-white group-hover:bg-[#fbf7f0] z-10 border-r border-[#c79754]/20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    {it.code}
                  </td>
                  <td className="py-2.5 px-3 max-w-[220px] truncate text-[#37150f]">{it.desc}</td>
                  {PERIOD_KEYS.map((p) => (
                    <td key={p} className="py-2.5 px-2 text-right tabular-nums text-[#37150f]">
                      {it.monthly[p] ? fmtInt(it.monthly[p]) : '-'}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right font-black text-[#be3937] tabular-nums">
                    {fmtInt(it.totalQty)}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemCode(it.code);
                        window.scrollTo({ top: 120, behavior: 'smooth' });
                      }}
                      className="rounded-lg bg-[#37150f] hover:bg-[#be3937] px-2.5 py-1 text-[10px] font-extrabold text-[#f5d275] transition cursor-pointer"
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
