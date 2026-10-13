/**
 * NIFTY 50 Opening Range Breakout (ORB) + VWAP Trend Strategy Configuration
 * All strategy thresholds, time windows, day filters, and risk rules live here.
 * No thresholds are hardcoded in the UI.
 */

export interface OrbTimeWindows {
  observeStart: string;       // "09:15"
  observeEnd: string;         // "09:30" - Opening range recorded
  primaryEntryStart: string;  // "09:30"
  primaryEntryEnd: string;    // "11:30"
  noEntryZoneStart: string;   // "11:30" - Low-momentum zone
  noEntryZoneEnd: string;     // "13:30"
  secondaryEntryStart: string;// "13:30" - Optional second entry window
  secondaryEntryEnd: string;  // "14:45"
  hardCutoffTime: string;     // "14:45" - No new entries allowed after this
  forceExitTime: string;      // "15:15" - Force exit for any open position
  secondaryWindowEnabled: boolean; // default true
}

export interface OrbDayFilterConfig {
  minRangeWidthPercent: number; // 0.15% of index price
  maxRangeWidthPercent: number; // 0.60% of index price
  maxIndiaVix: number;          // Default 22.0
  expiryCutoffTime: string;     // "13:00" - No new entries on expiry day after this
  blacklistedEventDays: string[]; // Event days list: e.g. ["2026-02-01", "2026-06-05"]
}

export interface OrbStrikeMarkingConfig {
  minDaysToExpiry: number;      // 2 days minimum for weekly, else use 1 strike ITM
  minDelta: number;             // 0.50
  maxDelta: number;             // 0.65
  maxBidAskSpreadPercent: number;// 0.50% of premium
  maxSpreadTicks: number;       // 1 tick size multiple (e.g. 0.05)
  minPremium: number;           // ₹40.0
  minVolume: number;            // Minimum contract volume threshold
  minOpenInterest: number;      // Minimum OI threshold
  maxCapitalPerTradePercent: number; // Premium * lotSize <= 60% of available capital
  oiWallBufferPoints: number;   // 40 index points buffer between index and highest OI strike
  markExpirationCandles: number;// 6 candles (30 minutes) before marked strike expires
}

export interface OrbEntryTriggerConfig {
  minCandleBodyRatio: number;   // 0.50 (Candle body >= 50% of candle range)
  minVolumeMultiplier: number;  // 1.2x of 20-candle average volume
  maxExtendedPercent: number;   // 0.25% above ORH / breakout level
  maxChasingSlippagePercent: number; // 3.0% from marked price
  rsiBullishMin: number;        // 55
  rsiBullishMax: number;        // 70
  rsiBearishMin: number;        // 30
  rsiBearishMax: number;        // 45
}

export interface OrbRiskAndExitConfig {
  capital: number;              // ₹25,000
  riskPerTradePercent: number;  // Default 2.0% (₹500), allowed 0.5% - 2.0%
  targetMultiplier: number;     // 1.5x risk (1:1.5 R:R)
  maxPremiumLossPercent: number;// Reject if premium SL implies loss > 25% of premium
  timeStopCandles: number;      // Exit if not reaching +0.5R within 6 candles (30 min)
  maxTradesPerDay: number;      // 2 trades per day
  reEntryCooldownCandles: number;// 3 candles cooldown in same direction after SL
  maxDailyLossPercent: number;  // 3.0% of capital (₹750)
  profitLockThreshold: number;  // ₹1,500 advisory soft profit lock
  slippageTicks: number;        // 1-2 ticks (default 1 tick = 0.05)
  staleFeedTimeoutSeconds: number; // 30 seconds
}

export interface OrbValidationGateCriteria {
  minPaperTrades: number;       // 100+ paper trades
  minProfitFactor: number;      // > 1.3
  requirePositiveExpectancy: boolean; // true
  maxDrawdownPercent: number;   // < 10% of capital
  trainSplitRatio: number;      // 0.60 (60% training / 40% out-of-sample)
}

