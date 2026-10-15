export type OptionType = 'CE' | 'PE';

export type CandleInterval = '1minute' | '3minute' | '5minute' | '15minute';

export interface CandleData {
  timestamp: string; // ISO string or time string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isCompleted?: boolean;
}

export interface TechnicalIndicators {
  ema9: number | null;
  ema21: number | null;
  rsi14: number | null;
  vwap: number | null;
  prevCandleHigh: number | null;
  prevCandleLow: number | null;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isEmaBullishCross: boolean; // ema9 > ema21
  isAboveVwap: boolean;       // close > vwap
  isRsiInZone: boolean;       // 55 <= rsi <= 70
  isBreakoutHigh: boolean;    // close > prevHigh
  candleConfirmed: boolean;
  dataFreshness: 'LIVE' | 'DELAYED' | 'STALE' | 'SIMULATED';
  lastUpdated: string;
}

export type SignalVerdict = 'BUY_WATCH' | 'NO_TRADE' | 'WEAKNESS_WARNING';

export interface StrategySignal {
  verdict: SignalVerdict;
  verdictTamil: string;
  reason: string;
  reasonTamil: string;
  underlyingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  optionPremiumTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  conditions: {
    emaCondition: boolean;      // EMA 9 > EMA 21
    vwapCondition: boolean;     // Close > VWAP
    rsiCondition: boolean;      // RSI 14 in [55, 70]
    highBreakCondition: boolean;// Close > Prev High
  };
  warnings: string[];
  warningsTamil: string[];
  referenceLevels: {
    entryPrice: number;
    stopLossPrice: number;
    targetPrice: number;
    riskRewardRatio: number;
  } | null;
  timestamp: string;
}

export interface StrategyConfig {
  emaFastPeriod: number;       // default 9
  emaSlowPeriod: number;       // default 21
  rsiPeriod: number;           // default 14
  rsiLowerBound: number;       // default 55
  rsiUpperBound: number;       // default 70
  stopLossPercent: number;     // default 2% (0.98 of entry)
  riskRewardMultiplier: number;// default 2.0 (1:2 R:R)
  underlyingFilterEnabled: boolean;
}

export interface RiskManagementPlan {
  availableCapital: number;    // default ₹25,000
  riskPercentage: number;      // default 1.0%
  riskBudget: number;          // capital * risk% / 100 (₹250)
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  riskPerUnit: number;         // entry - stopLoss
  lotSize: number;             // e.g. 65 (NIFTY)
  rawQuantity: number;
  lotsCount: number;
  finalQuantity: number;       // lotsCount * lotSize
  totalPremiumOutlay: number;  // finalQuantity * entryPrice
  isRiskExceeded: boolean;     // true if (1 lot * riskPerUnit) > riskBudget
  estimatedGrossProfit: number;
  estimatedGrossLoss: number;
  estimatedBrokerageCharges: number;
  estimatedNetProfit: number;
  estimatedNetLoss: number;
  dailyRealizedPnl: number;
  dailyUnrealizedPnl: number;
  maxDailyLoss: number;        // e.g. ₹1,000
  remainingRiskBudget: number;
  analysisTargetMin: number;   // ₹500
  analysisTargetMax: number;   // ₹2,500
}

export type PaperTradeStatus = 'OPEN' | 'CLOSED_TARGET' | 'CLOSED_SL' | 'CLOSED_MANUAL';

export interface PaperTradeRecord {
  id: string;
  orderType: 'PAPER_BUY';
  underlyingSymbol: string;    // 'NIFTY 50'
  contractName: string;        // e.g. 'NIFTY 24500 CE 24-OCT-2024'
  optionType: OptionType;
  strike: number;
  expiryDate: string;
  entryTimestamp: string;
  entryPrice: number;
  quantity: number;
  lotSize: number;
  lotsCount: number;
  stopLossPrice: number;
  targetPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  exitTimestamp?: string;
  exitPrice?: number;
  grossPnl?: number;
  charges?: number;
  netPnl?: number;
  status: PaperTradeStatus;
  exitReason?: string;
}

export interface PerformanceAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  netPnl: number;
  grossPnl: number;
  totalCharges: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
}

