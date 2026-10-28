export interface RawOptionData {
  strike: number;
  call_low: number;
  call_high: number;
  call_close: number;
  call_volume: number;
  put_low: number;
  put_high: number;
  put_close: number;
  put_volume: number;
  // Optional extra market fields
  call_ltp?: number;
  put_ltp?: number;
  call_oi?: number;
  put_oi?: number;
  call_iv?: number;
  put_iv?: number;
  call_change?: number;
  put_change?: number;
}

export interface ProcessedOptionRow {
  strike: number;
  
  // CALL Side (Left)
  call_volume: number;
  call_premium: number; // (Call Low + Put High) / 2
  call_avg: number;     // (Call Close + Put Close) / 2
  call_close: number;
  call_ltp: number;
  call_low: number;
  call_high: number;
  call_change?: number;

  // PUT Side (Right)
  put_ltp: number;
  put_close: number;
  put_avg: number;      // (Call Close + Put Close) / 2
  put_premium: number;  // (Put Low + Call High) / 2
  put_volume: number;
  put_low: number;
  put_high: number;
  put_change?: number;

  // Conditional Highlighting Flags
  isATM?: boolean;            // Orange (#f97316)
  isMinAvg?: boolean;         // Light Green (#86efac)
  isMinCallPremium?: boolean; // Light Blue (#7dd3fc)
  isMinPutPremium?: boolean;  // Light Blue (#7dd3fc)
  isTopCallVolume?: boolean;  // Light Yellow (#fde047) - Top 2
  isTopPutVolume?: boolean;   // Light Yellow (#fde047) - Top 2

  // Close Formula Breakup / Breakdown Indicators
  isFormulaAtm?: boolean;
  breakLevelRole?: 'FORMULA_ATM' | 'ATM_MINUS_100' | 'ATM_PLUS_100';

  // Trading Signal Flags & Intraday Trade Engine
  ceSignal?: boolean;         // call_close > call_avg && call_close > call_premium
  peSignal?: boolean;         // put_close > put_avg && put_close > put_premium
  ceTradeSetup?: TradeSetup | null;
  peTradeSetup?: TradeSetup | null;
  isNearestItmCE?: boolean;
  isNearestItmPE?: boolean;
  
  // Previous values for tick animation
  prevCallClose?: number;
  prevPutClose?: number;
  callTickDirection?: 'up' | 'down' | 'neutral';
  putTickDirection?: 'up' | 'down' | 'neutral';
}

export type BreakLevelRole = 'FORMULA_ATM' | 'ATM_MINUS_100' | 'ATM_PLUS_100';

export interface BreakEvenInfo {
  value: number;
  strike: number;
  highestValue: number;
  highestSource: string;
  lowestValue: number;
  lowestSource: string;
  callHigh: number;
  callLow: number;
  putHigh: number;
  putLow: number;
}

export interface BreakLevelsInfo {
  formulaAtmStrike: number;
  atmCallClose: number;
  atmPutClose: number;
  atmDiff: number;
  breakDown: {
    value: number;
    callStrike: number;
    callClose: number;
    putStrike: number;
    putClose: number;
  };
  breakUp: {
    value: number;
    callStrike: number;
    callClose: number;
    putStrike: number;
    putClose: number;
  };
  breakEven?: BreakEvenInfo;
}

export interface TradeSettings {
  maxSlPoints: number;        // Default: 10 points
  riskRewardRatio: number;    // Default: 2 (1:2 ratio)
}

export interface TradeSetup {
  type: 'BUY_CE' | 'BUY_PE';
  strike: number;
  strikeRole: 'ATM' | 'NEAREST_ITM' | 'OTHER';
  entryPrice: number;
  rawSlPrice: number;
  slPrice: number;
  isSlOverridden: boolean;
  calculatedRisk: number;
  effectiveRisk: number;
  targetPrice: number;
  rewardPoints: number;
  rrRatio: number;
  conditionMet: boolean;
  timestamp: string;
  details: {
    close: number;
    avg: number;
    premium: number;
  };
}

export interface MarketSnapshotRecord {
  id: string;
  snapshot_date: string; // YYYY-MM-DD
  hour_slot: string;     // "09:15", "10:15", "11:15", "12:15", "13:15", "14:15", "15:30", "CUSTOM"
  spot_close: number;
  created_at?: string;
  notes?: string;
}

export interface OptionChainHourlyDataRecord {
  id?: string;
  snapshot_id: string;
  strike: number;
  call_low: number;
  call_high: number;
  call_close: number;
  call_volume: number;
  call_avg: number;
  call_premium: number;
  put_low: number;
  put_high: number;
  put_close: number;
  put_volume: number;
  put_avg: number;
  put_premium: number;
  created_at?: string;
}

export interface MarketMetrics {
  spotPrice: number;
  spotChange: number;
  spotChangePercent: number;
  atmStrike: number;
  totalCallVolume: number;
  totalPutVolume: number;
  pcrVolume: number;
  maxPainStrike: number;
  minAvgValue: number;
  minCallPremiumValue: number;
  minPutPremiumValue: number;
  topCallVolumeStrikes: number[];
  topPutVolumeStrikes: number[];
  timestamp: string;
}

export type ConnectionMode = 'simulated' | 'broker_api' | 'supabase_synced' | 'historical';

export interface BrokerApiConfig {
  provider: 'upstox' | 'dhan' | 'angelone' | 'custom_proxy';
  apiKey: string;
  apiSecret?: string;
  proxyUrl?: string;
  wsUrl?: string;
  symbol: string;
  expiryDate: string;
  enabled: boolean;
  // Angel One SmartAPI parameters
  angelApiKey?: string;
  angelClientCode?: string;
  angelPin?: string;
  angelTotp?: string;
  angelJwtToken?: string;
  angelFeedToken?: string;
}

export interface BrokerStatus {
  connected: boolean;
  status: 'idle' | 'connected' | 'error' | 'token_expired';
  error?: string;
  spotPrice?: number;
  lastFetchedAt?: string;
  strikesCount?: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected: boolean;
}