export interface OrbStrategyConfiguration {
  timeWindows: OrbTimeWindows;
  dayFilter: OrbDayFilterConfig;
  strikeMarking: OrbStrikeMarkingConfig;
  entryTrigger: OrbEntryTriggerConfig;
  riskAndExit: OrbRiskAndExitConfig;
  validationGates: OrbValidationGateCriteria;
}

export const DEFAULT_ORB_CONFIG: OrbStrategyConfiguration = {
  timeWindows: {
    observeStart: '09:15',
    observeEnd: '09:30',
    primaryEntryStart: '09:30',
    primaryEntryEnd: '11:30',
    noEntryZoneStart: '11:30',
    noEntryZoneEnd: '13:30',
    secondaryEntryStart: '13:30',
    secondaryEntryEnd: '14:45',
    hardCutoffTime: '14:45',
    forceExitTime: '15:15',
    secondaryWindowEnabled: true,
  },
  dayFilter: {
    minRangeWidthPercent: 0.15,
    maxRangeWidthPercent: 0.60,
    maxIndiaVix: 22.0,
    expiryCutoffTime: '13:00',
    blacklistedEventDays: [
      // Major scheduled macro events (e.g. Budget Day, General Election Day)
      '2026-02-01',
      '2026-06-04',
    ],
  },
  strikeMarking: {
    minDaysToExpiry: 2,
    minDelta: 0.50,
    maxDelta: 0.65,
    maxBidAskSpreadPercent: 0.50,
    maxSpreadTicks: 1,
    minPremium: 40.0,
    minVolume: 1000,
    minOpenInterest: 5000,
    maxCapitalPerTradePercent: 60.0,
    oiWallBufferPoints: 40.0,
    markExpirationCandles: 6,
  },
  entryTrigger: {
    minCandleBodyRatio: 0.50,
    minVolumeMultiplier: 1.20,
    maxExtendedPercent: 0.25,
    maxChasingSlippagePercent: 3.0,
    rsiBullishMin: 55,
    rsiBullishMax: 70,
    rsiBearishMin: 30,
    rsiBearishMax: 45,
  },
  riskAndExit: {
    capital: 25000,
    riskPerTradePercent: 2.0, // ₹500
    targetMultiplier: 1.5,     // 1:1.5 R:R
    maxPremiumLossPercent: 25.0,
    timeStopCandles: 6,
    maxTradesPerDay: 2,
    reEntryCooldownCandles: 3,
    maxDailyLossPercent: 3.0,  // ₹750
    profitLockThreshold: 1500, // ₹1,500
    slippageTicks: 1,
    staleFeedTimeoutSeconds: 30,
  },
  validationGates: {
    minPaperTrades: 100,
    minProfitFactor: 1.30,
    requirePositiveExpectancy: true,
    maxDrawdownPercent: 10.0,
    trainSplitRatio: 0.60,
  },
};

const STORAGE_KEY = 'nifty_orb_strategy_config';

export function getStoredOrbConfig(): OrbStrategyConfiguration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_ORB_CONFIG,
        ...parsed,
        timeWindows: { ...DEFAULT_ORB_CONFIG.timeWindows, ...(parsed.timeWindows || {}) },
        dayFilter: { ...DEFAULT_ORB_CONFIG.dayFilter, ...(parsed.dayFilter || {}) },
        strikeMarking: { ...DEFAULT_ORB_CONFIG.strikeMarking, ...(parsed.strikeMarking || {}) },
        entryTrigger: { ...DEFAULT_ORB_CONFIG.entryTrigger, ...(parsed.entryTrigger || {}) },
        riskAndExit: { ...DEFAULT_ORB_CONFIG.riskAndExit, ...(parsed.riskAndExit || {}) },
        validationGates: { ...DEFAULT_ORB_CONFIG.validationGates, ...(parsed.validationGates || {}) },
      };
    }
  } catch (e) {
    console.warn('Failed to parse stored ORB config, using defaults:', e);
  }
  return DEFAULT_ORB_CONFIG;
}

export function saveStoredOrbConfig(config: OrbStrategyConfiguration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save ORB config:', e);
  }
}
