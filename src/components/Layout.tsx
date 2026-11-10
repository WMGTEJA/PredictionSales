import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  RefreshCw,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';

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
    <div className="flex min-h-screen w-full flex-col bg-[#fbf7f0] font-sans text-[#37150f] antialiased selection:bg-[#91171d] selection:text-[#f5d275]">
      {/* Top Header Banner */}
      <header className="shrink-0 px-2.5 pt-2.5 pb-2 sm:px-6 sm:pt-3">
        <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-3 rounded-[24px] border-2 border-[#c79754]/35 bg-[#37150f] p-3 text-white shadow-lg shadow-[#37150f]/15 md:flex-row md:items-center md:justify-between sm:px-6 sm:py-3">
          {/* Top Row on Mobile: Brand + Sync */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="grid size-9 sm:size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#91171d] via-[#be3937] to-[#d47837] text-[#f5d275] shadow-md shadow-[#91171d]/30 shrink-0">
                <TrendingUp className="size-4.5 sm:size-5.5 stroke-[2.5]" />
              </div>
              <div className="leading-tight">
                <div className="text-sm sm:text-lg font-extrabold tracking-tight text-[#f5d275]">
                  Sales Prediction
                </div>
              </div>
            </div>

            {/* Mobile-only Sync Action Button */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={() => syncNow()}
                disabled={syncing}
                className="flex items-center gap-1 rounded-full bg-[#959242] hover:bg-[#959242]/90 px-2.5 py-1 text-[11px] font-extrabold text-white transition shadow-sm cursor-pointer disabled:opacity-60"
                title="Fetch fresh data directly from Google Sheets"
              >
                <RefreshCw className={clsx('size-3', syncing && 'animate-spin')} />
                <span>{syncing ? '…' : 'Sync'}</span>
              </button>
            </div>
          </div>

          {/* Center: 3 Primary Navigation Sections */}
          <nav
            aria-label="Main navigation"
            className="flex items-center justify-center gap-1 sm:gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] p-1 shadow-inner overflow-x-auto"
          >
            {/* 1. Sales Order */}
            <NavLink
              to="/so/dashboard"
              className={() =>
                clsx(
                  'flex items-center gap-1.5 sm:gap-2 rounded-full px-3 py-1.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200 whitespace-nowrap',
                  isSoSection
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <Layers className="size-3.5 sm:size-4 shrink-0" />
              <span>Sales Order</span>
            </NavLink>

            {/* 2. Sales Invoice */}
            <NavLink
              to="/si/dashboard"
              className={() =>
                clsx(
                  'flex items-center gap-1.5 sm:gap-2 rounded-full px-3 py-1.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200 whitespace-nowrap',
                  isSiSection
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <FileSpreadsheet className="size-3.5 sm:size-4 shrink-0" />
              <span>Sales Invoice</span>
            </NavLink>

            {/* 3. SO vs SI */}
            <NavLink
              to="/fulfillment"
              className={() =>
                clsx(
                  'flex items-center gap-1.5 sm:gap-2 rounded-full px-3 py-1.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200 whitespace-nowrap',
                  isFulfillment
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <Scale className="size-3.5 sm:size-4 shrink-0" />
              <span>SO vs SI</span>
            </NavLink>
          </nav>

          {/* Right: Live Sync & External Link (Desktop) */}
          <div className="hidden md:flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Live Indicator Pill */}
            <div className="flex items-center gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] px-3 py-1.5 text-xs">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[#f5d275]">
                {syncing ? 'Syncing Sheet…' : formattedSyncTime ? `Live: ${formattedSyncTime}` : 'Live Google Sheet'}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Sub-Tabs for SO and SI sections */}
        {(isSoSection || isSiSection) && (
          <div className="mx-auto mt-2 flex w-full max-w-[1720px] flex-col gap-2 px-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#c79754]/30 bg-white/80 backdrop-blur-sm p-1 shadow-sm overflow-x-auto">
              <NavLink
                to={isSoSection ? '/so/dashboard' : '/si/dashboard'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-1.5 sm:gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold transition-all whitespace-nowrap',
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
                    'flex items-center gap-1.5 sm:gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[#91171d] text-[#f5d275] shadow-sm'
                      : 'text-[#37150f]/80 hover:bg-[#91171d]/10',
                  )
                }
              >
                <span>Prediction (Nov – Jan 2027)</span>
              </NavLink>
            </div>

          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full px-2.5 pb-6 sm:px-6">
        <div className="mx-auto w-full max-w-[1720px]">
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