export interface BacktestParams {
  startDate: string;
  endDate: string;
  interval: CandleInterval;
  capital: number;
  riskPercent: number;
  slippagePoints: number;      // e.g. 0.5 points
  brokeragePerOrder: number;   // e.g. ₹20
}

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  optionType: OptionType;
  strike: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  reason: 'TARGET' | 'STOP_LOSS' | 'TIME_EXIT';
}

export interface BacktestResult {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  grossPnl: number;
  netPnl: number;
  profitFactor: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  expectancyPerTrade: number;
  inSampleTradesCount?: number;
  inSampleNetPnl?: number;
  outOfSampleTradesCount?: number;
  outOfSampleNetPnl?: number;
  trades: BacktestTrade[];
}

export interface OpeningRange {
  high: number;
  low: number;
  width: number;
  widthPercent: number; // (width / indexPrice) * 100
  isFormed: boolean;
  isValidWidth: boolean;// between 0.15% and 0.60%
  timestampRecorded?: string;
}

export interface DayFilterResult {
  canTrade: boolean;
  reason: string;
  reasonTamil: string;
  rangeWidthPercent: number;
  indiaVix?: number;
  isEventDay: boolean;
  isExpiryAfter13: boolean;
  statusBadge: 'PASSED' | 'NO_TRADE_TODAY';
}

export interface MarkedStrike {
  contractName: string;
  symbol: string;
  strike: number;
  optionType: OptionType;
  expiryDate: string;
  daysToExpiry: number;
  isAtmOrItm1: boolean;
  premium: number;
  delta: number;
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number;
  volume: number;
  openInterest: number;
  capitalCost: number;       // premium * lotSize
  capitalCheckPassed: boolean;// premium * lotSize <= 60% of available capital
  markedAtTime: string;
  markedCandleIndex: number;
  candlesElapsed: number;
  isExpired: boolean;        // expires if 6 candles (30m) pass without trigger
  rejectionReason?: string;
}

export interface OrbTimeWindowState {
  currentTime: string;
  currentPhase: 'OBSERVE_ONLY' | 'PRIMARY_ENTRY' | 'NO_ENTRY_ZONE' | 'SECONDARY_ENTRY' | 'HARD_CUTOFF' | 'FORCE_EXIT' | 'MARKET_CLOSED';
  canEnterNewTrade: boolean;
  isForceExitTime: boolean;
  timeWindowLabel: string;
  timeWindowLabelTamil: string;
}

export interface OrbExitSignal {
  shouldExit: boolean;
  exitReason: 'STOP_LOSS' | 'TARGET_HIT' | 'BREAKEVEN' | 'TRAILING_SL' | 'MOMENTUM_FAILURE' | 'TIME_STOP' | 'FORCE_EXIT_1515' | 'STALE_FEED' | 'NONE';
  exitReasonTamil: string;
  suggestedExitPrice: number;
  currentRMultiple: number;
  trailStopLevel: number;
}

export interface DailyDisciplineState {
  tradesCompletedToday: number;
  maxTradesAllowed: number;  // 2
  consecutiveLosses: number; // Stop after 2 consecutive losses
  isDailyLossLimitHit: boolean; // 3% of capital
  isTradeHaltedForDay: boolean;
  haltReason?: string;
  isCooldownActive: boolean; // 3 candles cooldown in same direction after SL
  cooldownCandlesRemaining: number;
  cooldownDirection?: OptionType;
  dailyRealizedPnl: number;
  softProfitLockTriggered: boolean; // Daily profit >= ₹1,500
}

export interface ValidationGatesStatus {
  paperTradesCount: number;
  profitFactor: number;
  expectancyPerTrade: number;
  maxDrawdownPercent: number;
  gate1PaperTradesMet: boolean;  // >= 100
  gate2ProfitFactorMet: boolean; // > 1.3
  gate3ExpectancyMet: boolean;   // > 0
  gate4DrawdownMet: boolean;     // < 10%
  isValidated: boolean;          // ALL 4 gates met
  statusText: 'VALIDATED' | 'NOT VALIDATED';
}

