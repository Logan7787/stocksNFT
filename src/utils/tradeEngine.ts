import type { ProcessedOptionRow, TradeSettings, TradeSetup } from '../types/optionChain';
import { round2 } from './formulas';

export const DEFAULT_TRADE_SETTINGS: TradeSettings = {
  maxSlPoints: 10,
  riskRewardRatio: 2,
};

const STORAGE_KEY = 'nifty_trade_settings';

/**
 * Loads persisted trade settings or defaults
 */
export function getStoredTradeSettings(): TradeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        maxSlPoints: typeof parsed.maxSlPoints === 'number' && parsed.maxSlPoints > 0 ? parsed.maxSlPoints : DEFAULT_TRADE_SETTINGS.maxSlPoints,
        riskRewardRatio: typeof parsed.riskRewardRatio === 'number' && parsed.riskRewardRatio > 0 ? parsed.riskRewardRatio : DEFAULT_TRADE_SETTINGS.riskRewardRatio,
      };
    }
  } catch (e) {
    console.warn('Failed to read trade settings from storage:', e);
  }
  return DEFAULT_TRADE_SETTINGS;
}

/**
 * Saves trade settings to localStorage
 */
export function saveStoredTradeSettings(settings: TradeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save trade settings to storage:', e);
  }
}

/**
 * Identifies ATM strike and nearest ITM strikes for CE and PE
 */
export function getEligibleBreakoutStrikes(
  rows: ProcessedOptionRow[],
  spotPrice: number
): {
  atmStrike: number;
  nearestItmCeStrike: number | null;
  nearestItmPeStrike: number | null;
} {
  if (!rows || rows.length === 0) {
    return { atmStrike: spotPrice, nearestItmCeStrike: null, nearestItmPeStrike: null };
  }

  // 1. ATM Strike: closest strike to spotPrice
  let atmStrike = rows[0].strike;
  let minDiff = Math.abs(rows[0].strike - spotPrice);
  for (let i = 1; i < rows.length; i++) {
    const diff = Math.abs(rows[i].strike - spotPrice);
    if (diff < minDiff) {
      minDiff = diff;
      atmStrike = rows[i].strike;
    }
  }

  // 2. Nearest ITM Strike for CE:
  // Call option is ITM when strike < spotPrice. Nearest ITM is highest strike < spotPrice.
  const itmCeRows = rows.filter((r) => r.strike < spotPrice).sort((a, b) => b.strike - a.strike);
  let nearestItmCeStrike: number | null = null;
  if (itmCeRows.length > 0) {
    // If ATM is already an ITM strike (< spotPrice), the nearest ITM besides ATM would be the next one,
    // or if ATM is strictly considered ITM, both ATM and itmCeRows[0] are key strikes.
    // We pick itmCeRows[0].strike (highest strike below spot).
    nearestItmCeStrike = itmCeRows[0].strike;
    // If that happens to be the ATM strike itself, check if there is an immediately lower strike:
    if (nearestItmCeStrike === atmStrike && itmCeRows.length > 1) {
      nearestItmCeStrike = itmCeRows[1].strike;
    }
  }

  // 3. Nearest ITM Strike for PE:
  // Put option is ITM when strike > spotPrice. Nearest ITM is lowest strike > spotPrice.
  const itmPeRows = rows.filter((r) => r.strike > spotPrice).sort((a, b) => a.strike - b.strike);
  let nearestItmPeStrike: number | null = null;
  if (itmPeRows.length > 0) {
    nearestItmPeStrike = itmPeRows[0].strike;
    // If that happens to be the ATM strike itself, check if there is an immediately higher strike:
    if (nearestItmPeStrike === atmStrike && itmPeRows.length > 1) {
      nearestItmPeStrike = itmPeRows[1].strike;
    }
  }

  return {
    atmStrike,
    nearestItmCeStrike,
    nearestItmPeStrike,
  };
}

/**
 * Calculates trade setup for a given row and option type (CE or PE)
 * using the strict risk management rules:
 * - Calculated Risk = Entry Price (Close) - SL Price (Premium)
 * - Enforce Max Loss: if Calculated Risk > Max SL Points, override SL to Entry Price - Max SL Points
 * - Target = Entry + (Risk * riskRewardRatio) [Strict 1:2]
 */
