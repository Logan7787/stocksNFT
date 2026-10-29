import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Save, 
  Download, 
  RotateCcw, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  Layers,
  Database,
  SlidersHorizontal,
  Info,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Scale,
  Type,
  RefreshCw,
  Zap,
  UploadCloud
} from 'lucide-react';
import { ImportNseReportModal } from '../modals/ImportNseReportModal';
import { NseDataRetrieveModal } from '../modals/NseDataRetrieveModal';
import { 
  getMarketCloseStatusInfo, 
  getPreviousCloseOptionChain, 
  saveCloseSnapshotRecord,
  formatDateYMD,
  getISTNow,
  ForcedMarketMode,
  PreviousCloseChainResult,
  MarketCloseStatusInfo 
} from '../../services/previousCloseService';
import { autoSyncService, AutoSyncStatus } from '../../services/autoSyncService';
import { OptionChainDesktopTable, TableFontSize } from '../table/OptionChainDesktopTable';
import { OptionChainMobileTable } from '../table/OptionChainMobileTable';
import { HighlightLegend } from '../table/HighlightLegend';
import { evaluateAllTradeSignals, getStoredTradeSettings } from '../../utils/tradeEngine';
import { calculateBreakLevels } from '../../utils/formulas';
import type { ProcessedOptionRow, MarketMetrics, TradeSettings, BreakLevelsInfo } from '../../types/optionChain';

interface PreviousDayClosePageProps {
  onOpenSettings?: () => void;
  referenceSpotPrice?: number;
  spotChange?: number;
  spotChangePercent?: number;
  currentRows?: ProcessedOptionRow[];
  currentMetrics?: MarketMetrics;
}

