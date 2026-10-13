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
  Lock,
  X,
  Compass,
  Award,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import { CandlestickIndicatorChart } from './CandlestickIndicatorChart';
import { 
  generateRealisticOptionCandles, 
  generateRealisticSpotCandles,
  fetchUpstoxIntradayCandles 
} from '../../services/upstoxCandleService';
import { 
  getLatestTechnicalIndicators, 
  calculateEMA,
  calculateVWAP,
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
import { 
  getStoredOrbConfig, 
  saveStoredOrbConfig, 
  DEFAULT_ORB_CONFIG, 
  type OrbStrategyConfiguration 
} from '../../config/orbStrategyConfig';
import { 
  evaluateOrbTimeWindow, 
  calculateOpeningRange, 
  evaluateOrbDayFilter, 
  evaluateMarkStrike, 
  evaluateOrbEntrySignal, 
  evaluateOrbExitSignal, 
  evaluateValidationGates 
} from '../../utils/orbStrategyEngine';
import type { 
  CandleData, 
  CandleInterval, 
  OptionType, 
  PaperTradeRecord, 
  BacktestResult,
  OpeningRange,
  DayFilterResult,
  MarkedStrike,
  OrbTimeWindowState,
  DailyDisciplineState,
  ValidationGatesStatus
} from '../../types/niftyAnalysis';

export const NiftyOptionsAnalysisPage: React.FC = () => {
  // 1. Strategy Configuration (Configurable, Section 6 & 7)
  const [orbConfig, setOrbConfig] = useState<OrbStrategyConfiguration>(() => getStoredOrbConfig());
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(false);

  // 2. Market & Contract State
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
  const [lotSize] = useState<number>(25); // NIFTY lot size: 25
  const [indiaVix, setIndiaVix] = useState<number>(14.2); // Current India VIX

  // 3. Data Feeds & Real-Time Engine
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [isBrokerConnected, setIsBrokerConnected] = useState<boolean>(false);
  const [brokerErrorMessage, setBrokerErrorMessage] = useState<string | null>(null);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<string>(new Date().toLocaleTimeString());
  const [optionCandles, setOptionCandles] = useState<CandleData[]>([]);
  const [spotCandles, setSpotCandles] = useState<CandleData[]>([]);

  // 4. Operating Mode: Paper Trading (default) vs Live Signals Mode
  const [activeModuleMode, setActiveModuleMode] = useState<'PAPER_TRADING' | 'LIVE_SIGNALS'>('PAPER_TRADING');

  // 5. Paper Trades State
  const [paperTrades, setPaperTrades] = useState<PaperTradeRecord[]>(() => getStoredPaperTrades());
  const [tradeNotification, setTradeNotification] = useState<string | null>(null);

  // 6. Backtesting Module State
  const [isBacktestRunning, setIsBacktestRunning] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  // 7. Daily Discipline State (Section 6.7)
  const [disciplineState, setDisciplineState] = useState<DailyDisciplineState>({
    tradesCompletedToday: 0,
    maxTradesAllowed: orbConfig.riskAndExit.maxTradesPerDay,
    consecutiveLosses: 0,
    isDailyLossLimitHit: false,
    isTradeHaltedForDay: false,
    isCooldownActive: false,
    cooldownCandlesRemaining: 0,
    dailyRealizedPnl: 0,
    softProfitLockTriggered: false,
  });

  // Today's date string in YYYY-MM-DD
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Sync spot price with market feed
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
    const symbolKey = `NSE_INDEX|Nifty 50`;

    if (brokerCfg.enabled && brokerCfg.apiKey && isBrokerConnected) {
      const res = await fetchUpstoxIntradayCandles(symbolKey, selectedInterval, brokerCfg.apiKey);
      if (res.candles.length > 0) {
        setSpotCandles(res.candles);
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

  // ============================================================================
  // SECTION 6.1: TIME WINDOWS EVALUATION
  // ============================================================================
  const timeWindowState: OrbTimeWindowState = useMemo(() => {
    const nowTimeStr = new Date().toTimeString().slice(0, 5); // "HH:MM"
    return evaluateOrbTimeWindow(nowTimeStr, orbConfig);
  }, [orbConfig, lastDataTimestamp]);

  // ============================================================================
  // SECTION 6.2: OPENING RANGE & DAY FILTER EVALUATION (AT 09:30)
  // ============================================================================
  const openingRange: OpeningRange = useMemo(() => {
    return calculateOpeningRange(spotCandles, spotPrice, orbConfig);
  }, [spotCandles, spotPrice, orbConfig]);

  const dayFilterResult: DayFilterResult = useMemo(() => {
    const nowTimeStr = new Date().toTimeString().slice(0, 5);
    return evaluateOrbDayFilter({
      openingRange,
      currentDateStr: todayDateStr,
      contractExpiryStr: selectedExpiry,
      currentTimeStr: nowTimeStr,
      indiaVix,
      config: orbConfig,
    });
  }, [openingRange, todayDateStr, selectedExpiry, indiaVix, orbConfig, lastDataTimestamp]);

  // ============================================================================
  // SECTION 6.3: EVENT 1: MARK STRIKE (Bias Confirmed, Strike Shortlisted)
  // ============================================================================
  const markStrikeResult = useMemo(() => {
    return evaluateMarkStrike({
      indexCandles5m: spotCandles,
      indexPrice: spotPrice,
      openingRange,
      availableCapital: orbConfig.riskAndExit.capital,
      lotSize,
      currentDateStr: todayDateStr,
      contractExpiryStr: selectedExpiry,
      optionPremium: currentOptionPremium,
      optionDelta: selectedOptionType === 'CE' ? 0.55 : 0.55,
      bidPrice: roundToTick(currentOptionPremium - 0.1),
      askPrice: roundToTick(currentOptionPremium + 0.1),
      selectedOptionType,
      selectedStrike,
      config: orbConfig,
    });
  }, [spotCandles, spotPrice, openingRange, orbConfig, lotSize, todayDateStr, selectedExpiry, currentOptionPremium, selectedOptionType, selectedStrike]);

  const markedStrike = markStrikeResult.markedStrike;

  // ============================================================================
  // SECTION 6.4 & 6.5: EVENT 2: ENTRY SIGNAL EVALUATION
  // ============================================================================
  const entrySignalResult = useMemo(() => {
    const askPrice = roundToTick(currentOptionPremium + 0.1);
    return evaluateOrbEntrySignal({
      indexCandles5m: spotCandles,
      markedStrike,
      openingRange,
      currentOptionAsk: askPrice,
      config: orbConfig,
    });
  }, [spotCandles, markedStrike, openingRange, currentOptionPremium, orbConfig]);

  // ============================================================================
  // SECTION 6.6: EVENT 3: ACTIVE POSITION EXIT SIGNALS
  // ============================================================================
  const openPositions = useMemo(() => paperTrades.filter((t) => t.status === 'OPEN'), [paperTrades]);
  const activePosition = openPositions.length > 0 ? openPositions[0] : null;

  const exitSignalResult = useMemo(() => {
    if (!activePosition || spotCandles.length === 0) return null;
    const nowTimeStr = new Date().toTimeString().slice(0, 5);
    const completedSpot = spotCandles.filter((c) => c.isCompleted !== false);
    const latestCandle = completedSpot.length > 0 ? completedSpot[completedSpot.length - 1] : spotCandles[spotCandles.length - 1];
    const closes = completedSpot.map((c) => c.close);
    const ema9 = calculateEMA(closes, 9)[closes.length - 1];
    const ema21 = calculateEMA(closes, 21)[closes.length - 1];
    const vwap = calculateVWAP(completedSpot)[completedSpot.length - 1];

    return evaluateOrbExitSignal({
      position: {
        entryPrice: activePosition.entryPrice,
        stopLossPrice: activePosition.stopLossPrice,
        targetPrice: activePosition.targetPrice,
        currentPrice: currentOptionPremium,
        quantity: activePosition.quantity,
        indexSlLevel: entrySignalResult.indexSlLevel || spotPrice - 30,
        optionType: activePosition.optionType,
        candlesInTrade: 2, // simulated candles in trade
      },
      currentIndexPrice: spotPrice,
      latest5mCandle: latestCandle,
      ema9_5m: ema9,
      ema21_5m: ema21,
      vwap5m: vwap,
      currentTimeStr: nowTimeStr,
      isFeedStale: false,
      config: orbConfig,
    });
  }, [activePosition, spotCandles, currentOptionPremium, entrySignalResult, spotPrice, orbConfig, lastDataTimestamp]);

  // Monitor open positions & auto-trigger exits
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

  // Daily discipline update (Section 6.7)
  const dailyRealizedPnl = useMemo(() => {
    return paperTrades
      .filter((t) => t.status !== 'OPEN')
      .reduce((acc, t) => acc + (t.netPnl || 0), 0);
  }, [paperTrades]);

  const dailyUnrealizedPnl = useMemo(() => {
    return openPositions.reduce((acc, t) => acc + t.unrealizedPnl, 0);
  }, [openPositions]);

  useEffect(() => {
    const closedToday = paperTrades.filter((t) => t.status !== 'OPEN');
    const tradesCount = closedToday.length;
    let consecutiveLosses = 0;
    for (let i = 0; i < closedToday.length; i++) {
      if ((closedToday[i].netPnl || 0) < 0) consecutiveLosses++;
      else break;
    }

    const maxLossLimit = (orbConfig.riskAndExit.capital * orbConfig.riskAndExit.maxDailyLossPercent) / 100;
    const isDailyLossLimitHit = dailyRealizedPnl <= -maxLossLimit;
    const isTradeHaltedForDay = tradesCount >= orbConfig.riskAndExit.maxTradesPerDay || consecutiveLosses >= 2 || isDailyLossLimitHit;
    const softProfitLockTriggered = dailyRealizedPnl >= orbConfig.riskAndExit.profitLockThreshold;

    let haltReason = undefined;
    if (tradesCount >= orbConfig.riskAndExit.maxTradesPerDay) {
      haltReason = `Maximum 2 trades reached for the day (Daily Limit).`;
    } else if (consecutiveLosses >= 2) {
      haltReason = `Halted after 2 consecutive losses to protect capital.`;
    } else if (isDailyLossLimitHit) {
      haltReason = `Daily loss limit of ₹${maxLossLimit} (3%) reached. Signals halted.`;
    }

    setDisciplineState((prev) => ({
      ...prev,
      tradesCompletedToday: tradesCount,
      consecutiveLosses,
      isDailyLossLimitHit,
      isTradeHaltedForDay,
      haltReason,
      dailyRealizedPnl,
      softProfitLockTriggered,
    }));
  }, [paperTrades, dailyRealizedPnl, orbConfig]);

  // ============================================================================
  // SECTION 7: RISK MANAGEMENT & LOT SIZING (Capital: ₹25,000, Risk: 2% = ₹500)
  // ============================================================================
  const riskPlan = useMemo(() => {
    const slPrice = entrySignalResult.isEntryValid && entrySignalResult.premiumSl > 0
      ? entrySignalResult.premiumSl
      : roundToTick(currentOptionPremium * (1 - orbConfig.riskAndExit.riskPerTradePercent / 100));

    return calculateRiskManagementPlan({
      availableCapital: orbConfig.riskAndExit.capital,
      riskPercentage: orbConfig.riskAndExit.riskPerTradePercent,
      entryPrice: currentOptionPremium,
      stopLossPrice: slPrice,
      riskRewardRatio: orbConfig.riskAndExit.targetMultiplier,
      lotSize,
      dailyRealizedPnl,
      dailyUnrealizedPnl,
      maxDailyLoss: (orbConfig.riskAndExit.capital * orbConfig.riskAndExit.maxDailyLossPercent) / 100,
      slippageTicks: orbConfig.riskAndExit.slippageTicks,
    });
  }, [orbConfig, currentOptionPremium, entrySignalResult, lotSize, dailyRealizedPnl, dailyUnrealizedPnl]);

  // ============================================================================
  // SECTION 7A: VALIDATION GATES EVALUATION
  // ============================================================================
  const performance = useMemo(() => calculatePerformanceAnalytics(paperTrades), [paperTrades]);

  const validationGates: ValidationGatesStatus = useMemo(() => {
    return evaluateValidationGates(performance, orbConfig.riskAndExit.capital, orbConfig);
  }, [performance, orbConfig]);

  const flashNotification = (msg: string) => {
    setTradeNotification(msg);
    setTimeout(() => setTradeNotification(null), 4000);
  };

  // Execute Paper Buy Order (Enforcing Daily Discipline & Time Windows)
  const handleExecutePaperBuy = () => {
    if (disciplineState.isTradeHaltedForDay) {
      flashNotification(`வர்த்தகம் நிறுத்தப்பட்டது: ${disciplineState.haltReason}`);
      return;
    }

    if (!timeWindowState.canEnterNewTrade) {
      flashNotification(`வர்த்தக சாளரம் மூடப்பட்டுள்ளது: ${timeWindowState.timeWindowLabelTamil}`);
      return;
    }

    if (riskPlan.isRiskExceeded) {
      flashNotification('வர்த்தகம் தவிர்க்கப்பட்டது: 1 லாட்டின் ஆபத்து அனுமதிக்கப்பட்ட தொகையை விட அதிகம்!');
      return;
    }

    if (openPositions.length > 0) {
      flashNotification('ஏற்கனவே ஒரு நிலை திறந்துள்ளது. ஒரு நேரத்தில் ஒரு நிலை மட்டுமே அனுமதிக்கப்படுகிறது.');
      return;
    }

    const contractName = markedStrike ? markedStrike.contractName : `NIFTY ${selectedStrike} ${selectedOptionType} (${selectedExpiry})`;
    const entryAsk = roundToTick(currentOptionPremium + orbConfig.riskAndExit.slippageTicks * 0.05);

    const newTrade = createPaperTrade({
      contractName,
      optionType: selectedOptionType,
      strike: selectedStrike,
      expiryDate: selectedExpiry,
      entryPrice: entryAsk,
      quantity: riskPlan.finalQuantity,
      lotSize,
      stopLossPrice: riskPlan.stopLossPrice,
      targetPrice: riskPlan.targetPrice,
      slippagePoints: orbConfig.riskAndExit.slippageTicks * 0.05,
    });

    const updated = [newTrade, ...paperTrades];
    setPaperTrades(updated);
    savePaperTrades(updated);
    flashNotification(`காகித ஆணை செயல்படுத்தப்பட்டது (PAPER BUY): ${contractName} x ${riskPlan.finalQuantity} Qty`);
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
    link.setAttribute('download', `nifty_orb_trade_journal_${todayDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    flashNotification('வர்த்தக வரலாறு CSV கோப்பாக பதிவிறக்கப்பட்டது!');
  };

  // Run Walk-Forward Backtest (Section 7A)
  const handleRunBacktest = () => {
    setIsBacktestRunning(true);
    setTimeout(() => {
      const res = runBacktest(
        optionCandles,
        selectedOptionType,
        selectedStrike,
        {
          emaFastPeriod: 9,
          emaSlowPeriod: 21,
          rsiPeriod: 14,
          rsiLowerBound: orbConfig.entryTrigger.rsiBullishMin,
          rsiUpperBound: orbConfig.entryTrigger.rsiBullishMax,
          stopLossPercent: 2,
          riskRewardMultiplier: orbConfig.riskAndExit.targetMultiplier,
          underlyingFilterEnabled: true,
        },
        orbConfig.riskAndExit.capital,
        orbConfig.riskAndExit.riskPerTradePercent,
        lotSize,
        orbConfig.riskAndExit.slippageTicks * 0.05
      );
      setBacktestResult(res);
      setIsBacktestRunning(false);
      flashNotification(`பின்தேர்வு முடிந்தது (Walk-Forward 60/40 Complete): ${res.totalTrades} வர்த்தகங்கள் பகுப்பாய்வு செய்யப்பட்டன.`);
    }, 450);
  };

  // Save Config Changes
  const handleSaveConfig = (updated: OrbStrategyConfiguration) => {
    setOrbConfig(updated);
    saveStoredOrbConfig(updated);
    setIsConfigDrawerOpen(false);
    flashNotification('வியூக அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன! (Strategy Config Saved)');
  };

  const handleResetConfigDefaults = () => {
    setOrbConfig(DEFAULT_ORB_CONFIG);
    saveStoredOrbConfig(DEFAULT_ORB_CONFIG);
    flashNotification('இயல்புநிலை அமைப்புகள் மீட்டமைக்கப்பட்டன (Reset to Defaults)');
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
        {/* SECTION 7A: VALIDATION GATES STATUS BANNER                           */}
        {/* ==================================================================== */}
        <div className={`p-4 rounded-2xl border transition-all shadow-xl font-mono ${
          validationGates.isValidated
            ? 'bg-linear-to-r from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/70 text-emerald-100 ring-1 ring-emerald-500/30'
            : 'bg-linear-to-r from-amber-950/70 via-slate-900 to-slate-950 border-amber-500/60 text-amber-100 ring-1 ring-amber-500/30'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider shadow-md ${
                  validationGates.isValidated
                    ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                    : 'bg-amber-500 text-black shadow-amber-500/30'
                }`}>
                  {validationGates.statusText}
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  பிரிவு 7A: உத்தி சரிபார்ப்பு வாயில்கள் (Strategy Validation Gates)
                </span>
                <span className="text-[10px] text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40">
                  உண்மையான ஆணை செயல்படுத்தல் நிரந்தரமாக முடக்கப்பட்டுள்ளது (Real Orders Disabled)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-4xl leading-relaxed">
                இந்த உத்தி 100+ காகித வர்த்தகங்கள், 1.3-க்கு அதிகமான லாபக் காரணி (PF), நிகர நேர்மறை எதிர்பார்ப்பு மற்றும் மூலதனத்தில் 10%-க்கு குறைவான வீழ்ச்சியை அடையும் வரை <strong>"NOT VALIDATED"</strong> என குறிக்கப்படும்.
              </p>
            </div>

            {/* Validation Gate Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] w-full lg:w-auto shrink-0">
              <div className={`p-2 rounded-lg border text-center ${
                validationGates.gate1PaperTradesMet ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}>
                <span className="block font-bold">100+ வர்த்தகம்</span>
                <span>{validationGates.paperTradesCount} / 100 {validationGates.gate1PaperTradesMet ? '✓' : '✗'}</span>
              </div>
              <div className={`p-2 rounded-lg border text-center ${
                validationGates.gate2ProfitFactorMet ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}>
                <span className="block font-bold">PF &gt; 1.30</span>
                <span>{validationGates.profitFactor} {validationGates.gate2ProfitFactorMet ? '✓' : '✗'}</span>
              </div>
              <div className={`p-2 rounded-lg border text-center ${
                validationGates.gate3ExpectancyMet ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}>
                <span className="block font-bold">எதிர்பார்ப்பு &gt; 0</span>
                <span>₹{validationGates.expectancyPerTrade} {validationGates.gate3ExpectancyMet ? '✓' : '✗'}</span>
              </div>
              <div className={`p-2 rounded-lg border text-center ${
                validationGates.gate4DrawdownMet ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}>
                <span className="block font-bold">வீழ்ச்சி &lt; 10%</span>
                <span>{validationGates.maxDrawdownPercent}% {validationGates.gate4DrawdownMet ? '✓' : '✗'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* TOP CONTROLS & STRATEGY CONFIG BUTTON                                */}
        {/* ==================================================================== */}
        <div className="bg-linear-to-r from-cyan-950/70 via-slate-900/90 to-indigo-950/70 border border-cyan-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30">
                  பிரிவு 6: ORB + VWAP உத்தி
                </span>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  Opening Range Breakout + VWAP Trend <span className="text-cyan-400 text-sm font-normal">| நிஃப்டி 50 குறியீட்டு சமிக்ஞை</span>
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                சமிக்ஞைகள் <strong>NIFTY 50 INDEX</strong> மெழுகுவர்த்திகளிலிருந்து மட்டுமே உருவாக்கப்படுகின்றன. ஆப்ஷன்கள் வர்த்தகத்தை வெளிப்படுத்த மட்டுமே பயன்படுகின்றன.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Configure Strategy Thresholds Button */}
              <button
                onClick={() => setIsConfigDrawerOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>அமைப்புகள் (Configure Thresholds)</span>
              </button>

              {/* Operating Mode Toggle */}
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
                  <span>காகித வர்த்தகம்</span>
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
                  <span>நேரலை சமிக்ஞைகள்</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 6.1 & 6.2: TIME WINDOWS & DAY FILTER STATUS                   */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          {/* Time Window Card */}
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">
              6.1 நேர சாளரம் (IST Time Window)
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {timeWindowState.currentTime} IST
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                timeWindowState.canEnterNewTrade
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {timeWindowState.currentPhase}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {timeWindowState.timeWindowLabelTamil}
            </p>
          </div>

          {/* Opening Range Card */}
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">
              09:15 - 09:30 தொடக்க வரம்பு (Opening Range)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                ORH: ₹{openingRange.high} | ORL: ₹{openingRange.low}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                openingRange.isValidWidth ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {openingRange.widthPercent.toFixed(2)}% ({openingRange.width} pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              அனுமதிக்கப்பட்ட வரம்பு: 0.15% - 0.60% (தற்போது: {openingRange.isValidWidth ? 'சரியான அகலம்' : 'வரம்பிற்கு வெளியே'})
            </p>
          </div>

          {/* 6.2 Day Filter Status Card */}
          <div className={`rounded-xl p-3.5 border shadow-sm ${
            dayFilterResult.canTrade
              ? 'bg-white dark:bg-[#0c101d] border-slate-200 dark:border-slate-800'
              : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
          }`}>
            <span className="text-[10px] uppercase block opacity-80">
              6.2 நாள் வடிகட்டி (Day Filter Evaluation)
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-bold">
                {dayFilterResult.canTrade ? 'வடிகட்டி பூர்த்தியானது (PASSED)' : 'NO TRADE TODAY'}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                India VIX: {indiaVix} (Max {orbConfig.dayFilter.maxIndiaVix})
              </span>
            </div>
            <p className="text-[11px] mt-1 opacity-90 truncate" title={dayFilterResult.reasonTamil}>
              {dayFilterResult.reasonTamil}
            </p>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 6.3: EVENT 1: MARK STRIKE (Bias Confirmed, Strike Shortlisted)*/}
        {/* ==================================================================== */}
        <div className={`rounded-2xl p-4 border font-mono transition-all shadow-md ${
          markedStrike && !markedStrike.isExpired && markedStrike.capitalCheckPassed
            ? 'bg-linear-to-r from-cyan-950/70 via-slate-900 to-slate-950 border-cyan-500/70 text-cyan-100 ring-1 ring-cyan-500/30'
            : 'bg-white dark:bg-[#0c101d] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full shadow ${
                  markedStrike && !markedStrike.isExpired && markedStrike.capitalCheckPassed
                    ? 'bg-cyan-500 text-black'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {markedStrike && !markedStrike.isExpired && markedStrike.capitalCheckPassed ? 'STRIKE MARKED' : 'WAITING TO MARK STRIKE'}
                </span>
                <span className="text-sm font-bold text-white">
                  நிகழ்வு 1: ஸ்ட்ரைக் தேர்வு &amp; சார்பு உறுதி (Event 1: Mark Strike)
                </span>
                <span className="text-xs text-slate-400">
                  {markStrikeResult.biasReasonTamil}
                </span>
              </div>

              {markedStrike && (
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                  <span>ஒப்பந்தம்: <strong className="text-white">{markedStrike.contractName}</strong></span>
                  <span>பிரீமியம்: <strong className="text-cyan-400">₹{markedStrike.premium}</strong></span>
                  <span>டெல்டா (Delta): <strong className="text-emerald-400">{markedStrike.delta}</strong></span>
                  <span>ஸ்ப்ரெட்: <strong className="text-amber-400">₹{markedStrike.spread} ({markedStrike.spreadPercent}%)</strong></span>
                  <span>மூலதன செலவு: <strong className={markedStrike.capitalCheckPassed ? 'text-emerald-400' : 'text-rose-400'}>₹{markedStrike.capitalCost} (60% வரம்பு: ₹15,000)</strong></span>
                </div>
              )}
            </div>

            {/* Expiration Timer for Marked Strike (6 candles = 30 min) */}
            {markedStrike && !markedStrike.isExpired && (
              <div className="bg-black/60 p-2.5 rounded-xl border border-slate-800 text-xs shrink-0">
                <span className="text-[10px] text-slate-400 block">தூண்டுதல் காத்திருப்பு (Waiting for Trigger)</span>
                <span className="text-xs font-bold text-amber-400">
                  காலாவதி: 6 மெழுகுவர்த்திகளுக்குள் (30 நிமிடம்)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 6.4 & 6.5: EVENT 2: ENTRY SIGNAL                             */}
        {/* ==================================================================== */}
        <div className={`rounded-2xl p-4 border transition-all shadow-xl font-mono ${
          entrySignalResult.isEntryValid
            ? 'bg-linear-to-r from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/80 text-emerald-100 ring-2 ring-emerald-500/40'
            : 'bg-white dark:bg-[#0c101d] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs sm:text-sm font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md ${
                  entrySignalResult.isEntryValid
                    ? 'bg-emerald-500 text-black shadow-emerald-500/40'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  <Zap className="w-4 h-4 shrink-0" />
                  {entrySignalResult.verdict === 'BUY_WATCH' ? 'BUY WATCH — CE/PE' : 'NO TRADE'}
                </span>
                <span className="text-sm font-bold text-white">
                  நிகழ்வு 2: நுழைவு சமிக்ஞை (Event 2: Entry Signal on Confirmed 5m Close)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {entrySignalResult.reasonTamil} ({entrySignalResult.reason})
              </p>
            </div>

            {/* Entry, SL & Target Reference Levels */}
            {entrySignalResult.isEntryValid && (
              <div className="flex flex-wrap items-center gap-3 bg-black/60 p-3 rounded-xl border border-slate-800 text-xs w-full lg:w-auto">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">நுழைவு ஆஸ்க் (Entry Ask)</span>
                  <span className="text-sm font-bold text-white">₹{currentOptionPremium.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-rose-400 uppercase block">குறியீட்டு SL / பிரீமியம் SL</span>
                  <span className="text-sm font-bold text-rose-400">
                    ₹{entrySignalResult.indexSlLevel.toFixed(1)} / ₹{entrySignalResult.premiumSl.toFixed(2)}
                  </span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-emerald-400 uppercase block">இலக்கு (Target 1:1.5)</span>
                  <span className="text-sm font-bold text-emerald-400">₹{entrySignalResult.targetPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 6 Mandatory Entry Checklist Gates */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px]">
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              entrySignalResult.conditions.priceAboveOrhAndVwap ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}>
              <span>விலை &gt; ORH &amp; VWAP</span>
              <span>{entrySignalResult.conditions.priceAboveOrhAndVwap ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              entrySignalResult.conditions.ema9Above21 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}>
              <span>5m EMA 9 &gt; 21</span>
              <span>{entrySignalResult.conditions.ema9Above21 ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              entrySignalResult.conditions.rsiInZone ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}>
              <span>RSI (55–70 CE)</span>
              <span>{entrySignalResult.conditions.rsiInZone ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              entrySignalResult.conditions.candleBodyRatioMet ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}>
              <span>உடல் &gt;= 50%</span>
              <span>{entrySignalResult.conditions.candleBodyRatioMet ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              entrySignalResult.conditions.volumeSurgeMet ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}>
              <span>அளவு &gt;= 1.2x 20MA</span>
              <span>{entrySignalResult.conditions.volumeSurgeMet ? '✓' : '✗'}</span>
            </div>
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              entrySignalResult.conditions.notExtended ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}>
              <span>நீட்டிப்பு &lt;= 0.25%</span>
              <span>{entrySignalResult.conditions.notExtended ? '✓' : '✗'}</span>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* INTERACTIVE CANDLESTICK & INDICATOR CHART                            */}
        {/* ==================================================================== */}
        <CandlestickIndicatorChart
          candles={optionCandles}
          symbolName={`NIFTY ${selectedStrike} ${selectedOptionType} (${selectedInterval})`}
          underlyingPrice={spotPrice}
        />

        {/* ==================================================================== */}
        {/* SECTION 7: RISK MANAGEMENT & CAPITAL RULES                           */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                பிரிவு 7: ஆபத்து மேலாண்மை (Risk Management: Capital ₹25,000 | 2% Risk = ₹500)
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">
              ஸ்லிப்பேஜ்: 1 டிக் (₹0.05) சேர்க்கப்பட்டது | R:R இலக்கு: 1:1.5
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">ஆபத்து வரவு (Risk Budget)</span>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">₹{riskPlan.riskBudget.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">{orbConfig.riskAndExit.riskPerTradePercent}% of ₹{orbConfig.riskAndExit.capital}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">யூனிட் ஆபத்து (Risk / Unit)</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">₹{riskPlan.riskPerUnit.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Entry - SL</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">லாட்கள் அளவு (Lots)</span>
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
              <span className="text-[10px] text-slate-500 uppercase block">மதிப்பிடப்பட்ட நிகர லாபம் (1:1.5)</span>
              <span className="text-sm font-bold text-emerald-500">₹{riskPlan.estimatedNetProfit.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">Net of taxes &amp; ₹40 brokerage</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">மதிப்பிடப்பட்ட கட்டணங்கள்</span>
              <span className="text-sm font-bold text-amber-500">₹{riskPlan.estimatedBrokerageCharges.toFixed(2)}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">STT + GST + SEBI + Stamp</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            {riskPlan.isRiskExceeded ? (
              <div className="flex items-center gap-2 text-rose-500 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>TRADE SKIPPED — RISK TOO HIGH: 1 lot risk exceeds ₹{riskPlan.riskBudget}</span>
              </div>
            ) : disciplineState.isTradeHaltedForDay ? (
              <div className="flex items-center gap-2 text-rose-500 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{disciplineState.haltReason}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>ஆபத்து வரவு சரிபார்க்கப்பட்டது (Allowed under ₹{riskPlan.riskBudget} budget)</span>
              </div>
            )}

            {activeModuleMode === 'PAPER_TRADING' && (
              <button
                onClick={handleExecutePaperBuy}
                disabled={riskPlan.isRiskExceeded || disciplineState.isTradeHaltedForDay || !timeWindowState.canEnterNewTrade}
                className="px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Zap className="w-4 h-4 stroke-[2.5]" />
                <span>காகித ஆணை செயல்படுத்து (SIMULATE PAPER BUY)</span>
              </button>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 6.6: EVENT 3: ACTIVE PAPER POSITION & EXIT SIGNALS           */}
        {/* ==================================================================== */}
        {activeModuleMode === 'PAPER_TRADING' && (
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  நிகழ்வு 3: செயலில் உள்ள நிலை &amp; வெளியேறும் சமிக்ஞை (Event 3: Active Position &amp; Exits)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500">
                தினசரி ஒழுக்கம்: {disciplineState.tradesCompletedToday} / {orbConfig.riskAndExit.maxTradesPerDay} வர்த்தகம்
              </span>
            </div>

            {openPositions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                தற்போது திறந்த காகித வர்த்தகம் எதுவும் இல்லை. (No active simulated positions).
              </div>
            ) : (
              <div className="space-y-3">
                {openPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
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
                          <span>தற்போது: ₹{currentOptionPremium.toFixed(2)}</span>
                          <span className="text-rose-400">SL: ₹{pos.stopLossPrice.toFixed(2)}</span>
                          <span className="text-emerald-400">Target (1.5R): ₹{pos.targetPrice.toFixed(2)}</span>
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
                          வெளியேறு (Manual Exit)
                        </button>
                      </div>
                    </div>

                    {/* Exit Signal Evaluation Engine Bar */}
                    {exitSignalResult && (
                      <div className={`p-2.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                        exitSignalResult.shouldExit ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-slate-800/40 border-slate-700 text-slate-300'
                      }`}>
                        <span>வெளியேறும் நிலை: <strong>{exitSignalResult.exitReasonTamil}</strong></span>
                        <span>R-Multiple: <strong>{exitSignalResult.currentRMultiple.toFixed(2)}R</strong></span>
                        <span>டிரெயிலிங் SL: <strong>₹{exitSignalResult.trailStopLevel.toFixed(2)}</strong></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SECTION 6.7: DAILY DISCIPLINE & SOFT PROFIT LOCK                     */}
        {/* ==================================================================== */}
        {disciplineState.softProfitLockTriggered && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 text-xs font-mono text-amber-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>ஆலோசனை அறிவிப்பு:</strong> தினசரி லாபம் ₹{disciplineState.dailyRealizedPnl.toFixed(2)} எட்டியுள்ளது. 
              <strong>CONSIDER STOPPING - PROFIT PROTECTED</strong> (லாபத்தை பாதுகாக்கவும்).
            </span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PERFORMANCE JOURNAL & CSV EXPORT                                     */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-cyan-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                செயல்திறன் பகுப்பாய்வு &amp; வர்த்தக வரலாறு (Trade Journal)
              </h3>
            </div>
            
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV ஏற்றுமதி</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">வெற்றி விகிதம்</span>
              <span className="text-sm font-bold text-emerald-500">{performance.winRatePercent}%</span>
              <span className="text-[9px] text-slate-400 block">{performance.winningTrades} / {performance.totalTrades}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">நிகர P&amp;L</span>
              <span className={`text-sm font-bold ${performance.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {performance.netPnl >= 0 ? '+' : ''}₹{performance.netPnl.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-400 block">கட்டணங்கள்: ₹{performance.totalCharges.toFixed(2)}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">லாபக் காரணி (PF)</span>
              <span className="text-sm font-bold text-cyan-500">{performance.profitFactor}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">சராசரி வெற்றி</span>
              <span className="text-sm font-bold text-emerald-500">₹{performance.averageWin.toFixed(2)}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">சராசரி இழப்பு</span>
              <span className="text-sm font-bold text-rose-500">₹{performance.averageLoss.toFixed(2)}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">அதிகபட்ச வீழ்ச்சி</span>
              <span className="text-sm font-bold text-amber-500">₹{performance.maxDrawdown.toFixed(2)}</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-60 no-scrollbar border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-2">ஒப்பந்தம்</th>
                  <th className="p-2">அளவு</th>
                  <th className="p-2">நுழைவு</th>
                  <th className="p-2">வெளியேறு</th>
                  <th className="p-2">நிலை</th>
                  <th className="p-2 text-right">நிகர P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {paperTrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-slate-400">
                      வர்த்தக வரலாறு காலியாக உள்ளது.
                    </td>
                  </tr>
                ) : (
                  paperTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="p-2 font-bold text-slate-900 dark:text-white">{t.contractName}</td>
                      <td className="p-2">{t.quantity}</td>
                      <td className="p-2">₹{t.entryPrice.toFixed(2)} ({t.entryTimestamp})</td>
                      <td className="p-2">{t.exitPrice ? `₹${t.exitPrice.toFixed(2)} (${t.exitTimestamp})` : '-'}</td>
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
        {/* WALK-FORWARD BACKTESTING MODULE (60% IN-SAMPLE / 40% OUT-OF-SAMPLE) */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-3 gap-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                பிரிவு 7A: வரலாற்று பின்தேர்வு &amp; முன்னோக்கி சரிபார்ப்பு (Walk-Forward 60/40 Validation)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                முதல் 60% தரவில் விதிகளை உருவாக்கி, கடைசி 40% தீண்டப்படாத தரவில் சரிபார்க்கவும் (Walk-Forward Split).
              </p>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={isBacktestRunning}
              className="px-4 py-2 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBacktestRunning ? 'animate-spin' : ''}`} />
              <span>{isBacktestRunning ? 'பகுப்பாய்வு செய்கிறது...' : 'பின்தேர்வு இயக்கு (Run 60/40 Backtest)'}</span>
            </button>
          </div>

          {backtestResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">மொத்த வர்த்தகங்கள்</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{backtestResult.totalTrades}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">வெற்றி விகிதம்</span>
                  <span className="text-sm font-bold text-emerald-500">{backtestResult.winRate}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">வர்த்தக எதிர்பார்ப்பு</span>
                  <span className={`text-sm font-bold ${backtestResult.expectancyPerTrade > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ₹{backtestResult.expectancyPerTrade.toFixed(2)} / trade
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">அதிகபட்ச வீழ்ச்சி</span>
                  <span className="text-sm font-bold text-amber-500">₹{backtestResult.maxDrawdown.toFixed(2)}</span>
                </div>
              </div>

              {/* 60% / 40% Split Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-cyan-400 block">60% மாதிரிக்குள் (In-Sample Training)</span>
                  <span>வர்த்தகங்கள்: {backtestResult.inSampleTradesCount || 0} | நிகர P&amp;L: ₹{backtestResult.inSampleNetPnl || 0}</span>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-purple-400 block">40% மாதிரிக்கு வெளியே (Out-of-Sample Walk-Forward)</span>
                  <span>வர்த்தகங்கள்: {backtestResult.outOfSampleTradesCount || 0} | நிகர P&amp;L: ₹{backtestResult.outOfSampleNetPnl || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ==================================================================== */}
      {/* STRATEGY CONFIGURATION MODAL / DRAWER                                */}
      {/* ==================================================================== */}
      {isConfigDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 font-mono text-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  உத்தி அமைப்புகள் (Strategy Configuration Settings)
                </h3>
              </div>
              <button
                onClick={() => setIsConfigDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Section 6.1 Time Windows */}
              <div className="space-y-2">
                <span className="font-bold text-cyan-400 block">6.1 நேர சாளரங்கள் (Time Windows)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block">முதன்மை நுழைவு தொடக்கம்</label>
                    <input
                      type="text"
                      value={orbConfig.timeWindows.primaryEntryStart}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        timeWindows: { ...orbConfig.timeWindows, primaryEntryStart: e.target.value }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">கட்டாய வெளியேறும் நேரம்</label>
                    <input
                      type="text"
                      value={orbConfig.timeWindows.forceExitTime}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        timeWindows: { ...orbConfig.timeWindows, forceExitTime: e.target.value }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 6.2 Day Filter */}
              <div className="space-y-2">
                <span className="font-bold text-cyan-400 block">6.2 நாள் வடிகட்டி வரம்புகள் (Day Filter)</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block">குறைந்தபட்ச OR அகலம் (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={orbConfig.dayFilter.minRangeWidthPercent}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        dayFilter: { ...orbConfig.dayFilter, minRangeWidthPercent: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">அதிகபட்ச OR அகலம் (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={orbConfig.dayFilter.maxRangeWidthPercent}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        dayFilter: { ...orbConfig.dayFilter, maxRangeWidthPercent: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">அதிகபட்ச India VIX</label>
                    <input
                      type="number"
                      step="1"
                      value={orbConfig.dayFilter.maxIndiaVix}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        dayFilter: { ...orbConfig.dayFilter, maxIndiaVix: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 7 Risk Management */}
              <div className="space-y-2">
                <span className="font-bold text-cyan-400 block">7. ஆபத்து மேலாண்மை (Risk Management)</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block">மூலதனம் (Capital ₹)</label>
                    <input
                      type="number"
                      value={orbConfig.riskAndExit.capital}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        riskAndExit: { ...orbConfig.riskAndExit, capital: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">வர்த்தக ஆபத்து % (0.5%–2%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2.0"
                      value={orbConfig.riskAndExit.riskPerTradePercent}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        riskAndExit: { ...orbConfig.riskAndExit, riskPerTradePercent: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">இலக்கு விகிதம் (Target R:R)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={orbConfig.riskAndExit.targetMultiplier}
                      onChange={(e) => setOrbConfig({
                        ...orbConfig,
                        riskAndExit: { ...orbConfig.riskAndExit, targetMultiplier: Number(e.target.value) }
                      })}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleResetConfigDefaults}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
              >
                இயல்புநிலை மீட்டமை (Reset)
              </button>
              <button
                onClick={() => handleSaveConfig(orbConfig)}
                className="px-5 py-2 bg-linear-to-r from-cyan-500 to-blue-600 text-black font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                அமைப்புகளை சேமி (Save Settings)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
