import type { RiskManagementPlan } from '../types/niftyAnalysis';
import { roundToTick } from './technicalIndicators';

/**
 * Calculates estimated Indian statutory taxes & brokerage for NSE equity options intraday trade
 */
export function calculateEstimatedCharges(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  brokeragePerOrder: number = 20
): {
  brokerage: number;
  stt: number;
  exchangeTurnoverFee: number;
  sebiCharges: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
} {
  if (quantity <= 0) {
    return {
      brokerage: 0,
      stt: 0,
      exchangeTurnoverFee: 0,
      sebiCharges: 0,
      stampDuty: 0,
      gst: 0,
      totalCharges: 0,
    };
  }

  const buyTurnover = entryPrice * quantity;
  const sellTurnover = exitPrice * quantity;
  const totalTurnover = buyTurnover + sellTurnover;

  // 1. Brokerage: ₹20 buy + ₹20 sell = ₹40 max (flat fee)
  const brokerage = brokeragePerOrder * 2;

  // 2. STT (Securities Transaction Tax): 0.1% on Sell value for options (NSE rate)
  const stt = Math.round(sellTurnover * 0.001 * 100) / 100;

  // 3. Exchange Turnover charges: ~0.05% on total premium turnover
  const exchangeTurnoverFee = Math.round(totalTurnover * 0.0005 * 100) / 100;

  // 4. SEBI turnover charges: ₹10 per crore = 0.0001%
  const sebiCharges = Math.round(totalTurnover * 0.000001 * 100) / 100;

  // 5. Stamp duty: 0.003% on Buy side turnover
  const stampDuty = Math.round(buyTurnover * 0.00003 * 100) / 100;

  // 6. GST: 18% on (Brokerage + Exchange turnover charges + SEBI charges)
  const gst = Math.round((brokerage + exchangeTurnoverFee + sebiCharges) * 0.18 * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + exchangeTurnoverFee + sebiCharges + stampDuty + gst) * 100) / 100;

  return {
    brokerage,
    stt,
    exchangeTurnoverFee,
    sebiCharges,
    stampDuty,
    gst,
    totalCharges,
  };
}

/**
 * Computes complete strict Risk Management plan based on available capital,
 * per-trade risk percentage, contract lot size, and tick size.
 */
export function calculateRiskManagementPlan(params: {
  availableCapital?: number;       // default ₹25,000
  riskPercentage?: number;         // default 1.0%
  entryPrice: number;
  stopLossPrice?: number;          // optional, default entry * 0.98
  riskRewardRatio?: number;        // default 2.0 (1:2)
  lotSize?: number;                // default 25 or 50
  dailyRealizedPnl?: number;       // default 0
  dailyUnrealizedPnl?: number;     // default 0
  maxDailyLoss?: number;           // default ₹1,000
}): RiskManagementPlan {
  const {
    availableCapital = 25000,
    riskPercentage = 1.0,
    entryPrice,
    riskRewardRatio = 2.0,
    lotSize = 25,
    dailyRealizedPnl = 0,
    dailyUnrealizedPnl = 0,
    maxDailyLoss = 1000,
  } = params;

  // 1. Calculate Risk Budget = Capital * Risk% / 100
  const riskBudget = Math.round(((availableCapital * riskPercentage) / 100) * 100) / 100;

  // 2. Experimental default Stop Loss = Entry * 0.98 (2% stop loss, rounded to 0.05 tick)
  const defaultSl = roundToTick(entryPrice * 0.98);
  const stopLossPrice = params.stopLossPrice !== undefined && params.stopLossPrice > 0
    ? roundToTick(params.stopLossPrice)
    : defaultSl;

  // Risk per unit = Entry - StopLoss
  const riskPerUnit = Math.max(0.05, Math.round((entryPrice - stopLossPrice) * 100) / 100);

  // 3. Target Price = Entry + R:R * (Entry - StopLoss)
  const targetPrice = roundToTick(entryPrice + riskRewardRatio * riskPerUnit);

  // 4. Raw Quantity = Floor(Risk Budget / Risk per unit)
  const rawQuantity = Math.floor(riskBudget / riskPerUnit);

  // 5. Final Quantity rounded down to a valid multiple of actual lot size
  const lotsCount = Math.floor(rawQuantity / lotSize);
  const finalQuantity = lotsCount * lotSize;

  // Check if even 1 single lot exceeds permitted risk budget
  const oneLotRisk = lotSize * riskPerUnit;
  const isRiskExceeded = oneLotRisk > riskBudget || lotsCount === 0;

  // 6. Premium Outlay
  const totalPremiumOutlay = Math.round(finalQuantity * entryPrice * 100) / 100;

  // 7. Gross and Net Profit / Loss Calculations
  const estimatedGrossProfit = Math.round(finalQuantity * (targetPrice - entryPrice) * 100) / 100;
  const estimatedGrossLoss = Math.round(finalQuantity * (entryPrice - stopLossPrice) * 100) / 100;

  const targetCharges = calculateEstimatedCharges(entryPrice, targetPrice, finalQuantity);
  const slCharges = calculateEstimatedCharges(entryPrice, stopLossPrice, finalQuantity);

  const estimatedBrokerageCharges = targetCharges.totalCharges;
  const estimatedNetProfit = Math.round((estimatedGrossProfit - targetCharges.totalCharges) * 100) / 100;
  const estimatedNetLoss = Math.round((estimatedGrossLoss + slCharges.totalCharges) * 100) / 100;

  // 8. Remaining Risk Budget for the day
  const remainingRiskBudget = Math.max(0, Math.round((maxDailyLoss + dailyRealizedPnl) * 100) / 100);

  return {
    availableCapital,
    riskPercentage,
    riskBudget,
    entryPrice,
    stopLossPrice,
    targetPrice,
    riskPerUnit,
    lotSize,
    rawQuantity,
    lotsCount,
    finalQuantity,
    totalPremiumOutlay,
    isRiskExceeded,
    estimatedGrossProfit,
    estimatedGrossLoss,
    estimatedBrokerageCharges,
    estimatedNetProfit,
    estimatedNetLoss,
    dailyRealizedPnl,
    dailyUnrealizedPnl,
    maxDailyLoss,
    remainingRiskBudget,
    analysisTargetMin: 500,
    analysisTargetMax: 2500,
  };
}
