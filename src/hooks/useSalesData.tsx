import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MasterSalesData } from '../lib/types';
import {
  buildMasterDataFromSupabaseRows,
  DEFAULT_DATA_SELECTION,
  extractFilterOptions,
  fetchLatestSyncedAt,
  fetchSupabaseSalesRows,
  getCachedSupabaseRows,
  type DataSelectionConfig,
  type SupabaseSalesRow,
} from '../lib/supabase';

const STORAGE_KEY_LAST_SYNC = 'prediction-sales:last-synced-at-v3';

const EMPTY_MASTER_DATA: MasterSalesData = {
  so: {
    rows: [],
    companies: [],
    items: [],
    monthlyReports: [],
    totalQty: 0,
    monthlyTotals: {},
  },
  si: {
    rows: [],
    companies: [],
    items: [],
    monthlyReports: [],
    totalQty: 0,
    monthlyTotals: {},
  },
  fulfillment: {
    totalSoQty: 0,
    totalSiQty: 0,
    overallFulfillmentPct: 0,
    totalVariance: 0,
    monthly: [],
    items: [],
    stats: {
      totalItems: 0,
      fullyFulfilled: 0,
      partiallyFulfilled: 0,
      lowFulfilled: 0,
    },
  },
  syncedAt: '',
};

interface SalesDataContextType {
  data: MasterSalesData;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  selection: DataSelectionConfig;
  setSelection: (updater: DataSelectionConfig | ((prev: DataSelectionConfig) => DataSelectionConfig)) => void;
  availablePeriods: string[];
  availableStockGroups: string[];
  hasMultiDb: boolean;
  syncNow: () => Promise<boolean>;
  soManualAdjustments: Record<string, number>;
  setSoManualAdjustment: (code: string, qty: number | null) => void;
  resetSoManualAdjustments: () => void;
  siManualAdjustments: Record<string, number>;
  setSiManualAdjustment: (code: string, qty: number | null) => void;
  resetSiManualAdjustments: () => void;
}

const SO_MANUAL_KEY = 'prediction-sales:so-manual-adjustments-v3';
const SI_MANUAL_KEY = 'prediction-sales:si-manual-adjustments-v3';
const SELECTION_KEY = 'prediction-sales:data-selection-v2';

function loadManual(key: string): Record<string, number> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadSelection(): DataSelectionConfig {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SELECTION_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DataSelectionConfig>;
      return {
        ...DEFAULT_DATA_SELECTION,
        ...parsed,
        soTables: Array.isArray(parsed.soTables) && parsed.soTables.length > 0 ? parsed.soTables : ['SO'],
        siTables: Array.isArray(parsed.siTables) && parsed.siTables.length > 0 ? parsed.siTables : ['IV'],
      };
    }
  } catch {}
  return DEFAULT_DATA_SELECTION;
}

const SalesDataContext = createContext<SalesDataContextType | null>(null);

