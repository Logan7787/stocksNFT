import type { PaperTradeRecord, PerformanceAnalytics } from '../types/niftyAnalysis';
import { calculateEstimatedCharges } from '../utils/riskCalculator';

const STORAGE_KEY = 'nifty_paper_trades';

/**
 * Loads stored paper trade records from localStorage
 */
export function getStoredPaperTrades(): PaperTradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load paper trades:', e);
  }
  return [];
}

/**
 * Persists paper trade records to localStorage
 */
export function savePaperTrades(trades: PaperTradeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (e) {
    console.warn('Failed to save paper trades:', e);
  }
}

/**
 * Computes performance analytics from closed paper trades
 */
export function calculatePerformanceAnalytics(trades: PaperTradeRecord[]): PerformanceAnalytics {
  const closedTrades = trades.filter((t) => t.status !== 'OPEN');

  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePercent: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      netPnl: 0,
      grossPnl: 0,
      totalCharges: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
    };
  }

  let winningTrades = 0;
  let losingTrades = 0;
  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let grossPnl = 0;
  let totalCharges = 0;
  let netPnl = 0;

  // For Drawdown calculation
  let peakCumulative = 0;
  let maxDrawdown = 0;
  let currentCumulative = 0;

  closedTrades.forEach((t) => {
    const tradeGross = t.grossPnl || 0;
    const tradeCharges = t.charges || 0;
    const tradeNet = t.netPnl !== undefined ? t.netPnl : tradeGross - tradeCharges;

    grossPnl += tradeGross;
    totalCharges += tradeCharges;
    netPnl += tradeNet;

    if (tradeNet > 0) {
      winningTrades++;
      totalWinAmount += tradeNet;
    } else if (tradeNet < 0) {
      losingTrades++;
      totalLossAmount += Math.abs(tradeNet);
    }

    currentCumulative += tradeNet;
    if (currentCumulative > peakCumulative) {
      peakCumulative = currentCumulative;
    }
    const drawdown = peakCumulative - currentCumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  const totalTrades = closedTrades.length;
  const winRatePercent = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : 0;
  const averageWin = winningTrades > 0 ? Math.round((totalWinAmount / winningTrades) * 100) / 100 : 0;
  const averageLoss = losingTrades > 0 ? Math.round((totalLossAmount / losingTrades) * 100) / 100 : 0;
  const profitFactor = totalLossAmount > 0 ? Math.round((totalWinAmount / totalLossAmount) * 100) / 100 : totalWinAmount > 0 ? 999 : 0;
  const maxDrawdownPercent = peakCumulative > 0 ? Math.round((maxDrawdown / peakCumulative) * 1000) / 10 : 0;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePercent,
    averageWin,
    averageLoss,
    profitFactor,
    netPnl: Math.round(netPnl * 100) / 100,
    grossPnl: Math.round(grossPnl * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent,
  };
}

/**
 * Creates a simulated Paper Trade entry with slippage model
 */
export function createPaperTrade(params: {
  underlyingSymbol?: string;
  contractName: string;
  optionType: 'CE' | 'PE';
  strike: number;
  expiryDate: string;
  entryPrice: number;
  quantity: number;
  lotSize: number;
  stopLossPrice: number;
  targetPrice: number;
  slippagePoints?: number;
}): PaperTradeRecord {
  const slippage = params.slippagePoints || 0.1; // Default 0.10 pt slippage
  const simulatedEntry = Math.round((params.entryPrice + slippage) * 100) / 100;
  const lotsCount = Math.floor(params.quantity / params.lotSize);

  return {
    id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    orderType: 'PAPER_BUY',
    underlyingSymbol: params.underlyingSymbol || 'NIFTY 50',
    contractName: params.contractName,
    optionType: params.optionType,
    strike: params.strike,
    expiryDate: params.expiryDate,
    entryTimestamp: new Date().toLocaleTimeString('en-IN'),
    entryPrice: simulatedEntry,
    quantity: params.quantity,
    lotSize: params.lotSize,
    lotsCount,
    stopLossPrice: params.stopLossPrice,
    targetPrice: params.targetPrice,
    currentPrice: simulatedEntry,
    unrealizedPnl: 0,
    status: 'OPEN',
  };
}

/**
 * Closes a Paper Trade and records P&L and statutory charges
 */
export function closePaperTrade(
  trade: PaperTradeRecord,
  exitPrice: number,
  reason: 'TARGET' | 'STOP_LOSS' | 'MANUAL'
): PaperTradeRecord {
  const grossPnl = Math.round(trade.quantity * (exitPrice - trade.entryPrice) * 100) / 100;
  const { totalCharges } = calculateEstimatedCharges(trade.entryPrice, exitPrice, trade.quantity);
  const netPnl = Math.round((grossPnl - totalCharges) * 100) / 100;

  const statusMap = {
    TARGET: 'CLOSED_TARGET' as const,
    STOP_LOSS: 'CLOSED_SL' as const,
    MANUAL: 'CLOSED_MANUAL' as const,
  };

  return {
    ...trade,
    exitTimestamp: new Date().toLocaleTimeString('en-IN'),
    exitPrice,
    grossPnl,
    charges: totalCharges,
    netPnl,
    unrealizedPnl: 0,
    status: statusMap[reason],
    exitReason: reason === 'TARGET' ? 'Target Reached (1:2 R:R)' : reason === 'STOP_LOSS' ? 'Stop Loss Hit' : 'Manual Trader Exit',
  };
}

/**
 * Updates unrealized P&L for open positions and checks auto SL/Target triggers
 */
export function updateOpenPaperTrades(
  trades: PaperTradeRecord[],
  currentPrice: number
): { updatedTrades: PaperTradeRecord[]; triggeredTrades: PaperTradeRecord[] } {
  const triggeredTrades: PaperTradeRecord[] = [];

  const updatedTrades = trades.map((t) => {
    if (t.status !== 'OPEN') return t;

    const unrealizedGross = Math.round(t.quantity * (currentPrice - t.entryPrice) * 100) / 100;
    const { totalCharges } = calculateEstimatedCharges(t.entryPrice, currentPrice, t.quantity);
    const unrealizedNet = Math.round((unrealizedGross - totalCharges) * 100) / 100;

    // Auto Target Hit Check
    if (currentPrice >= t.targetPrice) {
      const closed = closePaperTrade(t, t.targetPrice, 'TARGET');
      triggeredTrades.push(closed);
      return closed;
    }

    // Auto Stop Loss Hit Check
    if (currentPrice <= t.stopLossPrice) {
      const closed = closePaperTrade(t, t.stopLossPrice, 'STOP_LOSS');
      triggeredTrades.push(closed);
      return closed;
    }

    return {
      ...t,
      currentPrice,
      unrealizedPnl: unrealizedNet,
    };
  });

  return { updatedTrades, triggeredTrades };
}

/**
 * Exports paper trade journal to CSV format
 */
export function exportPaperTradesToCSV(trades: PaperTradeRecord[]): string {
  const headers = [
    'ID',
    'Contract',
    'Type',
    'Strike',
    'Expiry',
    'Quantity',
    'Entry Price',
    'Entry Time',
    'Exit Price',
    'Exit Time',
    'Status',
    'Gross PnL (INR)',
    'Charges (INR)',
    'Net PnL (INR)',
    'Exit Reason',
  ];

  const rows = trades.map((t) => [
    t.id,
    `"${t.contractName}"`,
    t.optionType,
    t.strike,
    t.expiryDate,
    t.quantity,
    t.entryPrice,
    t.entryTimestamp,
    t.exitPrice || '-',
    t.exitTimestamp || '-',
    t.status,
    t.grossPnl !== undefined ? t.grossPnl : '-',
    t.charges !== undefined ? t.charges : '-',
    t.netPnl !== undefined ? t.netPnl : t.unrealizedPnl,
    `"${t.exitReason || 'Open Position'}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
