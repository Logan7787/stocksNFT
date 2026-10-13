import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Target, 
  Sliders, 
  Zap, 
  Activity, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Info, 
  Layers, 
  Radio, 
  RefreshCw,
  FileSpreadsheet,
  BarChart2,
  Lock
} from 'lucide-react';
import { CandlestickIndicatorChart } from './CandlestickIndicatorChart';
import { 
  generateRealisticOptionCandles, 
  generateRealisticSpotCandles,
  fetchUpstoxIntradayCandles 
} from '../../services/upstoxCandleService';
import { 
  getLatestTechnicalIndicators, 
  evaluateStrategySignal, 
  roundToTick 
} from '../../utils/technicalIndicators';
import { 
  calculateRiskManagementPlan, 
  calculateEstimatedCharges 
} from '../../utils/riskCalculator';
import { 
  getStoredPaperTrades, 
  savePaperTrades, 
  createPaperTrade, 
  closePaperTrade, 
  updateOpenPaperTrades, 
  calculatePerformanceAnalytics, 
  exportPaperTradesToCSV 
} from '../../services/paperTradingService';
import { runBacktest } from '../../services/backtestingService';
import { niftyMarketService, fetchUpstoxExpiryDates, calculateUpcomingExpiryDate } from '../../services/niftyApi';
import type { 
  CandleData, 
  CandleInterval, 
  OptionType, 
  StrategyConfig, 
  PaperTradeRecord, 
  BacktestResult 
} from '../../types/niftyAnalysis';

