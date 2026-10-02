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
  call_low: number;
  call_high: number;
  call_change?: number;

  // PUT Side (Right)
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
  
  // Previous values for tick animation
  prevCallClose?: number;
  prevPutClose?: number;
  callTickDirection?: 'up' | 'down' | 'neutral';
  putTickDirection?: 'up' | 'down' | 'neutral';
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
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected: boolean;
}
