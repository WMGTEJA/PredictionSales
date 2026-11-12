import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useSalesData } from '../hooks/useSalesData';

export default function Layout({ children }: { children: ReactNode }) {
  const { syncing, syncNow, lastSyncedAt, error } = useSalesData();
  const location = useLocation();
  const [logoSrc, setLogoSrc] = useState<string>('/logo.png');

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
      {/* Top Header - Edge-to-Edge Fluid Banner */}
      <header className="sticky top-0 z-40 w-full border-b border-[#c79754]/30 bg-[#37150f]/95 shadow-md shadow-[#37150f]/15 backdrop-blur-md">
        <div className="w-full px-3.5 sm:px-6 lg:px-8 xl:px-12 py-2.5 sm:py-3">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            {/* Top Row on Mobile: Brand Logo + Sync */}
            <div className="flex items-center justify-between gap-3">
              {/* Brand Logo & Title */}
              <NavLink to="/so/dashboard" className="flex items-center gap-2.5 group">
                <img
                  src={logoSrc}
                  alt="Sales Prediction Logo"
                  onError={() => {
                    if (logoSrc !== '/logo.svg') {
                      setLogoSrc('/logo.svg');
                    }
                  }}
                  className="h-8 sm:h-9 w-auto max-w-[140px] sm:max-w-[180px] object-contain rounded-xl transition-transform group-hover:scale-105"
                />
              </NavLink>

              {/* Mobile Right: Live Status & Sync Button */}
              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => syncNow()}
                  disabled={syncing}
                  className="bubbly-btn flex items-center gap-1.5 rounded-full bg-[#91171d] hover:bg-[#be3937] px-3 py-1.5 text-xs font-bold text-[#f5d275] shadow-sm cursor-pointer disabled:opacity-60"
                  title="Sync with Google Sheets"
                >
                  <RefreshCw className={clsx('size-3', syncing && 'animate-spin')} />
                  <span>{syncing ? 'Syncing…' : 'Sync'}</span>
                </button>
              </div>
            </div>

            {/* Center: Primary Navigation Tabs (Bubbly Segmented Pills) */}
            <nav
              aria-label="Main navigation"
              className="flex items-center justify-start sm:justify-center gap-1 rounded-full border border-[#c79754]/25 bg-[#240d09] p-1 shadow-inner overflow-x-auto no-scrollbar"
            >
              {/* 1. Sales Order */}
              <NavLink
                to="/so/dashboard"
                className={() =>
                  clsx(
                    'bubbly-btn flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap transition-all duration-200',
                    isSoSection
                      ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/30 scale-[1.02]'
                      : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                  )
                }
              >
                <Layers className="size-3.5 sm:size-4 shrink-0" />
                <span>Sales Orders</span>
              </NavLink>

              {/* 2. Sales Invoice */}
              <NavLink
                to="/si/dashboard"
                className={() =>
                  clsx(
                    'bubbly-btn flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap transition-all duration-200',
                    isSiSection
                      ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/30 scale-[1.02]'
                      : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                  )
                }
              >
                <FileSpreadsheet className="size-3.5 sm:size-4 shrink-0" />
                <span>Sales Invoices</span>
              </NavLink>

              {/* 3. SO vs SI */}
              <NavLink
                to="/fulfillment"
                className={() =>
                  clsx(
                    'bubbly-btn flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap transition-all duration-200',
                    isFulfillment
                      ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/30 scale-[1.02]'
                      : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                  )
                }
              >
                <Scale className="size-3.5 sm:size-4 shrink-0" />
                <span>SO vs SI</span>
              </NavLink>
            </nav>

            {/* Right: Desktop Live Indicator & Sync Action */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] px-3.5 py-1.5 text-xs">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-bold text-[#f5d275]">
                  {syncing ? 'Syncing Sheet…' : formattedSyncTime ? `Synced: ${formattedSyncTime}` : 'Live Connected'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => syncNow()}
                disabled={syncing}
                className="bubbly-btn flex items-center gap-1.5 rounded-full bg-[#91171d] hover:bg-[#be3937] px-3.5 py-1.5 text-xs font-bold text-[#f5d275] shadow-md shadow-[#91171d]/30 cursor-pointer disabled:opacity-60"
                title="Fetch fresh data from Google Sheet"
              >
                <RefreshCw className={clsx('size-3.5', syncing && 'animate-spin')} />
                <span>{syncing ? 'Syncing…' : 'Sync'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Sub-Navigation Pills for SO and SI */}
        {(isSoSection || isSiSection) && (
          <div className="w-full border-t border-[#c79754]/20 bg-[#2d110c] px-3.5 sm:px-6 lg:px-8 xl:px-12 py-1.5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <NavLink
                to={isSoSection ? '/so/dashboard' : '/si/dashboard'}
                className={({ isActive }) =>
                  clsx(
                    'bubbly-btn flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[#f5d275] text-[#37150f] shadow-sm font-extrabold'
                      : 'text-[#f5d275]/80 hover:bg-white/10 hover:text-white',
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
                    'bubbly-btn flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[#91171d] text-[#f5d275] shadow-sm font-extrabold'
                      : 'text-[#f5d275]/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Sparkles className="size-3.5" />
                <span>Predictions</span>
              </NavLink>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area - Full Width Fluid Container */}
      <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-6">
        <div className="w-full">
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-bold text-amber-900 shadow-sm">
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
