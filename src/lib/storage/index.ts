import { get, set, del } from 'idb-keyval';
import type { ParsedReport, StoredReport } from '../types';
import {
  getInitialSheetReports,
  syncGoogleSheet as fetchLiveSheet,
} from '../sheets';

export interface DataStore {
  mode: 'sheet';
  listReports(): Promise<StoredReport[]>;
  saveReport(parsed: ParsedReport, file?: File): Promise<void>;
  deleteReport(report: StoredReport): Promise<void>;
  downloadOriginal(report: StoredReport): Promise<Blob | null>;
  syncSheet(customUrl?: string): Promise<{ reports: StoredReport[]; rowCount: number; syncedAt: string }>;
  resetToSheetData(): Promise<StoredReport[]>;
}

const LOCAL_KEY = 'prediction-sales:reports-jan-oct-v2';
const fileKey = (id: string) => `prediction-sales:file:${id}`;

export function createSheetStore(): DataStore {
  const load = async (): Promise<StoredReport[]> => {
    const initial = getInitialSheetReports();
    const saved = await get<StoredReport[]>(LOCAL_KEY);
    if (saved && Array.isArray(saved) && saved.length >= initial.length) {
      return saved;
    }
    // Use full Jan-Oct Google Sheet reports
    await set(LOCAL_KEY, initial);
    return initial;
  };

  return {
    mode: 'sheet',

    async listReports() {
      const reports = await load();
      return reports.sort((a, b) => a.period.localeCompare(b.period));
    },

    async saveReport(parsed, file) {
      const reports = await load();
      const existing = reports.find((r) => r.period === parsed.period);
      if (existing) await del(fileKey(existing.id));

      const id = crypto.randomUUID();
      if (file) {
        await set(fileKey(id), file);
      }

      const report: StoredReport = {
        id,
        period: parsed.period,
        fileName: file ? file.name : parsed.fileName,
        filePath: file ? fileKey(id) : null,
        grandTotal: parsed.grandTotal,
        itemCount: parsed.items.length,
        totalQty: parsed.totalQty,
        totalAmount: parsed.totalAmount,
        uploadedAt: new Date().toISOString(),
        items: parsed.items,
      };

      const updated = [...reports.filter((r) => r.period !== parsed.period), report];
      await set(LOCAL_KEY, updated);
    },

    async deleteReport(report) {
      const reports = await load();
      await set(
        LOCAL_KEY,
        reports.filter((r) => r.id !== report.id),
      );
      if (report.filePath?.startsWith('prediction-sales:file:')) {
        await del(fileKey(report.id));
      }
    },

    async downloadOriginal(report) {
      if (!report.filePath?.startsWith('prediction-sales:file:')) return null;
      return ((await get<Blob>(fileKey(report.id))) ?? null) as Blob | null;
    },

    async syncSheet(customUrl?: string) {
      const result = await fetchLiveSheet(customUrl);
      await set(LOCAL_KEY, result.reports);
      return result;
    },

    async resetToSheetData() {
      const initial = getInitialSheetReports();
      await set(LOCAL_KEY, initial);
      return initial;
    },
  };
}

export const store: DataStore = createSheetStore();
