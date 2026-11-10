import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  ExternalLink,
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';
import { SPREADSHEET_MAIN_URL } from '../lib/sheets';

export default function Layout({ children }: { children: ReactNode }) {
  const { syncing, syncNow, lastSyncedAt, error } = useSalesData();
  const location = useLocation();

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const isSoSection = location.pathname.startsWith('/so');
  const isSiSection = location.pathname.startsWith('/si');
  const isFulfillment = location.pathname.startsWith('/fulfillment');

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#fbf7f0] font-sans text-[#37150f] antialiased selection:bg-[#91171d] selection:text-[#f5d275]">
      {/* Top Header Banner */}
      <header className="shrink-0 px-3 pt-3 pb-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between gap-3 rounded-[24px] border-2 border-[#c79754]/35 bg-[#37150f] px-4 py-2.5 sm:px-6 sm:py-3 text-white shadow-lg shadow-[#37150f]/15">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div className="grid size-10 sm:size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#91171d] via-[#be3937] to-[#d47837] text-[#f5d275] shadow-md shadow-[#91171d]/30">
              <TrendingUp className="size-5 sm:size-5.5 stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <div className="text-sm sm:text-lg font-extrabold tracking-tight text-[#f5d275]">
                Sales & Demand Suite
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#c79754]">
                Jan – Oct 2026 Live Sheet • Nov Forecast
              </div>
            </div>
          </div>

          {/* Center: 3 Primary Navigation Sections */}
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] p-1.5 shadow-inner"
          >
            {/* 1. Sales Order */}
            <NavLink
              to="/so/dashboard"
              className={() =>
                clsx(
                  'flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200',
                  isSoSection
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <Layers className="size-4" />
              <span>Sales Order</span>
            </NavLink>

            {/* 2. Sales Invoice */}
            <NavLink
              to="/si/dashboard"
              className={() =>
                clsx(
                  'flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200',
                  isSiSection
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <FileSpreadsheet className="size-4" />
              <span>Sales Invoice</span>
            </NavLink>

            {/* 3. SO vs SI */}
            <NavLink
              to="/fulfillment"
              className={() =>
                clsx(
                  'flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200',
                  isFulfillment
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <Scale className="size-4" />
              <span>SO vs SI</span>
            </NavLink>
          </nav>

          {/* Right: Live Sync & External Link */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Live Indicator Pill */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] px-3 py-1.5 text-xs">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[#f5d275]">
                {syncing ? 'Syncing Sheet…' : formattedSyncTime ? `Live: ${formattedSyncTime}` : 'Live Google Sheet'}
              </span>
            </div>

            {/* Manual Sync Button */}
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={syncing}
              className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#959242] hover:bg-[#959242]/90 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-extrabold text-white transition shadow-sm cursor-pointer disabled:opacity-60"
              title="Fetch fresh data directly from Google Sheets"
            >
              <RefreshCw className={clsx('size-3.5', syncing && 'animate-spin')} />
              <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Live'}</span>
            </button>

            {/* Open Google Sheet External */}
            <a
              href={SPREADSHEET_MAIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#c79754]/40 bg-white/5 hover:bg-white/10 px-3 py-1.5 sm:py-2 text-xs font-bold text-[#f5d275] transition"
              title="Open Google Sheets in new tab"
            >
              <span className="hidden lg:inline">Open Sheet</span>
              <ExternalLink className="size-3.5 opacity-80" />
            </a>
          </div>
        </div>

        {/* Secondary Sub-Tabs for SO and SI sections */}
        {(isSoSection || isSiSection) && (
          <div className="mx-auto mt-2 flex w-full max-w-[1720px] items-center justify-between px-2">
            <div className="flex items-center gap-2 rounded-full border border-[#c79754]/30 bg-white/80 backdrop-blur-sm p-1 shadow-sm">
              <NavLink
                to={isSoSection ? '/so/dashboard' : '/si/dashboard'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-full px-5 py-1.5 text-xs font-extrabold transition-all',
                    isActive
                      ? 'bg-[#37150f] text-[#f5d275] shadow-sm'
                      : 'text-[#37150f]/80 hover:bg-[#37150f]/10',
                  )
                }
              >
                <LayoutDashboard className="size-3.5" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to={isSoSection ? '/so/prediction' : '/si/prediction'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-full px-5 py-1.5 text-xs font-extrabold transition-all',
                    isActive
                      ? 'bg-[#91171d] text-[#f5d275] shadow-sm'
                      : 'text-[#37150f]/80 hover:bg-[#91171d]/10',
                  )
                }
              >
                <Sparkles className="size-3.5" />
                <span>Prediction (Nov 2026)</span>
              </NavLink>
            </div>

            <div className="text-[11px] font-semibold text-[#37150f]/60">
              {isSoSection
                ? 'Sales Order Tab (gid: 945362967) • Direct Live Stream'
                : 'Sales Invoice Tab (gid: 859053528) • Direct Live Stream'}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-3 pb-4 sm:px-6 sm:pb-6">
        <div className="mx-auto h-full w-full max-w-[1720px]">
          {error && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-800 shadow-sm">
              <span>Google Sheets Sync Notice: {error} (Serving local live cache)</span>
              <button
                onClick={() => syncNow()}
                className="underline hover:text-rose-950 cursor-pointer ml-3"
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
