import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { MasterSalesData } from '../lib/types';
import {
  fetchLiveMasterData,
  getCachedMasterData,
  STORAGE_KEY_LAST_SYNC,
} from '../lib/sheets';
import { INITIAL_SALES_DATA } from '../data/initialSalesData';

interface SalesDataContextType {
  data: MasterSalesData;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
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

function loadManual(key: string): Record<string, number> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const SalesDataContext = createContext<SalesDataContextType | null>(null);

export function SalesDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterSalesData>(INITIAL_SALES_DATA);
  const [loading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_LAST_SYNC) || INITIAL_SALES_DATA.syncedAt
      : INITIAL_SALES_DATA.syncedAt;
  });

  const [soManualAdjustments, setSoManualAdjustments] = useState<Record<string, number>>(() =>
    loadManual(SO_MANUAL_KEY),
  );
  const [siManualAdjustments, setSiManualAdjustments] = useState<Record<string, number>>(() =>
    loadManual(SI_MANUAL_KEY),
  );

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
    setSyncing(true);
    setError(null);
    try {
      const live = await fetchLiveMasterData();
      setData(live);
      setLastSyncedAt(live.syncedAt);
      return true;
    } catch (e) {
      console.error('Failed to sync live Google Sheets:', e);
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSyncing(false);
    }
  };

  // On mount: load cached data first, and concurrently trigger live sync
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await getCachedMasterData();
        if (mounted && cached) {
          setData(cached);
        }
      } catch (e) {
        console.warn('Cached read error:', e);
      }

      // Concurrently fetch live data
      if (mounted) {
        setSyncing(true);
        try {
          const live = await fetchLiveMasterData();
          if (mounted) {
            setData(live);
            setLastSyncedAt(live.syncedAt);
          }
        } catch (e) {
          console.warn('Automatic background live sync failed (using local data):', e);
        } finally {
          if (mounted) setSyncing(false);
        }
      }
    })();

    return () => {
      mounted = false;
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