export const NiftyOptionsAnalysisPage: React.FC = () => {
  // 1. Market & Contract State
  const [spotPrice, setSpotPrice] = useState<number>(() => niftyMarketService.getSpotPrice() || 24600.0);
  const [spotChange, setSpotChange] = useState<number>(35.5);
  const [spotChangePercent, setSpotChangePercent] = useState<number>(0.15);
  const [selectedOptionType, setSelectedOptionType] = useState<OptionType>('CE');
  const [selectedStrike, setSelectedStrike] = useState<number>(() => {
    const spot = niftyMarketService.getSpotPrice() || 24600.0;
    return Math.round(spot / 50) * 50;
  });
  const [selectedExpiry, setSelectedExpiry] = useState<string>(calculateUpcomingExpiryDate('NIFTY'));
  const [availableExpiries, setAvailableExpiries] = useState<string[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<CandleInterval>('5minute');
  const [lotSize, setLotSize] = useState<number>(25); // NIFTY lot size: 25

  // 2. Data Feeds & Real-Time Engine
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [isBrokerConnected, setIsBrokerConnected] = useState<boolean>(false);
  const [brokerErrorMessage, setBrokerErrorMessage] = useState<string | null>(null);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<string>(new Date().toLocaleTimeString());
  const [optionCandles, setOptionCandles] = useState<CandleData[]>([]);
  const [spotCandles, setSpotCandles] = useState<CandleData[]>([]);

  // 3. Operating Mode: Paper Trading (default) vs Live Signals Mode
  const [activeModuleMode, setActiveModuleMode] = useState<'PAPER_TRADING' | 'LIVE_SIGNALS'>('PAPER_TRADING');

  // 4. Configurable Strategy Parameters
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>({
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    rsiPeriod: 14,
    rsiLowerBound: 55,
    rsiUpperBound: 70,
    stopLossPercent: 2.0,
    riskRewardMultiplier: 2.0,
    underlyingFilterEnabled: true,
  });

  // 5. Risk Management Settings
  const [capital, setCapital] = useState<number>(25000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1% default = ₹250
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(1000);

  // 6. Paper Trades State
  const [paperTrades, setPaperTrades] = useState<PaperTradeRecord[]>(() => getStoredPaperTrades());
  const [tradeNotification, setTradeNotification] = useState<string | null>(null);

  // 7. Backtesting Module State
  const [isBacktestRunning, setIsBacktestRunning] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  // Synchronize spot price with active market feed
  useEffect(() => {
    const unsub = niftyMarketService.subscribe((data) => {
      setSpotPrice(data.spotPrice);
      setSpotChange(data.spotChange);
      setSpotChangePercent(data.metrics.spotChangePercent);
    });

    const unsubStatus = niftyMarketService.subscribeBrokerStatus((st) => {
      setIsBrokerConnected(st.connected && st.status === 'connected');
      if (st.status === 'token_expired') {
        setBrokerErrorMessage('Upstox Access Token Expired (401). Daily token reset occurs at 3:30 AM IST.');
      } else if (st.error) {
        setBrokerErrorMessage(st.error);
      } else {
        setBrokerErrorMessage(null);
      }
    });

    return () => {
      unsub();
      unsubStatus();
    };
  }, []);

  // Load contract expiries
  useEffect(() => {
    const brokerCfg = niftyMarketService.getBrokerConfig();
    fetchUpstoxExpiryDates(brokerCfg.apiKey, 'NIFTY').then((dates) => {
      if (dates && dates.length > 0) {
        setAvailableExpiries(dates);
        if (!dates.includes(selectedExpiry)) {
          setSelectedExpiry(dates[0]);
        }
      }
    });
  }, [selectedExpiry]);

  // Fetch or simulate intraday candles
  const loadCandles = useCallback(async () => {
    const brokerCfg = niftyMarketService.getBrokerConfig();
    // Instrument key formatting
    const symbolKey = `NSE_INDEX|Nifty 50`;

    if (brokerCfg.enabled && brokerCfg.apiKey && isBrokerConnected) {
      const res = await fetchUpstoxIntradayCandles(symbolKey, selectedInterval, brokerCfg.apiKey);
      if (res.candles.length > 0) {
        setSpotCandles(res.candles);
        // Also synthesize/fetch option candles
        const { candles } = generateRealisticOptionCandles(spotPrice, selectedStrike, selectedOptionType, selectedInterval);
        setOptionCandles(candles);
        setLastDataTimestamp(new Date().toLocaleTimeString());
        return;
      }
    }

    // High-Fidelity Simulation fallback
    const { candles: optCandles } = generateRealisticOptionCandles(spotPrice, selectedStrike, selectedOptionType, selectedInterval);
    const sptCandles = generateRealisticSpotCandles(spotPrice, selectedInterval);
    setOptionCandles(optCandles);
    setSpotCandles(sptCandles);
    setLastDataTimestamp(new Date().toLocaleTimeString());
  }, [spotPrice, selectedStrike, selectedOptionType, selectedInterval, isBrokerConnected]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // Real-time tick updates (every 2.5s)
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      loadCandles();
    }, 2500);
    return () => clearInterval(interval);
  }, [isLiveStreaming, loadCandles]);

  // Current option premium
  const currentOptionPremium = useMemo(() => {
    if (optionCandles.length === 0) return 120.0;
    return optionCandles[optionCandles.length - 1].close;
  }, [optionCandles]);

  // Update open paper trades with current premium
  useEffect(() => {
    setPaperTrades((prevTrades) => {
      if (!prevTrades.some((t) => t.status === 'OPEN')) return prevTrades;
      const { updatedTrades, triggeredTrades } = updateOpenPaperTrades(prevTrades, currentOptionPremium);
      if (triggeredTrades.length > 0) {
        savePaperTrades(updatedTrades);
        triggeredTrades.forEach((tr) => {
          flashNotification(`காகித வர்த்தகம் முடிந்தது: ${tr.contractName} (${tr.exitReason}) | Net PnL: ₹${tr.netPnl}`);
        });
      }
      return updatedTrades;
    });
  }, [currentOptionPremium]);

  // Evaluate technical indicators & strategy signal
  const indicators = useMemo(() => {
    const freshness = isBrokerConnected ? 'LIVE' : 'SIMULATED';
    return getLatestTechnicalIndicators(optionCandles, strategyConfig, freshness);
  }, [optionCandles, strategyConfig, isBrokerConnected]);

  const signal = useMemo(() => {
    return evaluateStrategySignal(optionCandles, spotCandles, strategyConfig);
  }, [optionCandles, spotCandles, strategyConfig]);

  // Risk Management Calculations
  const openPositions = useMemo(() => paperTrades.filter((t) => t.status === 'OPEN'), [paperTrades]);
  const dailyRealizedPnl = useMemo(() => {
    return paperTrades
      .filter((t) => t.status !== 'OPEN')
      .reduce((acc, t) => acc + (t.netPnl || 0), 0);
  }, [paperTrades]);
  const dailyUnrealizedPnl = useMemo(() => {
    return openPositions.reduce((acc, t) => acc + t.unrealizedPnl, 0);
  }, [openPositions]);

  const riskPlan = useMemo(() => {
    return calculateRiskManagementPlan({
      availableCapital: capital,
      riskPercentage: riskPercent,
      entryPrice: currentOptionPremium,
      riskRewardRatio: strategyConfig.riskRewardMultiplier,
      lotSize,
      dailyRealizedPnl,
      dailyUnrealizedPnl,
      maxDailyLoss,
    });
  }, [capital, riskPercent, currentOptionPremium, strategyConfig.riskRewardMultiplier, lotSize, dailyRealizedPnl, dailyUnrealizedPnl, maxDailyLoss]);

  // Performance Analytics
  const performance = useMemo(() => calculatePerformanceAnalytics(paperTrades), [paperTrades]);

  const flashNotification = (msg: string) => {
    setTradeNotification(msg);
    setTimeout(() => setTradeNotification(null), 4000);
  };

  // Execute Paper Buy Order
  const handleExecutePaperBuy = () => {
    if (riskPlan.isRiskExceeded) {
      flashNotification('வர்த்தகம் தவிர்க்கப்பட்டது: 1 லாட்டின் ஆபத்து அனுமதிக்கப்பட்ட தொகையை விட அதிகம்!');
      return;
    }

    const contractName = `NIFTY ${selectedStrike} ${selectedOptionType} (${selectedExpiry})`;
    const newTrade = createPaperTrade({
      contractName,
      optionType: selectedOptionType,
      strike: selectedStrike,
      expiryDate: selectedExpiry,
      entryPrice: currentOptionPremium,
      quantity: riskPlan.finalQuantity,
      lotSize,
      stopLossPrice: riskPlan.stopLossPrice,
      targetPrice: riskPlan.targetPrice,
    });

    const updated = [newTrade, ...paperTrades];
    setPaperTrades(updated);
    savePaperTrades(updated);
    flashNotification(`காகித வர்த்தகம் பதிவு செய்யப்பட்டது (PAPER TRADE): ${contractName} x ${riskPlan.finalQuantity} Qty`);
  };

  // Close open paper trade manually
  const handleCloseManualPaperTrade = (tradeId: string) => {
    const target = paperTrades.find((t) => t.id === tradeId);
    if (!target) return;
    const closed = closePaperTrade(target, currentOptionPremium, 'MANUAL');
    const updated = paperTrades.map((t) => (t.id === tradeId ? closed : t));
    setPaperTrades(updated);
    savePaperTrades(updated);
    flashNotification(`காகித வர்த்தகம் கைமுறையாக மூடப்பட்டது: ₹${closed.netPnl} Net P&L`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvData = exportPaperTradesToCSV(paperTrades);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nifty_paper_trade_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    flashNotification('வர்த்தக வரலாறு CSV கோப்பாக பதிவிறக்கப்பட்டது!');
  };

  // Run Backtest
  const handleRunBacktest = () => {
    setIsBacktestRunning(true);
    setTimeout(() => {
      const res = runBacktest(
        optionCandles,
        selectedOptionType,
        selectedStrike,
        strategyConfig,
        capital,
        riskPercent,
        lotSize
      );
      setBacktestResult(res);
      setIsBacktestRunning(false);
      flashNotification(`பின்தேர்வு முடிந்தது (Backtest Complete): ${res.totalTrades} வர்த்தகங்கள் பகுப்பாய்வு செய்யப்பட்டன.`);
    }, 400);
  };

  // Strike range generation centered around ATM
  const strikeOptions = useMemo(() => {
    const atm = Math.round(spotPrice / 50) * 50;
    const strikes: number[] = [];
    for (let s = atm - 500; s <= atm + 500; s += 50) {
      strikes.push(s);
    }
    return strikes;
  }, [spotPrice]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 transition-colors font-sans pb-16">
      {/* Toast Notification */}
      {tradeNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-cyan-500/50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
          <span className="text-xs font-mono font-medium">{tradeNotification}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        
        {/* ==================================================================== */}
        {/* 1. TOP DISCLAIMER & MODE BANNER (TAMIL + TECHNICAL ENGLISH)         */}
        {/* ==================================================================== */}
        <div className="bg-linear-to-r from-cyan-950/70 via-slate-900/90 to-indigo-950/70 border border-cyan-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30">
                  புதிய தொகுதி (NEW MODULE)
                </span>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  NIFTY 50 Options Analysis <span className="text-cyan-400 text-sm font-normal">| நிஃப்டி 50 ஆப்ஷன்ஸ் பகுப்பாய்வு</span>
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                <strong className="text-amber-400 font-bold">முக்கிய அறிவிப்பு:</strong> இது கல்வி மற்றும் பகுப்பாய்வு நோக்கங்களுக்காக மட்டுமே. 
                தினசரி ₹500–₹2,500 லாபம் என்பது ஆய்விற்கான இலக்கு மட்டுமே (Target for Analysis), உறுதியளிக்கப்பட்ட லாபம் அல்ல. 
                நேரடி ஆணை அனுப்புதல் முடக்கப்பட்டுள்ளது (Real-order execution disabled).
              </p>
            </div>

            {/* Operating Mode Toggle: Paper Trading vs Live Signals */}
            <div className="flex items-center bg-black/60 p-1 rounded-xl border border-slate-700 shrink-0">
              <button
                onClick={() => setActiveModuleMode('PAPER_TRADING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeModuleMode === 'PAPER_TRADING'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>காகித வர்த்தகம் (Paper Trading)</span>
              </button>
              <button
                onClick={() => setActiveModuleMode('LIVE_SIGNALS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeModuleMode === 'LIVE_SIGNALS'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>நேரலை சமிக்ஞைகள் (Live Signals)</span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 2. MARKET OVERVIEW & BROKER STATUS BAR                               */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* NIFTY 50 Underlying Index Price */}
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block">
              நிஃப்டி 50 குறியீடு (Underlying Index)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                ₹{spotPrice.toFixed(2)}
              </span>
              <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                spotChange >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {spotChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {spotChange >= 0 ? '+' : ''}{spotChange.toFixed(2)} ({spotChangePercent.toFixed(2)}%)
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-1 block">
              NSE Live Feed: {lastDataTimestamp}
            </span>
          </div>

          {/* Selected Option Premium */}
          <div className="bg-white dark:bg-[#0c101d] border border-cyan-500/40 dark:border-cyan-500/30 rounded-xl p-3.5 shadow-sm ring-1 ring-cyan-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase font-mono font-bold">
                தேர்ந்தெடுக்கப்பட்ட ஆப்ஷன் பிரீமியம் (Option Premium)
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black font-mono uppercase ${
                selectedOptionType === 'CE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {selectedOptionType}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-cyan-600 dark:text-cyan-300">
                ₹{currentOptionPremium.toFixed(2)}
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Strike {selectedStrike}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-1 block">
              காலாவதி (Expiry): {selectedExpiry}
            </span>
          </div>

          {/* Upstox Broker API Status */}
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block">
              Upstox API இணைப்பு நிலை (Connection Status)
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                isBrokerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`} />
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {isBrokerConnected ? 'Upstox நேரலை அங்கீகாரம் (LIVE)' : 'உயர் நம்பக உருவகப்படுத்துதல் (Simulated)'}
              </span>
            </div>
            {brokerErrorMessage ? (
              <span className="text-[10px] text-rose-500 dark:text-rose-400 font-mono mt-1 block truncate" title={brokerErrorMessage}>
                {brokerErrorMessage}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 block">
                OAuth v2 Bearer Token Secure Mode
              </span>
            )}
          </div>

          {/* Capital & Target Analysis */}
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block">
              மூலதனம் & தினசரி வரம்பு (Capital & Limit)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                ₹{capital.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-mono text-amber-500 font-bold">
                1% ஆபத்து: ₹{riskPlan.riskBudget}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 block">
              ஆய்வு இலக்கு: ₹500 – ₹2,500 (Analysis Target)
            </span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 3. CONTRACT SELECTOR & TIMEFRAME BAR                                 */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm font-mono text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* CE / PE Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-800">
              <button
                onClick={() => setSelectedOptionType('CE')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  selectedOptionType === 'CE'
                    ? 'bg-emerald-500 text-black shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                CALL (CE)
              </button>
              <button
                onClick={() => setSelectedOptionType('PE')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  selectedOptionType === 'PE'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                PUT (PE)
              </button>
            </div>

            {/* Strike Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">ஸ்ட்ரைக் (Strike):</span>
              <select
                value={selectedStrike}
                onChange={(e) => setSelectedStrike(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-cyan-500"
              >
                {strikeOptions.map((st) => (
                  <option key={st} value={st}>
                    {st} {st === Math.round(spotPrice / 50) * 50 ? '(ATM)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiry Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">காலாவதி (Expiry):</span>
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-cyan-500"
              >
                {availableExpiries.length > 0 ? (
                  availableExpiries.map((exp) => (
                    <option key={exp} value={exp}>
                      {exp}
                    </option>
                  ))
                ) : (
                  <option value={selectedExpiry}>{selectedExpiry}</option>
                )}
              </select>
            </div>

            {/* Candle Interval */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">இடைவெளி (Timeframe):</span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-800">
                {(['1minute', '3minute', '5minute', '15minute'] as CandleInterval[]).map((intv) => (
                  <button
                    key={intv}
                    onClick={() => setSelectedInterval(intv)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                      selectedInterval === intv
                        ? 'bg-cyan-500 text-black'
                        : 'text-slate-500 dark:text-slate-400 hover:text-white'
                    }`}
                  >
                    {intv.replace('minute', 'm')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lot Size and Tick Info */}
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
            <span>லாட் அளவு (Lot Size): <strong className="text-slate-800 dark:text-slate-200">{lotSize}</strong></span>
            <span>டிக் அளவு (Tick): <strong className="text-slate-800 dark:text-slate-200">0.05</strong></span>
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                isLiveStreaming
                  ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}
              title={isLiveStreaming ? 'நிறுத்து (Pause Feed)' : 'தொடங்கு (Resume Feed)'}
            >
              {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 4. EXPERIMENTAL SIGNAL STRATEGY CARD                                */}
        {/* ==================================================================== */}
        <div className={`rounded-2xl p-4 border transition-all shadow-xl font-mono ${
          signal.verdict === 'BUY_WATCH'
            ? 'bg-linear-to-r from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/80 text-emerald-100 ring-2 ring-emerald-500/30'
            : signal.verdict === 'WEAKNESS_WARNING'
            ? 'bg-linear-to-r from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/80 text-amber-100 ring-1 ring-amber-500/30'
            : 'bg-linear-to-r from-slate-900 via-slate-900 to-slate-950 border-slate-800 text-slate-300'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Verdict Badge & Explanations */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs sm:text-sm font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md ${
                  signal.verdict === 'BUY_WATCH'
                    ? 'bg-emerald-500 text-black shadow-emerald-500/40'
                    : signal.verdict === 'WEAKNESS_WARNING'
                    ? 'bg-amber-500 text-black shadow-amber-500/40'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  <Zap className="w-4 h-4 shrink-0" />
                  {signal.verdictTamil}
                </span>

                <span className="text-xs font-bold text-white bg-black/50 px-2.5 py-1 rounded-lg border border-slate-700">
                  NIFTY {selectedStrike} {selectedOptionType}
                </span>
                <span className="text-[11px] text-slate-400">
                  {signal.reasonTamil} ({signal.reason})
                </span>
              </div>

              {/* Warnings List */}
              <div className="mt-2 space-y-1">
                {signal.warningsTamil.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-300/90 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>{w}</span>
                  </p>
                ))}
              </div>
            </div>

            {/* Signal Analytical Reference Levels */}
            {signal.referenceLevels && (
              <div className="flex flex-wrap items-center gap-3 bg-black/60 p-3 rounded-xl border border-slate-800 text-xs w-full lg:w-auto">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">நுழைவு விலை (Entry)</span>
                  <span className="text-sm font-bold text-white">₹{signal.referenceLevels.entryPrice.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-rose-400 uppercase block">நஷ்டத் தடுப்பு (Stop Loss)</span>
                  <span className="text-sm font-bold text-rose-400">₹{signal.referenceLevels.stopLossPrice.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-emerald-400 uppercase block">இலக்கு விலை (Target 1:2)</span>
                  <span className="text-sm font-bold text-emerald-400">₹{signal.referenceLevels.targetPrice.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-cyan-400 uppercase block">R:R விகிதம்</span>
                  <span className="text-sm font-bold text-cyan-400">1:{signal.referenceLevels.riskRewardRatio}</span>
                </div>
              </div>
            )}
          </div>

          {/* Conditions Grid Checklist */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className={`p-2 rounded-lg flex items-center justify-between ${
              signal.conditions.emaCondition ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/40 text-slate-500'
            }`}>
              <span>EMA 9 &gt; EMA 21</span>
              <span>{signal.conditions.emaCondition ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg flex items-center justify-between ${
              signal.conditions.vwapCondition ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/40 text-slate-500'
            }`}>
              <span>விலை &gt; VWAP</span>
              <span>{signal.conditions.vwapCondition ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg flex items-center justify-between ${
              signal.conditions.rsiCondition ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/40 text-slate-500'
            }`}>
              <span>RSI 14 (55–70)</span>
              <span>{signal.conditions.rsiCondition ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg flex items-center justify-between ${
              signal.conditions.highBreakCondition ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/40 text-slate-500'
            }`}>
              <span>முந்தைய High உடைப்பு</span>
              <span>{signal.conditions.highBreakCondition ? '✓' : '✗'}</span>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 5. INTERACTIVE CANDLESTICK & INDICATOR CHART                         */}
        {/* ==================================================================== */}
        <CandlestickIndicatorChart
          candles={optionCandles}
          symbolName={`NIFTY ${selectedStrike} ${selectedOptionType} (${selectedInterval})`}
          underlyingPrice={spotPrice}
        />

        {/* ==================================================================== */}
        {/* 6. RISK MANAGEMENT & POSITION SIZING CALCULATOR                      */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                ஆபத்து மேலாண்மை & லாட் கணக்கீடு (Risk Management & Sizing)
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">
              மூலதனம் (Capital): ₹{capital.toLocaleString('en-IN')} | ஆபத்து (Risk): {riskPercent}%
            </span>
          </div>

          {/* Calculator Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">ஆபத்து வரவு (Risk Budget)</span>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">₹{riskPlan.riskBudget.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">{riskPercent}% of Capital</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">யூனிட் ஆபத்து (Risk / Unit)</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">₹{riskPlan.riskPerUnit.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Entry - SL</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">லாட்கள் எண்ணிக்கை (Lots)</span>
              <span className={`text-sm font-bold ${riskPlan.isRiskExceeded ? 'text-rose-500' : 'text-emerald-500'}`}>
                {riskPlan.lotsCount} லாட்கள் ({riskPlan.finalQuantity} Qty)
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Lot Size: {lotSize}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">மொத்த பிரீமியம் (Outlay)</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">₹{riskPlan.totalPremiumOutlay.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Qty x Entry</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">மதிப்பிடப்பட்ட நிகர லாபம்</span>
              <span className="text-sm font-bold text-emerald-500">₹{riskPlan.estimatedNetProfit.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Charges deducted</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">மதிப்பிடப்பட்ட கட்டணங்கள்</span>
              <span className="text-sm font-bold text-amber-500">₹{riskPlan.estimatedBrokerageCharges.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">STT + GST + Brokerage</span>
            </div>
          </div>

          {/* Risk Limit Warning or Action Button */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            {riskPlan.isRiskExceeded ? (
              <div className="flex items-center gap-2 text-rose-500 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>வர்த்தகம் தவிர்க்கப்பட்டது — அதிக ஆபத்து (TRADE SKIPPED — RISK TOO HIGH: 1 lot risk exceeds ₹{riskPlan.riskBudget})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>அனுமதிக்கப்பட்ட ஆபத்து வரம்பிற்குள் உள்ளது (Within Risk Budget)</span>
              </div>
            )}

            {/* Execute Paper Trade Button */}
            {activeModuleMode === 'PAPER_TRADING' && (
              <button
                onClick={handleExecutePaperBuy}
                disabled={riskPlan.isRiskExceeded}
                className="px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Zap className="w-4 h-4 stroke-[2.5]" />
                <span>காகித ஆணை செயல்படுத்து (SIMULATE PAPER BUY)</span>
              </button>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 7. PAPER TRADING TERMINAL & ACTIVE POSITIONS                         */}
        {/* ==================================================================== */}
        {activeModuleMode === 'PAPER_TRADING' && (
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  செயலில் உள்ள காகித நிலைகள் (Open Paper Positions)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500">
                தற்போதைய திறந்த நிலைகள்: {openPositions.length}
              </span>
            </div>

            {openPositions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                தற்போது திறந்த காகித வர்த்தகம் எதுவும் இல்லை. (No active simulated positions).
              </div>
            ) : (
              <div className="space-y-2">
                {openPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {pos.contractName}
                        </span>
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-bold">
                          PAPER TRADE
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span>அளவு: {pos.quantity}</span>
                        <span>நுழைவு: ₹{pos.entryPrice.toFixed(2)}</span>
                        <span>தற்போது: ₹{pos.currentPrice.toFixed(2)}</span>
                        <span className="text-rose-400">SL: ₹{pos.stopLossPrice.toFixed(2)}</span>
                        <span className="text-emerald-400">Target: ₹{pos.targetPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">நிகர P&amp;L (Net PnL)</span>
                        <span className={`text-base font-bold ${
                          pos.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}₹{pos.unrealizedPnl.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCloseManualPaperTrade(pos.id)}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-all cursor-pointer text-xs"
                      >
                        வெளியேறு (Exit)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 8. TRADE JOURNAL & PERFORMANCE ANALYTICS                            */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-cyan-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                செயல்திறன் பகுப்பாய்வு & வர்த்தக வரலாறு (Performance Journal)
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV ஏற்றுமதி (Export CSV)</span>
              </button>
            </div>
          </div>

          {/* Performance Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">வெற்றி விகிதம் (Win Rate)</span>
              <span className="text-sm font-bold text-emerald-500">{performance.winRatePercent}%</span>
              <span className="text-[9px] text-slate-400 block">{performance.winningTrades} / {performance.totalTrades} வென்றவை</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">நிகர P&amp;L (Net P&amp;L)</span>
              <span className={`text-sm font-bold ${performance.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {performance.netPnl >= 0 ? '+' : ''}₹{performance.netPnl.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-400 block">கட்டணங்கள்: ₹{performance.totalCharges.toFixed(2)}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">லாபக் காரணி (Profit Factor)</span>
              <span className="text-sm font-bold text-cyan-500">{performance.profitFactor}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">சராசரி வெற்றி (Avg Win)</span>
              <span className="text-sm font-bold text-emerald-500">₹{performance.averageWin.toFixed(2)}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">சராசரி இழப்பு (Avg Loss)</span>
              <span className="text-sm font-bold text-rose-500">₹{performance.averageLoss.toFixed(2)}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">அதிகபட்ச வீழ்ச்சி (Drawdown)</span>
              <span className="text-sm font-bold text-amber-500">₹{performance.maxDrawdown.toFixed(2)}</span>
            </div>
          </div>

          {/* Historical Trade Journal Table */}
          <div className="overflow-x-auto max-h-64 no-scrollbar border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-2">ஒப்பந்தம் (Contract)</th>
                  <th className="p-2">அளவு (Qty)</th>
                  <th className="p-2">நுழைவு (Entry)</th>
                  <th className="p-2">வெளியேறு (Exit)</th>
                  <th className="p-2">நிலை (Status)</th>
                  <th className="p-2 text-right">நிகர P&amp;L (Net)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {paperTrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-slate-400">
                      வர்த்தக வரலாறு காலியாக உள்ளது. (No trade records found).
                    </td>
                  </tr>
                ) : (
                  paperTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="p-2 font-bold text-slate-900 dark:text-white">
                        {t.contractName}
                      </td>
                      <td className="p-2">{t.quantity}</td>
                      <td className="p-2">₹{t.entryPrice.toFixed(2)} ({t.entryTimestamp})</td>
                      <td className="p-2">
                        {t.exitPrice ? `₹${t.exitPrice.toFixed(2)} (${t.exitTimestamp})` : '-'}
                      </td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'OPEN' ? 'bg-cyan-500/20 text-cyan-400' :
                          t.status === 'CLOSED_TARGET' ? 'bg-emerald-500/20 text-emerald-400' :
                          t.status === 'CLOSED_SL' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className={`p-2 text-right font-bold ${
                        (t.netPnl !== undefined ? t.netPnl : t.unrealizedPnl) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {(t.netPnl !== undefined ? t.netPnl : t.unrealizedPnl) >= 0 ? '+' : ''}
                        ₹{(t.netPnl !== undefined ? t.netPnl : t.unrealizedPnl).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 9. BACKTESTING & PERFORMANCE VALIDATION MODULE                       */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3 gap-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                வரலாற்று பின்தேர்வு தொகுதி (Backtesting & Validation Engine)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                எதிர்கால சார்பு இன்றி (No look-ahead bias), முந்தைய மெழுகுவர்த்தி தரவுகளில் உத்தியை சரிபார்க்கவும்.
              </p>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={isBacktestRunning}
              className="px-4 py-2 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBacktestRunning ? 'animate-spin' : ''}`} />
              <span>{isBacktestRunning ? 'பகுப்பாய்வு செய்கிறது...' : 'பின்தேர்வு இயக்கு (Run Backtest)'}</span>
            </button>
          </div>

          {backtestResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 block">மொத்த வர்த்தகங்கள் (Total Trades)</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{backtestResult.totalTrades}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">வெற்றி விகிதம் (Win Rate)</span>
                <span className="text-sm font-bold text-emerald-500">{backtestResult.winRate}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">நிகர P&amp;L (Net PnL)</span>
                <span className={`text-sm font-bold ${backtestResult.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  ₹{backtestResult.netPnl.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">அதிகபட்ச வீழ்ச்சி (Max Drawdown)</span>
                <span className="text-sm font-bold text-amber-500">₹{backtestResult.maxDrawdown.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
