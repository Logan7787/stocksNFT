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
  Printer
} from 'lucide-react';
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
import { OptionChainDesktopTable } from '../table/OptionChainDesktopTable';
import { OptionChainMobileTable } from '../table/OptionChainMobileTable';
import { HighlightLegend } from '../table/HighlightLegend';
import { evaluateAllTradeSignals, getStoredTradeSettings } from '../../utils/tradeEngine';
import type { ProcessedOptionRow, MarketMetrics, TradeSettings } from '../../types/optionChain';

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
  const [customDate, setCustomDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [dataResult, setDataResult] = useState<PreviousCloseChainResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [tradeSettings] = useState<TradeSettings>(getStoredTradeSettings());

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast(null);
    setTimeout(() => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    }, 50);
  };

  // Determine current market condition & target date
  const statusInfo: MarketCloseStatusInfo = useMemo(() => {
    return getMarketCloseStatusInfo(forcedMode, customDate || undefined);
  }, [forcedMode, customDate]);

  // Cache key ref to ensure we load exactly once per date/mode and never blink or re-fetch on background ticks
  const loadedKeyRef = React.useRef<string>('');

  useEffect(() => {
    const isToday = statusInfo.effectiveCloseDate === formatDateYMD(getISTNow());
    const effectiveSpot = isToday ? (referenceSpotPrice || 22687.65) : 22811.35;
    const modeKey = `${statusInfo.effectiveCloseDate}_${forcedMode}_${customDate}`;

    const dateOrModeChanged = loadedKeyRef.current !== modeKey;

    if (dateOrModeChanged) {
      loadedKeyRef.current = modeKey;
      setLoading(true);
    } else if (dataResult && dataResult.rows.length > 0) {
      return; // Already loaded with valid rows for this mode & date
    }

    let isMounted = true;

    getPreviousCloseOptionChain(statusInfo.effectiveCloseDate, effectiveSpot, {
      todayRows: currentRows,
      todaySpotChange: spotChange,
      todaySpotChangePercent: spotChangePercent,
      todayMetrics: currentMetrics,
    })
      .then((res) => {
        if (isMounted) {
          setDataResult(res);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          showToast(err.message || 'Error loading market close data', 'error');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    statusInfo.effectiveCloseDate, 
    forcedMode, 
    customDate, 
    referenceSpotPrice, 
    currentRows, 
    spotChange, 
    spotChangePercent, 
    currentMetrics,
    dataResult
  ]);

  // Evaluate trade signals on the closed option chain data
  const { rows: rowsWithSignals } = useMemo(() => {
    if (!dataResult) {
      return { rows: [] };
    }
    return evaluateAllTradeSignals(dataResult.rows, dataResult.spotPrice, tradeSettings);
  }, [dataResult, tradeSettings]);

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
      'CALL_LOW',
      'CALL_HIGH',
      'STRIKE',
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
        r.call_low,
        r.call_high,
        r.strike,
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

          {/* Right Action Controls: Save DB + Print + Export CSV */}
          <div className="flex items-center gap-2 print:hidden">
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
              title="Print data to printer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
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

        {/* Second Line: Condition Selector, Date Picker, Simulation Modes */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono print:hidden">
          {/* Live vs Closed Simulation Mode Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-1 rounded-xl">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 uppercase font-bold flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Condition Mode:
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
              rows={rowsWithSignals}
              spotPrice={dataResult.spotPrice}
            />
          </div>

          {/* Mobile Option Chain Table View */}
          <div className="lg:hidden">
            <OptionChainMobileTable
              rows={rowsWithSignals}
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
    </div>
  );
};