export const PreviousDayClosePage: React.FC<PreviousDayClosePageProps> = ({
  onOpenSettings,
  referenceSpotPrice,
  spotChange,
  spotChangePercent,
  currentRows,
  currentMetrics,
}) => {
  // Mode: Auto (detects IST market hours) vs Simulation
  const [forcedMode, setForcedMode] = useState<ForcedMarketMode>('auto');
  const [sessionView, setSessionView] = useState<'previous_day' | 'today_close'>('previous_day');
  const [customDate, setCustomDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [dataResult, setDataResult] = useState<PreviousCloseChainResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isNseRetrieveOpen, setIsNseRetrieveOpen] = useState<boolean>(false);
  const [tradeSettings] = useState<TradeSettings>(getStoredTradeSettings());

  // Font size state for table & print visibility
  const [tableFontSize, setTableFontSize] = useState<TableFontSize>(() => {
    const saved = localStorage.getItem('nifty_prev_close_font_size');
    if (saved === 'normal' || saved === 'large' || saved === 'xlarge') return saved;
    return 'large'; // Default to large for comfortable reading and printing
  });

  const handleSetFontSize = (size: TableFontSize) => {
    setTableFontSize(size);
    localStorage.setItem('nifty_prev_close_font_size', size);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast(null);
    setTimeout(() => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    }, 50);
  };

  // Determine current market condition & target date
  const statusInfo: MarketCloseStatusInfo = useMemo(() => {
    return getMarketCloseStatusInfo(forcedMode, customDate || undefined, sessionView);
  }, [forcedMode, customDate, sessionView]);

  // Auto-Sync Status & manual sync state
  const [syncStatus, setSyncStatus] = useState<AutoSyncStatus>(autoSyncService.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  useEffect(() => {
    return autoSyncService.subscribe(setSyncStatus);
  }, []);

  // Cache key ref to ensure we load exactly once per date/mode and never blink or re-fetch on background ticks
  const loadedKeyRef = React.useRef<string>('');

  const loadData = useCallback((forceRefresh = false) => {
    const isToday = statusInfo.effectiveCloseDate === formatDateYMD(getISTNow());
    const effectiveSpot = isToday ? (referenceSpotPrice || 22698.85) : 22749.75;
    const modeKey = `${statusInfo.effectiveCloseDate}_${forcedMode}_${customDate}_${sessionView}`;

    if (forceRefresh) {
      loadedKeyRef.current = modeKey;
      setLoading(true);
    } else {
      const dateOrModeChanged = loadedKeyRef.current !== modeKey;
      if (dateOrModeChanged) {
        loadedKeyRef.current = modeKey;
        setLoading(true);
      } else if (dataResult && dataResult.rows.length > 0) {
        return;
      }
    }

    getPreviousCloseOptionChain(statusInfo.effectiveCloseDate, effectiveSpot, {
      todayRows: currentRows,
      todaySpotChange: spotChange,
      todaySpotChangePercent: spotChangePercent,
      todayMetrics: currentMetrics,
    })
      .then((res) => {
        setDataResult(res);
        setLoading(false);
      })
      .catch((err: any) => {
        showToast(err.message || 'Error loading market close data', 'error');
        setLoading(false);
      });
  }, [
    statusInfo.effectiveCloseDate, 
    forcedMode, 
    customDate,
    sessionView,
    referenceSpotPrice, 
    currentRows, 
    spotChange, 
    spotChangePercent, 
    currentMetrics, 
    dataResult
  ]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Listen to background sync completions from autoSyncService
  useEffect(() => {
    const handleCloseSynced = (event: any) => {
      const detail = event?.detail;
      if (!detail || detail.date === statusInfo.effectiveCloseDate) {
        showToast(`Auto-Sync updated latest close data (${detail?.strikesCount || ''} strikes)`, 'info');
        loadData(true);
      }
    };
    window.addEventListener('nifty-market-close-synced', handleCloseSynced);
    return () => window.removeEventListener('nifty-market-close-synced', handleCloseSynced);
  }, [statusInfo.effectiveCloseDate, loadData]);

  // Manual Trigger for Instant Background Sync from NSE
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    showToast(`Syncing official option chain settlement data for ${statusInfo.effectiveCloseDate}...`, 'info');
    try {
      const res = await autoSyncService.performSync(statusInfo.effectiveCloseDate, 'manual');
      if (res.success) {
        showToast(res.message, 'success');
        loadData(true);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Manual sync failed', 'error');
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Evaluate trade signals on the closed option chain data
  const { rows: rowsWithSignals } = useMemo(() => {
    if (!dataResult) {
      return { rows: [] };
    }
    return evaluateAllTradeSignals(dataResult.rows, dataResult.spotPrice, tradeSettings);
  }, [dataResult, tradeSettings]);

  // Screen filter state: All strikes vs ATM ± 500 strikes
  const [strikeFilter, setStrikeFilter] = useState<'all' | 'atm500'>('all');

  const atmStrike = dataResult?.metrics.atmStrike ?? (dataResult ? Math.round(dataResult.spotPrice / 50) * 50 : 22750);

  // Filtered rows for on-screen view
  const displayedRows = useMemo(() => {
    if (strikeFilter === 'atm500') {
      return rowsWithSignals.filter((r) => Math.abs(r.strike - atmStrike) <= 500);
    }
    return rowsWithSignals;
  }, [rowsWithSignals, strikeFilter, atmStrike]);

  // Calculate or retrieve formula Break Up, Break Down, Break Even & ATM levels
  const breakLevels: BreakLevelsInfo | null = useMemo(() => {
    if (dataResult?.breakLevels && dataResult.breakLevels.breakEven) return dataResult.breakLevels;
    if (dataResult?.rows && dataResult.rows.length > 0) {
      return calculateBreakLevels(dataResult.rows, dataResult.spotPrice);
    }
    return dataResult?.breakLevels || null;
  }, [dataResult]);

  // Handle Save snapshot
  const handleSaveToDb = async () => {
    if (!dataResult || dataResult.rows.length === 0) return;
    setIsSaving(true);
    try {
      const res = await saveCloseSnapshotRecord(
        dataResult.date,
        dataResult.spotPrice,
        dataResult.rows
      );
      if (res.success) {
        showToast(res.message, 'success');
        // Update source to database
        setDataResult(prev => prev ? { ...prev, source: 'database' } : null);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save snapshot', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    if (!dataResult || dataResult.rows.length === 0) return;
    const filename = `NIFTY_Market_Close_Option_Chain_${dataResult.date}_15-30.csv`;
    const headers = [
      'CALL_VOLUME',
      'CALL_PREMIUM',
      'CALL_AVG',
      'CALL_CLOSE',
      'CALL_LTP',
      'CALL_LOW',
      'CALL_HIGH',
      'STRIKE',
      'PUT_LTP',
      'PUT_CLOSE',
      'PUT_AVG',
      'PUT_PREMIUM',
      'PUT_VOLUME',
      'PUT_LOW',
      'PUT_HIGH',
      'ACTION_SIGNAL'
    ];

    const csvLines = [headers.join(',')];
    rowsWithSignals.forEach((r) => {
      csvLines.push([
        r.call_volume,
        r.call_premium,
        r.call_avg,
        r.call_close,
        r.call_ltp ?? r.call_close,
        r.call_low,
        r.call_high,
        r.strike,
        r.put_ltp ?? r.put_close,
        r.put_close,
        r.put_avg,
        r.put_premium,
        r.put_volume,
        r.put_low,
        r.put_high,
        r.ceSignal ? 'BUY_CE' : r.peSignal ? 'BUY_PE' : 'NO_TRADE'
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filename}`, 'success');
  };

  // Handle Print to physical printer or PDF
  const handlePrint = () => {
    if (!dataResult || dataResult.rows.length === 0) return;
    window.print();
  };

  const isPositive = (dataResult?.spotChange ?? 0) >= 0;

  return (
    <div className="flex-1 p-2 sm:p-4 max-w-[1600px] w-full mx-auto space-y-3">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-top-4 duration-200 text-xs font-mono font-bold bg-white/95 dark:bg-slate-900/95 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-cyan-500" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Condition & Control Bar */}
      <div className="bg-white/90 dark:bg-[#0a0e1a]/90 backdrop-blur-md border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Top Line: Status Header & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-md ${
              statusInfo.isMarketOpenAndLive 
                ? 'bg-linear-to-br from-emerald-500 to-teal-600 text-black' 
                : 'bg-linear-to-br from-indigo-500 to-blue-600 text-white'
            }`}>
              <History className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {statusInfo.headline}
                </h2>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  statusInfo.isMarketOpenAndLive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                    : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                }`}>
                  {statusInfo.modeBadgeText}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {statusInfo.subtext}
              </p>
            </div>
          </div>

          {/* Right Action Controls: Auto-Sync + Sync Now + Font Size + Save DB + Print + Export CSV */}
          <div className="flex items-center gap-2 print:hidden flex-wrap">
            {/* Background Auto-Sync Status Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono border transition-all ${
              syncStatus.status === 'syncing'
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400'
                : syncStatus.status === 'error'
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  syncStatus.status === 'syncing' ? 'bg-cyan-400' :
                  syncStatus.status === 'error' ? 'bg-rose-400' : 'bg-emerald-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncStatus.status === 'syncing' ? 'bg-cyan-500' :
                  syncStatus.status === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                }`}></span>
              </span>
              <span className="font-bold">
                {syncStatus.status === 'syncing' ? 'Auto-Syncing...' : 'Auto-Sync Active'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden xl:inline" title={syncStatus.message}>
                ({syncStatus.nextScheduledCheck || '15:30 Close & 20:30 Settlement'})
              </span>
            </div>

            {/* Retrieve from NSE Button with dialogue box */}
            <button
              onClick={() => setIsNseRetrieveOpen(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 active:scale-95"
              title="Retrieve official NSE live or settlement option chain data in a preview dialogue box"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Retrieve from NSE</span>
            </button>

            {/* Import / Paste NSE Data button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl shadow-xs border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
              title="Import or paste official NSE report or OCR text without editing code"
            >
              <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import / Paste NSE Data</span>
            </button>

            {/* Font Size Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-0.5 shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 font-bold font-mono flex items-center gap-1">
                <Type className="w-3 h-3 text-cyan-500" />
                Font:
              </span>
              <button
                onClick={() => handleSetFontSize('normal')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tableFontSize === 'normal'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
                title="Normal font size (14px)"
              >
                Medium
              </button>
              <button
                onClick={() => handleSetFontSize('large')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tableFontSize === 'large'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
                title="Large font size (16px) - Recommended for high readability & printing"
              >
                Large
              </button>
              <button
                onClick={() => handleSetFontSize('xlarge')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tableFontSize === 'xlarge'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
                title="Extra Large font size (18px) - Maximum visibility"
              >
                X-Large
              </button>
            </div>

            {/* Strike Range Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-0.5 shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 font-bold font-mono">
                Strikes:
              </span>
              <button
                onClick={() => setStrikeFilter('all')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  strikeFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
                title="View all strikes"
              >
                All ({rowsWithSignals.length})
              </button>
              <button
                onClick={() => setStrikeFilter('atm500')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  strikeFilter === 'atm500'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
                title={`Filter screen view to ATM ±500 (${atmStrike - 500} to ${atmStrike + 500})`}
              >
                ATM ±500
              </button>
            </div>

            <button
              onClick={handleSaveToDb}
              disabled={isSaving || loading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              title="Save this 15:30 close snapshot into database"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save to DB'}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !dataResult}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              title={`Print to printer or PDF (Only ATM ±500 rows: ${atmStrike - 500} to ${atmStrike + 500})`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print (ATM ±500)</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              title="Export close data to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Second Line: Session View Selector, Condition Selector, Date Picker */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Session Selector: Previous Day Close vs Today's Close */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-1 rounded-xl">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 uppercase font-bold flex items-center gap-1">
                <History className="w-3 h-3 text-cyan-500" />
                Session View:
              </span>
              <button
                onClick={() => { setSessionView('previous_day'); setCustomDate(''); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  sessionView === 'previous_day' && !customDate
                    ? 'bg-cyan-500 text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
                title={`Display previous completed session close (${statusInfo.previousTradingDay})`}
              >
                <span>Previous Day Close ({statusInfo.previousTradingDay})</span>
              </button>
              {statusInfo.canViewTodayClose && (
                <button
                  onClick={() => { setSessionView('today_close'); setCustomDate(''); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    sessionView === 'today_close' && !customDate
                      ? 'bg-amber-500 text-black shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                  title={`Display today's final 15:30 IST market close (${statusInfo.todayDate})`}
                >
                  <Clock className="w-3.5 h-3.5 text-black" />
                  <span>Today's Close ({statusInfo.todayDate})</span>
                </button>
              )}
            </div>

            {/* Live vs Closed Simulation Mode Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-1 rounded-xl">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 uppercase font-bold flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                Condition:
              </span>
              <button
                onClick={() => { setForcedMode('auto'); setCustomDate(''); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  forcedMode === 'auto' && !customDate
                    ? 'bg-cyan-500 text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Auto (Live Clock)
              </button>
              <button
                onClick={() => { setForcedMode('live'); setCustomDate(''); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  forcedMode === 'live'
                    ? 'bg-emerald-500 text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3 text-emerald-950" />
                Test: Market Open
              </button>
              <button
                onClick={() => { setForcedMode('closed'); setCustomDate(''); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  forcedMode === 'closed'
                    ? 'bg-amber-500 text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Test: Market Closed
              </button>
            </div>
          </div>

          {/* Date Picker & Source Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 px-2.5 py-1 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] text-slate-500 mr-1">Session Date:</span>
              <input
                type="date"
                value={customDate || statusInfo.effectiveCloseDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              />
              {customDate && (
                <button
                  onClick={() => setCustomDate('')}
                  className="ml-1 text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  title="Reset to automatic date"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Data Source pill */}
            <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              <span>Slot: <strong>15:30 IST Close</strong></span>
              <span className="text-slate-400">|</span>
              <span className={`font-semibold ${
                dataResult?.source === 'database' ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {dataResult?.source === 'database' ? 'DB Record' : 'Close Model'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Break Up & Break Down Analysis Cards */}
      {breakLevels && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Break Up Card (BU) */}
          <div className="relative overflow-hidden bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-teal-950/30 border-2 border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-4 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Break Up Value
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500 text-slate-950 uppercase tracking-widest shadow-xs">
                      BU
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ITM Call + ITM Put Average
                  </span>
                </div>
              </div>
            </div>

            {/* Main Value Display */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {breakLevels.breakUp.value.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                pts
              </span>
            </div>

            {/* Formula Breakdown Details */}
            <div className="mt-3 pt-3 border-t border-emerald-500/20 dark:border-emerald-500/20 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  ATM - 100 CE ({breakLevels.breakUp.callStrike}):
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{breakLevels.breakUp.callClose.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                  ATM + 100 PE ({breakLevels.breakUp.putStrike}):
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{breakLevels.breakUp.putClose.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 text-right italic">
                Formula: ({breakLevels.breakUp.callClose.toFixed(2)} + {breakLevels.breakUp.putClose.toFixed(2)}) / 2 = {breakLevels.breakUp.value.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 2. Break Down Card (BD) */}
          <div className="relative overflow-hidden bg-linear-to-br from-rose-500/10 via-rose-500/5 to-amber-500/10 dark:from-rose-950/40 dark:via-slate-900/90 dark:to-red-950/30 border-2 border-rose-500/30 dark:border-rose-500/40 rounded-2xl p-4 shadow-lg backdrop-blur-sm transition-all hover:border-rose-500/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-xs">
                  <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      Break Down Value
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white uppercase tracking-widest shadow-xs">
                      BD
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    OTM Call + OTM Put Average
                  </span>
                </div>
              </div>
            </div>

            {/* Main Value Display */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                {breakLevels.breakDown.value.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                pts
              </span>
            </div>

            {/* Formula Breakdown Details */}
            <div className="mt-3 pt-3 border-t border-rose-500/20 dark:border-rose-500/20 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  ATM + 100 CE ({breakLevels.breakDown.callStrike}):
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{breakLevels.breakDown.callClose.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  ATM - 100 PE ({breakLevels.breakDown.putStrike}):
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{breakLevels.breakDown.putClose.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 text-right italic">
                Formula: ({breakLevels.breakDown.callClose.toFixed(2)} + {breakLevels.breakDown.putClose.toFixed(2)}) / 2 = {breakLevels.breakDown.value.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 3. Break Even Card (BE) */}
          {breakLevels.breakEven ? (
            <div className="relative overflow-hidden bg-linear-to-br from-indigo-500/10 via-indigo-500/5 to-purple-500/10 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-purple-950/30 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl p-4 shadow-lg backdrop-blur-sm transition-all hover:border-indigo-500/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-xs">
                    <Scale className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        Break Even Value
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-indigo-500 text-white uppercase tracking-widest shadow-xs">
                        BE
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      ATM (Max High + Min Low) / 2
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Value Display */}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
                  {breakLevels.breakEven.value.toFixed(2)}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                  pts
                </span>
              </div>

              {/* Formula Breakdown Details */}
              <div className="mt-3 pt-3 border-t border-indigo-500/20 dark:border-indigo-500/20 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    Max High ({breakLevels.breakEven.highestSource}):
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{breakLevels.breakEven.highestValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Min Low ({breakLevels.breakEven.lowestSource}):
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{breakLevels.breakEven.lowestValue.toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 text-right italic">
                  Formula: ({breakLevels.breakEven.highestValue.toFixed(2)} + {breakLevels.breakEven.lowestValue.toFixed(2)}) / 2 = {breakLevels.breakEven.value.toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-mono">Break Even Unavailable</span>
            </div>
          )}

          {/* 4. Formula ATM Strike Selection Card */}
          <div className="relative overflow-hidden bg-linear-to-br from-amber-500/10 via-amber-500/5 to-cyan-500/10 dark:from-amber-950/40 dark:via-slate-900/90 dark:to-cyan-950/30 border-2 border-amber-500/30 dark:border-amber-500/40 rounded-2xl p-4 shadow-lg backdrop-blur-sm transition-all hover:border-amber-500/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs">
                  <Target className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Formula ATM Strike
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400 text-slate-950 uppercase tracking-widest shadow-xs">
                      ATM
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    |Call Close - Put Close| ≤ 25 pts
                  </span>
                </div>
              </div>
            </div>

            {/* Main Strike Display */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-amber-500 dark:text-amber-400">
                {breakLevels.formulaAtmStrike}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                (Spread: {breakLevels.atmDiff.toFixed(2)} pts)
              </span>
            </div>

            {/* ATM Breakdown Details */}
            <div className="mt-3 pt-3 border-t border-amber-500/20 dark:border-amber-500/20 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                  Call Close:
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{breakLevels.atmCallClose.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Put Close:
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{breakLevels.atmPutClose.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 text-right italic">
                Difference: |{breakLevels.atmCallClose.toFixed(2)} - {breakLevels.atmPutClose.toFixed(2)}| = {breakLevels.atmDiff.toFixed(2)} pts (Target &lt; 25)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spot Price & Key Metrics Card */}
      {dataResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {/* 1. Spot Close */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
              Spot Market Close
            </span>
            <div className="text-lg font-black font-mono text-slate-950 dark:text-white mt-0.5">
              {dataResult.spotPrice.toFixed(2)}
            </div>
            <div className={`flex items-center gap-1 text-[11px] font-mono font-bold mt-0.5 ${
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{isPositive ? '+' : ''}{dataResult.spotChange.toFixed(2)}</span>
              <span>({isPositive ? '+' : ''}{dataResult.spotChangePercent.toFixed(2)}%)</span>
            </div>
          </div>

          {/* 2. ATM Strike */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
              Close ATM Strike
            </span>
            <div className="text-lg font-black font-mono text-[#ca8a04] dark:text-[#fde047] mt-0.5">
              {dataResult.metrics.atmStrike}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              Closest to Close Spot
            </span>
          </div>

          {/* 3. PCR Ratio */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
              PCR Volume Ratio
            </span>
            <div className="text-lg font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">
              {dataResult.metrics.pcrVolume.toFixed(2)}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              {dataResult.metrics.pcrVolume >= 1 ? 'Bullish Bias' : 'Bearish Bias'}
            </span>
          </div>

          {/* 4. Min AVG */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
              Lowest AVG Value
            </span>
            <div className="text-lg font-black font-mono text-[#0284c7] dark:text-[#7dd3fc] mt-0.5">
              {dataResult.metrics.minAvgValue.toFixed(2)}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              (Call Close + Put Close) / 2
            </span>
          </div>

          {/* 5. Total Call Volume */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
              Total CE Volume
            </span>
            <div className="text-base font-black font-mono text-slate-900 dark:text-slate-200 mt-0.5">
              {dataResult.metrics.totalCallVolume.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              All CE Strikes
            </span>
          </div>

          {/* 6. Total Put Volume */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
              Total PE Volume
            </span>
            <div className="text-base font-black font-mono text-slate-900 dark:text-slate-200 mt-0.5">
              {dataResult.metrics.totalPutVolume.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              All PE Strikes
            </span>
          </div>
        </div>
      )}

      {/* Highlights Legend */}
      {dataResult && (
        <HighlightLegend
          metrics={dataResult.metrics}
          autoSaveCountdown={0}
          isAutoSaveEnabled={false}
          totalStrikesCount={dataResult.rows.length}
        />
      )}


      {/* Loading Spinner */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Loading Market Close Option Chain...
          </p>
        </div>
      ) : dataResult ? (
        <>
          {/* Desktop Option Chain Table View */}
          <div className="hidden lg:block">
            <OptionChainDesktopTable
              rows={displayedRows}
              spotPrice={dataResult.spotPrice}
              fontSize={tableFontSize}
              atmStrike={atmStrike}
              printAtmRangeOnly={true}
            />
          </div>

          {/* Mobile Option Chain Table View */}
          <div className="lg:hidden">
            <OptionChainMobileTable
              rows={displayedRows}
              spotPrice={dataResult.spotPrice}
              metrics={dataResult.metrics}
            />
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-xs font-mono text-slate-500">
          No data available for this market close session.
        </div>
      )}

      {/* Import / Paste NSE Report Modal */}
      <ImportNseReportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultDate={statusInfo.effectiveCloseDate}
        onSuccess={(msg) => {
          showToast(msg, 'success');
          loadData(true);
        }}
      />

      {/* Retrieve from NSE Interactive Dialogue Box */}
      <NseDataRetrieveModal
        isOpen={isNseRetrieveOpen}
        onClose={() => setIsNseRetrieveOpen(false)}
        onApplyToClosePage={(_res) => {
          loadData(true);
        }}
        onApplyToLiveChain={(_res) => {
          loadData(true);
        }}
        onToast={showToast}
      />
    </div>
  );
};
