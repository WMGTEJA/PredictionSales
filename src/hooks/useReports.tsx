import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createSheetStore, type DataStore } from '../lib/storage';
import type { StoredReport } from '../lib/types';
import { getInitialSheetReports, getLastSyncedAt } from '../lib/sheets';

interface StorageContextType {
  store: DataStore;
  reports: StoredReport[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  syncNow: (customUrl?: string) => Promise<boolean>;
  lastSyncedAt: string | null;
  resetData: () => Promise<void>;
  manualAdjustments: Record<string, number>;
  setManualAdjustment: (code: string, qty: number | null) => void;
  resetManualAdjustments: () => void;
}

const MANUAL_KEY = 'wmg_sales_manual_adjustments';

function getInitialManual(): Record<string, number> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(MANUAL_KEY) : null;
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const StorageContext = createContext<StorageContextType | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const [store] = useState<DataStore>(() => createSheetStore());
  const [reports, setReports] = useState<StoredReport[]>(() => getInitialSheetReports());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(getLastSyncedAt());
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>(() => getInitialManual());

  const setManualAdjustment = (code: string, qty: number | null) => {
    setManualAdjustments((prev) => {
      const key = code.trim().toUpperCase();
      const next = { ...prev };
      if (qty === null || qty === undefined || qty < 0) {
        delete next[key];
      } else {
        next[key] = Math.round(qty);
      }
      try {
        localStorage.setItem(MANUAL_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save manual adjustments:', e);
      }
      return next;
    });
  };

  const resetManualAdjustments = () => {
    setManualAdjustments({});
    try {
      localStorage.removeItem(MANUAL_KEY);
    } catch {}
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await store.listReports();
      setReports(data);
      setLastSyncedAt(getLastSyncedAt());
    } catch (e) {
      console.error('Failed to load reports:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async (customUrl?: string): Promise<boolean> => {
    setSyncing(true);
    setError(null);
    try {
      const res = await store.syncSheet(customUrl);
      setReports(res.reports);
      setLastSyncedAt(res.syncedAt);
      return true;
    } catch (e) {
      console.error('Google Sheet sync error:', e);
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const resetData = async () => {
    setLoading(true);
    try {
      const data = await store.resetToSheetData();
      setReports(data);
      setLastSyncedAt(getLastSyncedAt());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [store]);

  return (
    <StorageContext.Provider
      value={{
        store,
        reports,
        loading,
        syncing,
        error,
        refresh,
        syncNow,
        lastSyncedAt,
        resetData,
        manualAdjustments,
        setManualAdjustment,
        resetManualAdjustments,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useReports() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useReports must be used within StorageProvider');
  return ctx;
}
