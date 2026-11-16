import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  RefreshCw,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import {
  DEFAULT_DATA_SELECTION,
  formatPeriodShort,
  type QtyFieldChoice,
  type SITableChoice,
  type SOTableChoice,
  type SourceDbFilter,
} from '../lib/supabase';
import { getMainAppUrl } from '../lib/sso';

export default function Layout({ children }: { children: ReactNode }) {
  const {
    syncing,
    syncNow,
    lastSyncedAt,
    error,
    selection,
    setSelection,
    availablePeriods,
    availableStockGroups,
  } = useSalesData();
  const location = useLocation();
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const [logoSrc, setLogoSrc] = useState<string>(`${baseUrl}logo.jpeg`);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const mainAppUrl = getMainAppUrl();

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const isSoSection = location.pathname.startsWith('/so');
  const isSiSection = location.pathname.startsWith('/si');
  const isFulfillment = location.pathname.startsWith('/fulfillment');

  const toggleSoTable = (t: SOTableChoice) => {
    setSelection((prev) => {
      const exists = prev.soTables.includes(t);
      const next = exists ? prev.soTables.filter((x) => x !== t) : [...prev.soTables, t];
      return { ...prev, soTables: next.length > 0 ? next : ['SO'] };
    });
  };

  const toggleSiTable = (t: SITableChoice) => {
    setSelection((prev) => {
      const exists = prev.siTables.includes(t);
      const next = exists ? prev.siTables.filter((x) => x !== t) : [...prev.siTables, t];
      return { ...prev, siTables: next.length > 0 ? next : ['IV'] };
    });
  };

  return (
    <div className="app-shell antialiased selection:bg-[#91171d] selection:text-[#f5d275]">
      {/* Top Header Banner */}
      <header className="sticky top-0 z-40 w-full border-b border-[#c79754]/30 bg-[#37150f]/95 shadow-md shadow-[#37150f]/15 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3 sm:py-3.5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Top Row on Mobile: Title + Sync + WMD Logo */}
            <div className="flex items-center justify-between gap-3 md:hidden">
              <span className="text-sm font-extrabold tracking-wide text-[#f5d275]">
                Sales Prediction
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className="bubbly-btn flex items-center gap-1 rounded-full border border-[#c79754]/30 bg-[#240d09] px-3 py-1.5 text-xs font-bold text-[#f5d275] cursor-pointer"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => syncNow()}
                  disabled={syncing}
                  className="bubbly-btn flex items-center gap-1.5 rounded-full bg-[#91171d] hover:bg-[#be3937] px-3.5 py-1.5 text-xs font-bold text-[#f5d275] shadow-sm cursor-pointer disabled:opacity-60"
                  title="Sync live data from Supabase"
                >
                  <RefreshCw className={clsx('size-3.5', syncing && 'animate-spin')} />
                  <span>{syncing ? 'Syncing…' : 'Sync'}</span>
                </button>

                <a
                  href={mainAppUrl}
                  target="_top"
                  title="Back to WMD Hub"
                  aria-label="Back to WMD Hub"
                  className="flex items-center group cursor-pointer shrink-0"
                >
                  <img
                    src={logoSrc}
                    alt="WMD Logo"
                    onError={() => {
                      const fallbackSvg = `${baseUrl}logo.svg`;
                      if (logoSrc !== fallbackSvg) {
                        setLogoSrc(fallbackSvg);
                      }
                    }}
                    className="h-9 w-auto max-w-[120px] object-contain rounded-xl transition-transform group-hover:scale-105"
                  />
                </a>
              </div>
            </div>

            {/* Center: Primary Navigation Tabs (Pill Segments) */}
            <nav
              aria-label="Main navigation"
              className="flex items-center justify-start sm:justify-center gap-1.5 rounded-full border border-[#c79754]/25 bg-[#240d09] p-1.5 shadow-inner overflow-x-auto no-scrollbar"
            >
              <NavLink
                to="/so/dashboard"
                className={() =>
                  clsx(
                    'bubbly-btn flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap transition-all duration-200',
                    isSoSection
                      ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/30 scale-[1.02]'
                      : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                  )
                }
              >
                <Layers className="size-4 shrink-0" />
                <span>Sales Orders</span>
              </NavLink>

              <NavLink
                to="/si/dashboard"
                className={() =>
                  clsx(
                    'bubbly-btn flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap transition-all duration-200',
                    isSiSection
                      ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/30 scale-[1.02]'
                      : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                  )
                }
              >
                <FileSpreadsheet className="size-4 shrink-0" />
                <span>Sales Invoices</span>
              </NavLink>

              <NavLink
                to="/fulfillment"
                className={() =>
                  clsx(
                    'bubbly-btn flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap transition-all duration-200',
                    isFulfillment
                      ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/30 scale-[1.02]'
                      : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                  )
                }
              >
                <Scale className="size-4 shrink-0" />
                <span>SO vs SI</span>
              </NavLink>
            </nav>

            {/* Right: Desktop Data Source Button, Live Indicator & Sync Action */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={clsx(
                  'bubbly-btn flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-bold cursor-pointer transition-colors',
                  filtersOpen
                    ? 'border-[#f5d275] bg-[#f5d275] text-[#37150f]'
                    : 'border-[#c79754]/30 bg-[#240d09] text-[#f5d275] hover:border-[#f5d275]/60',
                )}
                title="Choose SQL Accounting tables, database, date range & quantity unit"
              >
                <SlidersHorizontal className="size-4" />
                <span>
                  {selection.sourceDb === 'ALL' ? 'All DBs' : selection.sourceDb} • {selection.qtyField.toUpperCase()}
                </span>
              </button>

              <div className="flex items-center gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] px-3.5 py-2 text-xs sm:text-sm">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-bold text-[#f5d275]">
                  {syncing ? 'Syncing…' : formattedSyncTime ? `Live: ${formattedSyncTime}` : 'Live DB'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => syncNow()}
                disabled={syncing}
                className="bubbly-btn flex items-center gap-2 rounded-full bg-[#91171d] hover:bg-[#be3937] px-4 py-2 text-xs sm:text-sm font-bold text-[#f5d275] shadow-md shadow-[#91171d]/30 cursor-pointer disabled:opacity-60"
                title="Fetch fresh data from Supabase"
              >
                <RefreshCw className={clsx('size-4', syncing && 'animate-spin')} />
                <span>{syncing ? 'Syncing…' : 'Sync'}</span>
              </button>

              <a
                href={mainAppUrl}
                target="_top"
                title="Back to WMD Hub"
                aria-label="Back to WMD Hub"
                className="flex items-center group cursor-pointer shrink-0"
              >
                <img
                  src={logoSrc}
                  alt="WMD Logo"
                  onError={() => {
                    const fallbackSvg = `${baseUrl}logo.svg`;
                    if (logoSrc !== fallbackSvg) {
                      setLogoSrc(fallbackSvg);
                    }
                  }}
                  className="h-10 w-auto max-w-[160px] object-contain rounded-xl transition-transform group-hover:scale-105"
                />
              </a>
            </div>
          </div>
        </div>

        {/* Collapsible Data Source & Table Selector Drawer */}
        {filtersOpen && (
          <div className="w-full border-t border-[#c79754]/25 bg-[#240d09] px-4 sm:px-6 lg:px-8 xl:px-12 py-3.5 text-xs text-[#f5d275]">
            <div className="flex flex-wrap items-center gap-4">
              {/* Database */}
              <div className="flex items-center gap-1.5">
                <Database className="size-3.5 text-[#c79754]" />
                <span className="font-bold text-[#c79754]">DB:</span>
                <select
                  value={selection.sourceDb}
                  onChange={(e) => setSelection((p) => ({ ...p, sourceDb: e.target.value as SourceDbFilter }))}
                  className="rounded-lg border border-[#c79754]/30 bg-[#37150f] px-2.5 py-1 font-bold text-[#f5d275]"
                >
                  <option value="ALL">Combined (ACC-0002 + ACC-0006)</option>
                  <option value="ACC-0002">ACC-0002 only</option>
                  <option value="ACC-0006">ACC-0006 only</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#c79754]">From:</span>
                <select
                  value={selection.fromPeriod}
                  onChange={(e) => setSelection((p) => ({ ...p, fromPeriod: e.target.value }))}
                  className="rounded-lg border border-[#c79754]/30 bg-[#37150f] px-2 py-1 font-bold text-[#f5d275]"
                >
                  <option value="">Earliest</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{formatPeriodShort(p)}</option>
                  ))}
                </select>
                <span className="font-bold text-[#c79754]">To:</span>
                <select
                  value={selection.toPeriod}
                  onChange={(e) => setSelection((p) => ({ ...p, toPeriod: e.target.value }))}
                  className="rounded-lg border border-[#c79754]/30 bg-[#37150f] px-2 py-1 font-bold text-[#f5d275]"
                >
                  <option value="">Latest</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{formatPeriodShort(p)}</option>
                  ))}
                </select>
              </div>

              {/* Quantity Field */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#c79754]">Qty:</span>
                <select
                  value={selection.qtyField}
                  onChange={(e) => setSelection((p) => ({ ...p, qtyField: e.target.value as QtyFieldChoice }))}
                  className="rounded-lg border border-[#c79754]/30 bg-[#37150f] px-2 py-1 font-bold text-[#f5d275]"
                >
                  <option value="sqty">SQTY (Base Units)</option>
                  <option value="qty">QTY (Doc UOM)</option>
                </select>
              </div>

              {/* Stock Group */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#c79754]">Group:</span>
                <select
                  value={selection.stockGroup}
                  onChange={(e) => setSelection((p) => ({ ...p, stockGroup: e.target.value }))}
                  className="rounded-lg border border-[#c79754]/30 bg-[#37150f] px-2 py-1 font-bold text-[#f5d275]"
                >
                  <option value="ALL">All Stock Groups</option>
                  {availableStockGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* SO Tables */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#c79754]">SO Tables:</span>
                {(['SO', 'DO'] as SOTableChoice[]).map((t) => (
                  <label key={t} className="inline-flex items-center gap-1 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={selection.soTables.includes(t)}
                      onChange={() => toggleSoTable(t)}
                      className="accent-[#91171d]"
                    />
                    <span>SL_{t}</span>
                  </label>
                ))}
              </div>

              {/* SI Tables */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#c79754]">SI Tables:</span>
                {([
                  ['IV', 'SL_IV'],
                  ['CS', '+SL_CS'],
                  ['CN', '-SL_CN'],
                  ['DN', '+SL_DN'],
                ] as Array<[SITableChoice, string]>).map(([t, lbl]) => (
                  <label key={t} className="inline-flex items-center gap-1 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={selection.siTables.includes(t)}
                      onChange={() => toggleSiTable(t)}
                      className="accent-[#91171d]"
                    />
                    <span>{lbl}</span>
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setSelection(DEFAULT_DATA_SELECTION)}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#c79754]/30 px-2.5 py-1 font-bold text-[#c79754] hover:text-[#f5d275] cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}

        {/* Secondary Sub-Navigation Bar for SO and SI */}
        {(isSoSection || isSiSection) && (
          <div className="w-full border-t border-[#c79754]/20 bg-[#2d110c] px-4 sm:px-6 lg:px-8 xl:px-12 py-2">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
              <NavLink
                to={isSoSection ? '/so/dashboard' : '/si/dashboard'}
                className={({ isActive }) =>
                  clsx(
                    'bubbly-btn flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[#f5d275] text-[#37150f] shadow-sm font-black'
                      : 'text-[#f5d275]/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <LayoutDashboard className="size-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to={isSoSection ? '/so/prediction' : '/si/prediction'}
                className={({ isActive }) =>
                  clsx(
                    'bubbly-btn flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[#91171d] text-[#f5d275] shadow-sm font-black'
                      : 'text-[#f5d275]/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Sparkles className="size-4" />
                <span>Predictions</span>
              </NavLink>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="app-main-content flex-1 px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7">
        <div className="w-full">
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm font-bold text-amber-900 shadow-sm">
              <span>Notice: {error} (Serving local cache)</span>
              <button
                onClick={() => syncNow()}
                className="underline hover:text-amber-950 cursor-pointer ml-3 font-extrabold"
              >
                Retry
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
