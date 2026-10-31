import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Award,
  SlidersHorizontal,
  Database
} from 'lucide-react';
import { myTradeService } from '../../services/myTradeService';
import type { NseStockRecord, StockRecommendation } from '../../types/myTrade';

interface MyTradeDashboardProps {
  onNavigate?: (route: string) => void;
}

type TabType = 'STOCKS' | 'PREDICTIONS' | 'RESULTS' | 'SETTLEMENT';

export const MyTradeDashboard: React.FC<MyTradeDashboardProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('STOCKS');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-30');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'gainers' | 'losers' | 'top_volume'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const availableDates = myTradeService.getAvailableDates();
  const performance = myTradeService.getModelPerformance();
  const syncStatus = myTradeService.getSyncStatus();
  const recommendations = myTradeService.getRecommendations();
  const yesterdayResults = myTradeService.getYesterdayResults();

  const stocks = useMemo(() => {
    return myTradeService.getStocksByDate(selectedDate, searchQuery, filterType);
  }, [selectedDate, searchQuery, filterType]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApplyToOptionChain = () => {
    showToast('Applied 20:30 PM NSE Settled Bhavcopy to Previous Day Market Close Data!');
    if (onNavigate) {
      setTimeout(() => onNavigate('/previous-close'), 800);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
          <div className="px-4 py-3 bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-mono rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="relative overflow-hidden bg-linear-to-r from-slate-900 via-indigo-950/90 to-slate-900 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-linear-to-br from-cyan-500 to-indigo-600 text-slate-950 shadow-lg shadow-cyan-500/30">
              <Zap className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  My Trade <span className="text-cyan-400 font-mono text-sm uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40">NSE ML Strategy</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Automated 20:30 PM IST Settlement Bhavcopy Pipeline • Machine Learning Predictions • Google Sheet Realtime Sync
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleApplyToOptionChain}
              className="px-3.5 py-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black text-xs font-black rounded-xl shadow-md shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Apply official settled close values to Previous Market Close Data option chain"
            >
              <Layers className="w-4 h-4" />
              <span>Apply Settled to Option Chain</span>
            </button>

            <a
              href={`https://docs.google.com/spreadsheets/d/${syncStatus.googleSheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Google Sheet</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Model Accuracy</span>
            <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
              {performance.accuracy}%
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Win Rate: {performance.winRate}%</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Average Return</span>
            <div className="text-lg font-black font-mono text-cyan-400 mt-0.5">
              +{performance.averageReturn}%
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Avg Loss: {performance.averageLoss}%</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Predictions</span>
            <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
              {performance.totalPredictions}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{performance.successfulPredictions} Successful Wins</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">NSE 20:30 Settlement</span>
            <div className="text-xs font-black font-mono text-purple-400 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {syncStatus.lastSyncTimeIST}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{syncStatus.totalStocksSynced} Stocks Cleaned</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar font-mono text-xs">
        <button
          onClick={() => setActiveTab('STOCKS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'STOCKS'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white bg-slate-100 dark:bg-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>NSE Stocks Bhavcopy</span>
          <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-black">{stocks.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('PREDICTIONS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'PREDICTIONS'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white bg-slate-100 dark:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>AI Recommendations</span>
          <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-black">{recommendations.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('RESULTS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'RESULTS'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white bg-slate-100 dark:bg-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-emerald-500" />
          <span>Model Results Verification</span>
          <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-black">{yesterdayResults.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('SETTLEMENT')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'SETTLEMENT'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white bg-slate-100 dark:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-purple-500" />
          <span>20:30 PM Settlement Engine</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. STOCKS BHAVCOPY TAB                                    */}
      {/* ========================================================= */}
      {activeTab === 'STOCKS' && (
        <div className="space-y-4">
          {/* Controls: Search, Date, Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500 font-mono">Date:</span>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  {availableDates.map(d => (
                    <option key={d} value={d} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {d} {d === '2026-10-30' ? '(Latest Settled)' : '(Oct 29 Expiry)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-all ${
                    filterType === 'all'
                      ? 'bg-cyan-500 text-black shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('top_volume')}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-all ${
                    filterType === 'top_volume'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Top Volume
                </button>
                <button
                  onClick={() => setFilterType('gainers')}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-all ${
                    filterType === 'gainers'
                      ? 'bg-emerald-500 text-black shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Gainers
                </button>
                <button
                  onClick={() => setFilterType('losers')}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-all ${
                    filterType === 'losers'
                      ? 'bg-rose-500 text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Losers
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Symbol / Company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Stocks Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-[#080b12]">
            <div className="overflow-x-auto max-h-160">
              <table className="w-full text-xs font-mono border-collapse select-text">
                <thead className="sticky top-0 z-10 bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 text-left sticky left-0 z-20 bg-slate-200 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800">
                      Symbol
                    </th>
                    <th className="py-2.5 px-3 text-left">Company</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-100/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300">
                      Settled Close
                    </th>
                    <th className="py-2.5 px-3 text-right">Return %</th>
                    <th className="py-2.5 px-3 text-right">Prev Close</th>
                    <th className="py-2.5 px-3 text-right">Open</th>
                    <th className="py-2.5 px-3 text-right">High</th>
                    <th className="py-2.5 px-3 text-right">Low</th>
                    <th className="py-2.5 px-3 text-right">Daily Range</th>
                    <th className="py-2.5 px-3 text-right">Range %</th>
                    <th className="py-2.5 px-3 text-right">Gap %</th>
                    <th className="py-2.5 px-3 text-right bg-amber-100/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300">
                      Volume
                    </th>
                    <th className="py-2.5 px-3 text-right">Value (₹ Cr)</th>
                    <th className="py-2.5 px-3 text-right">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                  {stocks.length > 0 ? (
                    stocks.map((stock) => {
                      const isUp = stock.dailyReturnPct >= 0;
                      return (
                        <tr
                          key={stock.symbol}
                          className="hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 text-left font-black text-slate-900 dark:text-cyan-300 sticky left-0 z-10 bg-white dark:bg-[#080b12] border-r border-slate-200 dark:border-slate-800">
                            {stock.symbol}
                          </td>
                          <td className="py-2 px-3 text-left text-slate-700 dark:text-slate-300 font-sans max-w-48 truncate" title={stock.company}>
                            {stock.company}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white bg-emerald-50/50 dark:bg-emerald-950/10">
                            ₹{stock.close.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 text-right font-black ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isUp ? '+' : ''}{stock.dailyReturnPct.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                            ₹{stock.prevClose.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                            ₹{stock.open.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                            ₹{stock.high.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-rose-700 dark:text-rose-400 font-semibold">
                            ₹{stock.low.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                            {stock.dailyRange.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                            {stock.rangePct.toFixed(2)}%
                          </td>
                          <td className={`py-2 px-3 text-right ${stock.gapPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {stock.gapPct >= 0 ? '+' : ''}{stock.gapPct.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-right font-black text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/10">
                            {stock.volume.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-200">
                            ₹{(stock.tradedValue / 10000000).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                            {stock.trades.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-500 font-mono">
                        No stocks found matching "{searchQuery}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. AI PREDICTIONS TAB                                     */}
      {/* ========================================================= */}
      {activeTab === 'PREDICTIONS' && (
        <div className="space-y-4">
          <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-cyan-500/10 dark:from-amber-950/40 dark:via-slate-900 dark:to-cyan-950/30 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-500 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  My-Trade Machine Learning Model Recommendations
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  19 technical indicators trained on historical NSE Bhavcopy data. High-probability trades with predicted returns.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              Win Rate: 78.4%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recommendations.slice(0, 15).map((rec) => (
              <div
                key={rec.stock}
                className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-cyan-500/50 transition-all font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-300">
                      #{rec.rank}
                    </span>
                    <span className="text-base font-black text-slate-950 dark:text-white">
                      {rec.stock}
                    </span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                    rec.direction === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
                  }`}>
                    {rec.direction}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">CMP</span>
                    <strong className="text-slate-900 dark:text-white text-sm">₹{rec.cmp.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">ML Score</span>
                    <strong className="text-amber-500 text-sm">{rec.score} / 100</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Target</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">₹{rec.targetPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Stop Loss</span>
                    <strong className="text-rose-600 dark:text-rose-400">₹{rec.stopLoss.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Expected Gain:</span>
                  <strong className="text-emerald-500 font-black">+{rec.expectedReturn}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MODEL RESULTS VERIFICATION TAB                         */}
      {/* ========================================================= */}
      {activeTab === 'RESULTS' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white font-mono">
                Yesterday's Predictions vs Actual Results
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Verification tracking of predicted return vs actual market closing performance.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold">
                Wins: {yesterdayResults.filter(r => r.result === 'Win').length}
              </span>
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg font-bold">
                Losses: {yesterdayResults.filter(r => r.result === 'Loss').length}
              </span>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-[#080b12]">
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 text-left">Date</th>
                  <th className="py-2.5 px-4 text-left">Stock</th>
                  <th className="py-2.5 px-4 text-right">ML Score</th>
                  <th className="py-2.5 px-4 text-right">Predicted Return</th>
                  <th className="py-2.5 px-4 text-right">Actual Return</th>
                  <th className="py-2.5 px-4 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                {yesterdayResults.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="py-2 px-4 text-slate-500">{r.date}</td>
                    <td className="py-2 px-4 font-black text-slate-900 dark:text-white">{r.stock}</td>
                    <td className="py-2 px-4 text-right text-amber-500 font-bold">{r.yesterdayScore}</td>
                    <td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300">+{r.predictedReturn}%</td>
                    <td className={`py-2 px-4 text-right font-black ${r.actualReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {r.actualReturn >= 0 ? '+' : ''}{r.actualReturn}%
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        r.result === 'Win'
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                      }`}>
                        {r.result === 'Win' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SETTLEMENT ENGINE & ARCHIVE SYNC TAB                   */}
      {/* ========================================================= */}
      {activeTab === 'SETTLEMENT' && (
        <div className="space-y-5 font-mono text-xs">
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Why NSE 20:30 PM Settlement Is Essential & How It Works
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  NSE closes market trading at 15:30 IST, but the official settlement price is derived using the weighted average (VWAP) of the last 30 minutes of trades and released at 20:30 PM IST.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-2">
                <h4 className="font-black text-xs uppercase text-cyan-600 dark:text-cyan-400">
                  1. Before 20:30 PM IST (Unsettled Phase)
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  During live market hours and immediately after 15:30 close, the NSE option chain and quote pages display only the Last Traded Price (LTP). The official <strong>CLOSE</strong> column is marked as <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">-</code>.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-xs uppercase text-emerald-600 dark:text-emerald-400">
                  2. After 20:30 PM IST (Official Settlement Phase)
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  NSE publishes the final settled UDiFF Bhavcopy archives on <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">nsearchives.nseindia.com</code>. The <strong>CLOSE</strong> column now carries the true settled price (e.g. 322.05 for Strike 22700 CE).
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                Automated GitHub Actions Cron: <span className="text-cyan-400 font-bold">15 15 * * 1-6 (Daily 20:45 IST)</span>
              </div>
              <button
                onClick={handleApplyToOptionChain}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Synchronize to Option Chain Now</span>
              </button>
            </div>
          </div>

          {/* Official Archive Download Links */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md">
            <h4 className="font-black text-slate-900 dark:text-white text-sm mb-3">
              Direct NSE Archives Download (Official Zip Bhavcopy)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={myTradeService.getNseBhavcopyUrl(selectedDate, 'cm')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-between transition-all"
              >
                <div>
                  <strong className="text-slate-900 dark:text-white block">Capital Market (CM) Bhavcopy</strong>
                  <span className="text-[10px] text-slate-500">Date: {selectedDate} • Stocks & Equity</span>
                </div>
                <Download className="w-4 h-4 text-cyan-500" />
              </a>

              <a
                href={myTradeService.getNseBhavcopyUrl(selectedDate, 'fo')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-between transition-all"
              >
                <div>
                  <strong className="text-slate-900 dark:text-white block">Derivatives (FO) Bhavcopy</strong>
                  <span className="text-[10px] text-slate-500">Date: {selectedDate} • NIFTY Option Strikes Close</span>
                </div>
                <Download className="w-4 h-4 text-purple-500" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

