import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { DEFAULT_SHEET_TAB_NAME, DEFAULT_SHEET_URL } from '../lib/sheets';

export default function Layout({ children }: { children: ReactNode }) {
  const { syncing, syncNow, lastSyncedAt } = useReports();

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#fbf7f0] font-sans text-[#37150f] antialiased selection:bg-[#91171d] selection:text-[#f5d275]">
      {/* Bigger Bubbly Header Banner with Prominent Tab Switcher */}
      <header className="shrink-0 px-4 pt-3.5 pb-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 rounded-[28px] border-2 border-[#c79754]/35 bg-[#37150f] px-5 py-3 text-white shadow-lg shadow-[#37150f]/15">
          {/* Left: Brand */}
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 sm:size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#91171d] via-[#be3937] to-[#d47837] text-[#f5d275] shadow-md shadow-[#91171d]/30">
              <TrendingUp className="size-6 stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <div className="text-base sm:text-xl font-extrabold tracking-tight text-[#f5d275]">
                Sales Prediction
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#c79754]">
                Jan – Oct History • Nov Forecast
              </div>
            </div>
          </div>

          {/* Center: Big Bubbly Tab Switcher */}
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 rounded-full border border-[#c79754]/30 bg-[#240d09] p-1.5 shadow-inner"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-full px-6 py-2.5 sm:px-9 sm:py-3 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <LayoutDashboard className="size-4 sm:size-4.5" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/predictions"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-full px-6 py-2.5 sm:px-9 sm:py-3 text-xs sm:text-sm font-extrabold tracking-wide transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-[#91171d] to-[#be3937] text-[#f5d275] shadow-md shadow-[#91171d]/40 scale-[1.02]'
                    : 'text-[#c79754] hover:bg-white/5 hover:text-[#f5d275]',
                )
              }
            >
              <Sparkles className="size-4 sm:size-4.5" />
              <span>Predictions</span>
            </NavLink>
          </nav>

          {/* Right: Sync Controls & Sheet Link */}
          <div className="flex items-center gap-2.5">
            {/* Unit Indicator Badge (Pcs Counting) */}
            <span className="hidden md:inline-flex items-center rounded-full border border-[#c79754]/30 bg-[#240d09] px-3.5 py-1.5 text-xs font-extrabold text-[#f5d275]">
              Unit: Pieces (Pcs)
            </span>

            {/* Live Sync Pill */}
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={syncing}
              className="flex items-center gap-2 rounded-full bg-[#959242] hover:bg-[#959242]/90 px-4 py-2.5 text-xs font-extrabold text-white transition shadow-sm cursor-pointer disabled:opacity-60"
              title={formattedSyncTime ? `Last synced: ${formattedSyncTime}` : 'Sync Google Sheet'}
            >
              <RefreshCw className={clsx('size-3.5', syncing && 'animate-spin')} />
              <span className="hidden lg:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>

            {/* Open Google Sheet */}
            <a
              href={DEFAULT_SHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="grid size-10 place-items-center rounded-full border border-[#c79754]/30 bg-[#240d09] text-[#f5d275] hover:bg-[#c79754]/20 transition"
              title={`Open Google Sheet (${DEFAULT_SHEET_TAB_NAME})`}
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Viewport-Locked Main Content Area (No Page Scroll) */}
      <main className="mx-auto flex-1 min-h-0 w-full max-w-[1680px] overflow-hidden px-4 pb-4 pt-1.5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
