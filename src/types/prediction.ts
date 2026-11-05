// ==============================================================================
// Quantitative Real-Time Option Strike Prediction Types
// Evaluates strikes for Buy/Sell signals, targets, stop losses, entry/exit timings
// ==============================================================================

export type PredictionAction = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL_WRITE' | 'AVOID';
export type OIBuildUp = 'LONG_BUILDUP' | 'SHORT_COVERING' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'NEUTRAL';
export type Moneyness = 'ITM' | 'ATM' | 'OTM';
export type OptionType = 'CE' | 'PE';

export interface StrikePrediction {
  strike: number;
  optionType: OptionType;
  symbol: string;
  ltp: number;
  action: PredictionAction;
  confidenceScore: number; // 0 - 100%
  expectedMove: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  entryPrice: number;
  entryTimeWindow: string;
  entryCondition: string;
  target1: number;
  target2: number;
  stopLoss: number;
  targetExitTime: string;
  mandatoryExitTime: string;
  maxHoldingMinutes: number;
  trailingSlRule: string;
  exitStrategyReason: string;
  riskReward: string;
  oiBuildUp: OIBuildUp;
  oiBuildUpLabel: string;
  moneyness: Moneyness;
  reasons: string[];
  thetaRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  winProbability: number;
  iv: number;
  delta: number;
}

export interface MarketPredictionSummary {
  bias: 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
  confidence: number;
  predictedRange: {
    min: number;
    max: number;
    center: number;
  };
  topCallPick: StrikePrediction | null;
  topPutPick: StrikePrediction | null;
  topSellerPick: StrikePrediction | null;
  callBuyingPower: number; // 0 - 100
  putBuyingPower: number; // 0 - 100
  keySupport: number;
  keyResistance: number;
  summaryRationale: string;
}

export interface OptionContractData {
  instrumentKey: string;
  symbol: string;
  strike: number;
  expiry: string;
  optionType: OptionType;
  moneyness: Moneyness;
  ltp: number | null;
  change: number | null;
  changePercent: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  prevClose?: number | null;
  bid?: number | null;
  ask?: number | null;
  volume: number | null;
  oi: number | null;
  oiChange: number | null;
  iv: number | null;
  delta: number | null;
  theta?: number | null;
  gamma?: number | null;
  vega?: number | null;
  lastUpdate?: string | null;
  isStale?: boolean;
}

export interface OptionChainRow {
  strike: number;
  isAtm: boolean;
  distanceFromAtm: number;
  ce: OptionContractData;
  pe: OptionContractData;
}

export interface UnderlyingSnapshot {
  symbol: string;
  spotPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  dayHigh?: number;
  dayLow?: number;
  prevClose: number;
  atmStrike: number;
  nearestExpiry: string;
  availableExpiries: string[];
  indiaVix?: number;
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE-OPEN' | 'UNKNOWN';
  lastUpdate: string;
  isSimulated: boolean;
}

export interface OptionChainSnapshot {
  underlying: UnderlyingSnapshot;
  selectedExpiry: string;
  atmStrike: number;
  strikeInterval: number;
  rows: OptionChainRow[];
  totalCeOi: number;
  totalPeOi: number;
  totalCeVolume: number;
  totalPeVolume: number;
  oiPcr: number;
  volumePcr: number;
  maxPainStrike: number;
  supportStrike: number;
  resistanceStrike: number;
  provider: string;
  dataFreshness: 'LIVE' | 'DELAYED' | 'STALE' | 'SIMULATED';
  timestamp: string;
}

export interface Candle {
  timestamp: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicatorData {
  timeframe: '1m' | '3m' | '5m' | '15m';
  candles: Candle[];
  ema9: number | null;
  ema20: number | null;
  ema50: number | null;
  vwap: number | null;
  rsi14: number | null;
  macd: {
    macdLine: number | null;
    signalLine: number | null;
    histogram: number | null;
  };
  atr14: number | null;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  openingRange: {
    high: number;
    low: number;
  };
  support: number;
  resistance: number;
  sourceInstrument: string;
  lastUpdate: string;
}

export type AlertStatus =
  | 'ARMED'
  | 'ENTRY_TRIGGERED'
  | 'TARGET1_HIT'
  | 'TARGET2_HIT'
  | 'STOPLOSS_HIT'
  | 'TIME_EXPIRED';

export interface LiveAlert {
  id: string;
  strike: number;
  optionType: OptionType;
  symbol: string;
  action: PredictionAction;
  entryPrice: number;
  target1: number;
  target2: number;
  stopLoss: number;
  maxHoldMinutes: number;
  createdAt: number;
  currentLtp: number;
  status: AlertStatus;
  lastTriggeredEvent?: string;
  lastTriggeredTime?: string;
  soundEnabled: boolean;
  notifiedEvents: { [key: string]: boolean };
}

export type AlertListener = (
  alerts: LiveAlert[],
  lastNotification?: { title: string; message: string; type: 'success' | 'warning' | 'info' }
) => void;

