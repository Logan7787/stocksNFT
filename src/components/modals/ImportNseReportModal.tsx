import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles,
  Clipboard,
  RefreshCw,
  Database
} from 'lucide-react';
import { parseNseDerivativesReport, ParsedNseReportResult } from '../../services/nseService';
import { autoSyncService } from '../../services/autoSyncService';

interface ImportNseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  onSuccess: (message: string) => void;
}

export const ImportNseReportModal: React.FC<ImportNseReportModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  onSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [rawText, setRawText] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<ParsedNseReportResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = (textToParse: string) => {
    setErrorMsg(null);
    if (!textToParse.trim()) {
      setParsedResult(null);
      return;
    }

    try {
      const res = parseNseDerivativesReport(textToParse, selectedDate);
      if (res.success && res.totalStrikes > 0) {
        setParsedResult(res);
      } else {
        setParsedResult(null);
        setErrorMsg(res.message);
      }
    } catch (e: any) {
      setParsedResult(null);
      setErrorMsg(e.message || 'Failed to parse report');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const txt = e.target.value;
    setRawText(txt);
    handleParse(txt);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
      handleParse(text);
    } catch (err) {
      setErrorMsg('Could not read clipboard. Please paste directly into the box.');
    }
  };

  const handleApplyAndSave = async () => {
    if (!rawText.trim() && !parsedResult) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await autoSyncService.importFromReportText(rawText, selectedDate);
      if (res.success) {
        onSuccess(res.message);
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error saving report data');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-600 dark:text-cyan-400">
              <UploadCloud className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Import NSE Derivatives Report
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                  Auto-Parser
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Paste official NSE settlement text, OCR from PDF, or Bhavcopy table to update previous close instantly.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Date Selector & Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                Target Market Close Date:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (rawText) handleParse(rawText);
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-3 py-1.5 text-xs font-mono font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste from Clipboard</span>
              </button>
            </div>
          </div>

          {/* Textarea Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Paste Report Lines or Table Data:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Accepts lines with Strike, CE/PE, High, Low, Close & Volume
              </span>
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={handleTextChange}
              placeholder="Example:
Index Options 27-Oct-2026 PE 22,500.00 95.00 166.00 21.05 24.20 107.05 22.15 -84.90 -79.31 92,24,964
Index Options 27-Oct-2026 CE 22,700.00 64.70 180.00 41.85 133.90 82.45 137.95 55.50 67.31 87,94,255..."
              className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-y"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Parsing Preview */}
          {parsedResult && (
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    Parsed {parsedResult.totalStrikes} Strike Rows
                  </span>
                  {parsedResult.expiryDate && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-bold">
                      Expiry: {parsedResult.expiryDate}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Implied Spot Price: <span className="text-cyan-500 font-black">₹{parsedResult.spotPrice.toLocaleString('en-IN')}</span>
                  {' '}({parsedResult.spotChange >= 0 ? '+' : ''}{parsedResult.spotChange} pts / {parsedResult.spotChangePercent}%)
                </div>
              </div>

              {/* Sample Strikes Preview Table */}
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-[11px] font-mono text-left">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-1 px-3">Strike</th>
                      <th className="py-1 px-3 text-right">CE Close</th>
                      <th className="py-1 px-3 text-right">CE Volume</th>
                      <th className="py-1 px-3 text-right">PE Close</th>
                      <th className="py-1 px-3 text-right">PE Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                    {parsedResult.rawRows.slice(0, 10).map((r) => (
                      <tr key={r.strike} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-1 px-3 font-bold text-cyan-600 dark:text-cyan-400">{r.strike}</td>
                        <td className="py-1 px-3 text-right text-emerald-600 dark:text-emerald-400">{r.call_close.toFixed(2)}</td>
                        <td className="py-1 px-3 text-right text-slate-500">{r.call_volume.toLocaleString('en-IN')}</td>
                        <td className="py-1 px-3 text-right text-rose-600 dark:text-rose-400">{r.put_close.toFixed(2)}</td>
                        <td className="py-1 px-3 text-right text-slate-500">{r.put_volume.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyAndSave}
            disabled={!parsedResult || isSaving}
            className="px-5 py-2.5 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving Snapshot...' : 'Save & Set as Market Close'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