export function SalesDataProvider({ children }: { children: ReactNode }) {
  const [fallbackData, setFallbackData] = useState<MasterSalesData>(EMPTY_MASTER_DATA);
  const [supabaseRows, setSupabaseRows] = useState<SupabaseSalesRow[] | null>(null);
  const [selection, setSelectionState] = useState<DataSelectionConfig>(loadSelection);
  const [loading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_LAST_SYNC)
      : null;
  });
  const inFlightSyncRef = useRef<Promise<boolean> | null>(null);

  const [soManualAdjustments, setSoManualAdjustments] = useState<Record<string, number>>(() =>
    loadManual(SO_MANUAL_KEY),
  );
  const [siManualAdjustments, setSiManualAdjustments] = useState<Record<string, number>>(() =>
    loadManual(SI_MANUAL_KEY),
  );

  const setSelection = (
    updater: DataSelectionConfig | ((prev: DataSelectionConfig) => DataSelectionConfig),
  ) => {
    setSelectionState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const { periods: availablePeriods, stockGroups: availableStockGroups } = useMemo(() => {
    if (!supabaseRows || supabaseRows.length === 0) {
      return { periods: [] as string[], stockGroups: [] as string[] };
    }
    return extractFilterOptions(supabaseRows);
  }, [supabaseRows]);

  const data = useMemo(() => {
    if (supabaseRows && supabaseRows.length > 0) {
      return buildMasterDataFromSupabaseRows(supabaseRows, selection);
    }
    return fallbackData;
  }, [supabaseRows, selection, fallbackData]);

  const hasMultiDb = Boolean(supabaseRows && supabaseRows.length > 0);

  const setSoManualAdjustment = (code: string, qty: number | null) => {
    setSoManualAdjustments((prev) => {
      const key = code.trim().toUpperCase();
      const next = { ...prev };
      if (qty === null || qty === undefined || qty < 0) {
        delete next[key];
      } else {
        next[key] = Math.round(qty);
      }
      try {
        localStorage.setItem(SO_MANUAL_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save SO manual adjustments:', e);
      }
      return next;
    });
  };

  const resetSoManualAdjustments = () => {
    setSoManualAdjustments({});
    try {
      localStorage.removeItem(SO_MANUAL_KEY);
    } catch {}
  };

  const setSiManualAdjustment = (code: string, qty: number | null) => {
    setSiManualAdjustments((prev) => {
      const key = code.trim().toUpperCase();
      const next = { ...prev };
      if (qty === null || qty === undefined || qty < 0) {
        delete next[key];
      } else {
        next[key] = Math.round(qty);
      }
      try {
        localStorage.setItem(SI_MANUAL_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save SI manual adjustments:', e);
      }
      return next;
    });
  };

  const resetSiManualAdjustments = () => {
    setSiManualAdjustments({});
    try {
      localStorage.removeItem(SI_MANUAL_KEY);
    } catch {}
  };

  const syncNow = async (): Promise<boolean> => {
    if (inFlightSyncRef.current) return inFlightSyncRef.current;

    const run = (async () => {
      setSyncing(true);
      setError(null);
      try {
        const rows = await fetchSupabaseSalesRows();
        if (rows.length > 0) {
          setSupabaseRows(rows);
          const latest = rows.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), '');
          const syncedTime = latest || new Date().toISOString();
          setLastSyncedAt(syncedTime);
          try {
            localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncedTime);
          } catch {}
          return true;
        }

        const { fetchLiveMasterData } = await import('../lib/sheets');
        const live = await fetchLiveMasterData();
        setFallbackData(live);
        setLastSyncedAt(live.syncedAt);
        return true;
      } catch (e) {
        console.error('Failed to sync live data:', e);
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setSyncing(false);
        inFlightSyncRef.current = null;
      }
    })();

    inFlightSyncRef.current = run;
    return run;
  };

  const lastSyncedAtRef = useRef<string | null>(lastSyncedAt);
  useEffect(() => {
    lastSyncedAtRef.current = lastSyncedAt;
  }, [lastSyncedAt]);

  useEffect(() => {
    let mounted = true;
    let lastCheckedMs = 0;

    const pullFreshFromSupabase = async (hasExistingData: boolean) => {
      if (!mounted) return;
      if (inFlightSyncRef.current) {
        await inFlightSyncRef.current;
        return;
      }
      setSyncing(true);
      const run = (async () => {
        try {
          const rows = await fetchSupabaseSalesRows();
          if (mounted && rows.length > 0) {
            setSupabaseRows(rows);
            const latest = rows.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), '');
            const syncedTime = latest || new Date().toISOString();
            setLastSyncedAt(syncedTime);
            try {
              localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncedTime);
            } catch {}
            return true;
          } else if (mounted) {
            const { fetchLiveMasterData } = await import('../lib/sheets');
            const live = await fetchLiveMasterData();
            if (mounted) {
              setFallbackData(live);
              setLastSyncedAt(live.syncedAt);
            }
            return true;
          }
          return false;
        } catch (e) {
          console.warn('Automatic background live sync failed (using local data):', e);
          if (mounted && !hasExistingData) {
            try {
              const { getCachedMasterData } = await import('../lib/sheets');
              const cached = await getCachedMasterData();
              if (mounted && cached) {
                setFallbackData(cached);
                if (cached.syncedAt) setLastSyncedAt(cached.syncedAt);
              }
            } catch {}
          }
          return false;
        } finally {
          if (mounted) setSyncing(false);
          inFlightSyncRef.current = null;
        }
      })();
      inFlightSyncRef.current = run;
      await run;
    };

    const checkForUpdates = async () => {
      const now = Date.now();
      if (now - lastCheckedMs < 2 * 60 * 1000) return;
      lastCheckedMs = now;
      try {
        const remoteSyncedAt = await fetchLatestSyncedAt();
        if (remoteSyncedAt && (!lastSyncedAtRef.current || remoteSyncedAt > lastSyncedAtRef.current)) {
          await pullFreshFromSupabase(true);
        }
      } catch {
        // Silent background check failure
      }
    };

    (async () => {
      let hasWarmCache = false;
      let cachedSyncedAt = '';
      try {
        const cachedSb = await getCachedSupabaseRows();
        if (mounted && cachedSb && cachedSb.length > 0) {
          setSupabaseRows(cachedSb);
          hasWarmCache = true;
          cachedSyncedAt = cachedSb.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), '');
          if (cachedSyncedAt) {
            setLastSyncedAt(cachedSyncedAt);
            lastSyncedAtRef.current = cachedSyncedAt;
          }
        }
      } catch (e) {
        console.warn('Cached read error:', e);
      }

      lastCheckedMs = Date.now();
      if (hasWarmCache) {
        // Lightweight 1-row PK check: skip full download if cache is already up to date
        try {
          const remoteSyncedAt = await fetchLatestSyncedAt();
          if (remoteSyncedAt && (!cachedSyncedAt || remoteSyncedAt > cachedSyncedAt)) {
            await pullFreshFromSupabase(true);
          }
        } catch {
          // Keep serving warm cache silently
        }
      } else {
        await pullFreshFromSupabase(false);
      }
    })();

    // Auto-check Supabase every 5 minutes and when returning to the tab
    const intervalId = window.setInterval(checkForUpdates, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <SalesDataContext.Provider
      value={{
        data,
        loading,
        syncing,
        error,
        lastSyncedAt,
        selection,
        setSelection,
        availablePeriods,
        availableStockGroups,
        hasMultiDb,
        syncNow,
        soManualAdjustments,
        setSoManualAdjustment,
        resetSoManualAdjustments,
        siManualAdjustments,
        setSiManualAdjustment,
        resetSiManualAdjustments,
      }}
    >
      {children}
    </SalesDataContext.Provider>
  );
}

export function useSalesData(): SalesDataContextType {
  const ctx = useContext(SalesDataContext);
  if (!ctx) {
    throw new Error('useSalesData must be used within a SalesDataProvider');
  }
  return ctx;
}