export function calculateTradeSetup(
  row: ProcessedOptionRow,
  type: 'BUY_CE' | 'BUY_PE',
  settings: TradeSettings,
  strikeRole: 'ATM' | 'NEAREST_ITM' | 'OTHER' = 'OTHER'
): TradeSetup {
  const isCE = type === 'BUY_CE';
  const entryPrice = round2(isCE ? row.call_close : row.put_close);
  const avgPrice = round2(isCE ? row.call_avg : row.put_avg);
  const rawSlPrice = round2(isCE ? row.call_premium : row.put_premium);

  // Trigger check: Close > AVG AND Close > PREMIUM
  const conditionMet = entryPrice > avgPrice && entryPrice > rawSlPrice;

  // 1. Calculate Risk First: Calculated Risk = Entry Price (Close) - SL Price (Premium)
  const rawRisk = Math.max(0.05, round2(entryPrice - rawSlPrice));

  // 2. Enforce Max Loss:
  // If Calculated Risk is greater than Max SL Points, override SL to be exactly Entry Price - Max SL Points.
  // Whichever is higher/safer: Math.max(rawSlPrice, entryPrice - settings.maxSlPoints)
  const maxLossSl = round2(Math.max(0.05, entryPrice - settings.maxSlPoints));
  const isSlOverridden = rawRisk > settings.maxSlPoints;
  const slPrice = isSlOverridden ? maxLossSl : rawSlPrice;

  // Effective risk after max loss enforcement
  const effectiveRisk = round2(entryPrice - slPrice);

  // 3. Target = Entry + (Risk * Risk-to-Reward Ratio)
  const rewardMultiplier = settings.riskRewardRatio > 0 ? settings.riskRewardRatio : 2;
  const rewardPoints = round2(effectiveRisk * rewardMultiplier);
  const targetPrice = round2(entryPrice + rewardPoints);

  return {
    type,
    strike: row.strike,
    strikeRole,
    entryPrice,
    rawSlPrice,
    slPrice,
    isSlOverridden,
    calculatedRisk: rawRisk,
    effectiveRisk,
    targetPrice,
    rewardPoints,
    rrRatio: rewardMultiplier,
    conditionMet,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    details: {
      close: entryPrice,
      avg: avgPrice,
      premium: rawSlPrice,
    },
  };
}

export interface TradeEvaluationResult {
  rows: ProcessedOptionRow[];
  activeSetups: TradeSetup[];
  eligibleStrikes: {
    atmStrike: number;
    nearestItmCeStrike: number | null;
    nearestItmPeStrike: number | null;
  };
  atmRow?: ProcessedOptionRow;
  nearestItmCeRow?: ProcessedOptionRow;
  nearestItmPeRow?: ProcessedOptionRow;
}

/**
 * Evaluates trade signals for all option chain rows with strict risk management.
 * Identifies ATM and nearest ITM strikes and generates active trade setups.
 */
export function evaluateAllTradeSignals(
  rows: ProcessedOptionRow[],
  spotPrice: number,
  settings: TradeSettings
): TradeEvaluationResult {
  const eligible = getEligibleBreakoutStrikes(rows, spotPrice);
  const activeSetups: TradeSetup[] = [];

  const updatedRows = rows.map((row) => {
    const isATM = row.strike === eligible.atmStrike;
    const isNearestItmCE = eligible.nearestItmCeStrike !== null && row.strike === eligible.nearestItmCeStrike;
    const isNearestItmPE = eligible.nearestItmPeStrike !== null && row.strike === eligible.nearestItmPeStrike;

    // CE Breakout evaluation
    const ceRole: 'ATM' | 'NEAREST_ITM' | 'OTHER' = isATM ? 'ATM' : isNearestItmCE ? 'NEAREST_ITM' : 'OTHER';
    const ceSetup = calculateTradeSetup(row, 'BUY_CE', settings, ceRole);
    const ceSignal = ceSetup.conditionMet;

    // PE Breakout evaluation
    const peRole: 'ATM' | 'NEAREST_ITM' | 'OTHER' = isATM ? 'ATM' : isNearestItmPE ? 'NEAREST_ITM' : 'OTHER';
    const peSetup = calculateTradeSetup(row, 'BUY_PE', settings, peRole);
    const peSignal = peSetup.conditionMet;

    // Active setups must be on ATM or nearest ITM strike as per specification:
    // "Trigger: If call_close > call_avg AND call_close > call_premium on the ATM or nearest ITM strike."
    // "Trigger: If put_close > put_avg AND put_close > put_premium on the ATM or nearest ITM strike."
    if (ceSignal && (isATM || isNearestItmCE)) {
      activeSetups.push(ceSetup);
    }

    if (peSignal && (isATM || isNearestItmPE)) {
      activeSetups.push(peSetup);
    }

    return {
      ...row,
      isNearestItmCE,
      isNearestItmPE,
      ceSignal,
      peSignal,
      ceTradeSetup: ceSetup,
      peTradeSetup: peSetup,
    };
  });

  const atmRow = updatedRows.find((r) => r.strike === eligible.atmStrike);
  const nearestItmCeRow = updatedRows.find((r) => r.strike === eligible.nearestItmCeStrike);
  const nearestItmPeRow = updatedRows.find((r) => r.strike === eligible.nearestItmPeStrike);

  return {
    rows: updatedRows,
    activeSetups,
    eligibleStrikes: eligible,
    atmRow,
    nearestItmCeRow,
    nearestItmPeRow,
  };
}
