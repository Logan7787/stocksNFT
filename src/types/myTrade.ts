export interface NseStockRecord {
  date: string;
  symbol: string;
  company: string;
  sector?: string;
  open: number;
  high: number;
  low: number;
  close: number; // Official 20:30 PM Settled Bhavcopy Close
  prevClose: number;
  dailyReturnPct: number;
  dailyRange: number;
  rangePct: number;
  gapPct: number;
  volume: number;
  tradedValue: number; // In Rupees
  trades: number;
}

export interface StockRecommendation {
  rank: number;
  stock: string;
  cmp: number;
  volume: number;
  returnPct: number;
  score: number; // 0-100 ML Score
  expectedReturn: number; // Expected next-day return %
  direction: 'BULLISH' | 'BEARISH';
  sector: string;
  targetPrice: number;
  stopLoss: number;
}

export interface HistoricalPredictionResult {
  date: string;
  stock: string;
  yesterdayScore: number;
  predictedReturn: number;
  actualReturn: number;
  result: 'Win' | 'Loss';
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  winRate: number;
  averageReturn: number;
  averageLoss: number;
  totalPredictions: number;
  successfulPredictions: number;
  lastUpdated: string;
}

export interface BhavcopySyncStatus {
  lastSyncDate: string;
  lastSyncTimeIST: string;
  totalStocksSynced: number;
  sourceArchive: string;
  googleSheetId: string;
  googleSheetName: string;
  isAutoScheduled: boolean;
  scheduleTime: string; // e.g. "20:30 IST / 15:15 UTC"
}

