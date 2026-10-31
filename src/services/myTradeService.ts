import type {
  NseStockRecord,
  StockRecommendation,
  HistoricalPredictionResult,
  ModelPerformanceMetrics,
  BhavcopySyncStatus
} from '../types/myTrade';
import {
  MY_TRADE_STOCKS_2026_10_30,
  MY_TRADE_STOCKS_2026_10_29,
  MY_TRADE_RECOMMENDATIONS,
  MY_TRADE_YESTERDAY_RESULTS,
  MY_TRADE_PERFORMANCE,
  MY_TRADE_SYNC_STATUS
} from '../data/myTradeData';

export class MyTradeService {
  private static instance: MyTradeService;

  public static getInstance(): MyTradeService {
    if (!MyTradeService.instance) {
      MyTradeService.instance = new MyTradeService();
    }
    return MyTradeService.instance;
  }

  public getAvailableDates(): string[] {
    return ['2026-10-30', '2026-10-29'];
  }

  public getStocksByDate(
    date: string = '2026-10-30',
    search: string = '',
    filter: 'all' | 'gainers' | 'losers' | 'top_volume' = 'all'
  ): NseStockRecord[] {
    let source = date === '2026-10-29' ? MY_TRADE_STOCKS_2026_10_29 : MY_TRADE_STOCKS_2026_10_30;

    let result = [...source];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        s => s.symbol.toLowerCase().includes(q) || s.company.toLowerCase().includes(q)
      );
    }

    if (filter === 'gainers') {
      result = result.filter(s => s.dailyReturnPct > 0).sort((a, b) => b.dailyReturnPct - a.dailyReturnPct);
    } else if (filter === 'losers') {
      result = result.filter(s => s.dailyReturnPct < 0).sort((a, b) => a.dailyReturnPct - b.dailyReturnPct);
    } else if (filter === 'top_volume') {
      result = result.sort((a, b) => b.volume - a.volume);
    }

    return result;
  }

  public getRecommendations(): StockRecommendation[] {
    return MY_TRADE_RECOMMENDATIONS;
  }

  public getYesterdayResults(): HistoricalPredictionResult[] {
    return MY_TRADE_YESTERDAY_RESULTS;
  }

  public getModelPerformance(): ModelPerformanceMetrics {
    return MY_TRADE_PERFORMANCE;
  }

  public getSyncStatus(): BhavcopySyncStatus {
    return MY_TRADE_SYNC_STATUS;
  }

  /**
   * Constructs download/fetch URL for official NSE UDiFF CM Bhavcopy (20:30 IST archive)
   */
  public getNseBhavcopyUrl(dateStr: string, type: 'cm' | 'fo' = 'cm'): string {
    const formatted = dateStr.replace(/-/g, '');
    const prefix = type === 'cm' ? 'CM' : 'FO';
    return `https://nsearchives.nseindia.com/content/${type}/BhavCopy_NSE_${prefix}_0_0_0_${formatted}_F_0000.csv.zip`;
  }
}

export const myTradeService = MyTradeService.getInstance();

