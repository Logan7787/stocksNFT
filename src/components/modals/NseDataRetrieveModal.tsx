import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Scale, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Search, 
  Save, 
  Database,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { retrieveNseOptionDataWithSummary, NseRetrieveResult } from '../../services/nseService';
import { niftyMarketService } from '../../services/niftyApi';
import { saveCurrentSnapshot, getClosestMarketHourSlot } from '../../services/snapshotService';
import type { ProcessedOptionRow } from '../../types/optionChain';

interface NseDataRetrieveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToLiveChain?: (result: NseRetrieveResult) => void;
  onApplyToClosePage?: (result: NseRetrieveResult) => void;
  onToast?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export const NseDataRetrieveModal: React.FC<NseDataRetrieveModalProps> = ({
  isOpen,
  onClose,
  onApplyToLiveChain,
  onApplyToClosePage,
  onToast,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [dataResult, setDataResult] = useState<NseRetrieveResult | null>(null);
  const [strikeFilter, setStrikeFilter] = useState<'atm500' | 'atm1000' | 'all'>('atm500');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);

  // Fetch or retrieve data whenever modal opens
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await retrieveNseOptionDataWithSummary('NIFTY');
      setDataResult(res);
      if (onToast) {
        onToast(`Retrieved ${res.totalStrikes} contracts from ${res.source}`, 'success');
      }
    } catch (err: any) {
      if (onToast) {
        onToast(err.message || 'Error retrieving data from NSE', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Derived filtered rows
  const displayedRows = useMemo(() => {
    if (!dataResult) return [];
    let rows = dataResult.processedRows;
    const atm = dataResult.metrics.atmStrike || 22700;

    if (strikeFilter === 'atm500') {
      rows = rows.filter(r => Math.abs(r.strike - atm) <= 500);
    } else if (strikeFilter === 'atm1000') {
      rows = rows.filter(r => Math.abs(r.strike - atm) <= 1000);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      rows = rows.filter(r => String(r.strike).includes(query));
    }

    return rows;
  }, [dataResult, strikeFilter, searchQuery]);

  if (!isOpen) return null;

  const spot = dataResult?.spotPrice ?? 22698.85;
  const spotChange = dataResult?.spotChange ?? -50.90;
  const spotChangePercent = dataResult?.spotChangePercent ?? -0.22;
  const isPositive = spotChange >= 0;
  const breakLevels = dataResult?.breakLevels;
  const metrics = dataResult?.metrics;

  // Safely extract numeric values whether breakLevels has object or direct number format:
  const buValue: number = typeof breakLevels?.breakUp === 'object' && breakLevels?.breakUp !== null
    ? (breakLevels.breakUp as any).value ?? 247.45
    : typeof breakLevels?.breakUp === 'number'
    ? breakLevels.breakUp
    : 247.45;

  const bdValue: number = typeof breakLevels?.breakDown === 'object' && breakLevels?.breakDown !== null
    ? (breakLevels.breakDown as any).value ?? 148.38
    : typeof breakLevels?.breakDown === 'number'
    ? breakLevels.breakDown
    : 148.38;

  const beValue: number = typeof breakLevels?.breakEven === 'object' && breakLevels?.breakEven !== null
    ? (breakLevels.breakEven as any).value ?? 194.05
    : typeof breakLevels?.breakEven === 'number'
    ? breakLevels.breakEven
    : 194.05;

  const formulaAtm: number = breakLevels?.formulaAtmStrike ?? 22750;
  const formulaSpread: number = typeof breakLevels?.atmDiff === 'number'
    ? breakLevels.atmDiff
    : typeof (breakLevels as any)?.atmSpread === 'number'
    ? (breakLevels as any).atmSpread
    : 14.70;

  const handleApplyToLive = () => {
    if (!dataResult) return;
    niftyMarketService.applyRetrievedOptionChain(
      dataResult.spotPrice,
      dataResult.previousClose,
      dataResult.rawRows
    );
    if (onApplyToLiveChain) {
      onApplyToLiveChain(dataResult);
    }
    if (onToast) {
      onToast(`Applied ${dataResult.totalStrikes} official strikes to Live Option Chain!`, 'success');
    }
    onClose();
  };

  const handleApplyToClose = () => {
    if (!dataResult) return;
    if (onApplyToClosePage) {
      onApplyToClosePage(dataResult);
    }
    if (onToast) {
      onToast(`Applied official close data (Spot: ₹${dataResult.spotPrice}) to Market Close page!`, 'success');
    }
    onClose();
  };

  const handleSaveToDb = async () => {
    if (!dataResult) return;
    setIsSavingDb(true);
    try {
      const slot = getClosestMarketHourSlot();
      const res = await saveCurrentSnapshot(
        dataResult.spotPrice,
        dataResult.processedRows,
        '15:30',
        `NSE Official Settlement Data (${dataResult.expiryDate})`
      );
      if (res.success) {
        if (onToast) onToast('Snapshot saved to Database successfully!', 'success');
      } else {
        if (onToast) onToast(res.message, 'error');
      }
    } catch (err: any) {
      if (onToast) onToast(err.message || 'Failed to save to database', 'error');
    } finally {
      setIsSavingDb(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-7xl max-h-[92vh] bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-4 bg-linear-to-r from-slate-100 to-slate-200 dark:from-[#0f1422] dark:to-[#090d16] border-b border-slate-300 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-linear-to-br from-cyan-500 to-blue-600 rounded-xl text-black shadow-md shadow-cyan-500/20">
              <Download className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  NSE Data Retrieval Summary & Verification
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30">
                  OFFICIAL FEED
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Detailed preview of collected underlying spot, closing contracts, and formula metrics from NSE India
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Re-query NSE India API"
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-10 h-10 text-cyan-500 animate-spin" />
              <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                Retrieving official Option Chain data from NSE India...
              </p>
              <span className="text-xs text-slate-500">
                Connecting to /api/nse/api/option-chain-indices and parsing 104 weekly contracts
              </span>
            </div>
          ) : dataResult ? (
            <>
              {/* Meta Source & Timestamp Banner */}
              <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Source: <span className="text-cyan-600 dark:text-cyan-400">{dataResult.source}</span>
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    Expiry: <strong className="text-slate-900 dark:text-white">{dataResult.expiryDate}</strong>
                  </span>
                  <span className="text-slate-400 hidden sm:inline">|</span>
                  <span className="text-slate-700 dark:text-slate-300 hidden sm:inline">
                    Total Contracts: <strong className="text-slate-900 dark:text-white">{dataResult.totalStrikes} Strikes</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-500/30">
                    {dataResult.marketStatus === 'LIVE_MARKET' ? '● MARKET LIVE' : '■ MARKET CLOSED (SETTLED)'}
                  </span>
                  <span className="text-slate-500 text-[11px]">{dataResult.timestamp}</span>
                </div>
              </div>

              {/* Top Overview Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* 1. Spot Price */}
                <div className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 block">
                    Spot Market Close
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-slate-950 dark:text-white">
                    ₹{spot.toFixed(2)}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-mono font-bold mt-1 ${
                    isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{isPositive ? '+' : ''}{spotChange.toFixed(2)} ({isPositive ? '+' : ''}{spotChangePercent.toFixed(2)}%)</span>
                  </div>
                </div>

                {/* 2. Break Up Value (BU) */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/60 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-emerald-800 dark:text-emerald-300">
                      Break Up Value
                    </span>
                    <span className="px-1.5 py-0.2 bg-emerald-500 text-black text-[9px] font-bold rounded-sm">BU</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {buValue.toFixed(2)} <span className="text-xs font-normal">pts</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-1">
                    ITM Call + ITM Put Average
                  </span>
                </div>

                {/* 3. Break Down Value (BD) */}
                <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800/60 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-rose-800 dark:text-rose-300">
                      Break Down Value
                    </span>
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-sm">BD</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
                    {bdValue.toFixed(2)} <span className="text-xs font-normal">pts</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-1">
                    OTM Call + OTM Put Average
                  </span>
                </div>

                {/* 4. Break Even Value (BE) */}
                <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800/60 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-blue-800 dark:text-blue-300">
                      Break Even Value
                    </span>
                    <span className="px-1.5 py-0.2 bg-blue-500 text-white text-[9px] font-bold rounded-sm">BE</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-blue-700 dark:text-blue-400">
                    {beValue.toFixed(2)} <span className="text-xs font-normal">pts</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-1">
                    ATM (Max High + Min Low) / 2
                  </span>
                </div>

                {/* 5. Formula ATM Strike */}
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 rounded-xl p-3 shadow-xs col-span-2 md:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-amber-800 dark:text-amber-300">
                      Formula ATM Strike
                    </span>
                    <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[9px] font-bold rounded-sm">ATM</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
                    {formulaAtm}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-1">
                    Spread: {formulaSpread.toFixed(2)} pts (≤ 25 pts)
                  </span>
                </div>
              </div>

              {/* Secondary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-300 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">Spot ATM Strike:</span>
                  <strong className="text-slate-900 dark:text-white text-sm">{metrics?.atmStrike ?? 22700}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Lowest AVG Value:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 text-sm">
                    {metrics?.minAvgValue?.toFixed(2) ?? '193.18'} pts
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">PCR Volume Ratio:</span>
                  <strong className="text-cyan-600 dark:text-cyan-400 text-sm">{metrics?.pcrVolume?.toFixed(2) ?? '0.96'} (Bearish)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total CE / PE Vol:</span>
                  <strong className="text-slate-900 dark:text-white text-sm">
                    {((metrics?.totalCallVolume ?? 1895658180) / 10000000).toFixed(1)} Cr / {((metrics?.totalPutVolume ?? 1813809855) / 10000000).toFixed(1)} Cr
                  </strong>
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Display Range:
                  </span>
                  <button
                    onClick={() => setStrikeFilter('atm500')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                      strikeFilter === 'atm500'
                        ? 'bg-cyan-500 text-black shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    ATM ±500 (Active Range)
                  </button>
                  <button
                    onClick={() => setStrikeFilter('atm1000')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                      strikeFilter === 'atm1000'
                        ? 'bg-cyan-500 text-black shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    ATM ±1000
                  </button>
                  <button
                    onClick={() => setStrikeFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                      strikeFilter === 'all'
                        ? 'bg-cyan-500 text-black shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    All ({dataResult.totalStrikes})
                  </button>
                </div>

                {/* Strike Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Strike..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 w-36 sm:w-44"
                  />
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-300 dark:border-slate-800 rounded-xl overflow-x-auto shadow-inner max-h-115">
                <table className="w-full text-xs font-mono border-collapse select-text">
                  <thead className="sticky top-0 z-10 bg-slate-200 dark:bg-[#0c101c] text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th colSpan={5} className="py-1.5 px-2 text-center bg-cyan-100/70 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-300 border-r border-slate-300 dark:border-slate-800">
                        CALLS (CE)
                      </th>
                      <th colSpan={2} className="py-1.5 px-2 text-center bg-slate-300/80 dark:bg-slate-800/80 text-slate-900 dark:text-white border-r border-slate-300 dark:border-slate-800">
                        STRIKE & SIGNAL
                      </th>
                      <th colSpan={5} className="py-1.5 px-2 text-center bg-rose-100/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300">
                        PUTS (PE)
                      </th>
                    </tr>
                    <tr className="border-t border-slate-300 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-900">
                      <th className="py-1.5 px-2 text-right">Volume</th>
                      <th className="py-1.5 px-2 text-right">Premium</th>
                      <th className="py-1.5 px-2 text-right">AVG</th>
                      <th className="py-1.5 px-2 text-right">Close</th>
                      <th className="py-1.5 px-2 text-right border-r border-slate-300 dark:border-slate-800">LTP</th>
                      
                      <th className="py-1.5 px-3 text-center bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-black">
                        STRIKE
                      </th>
                      <th className="py-1.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">Signal</th>
                      
                      <th className="py-1.5 px-2 text-right">LTP</th>
                      <th className="py-1.5 px-2 text-right">Close</th>
                      <th className="py-1.5 px-2 text-right">AVG</th>
                      <th className="py-1.5 px-2 text-right">Premium</th>
                      <th className="py-1.5 px-2 text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                    {displayedRows.map((row) => {
                      const isFormulaAtm = breakLevels?.formulaAtmStrike === row.strike;
                      const isMinAvg = metrics?.minAvgValue !== undefined && Math.abs(row.call_avg - metrics.minAvgValue) < 0.01;
                      const isAtm = row.isATM;

                      return (
                        <tr
                          key={row.strike}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                            isAtm
                              ? 'bg-amber-100/50 dark:bg-amber-500/10 font-bold'
                              : isFormulaAtm
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                              : ''
                          }`}
                        >
                          {/* CE Volume */}
                          <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                            {row.call_volume > 0 ? row.call_volume.toLocaleString('en-IN') : '0'}
                            {row.isTopCallVolume && (
                              <span className="ml-1 px-1 py-0.2 rounded-xs bg-amber-500 text-black text-[9px] font-black">TOP</span>
                            )}
                          </td>
                          {/* CE Premium */}
                          <td className={`py-1.5 px-2 text-right ${
                            row.isMinCallPremium ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 font-bold' : 'text-cyan-700 dark:text-cyan-400'
                          }`}>
                            {row.call_premium.toFixed(2)}
                          </td>
                          {/* CE AVG */}
                          <td className={`py-1.5 px-2 text-right ${
                            isMinAvg ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {row.call_avg.toFixed(2)}
                          </td>
                          {/* CE Close */}
                          <td className="py-1.5 px-2 text-right font-semibold text-slate-900 dark:text-white">
                            {row.call_close.toFixed(2)}
                          </td>
                          {/* CE LTP */}
                          <td className="py-1.5 px-2 text-right text-slate-800 dark:text-slate-300 border-r border-slate-300 dark:border-slate-800">
                            {row.call_ltp.toFixed(2)}
                          </td>

                          {/* Strike */}
                          <td className="py-1.5 px-3 text-center font-black">
                            <div className="flex items-center justify-center gap-1">
                              <span className={`px-2 py-0.5 rounded-md ${
                                isAtm
                                  ? 'bg-amber-500 text-black shadow-xs font-black'
                                  : isFormulaAtm
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}>
                                {row.strike}
                              </span>
                              {isFormulaAtm && !isAtm && (
                                <span className="text-[9px] px-1 py-0.2 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded-sm font-bold">
                                  ATM-F
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Signal */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-300 dark:border-slate-800">
                            {row.call_close > row.call_avg && row.call_close > row.call_premium ? (
                              <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold">
                                ● BUY CE
                              </span>
                            ) : row.put_close > row.put_avg && row.put_close > row.put_premium ? (
                              <span className="px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 text-[10px] font-bold">
                                ● BUY PE
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </td>

                          {/* PE LTP */}
                          <td className="py-1.5 px-2 text-right text-slate-800 dark:text-slate-300">
                            {row.put_ltp.toFixed(2)}
                          </td>
                          {/* PE Close */}
                          <td className="py-1.5 px-2 text-right font-semibold text-slate-900 dark:text-white">
                            {row.put_close.toFixed(2)}
                          </td>
                          {/* PE AVG */}
                          <td className={`py-1.5 px-2 text-right ${
                            isMinAvg ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {row.put_avg.toFixed(2)}
                          </td>
                          {/* PE Premium */}
                          <td className={`py-1.5 px-2 text-right ${
                            row.isMinPutPremium ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 font-bold' : 'text-cyan-700 dark:text-cyan-400'
                          }`}>
                            {row.put_premium.toFixed(2)}
                          </td>
                          {/* PE Volume */}
                          <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                            {row.put_volume > 0 ? row.put_volume.toLocaleString('en-IN') : '0'}
                            {row.isTopPutVolume && (
                              <span className="ml-1 px-1 py-0.2 rounded-xs bg-amber-500 text-black text-[9px] font-black">TOP</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-slate-500">
              No data collected. Click "Refresh" to query NSE.
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-100 dark:bg-[#0c101c] border-t border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
            Spot: <strong className="text-slate-900 dark:text-white">₹{spot.toFixed(2)}</strong> • ATM: <strong className="text-amber-500">{metrics?.atmStrike ?? 22700}</strong> • BU: <strong className="text-emerald-500">{buValue.toFixed(2)}</strong> • BD: <strong className="text-rose-500">{bdValue.toFixed(2)}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToDb}
              disabled={loading || !dataResult || isSavingDb}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isSavingDb ? 'Saving...' : 'Save to DB'}</span>
            </button>

            <button
              onClick={handleApplyToClose}
              disabled={loading || !dataResult}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Apply to Market Close Tab</span>
            </button>

            <button
              onClick={handleApplyToLive}
              disabled={loading || !dataResult}
              className="px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Apply to Option Chain</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
