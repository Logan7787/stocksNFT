import type { CandleData, StrategyConfig, BacktestResult, BacktestTrade, OptionType } from '../types/niftyAnalysis';
import { getLatestTechnicalIndicators, roundToTick } from '../utils/technicalIndicators';
import { calculateEstimatedCharges } from '../utils/riskCalculator';

/**
 * Runs historical strategy simulation over completed candles
 * strictly preventing lookahead bias
 */
export function runBacktest(
  candles: CandleData[],
  optionType: OptionType,
  strike: number,
  config: StrategyConfig,
  capital: number = 25000,
  riskPercent: number = 1.0,
  lotSize: number = 65,
  slippagePoints: number = 0.2,
  brokeragePerOrder: number = 20
): BacktestResult {
  const trades: BacktestTrade[] = [];
  const minRequired = Math.max(config.emaSlowPeriod, config.rsiPeriod) + 2;

  if (candles.length < minRequired) {
    return {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      winRate: 0,
      grossPnl: 0,
      netPnl: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancyPerTrade: 0,
      trades: [],
    };
  }

  let inPosition = false;
  let entryPrice = 0;
  let entryTime = '';
  let stopLoss = 0;
  let target = 0;
  let quantity = 0;

  // Iterate strictly forward in time candle-by-candle (no lookahead)
  for (let i = minRequired; i < candles.length; i++) {
    const historicalSlice = candles.slice(0, i);
    const currentCandle = candles[i];

    // If currently in a position, evaluate exit criteria first
    if (inPosition) {
      let exitPrice = 0;
      let exitReason: 'TARGET' | 'STOP_LOSS' | 'TIME_EXIT' | null = null;

      // 1. Check if Target reached during candle
      if (currentCandle.high >= target) {
        exitPrice = target - slippagePoints;
        exitReason = 'TARGET';
      }
      // 2. Check if Stop Loss hit
      else if (currentCandle.low <= stopLoss) {
        exitPrice = stopLoss - slippagePoints;
        exitReason = 'STOP_LOSS';
      }
      // 3. End of dataset exit
      else if (i === candles.length - 1) {
        exitPrice = currentCandle.close - slippagePoints;
        exitReason = 'TIME_EXIT';
      }

      if (exitReason) {
        const grossPnl = Math.round(quantity * (exitPrice - entryPrice) * 100) / 100;
        const { totalCharges } = calculateEstimatedCharges(entryPrice, exitPrice, quantity, brokeragePerOrder);
        const netPnl = Math.round((grossPnl - totalCharges) * 100) / 100;

        trades.push({
          entryTime,
          exitTime: currentCandle.timestamp,
          optionType,
          strike,
          entryPrice,
          exitPrice: roundToTick(exitPrice),
          quantity,
          grossPnl,
          charges: totalCharges,
          netPnl,
          reason: exitReason,
        });

        inPosition = false;
        continue;
      }
    }

    // If not in position, check BUY WATCH signal on confirmed close of previous candle
    if (!inPosition && i < candles.length - 1) {
      const indicators = getLatestTechnicalIndicators(historicalSlice, config);
      const lastCandle = historicalSlice[historicalSlice.length - 1];

      const { isEmaBullishCross, isAboveVwap, isRsiInZone, isBreakoutHigh } = indicators;
      const signalTriggered = isEmaBullishCross && isAboveVwap && isRsiInZone && isBreakoutHigh;

      if (signalTriggered) {
        // Execute entry on the open of the current candle with slippage
        entryPrice = roundToTick(currentCandle.open + slippagePoints);
        entryTime = currentCandle.timestamp;

        // Position sizing based on 1% risk budget
        const riskBudget = (capital * riskPercent) / 100;
        stopLoss = roundToTick(entryPrice * (1 - config.stopLossPercent / 100));
        const riskPerUnit = Math.max(0.1, entryPrice - stopLoss);
        target = roundToTick(entryPrice + config.riskRewardMultiplier * riskPerUnit);

        const rawQty = Math.floor(riskBudget / riskPerUnit);
        const lots = Math.floor(rawQty / lotSize);

        if (lots > 0) {
          quantity = lots * lotSize;
          inPosition = true;
        }
      }
    }
  }

  // Calculate Metrics
  let winTrades = 0;
  let lossTrades = 0;
  let winSum = 0;
  let lossSum = 0;
  let grossPnl = 0;
  let netPnl = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let cumNet = 0;

  // 60% in-sample / 40% out-of-sample split boundary
  const splitIndex = Math.floor(candles.length * 0.60);
  let inSampleTradesCount = 0;
  let inSampleNetPnl = 0;
  let outOfSampleTradesCount = 0;
  let outOfSampleNetPnl = 0;

  trades.forEach((t) => {
    grossPnl += t.grossPnl;
    netPnl += t.netPnl;
    cumNet += t.netPnl;

    if (cumNet > peak) peak = cumNet;
    const dd = peak - cumNet;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (t.netPnl > 0) {
      winTrades++;
      winSum += t.netPnl;
    } else {
      lossTrades++;
      lossSum += Math.abs(t.netPnl);
    }

    // Check if entry was in the first 60% of candles
    const tradeCandleIdx = candles.findIndex((c) => c.timestamp === t.entryTime);
    if (tradeCandleIdx !== -1 && tradeCandleIdx < splitIndex) {
      inSampleTradesCount++;
      inSampleNetPnl += t.netPnl;
    } else {
      outOfSampleTradesCount++;
      outOfSampleNetPnl += t.netPnl;
    }
  });

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? Math.round((winTrades / totalTrades) * 1000) / 10 : 0;
  const avgWin = winTrades > 0 ? Math.round((winSum / winTrades) * 100) / 100 : 0;
  const avgLoss = lossTrades > 0 ? Math.round((lossSum / lossTrades) * 100) / 100 : 0;
  const profitFactor = lossSum > 0 ? Math.round((winSum / lossSum) * 100) / 100 : winSum > 0 ? 999 : 0;

  // Expectancy Per Trade = (WinRate * AvgWin) - (LossRate * AvgLoss) - AvgCommission
  const winRateFrac = totalTrades > 0 ? winTrades / totalTrades : 0;
  const lossRateFrac = 1 - winRateFrac;
  const expectancyPerTrade = totalTrades > 0
    ? Math.round(((winRateFrac * avgWin) - (lossRateFrac * avgLoss) - (brokeragePerOrder * 2)) * 100) / 100
    : 0;

  return {
    totalTrades,
    winTrades,
    lossTrades,
    winRate,
    grossPnl: Math.round(grossPnl * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    profitFactor,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    avgWin,
    avgLoss,
    expectancyPerTrade,
    inSampleTradesCount,
    inSampleNetPnl: Math.round(inSampleNetPnl * 100) / 100,
    outOfSampleTradesCount,
    outOfSampleNetPnl: Math.round(outOfSampleNetPnl * 100) / 100,
    trades,
  };
}
