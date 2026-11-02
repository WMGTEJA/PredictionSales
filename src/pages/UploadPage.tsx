import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Package,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Table,
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { fmtInt, periodLabel, periodShort } from '../lib/format';
import {
  DEFAULT_SHEET_TAB_NAME,
  DEFAULT_SHEET_URL,
  getSavedSheetUrl,
  saveSheetUrl,
} from '../lib/sheets';

export default function UploadPage() {
  const { reports, syncing, syncNow, lastSyncedAt, resetData } = useReports();
  const [sheetUrlInput, setSheetUrlInput] = useState(getSavedSheetUrl());
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('en-MY', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Default snapshot loaded';

  const totalQtyAll = reports.reduce((s, r) => s + r.totalQty, 0);

  const handleSync = async () => {
    setSyncMessage(null);
    saveSheetUrl(sheetUrlInput);
    const success = await syncNow(sheetUrlInput);
    if (success) {
      setSyncMessage('Successfully synced latest data from Google Sheets!');
    }
  };

  const handleReset = async () => {
    setSyncMessage(null);
    await resetData();
    setSheetUrlInput(DEFAULT_SHEET_URL);
    setSyncMessage('Reset to original Jan–Oct Google Sheets dataset.');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Spreadsheet & Data Source
          </h1>
          <p className="text-sm text-slate-500">
            Connected to Google Sheet: <span className="font-semibold text-slate-700">{DEFAULT_SHEET_TAB_NAME}</span>
          </p>
        </div>
        <Link to="/" className="btn-primary self-start sm:self-auto">
          View Forecast Dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* Sync Success Feedback */}
      {syncMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Google Sheets Connection Card */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
              <FileSpreadsheet className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Google Sheet Connection</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  Active Source
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Directly feeds monthly item quantities into the sales prediction engine
              </p>
            </div>
          </div>

          <a
            href={DEFAULT_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary self-start sm:self-auto text-xs"
          >
            <ExternalLink className="size-3.5" />
            Open in Google Sheets
          </a>
        </div>

        {/* Sheet Configuration Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="text-slate-400 font-medium">Active Sheet Tab</div>
            <div className="mt-1 font-semibold text-slate-800 text-sm">{DEFAULT_SHEET_TAB_NAME}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="text-slate-400 font-medium">Mapped Columns</div>
            <div className="mt-1 font-mono text-slate-800 text-xs">Stock Group, Item Code, Item Desc, Month, Qty</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="text-slate-400 font-medium">Last Synced</div>
            <div className="mt-1 font-medium text-slate-800 text-xs">{formattedSyncTime}</div>
          </div>
        </div>

        {/* Sheet URL & Sync Action Bar */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">Google Spreadsheet URL or CSV Export</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={sheetUrlInput}
              onChange={(e) => setSheetUrlInput(e.target.value)}
              className="input flex-1 font-mono text-xs"
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary shrink-0"
            >
              <RefreshCw className={clsx('size-4', syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync Live Data'}
            </button>
            <button
              onClick={handleReset}
              disabled={syncing}
              className="btn-secondary shrink-0"
              title="Reset to bundled Jan-Oct dataset"
            >
              <RotateCcw className="size-4" />
              Reset
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Note: The Google Sheet link is set to public or link-shared so the browser can read and sync without needing credentials.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Table className="size-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Available History</div>
              <div className="text-xl font-bold text-slate-900">{reports.length} Months</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Covers {reports.map((r) => periodShort(r.period)).join(', ')}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Package className="size-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Historical Qty</div>
              <div className="text-xl font-bold text-slate-900">{fmtInt(totalQtyAll)} pcs</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Over 12,400 raw delivery line records aggregated
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Forecast Target</div>
              <div className="text-xl font-bold text-slate-900">November 2026</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Next period prediction automatically generated
          </div>
        </div>
      </div>

      {/* Monthly Breakdown List */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900">Monthly Aggregated Data</h2>
          <p className="text-xs text-slate-500">Individual months loaded from Google Sheet</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Period</th>
                <th className="px-4 py-3.5">Source Tab / File</th>
                <th className="px-4 py-3.5 text-right">Items Sold</th>
                <th className="px-5 py-3.5 text-right font-semibold">Total Quantity (pcs)</th>
                <th className="px-4 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                    {periodLabel(r.period, true)}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 truncate max-w-[300px]">
                    {r.fileName}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                    {r.itemCount} items
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-mono font-bold text-slate-900">
                    {fmtInt(r.totalQty)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="size-3" /> Ready
                    </span>
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
