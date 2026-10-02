import React from 'react';
import { 
  X, 
  History, 
  Download, 
  Eye, 
  Clock, 
  Calendar, 
  FileSpreadsheet
} from 'lucide-react';
import type { MarketSnapshotRecord } from '../../types/optionChain';

interface SnapshotManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: MarketSnapshotRecord[];
  onLoadSnapshot: (snapshotId: string) => void;
  onExportCsv: (snapshotId?: string) => void;
  activeSlot: string;
}

export const SnapshotManagerModal: React.FC<SnapshotManagerModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  onLoadSnapshot,
  onExportCsv,
  activeSlot,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0f1523] border border-slate-300 dark:border-slate-700/80 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Database Snapshot Archive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Historical hourly records stored in Supabase PostgreSQL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-800 dark:text-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Total Saved Records: <strong className="text-slate-900 dark:text-white">{snapshots.length}</strong>
            </span>
            <button
              onClick={() => onExportCsv()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export Current Visible Chain to CSV</span>
            </button>
          </div>

          {snapshots.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <Clock className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2 animate-bounce" />
              <p className="text-slate-800 dark:text-slate-300 font-bold text-sm">No Snapshots Saved Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click "Save Hourly Snapshot Now" on the navigation bar or enable the auto-hourly timer to store records.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Hour Slot</th>
                    <th className="py-2.5 px-3 text-right">Spot Close</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {snapshots.map((s) => {
                    const isSelected = activeSlot === s.hour_slot;
                    return (
                      <tr key={s.id} className={`hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors ${isSelected ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>{s.snapshot_date}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-cyan-800 dark:text-cyan-300 font-bold text-[11px]">
                            {s.hour_slot} IST
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {Number(s.spot_close).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-45">
                          {s.notes || 'Automated Snapshot'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                onLoadSnapshot(s.id);
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-400/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Load</span>
                            </button>
                            <button
                              onClick={() => onExportCsv(s.id)}
                              title="Export CSV"
                              className="p-1 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Archive
          </button>
        </div>
      </div>
    </div>
  );
};
