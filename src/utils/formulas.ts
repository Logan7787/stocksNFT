import type { RawOptionData, ProcessedOptionRow, MarketMetrics, BreakLevelsInfo } from '../types/optionChain';

/**
 * Custom Mathematical Formulas for NIFTY 50 Option Chain:
 * 1. Call Premium = (Call Low + Put High) / 2
 * 2. Put Premium  = (Put Low + Call High) / 2
 * 3. AVG          = (Call Close + Put Close) / 2
 * All rounded to 2 decimal places.
 */

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateCallPremium(callLow: number, putHigh: number): number {
  return round2((callLow + putHigh) / 2);
}

export function calculatePutPremium(putLow: number, callHigh: number): number {
  return round2((putLow + callHigh) / 2);
}

export function calculateAveragePrice(callClose: number, putClose: number): number {
  return round2((callClose + putClose) / 2);
}

/**
 * Transforms raw market option data into processed rows with exact business calculations
 */
export function processRawOptionRow(raw: RawOptionData, prevRow?: ProcessedOptionRow): ProcessedOptionRow {
  const callPremium = calculateCallPremium(raw.call_low, raw.put_high);
  const putPremium = calculatePutPremium(raw.put_low, raw.call_high);
  // Use settlement close if > 0, otherwise fallback to LTP so AVG is computed before settlement
  const effectiveCallClose = (raw.call_close && raw.call_close > 0) ? raw.call_close : (raw.call_ltp || 0);
  const effectivePutClose = (raw.put_close && raw.put_close > 0) ? raw.put_close : (raw.put_ltp || 0);
  const avgPrice = calculateAveragePrice(effectiveCallClose, effectivePutClose);

  let callTickDirection: 'up' | 'down' | 'neutral' = 'neutral';
  if (prevRow) {
    if (raw.call_close > prevRow.call_close) callTickDirection = 'up';
    else if (raw.call_close < prevRow.call_close) callTickDirection = 'down';
  }

  let putTickDirection: 'up' | 'down' | 'neutral' = 'neutral';
  if (prevRow) {
    if (raw.put_close > prevRow.put_close) putTickDirection = 'up';
    else if (raw.put_close < prevRow.put_close) putTickDirection = 'down';
  }

  return {
    strike: raw.strike,
    
    // CALL Section
    call_volume: Math.round(raw.call_volume),
    call_premium: callPremium,
    call_avg: avgPrice,
    call_close: round2(raw.call_close),
    call_prev_close: raw.call_prev_close !== undefined ? round2(raw.call_prev_close) : round2(raw.call_close),
    call_settlement_close: raw.call_settlement_close !== undefined ? round2(raw.call_settlement_close) : undefined,
    call_ltp: (raw.call_ltp !== undefined && raw.call_ltp > 0) ? round2(raw.call_ltp) : round2(raw.call_close),
    call_low: round2(raw.call_low),
    call_high: round2(raw.call_high),
    call_change: raw.call_change ? round2(raw.call_change) : 0,

    // PUT Section
    put_ltp: (raw.put_ltp !== undefined && raw.put_ltp > 0) ? round2(raw.put_ltp) : round2(raw.put_close),
    put_close: round2(raw.put_close),
    put_prev_close: raw.put_prev_close !== undefined ? round2(raw.put_prev_close) : round2(raw.put_close),
    put_settlement_close: raw.put_settlement_close !== undefined ? round2(raw.put_settlement_close) : undefined,
    put_avg: avgPrice,
    put_premium: putPremium,
    put_volume: Math.round(raw.put_volume),
    put_low: round2(raw.put_low),
    put_high: round2(raw.put_high),
    put_change: raw.put_change ? round2(raw.put_change) : 0,

    // Tick tracker
    prevCallClose: prevRow?.call_close ?? raw.call_close,
    prevPutClose: prevRow?.put_close ?? raw.put_close,
    callTickDirection,
    putTickDirection,
  };
}

/**
 * Finds ATM strike, min AVG, min Premiums, and Top 2 Volume strikes,
 * and sets the conditional highlight flags on the rows.
 */
export function applyConditionalHighlights(
  rows: ProcessedOptionRow[],
  spotClose: number
): { highlightedRows: ProcessedOptionRow[]; metrics: MarketMetrics } {
  if (!rows || rows.length === 0) {
    const emptyMetrics: MarketMetrics = {
      spotPrice: spotClose,
      spotChange: 0,
      spotChangePercent: 0,
      atmStrike: spotClose,
      totalCallVolume: 0,
      totalPutVolume: 0,
      pcrVolume: 1,
      maxPainStrike: spotClose,
      minAvgValue: 0,
      minCallPremiumValue: 0,
      minPutPremiumValue: 0,
      topCallVolumeStrikes: [],
      topPutVolumeStrikes: [],
      timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    };
    return { highlightedRows: [], metrics: emptyMetrics };
  }

  // 1. Find At-The-Money (ATM) Strike (closest to spotClose)
  let closestStrike = rows[0].strike;
  let minDiff = Math.abs(rows[0].strike - spotClose);
  for (let i = 1; i < rows.length; i++) {
    const diff = Math.abs(rows[i].strike - spotClose);
    if (diff < minDiff) {
      minDiff = diff;
      closestStrike = rows[i].strike;
    }
  }

  // 2. Find minimum AVG value across all strikes
  let minAvg = Infinity;
  for (const row of rows) {
    if (row.call_avg < minAvg) {
      minAvg = row.call_avg;
    }
  }

  // 3. Find minimum Call PREMIUM and minimum Put PREMIUM
  let minCallPrem = Infinity;
  let minPutPrem = Infinity;
  for (const row of rows) {
    if (row.call_premium < minCallPrem) {
      minCallPrem = row.call_premium;
    }
    if (row.put_premium < minPutPrem) {
      minPutPrem = row.put_premium;
    }
  }

  // 4. Find Top 2 Highest Call Volumes and Top 2 Highest Put Volumes
  const sortedByCallVol = [...rows].sort((a, b) => b.call_volume - a.call_volume);
  const top2CallVolThreshold = sortedByCallVol.length >= 2 
    ? sortedByCallVol[1].call_volume 
    : (sortedByCallVol[0]?.call_volume ?? 0);
  const topCallStrikes = sortedByCallVol.slice(0, 2).map(r => r.strike);

  const sortedByPutVol = [...rows].sort((a, b) => b.put_volume - a.put_volume);
  const top2PutVolThreshold = sortedByPutVol.length >= 2 
    ? sortedByPutVol[1].put_volume 
    : (sortedByPutVol[0]?.put_volume ?? 0);
  const topPutStrikes = sortedByPutVol.slice(0, 2).map(r => r.strike);

  // Totals for metrics
  let totalCallVol = 0;
  let totalPutVol = 0;

  // Apply flags to each row
  const highlightedRows: ProcessedOptionRow[] = rows.map((row) => {
    totalCallVol += row.call_volume;
    totalPutVol += row.put_volume;

    const isATM = row.strike === closestStrike;
    const isMinAvg = Math.abs(row.call_avg - minAvg) < 0.001;
    const isMinCallPremium = Math.abs(row.call_premium - minCallPrem) < 0.001;
    const isMinPutPremium = Math.abs(row.put_premium - minPutPrem) < 0.001;
    const isTopCallVolume = row.call_volume >= top2CallVolThreshold && row.call_volume > 0;
    const isTopPutVolume = row.put_volume >= top2PutVolThreshold && row.put_volume > 0;

    // CE Breakout: call_close (or LTP) > call_avg AND > call_premium
    const callCompareVal = (row.call_close && row.call_close > 0) ? row.call_close : (row.call_ltp || 0);
    const ceSignal = callCompareVal > row.call_avg && callCompareVal > row.call_premium;
    // PE Breakout: put_close (or LTP) > put_avg AND > put_premium
    const putCompareVal = (row.put_close && row.put_close > 0) ? row.put_close : (row.put_ltp || 0);
    const peSignal = putCompareVal > row.put_avg && putCompareVal > row.put_premium;

    return {
      ...row,
      isATM,
      isMinAvg,
      isMinCallPremium,
      isMinPutPremium,
      isTopCallVolume,
      isTopPutVolume,
      ceSignal,
      peSignal,
    };
  });

  const pcr = totalCallVol > 0 ? round2(totalPutVol / totalCallVol) : 1;

  // Approximate Max Pain calculation for advanced option analytics
  let minLoss = Infinity;
  let maxPainStrike = closestStrike;
  for (const r of rows) {
    let loss = 0;
    for (const testRow of rows) {
      if (testRow.strike < r.strike) {
        loss += (r.strike - testRow.strike) * testRow.call_volume;
      } else if (testRow.strike > r.strike) {
        loss += (testRow.strike - r.strike) * testRow.put_volume;
      }
    }
    if (loss < minLoss) {
      minLoss = loss;
      maxPainStrike = r.strike;
    }
  }

  const metrics: MarketMetrics = {
    spotPrice: round2(spotClose),
    spotChange: 0,
    spotChangePercent: 0,
    atmStrike: closestStrike,
    totalCallVolume: totalCallVol,
    totalPutVolume: totalPutVol,
    pcrVolume: pcr,
    maxPainStrike,
    minAvgValue: round2(minAvg),
    minCallPremiumValue: round2(minCallPrem),
    minPutPremiumValue: round2(minPutPrem),
    topCallVolumeStrikes: topCallStrikes,
    topPutVolumeStrikes: topPutStrikes,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
  };

  return { highlightedRows, metrics };
}

/**
 * Generates initial realistic NIFTY 50 Option Chain data centered around 22,620.45
 * Step of 50: 22000 to 23200 (25 strikes)
 */
export function generateBaseNiftyOptionData(spotPrice = 22620.45): RawOptionData[] {
  const strikes: number[] = [];
  const startStrike = Math.floor((spotPrice - 600) / 50) * 50; // e.g. 22000
  const endStrike = Math.ceil((spotPrice + 600) / 50) * 50;     // e.g. 23200

  for (let s = startStrike; s <= endStrike; s += 50) {
    strikes.push(s);
  }

  return strikes.map((strike) => {
    const moneyness = strike - spotPrice; // positive = OTM for call, ITM for put
    
    // Realistic Call pricing (Black-Scholes approximation / realistic curve)
    const callIntrinsic = Math.max(0, spotPrice - strike);
    const callTimeValue = Math.max(8, 280 * Math.exp(-Math.pow(moneyness / 420, 2)));
    const callClose = Math.max(0.5, callIntrinsic + callTimeValue);
    
    // Realistic Put pricing
    const putIntrinsic = Math.max(0, strike - spotPrice);
    const putTimeValue = Math.max(8, 280 * Math.exp(-Math.pow(moneyness / 420, 2)));
    const putClose = Math.max(0.5, putIntrinsic + putTimeValue);

    // Intraday spreads (Low/High)
    const callSpread = Math.max(3.5, callClose * 0.12);
    const putSpread = Math.max(3.5, putClose * 0.12);

    const call_low = round2(Math.max(0.2, callClose - callSpread * 0.6));
    const call_high = round2(callClose + callSpread * 0.7);
    const put_low = round2(Math.max(0.2, putClose - putSpread * 0.6));
    const put_high = round2(putClose + putSpread * 0.7);

    // Volume distribution peaks near ATM and major round numbers
    const distFromAtm = Math.abs(moneyness);
    const baseVolFactor = Math.exp(-Math.pow(distFromAtm / 300, 2));
    const isRound100 = strike % 100 === 0;
    const isRound500 = strike % 500 === 0;
    const multiplier = isRound500 ? 2.4 : isRound100 ? 1.7 : 1.0;

    const call_volume = Math.round((350000 + 1200000 * baseVolFactor * multiplier) + (Math.sin(strike) * 50000));
    const put_volume = Math.round((320000 + 1150000 * baseVolFactor * multiplier) + (Math.cos(strike) * 45000));

    const call_ltp = round2(callClose * (1 + (Math.sin(strike * 3) * 0.015)));
    const put_ltp = round2(putClose * (1 + (Math.cos(strike * 3) * 0.015)));

    return {
      strike,
      call_low,
      call_high,
      call_close: round2(callClose),
      call_ltp,
      call_volume: Math.max(10000, call_volume),
      put_low,
      put_high,
      put_close: round2(putClose),
      put_ltp,
      put_volume: Math.max(10000, put_volume),
    };
  });
}

/**
 * Calculates Close ATM strike and Break Up / Break Down values according to formula:
 * 1. Base ATM Strike: Strike closest to Spot Market Close.
 * 2. Formula ATM Strike: Evaluates strikes near the base ATM strike (within ±200 pts / ±4 strikes).
 *    Finds the strike where |Call Close - Put Close| <= 25 pts with the lowest spread.
 *    If no strike has spread <= 25 pts, falls back to the nearby strike with minimum spread.
 * 3. Break Down: (Call Close at ATM+100 + Put Close at ATM-100) / 2
 * 4. Break Up:   (Call Close at ATM-100 + Put Close at ATM+100) / 2
 */
export function calculateBreakLevels(
  rows: ProcessedOptionRow[],
  spotClose?: number
): BreakLevelsInfo | null {
  if (!rows || rows.length === 0) return null;

  // 1. Determine the base Spot ATM strike
  let baseAtmStrike: number;
  if (spotClose !== undefined && spotClose > 0) {
    let closest = rows[0].strike;
    let minD = Math.abs(rows[0].strike - spotClose);
    for (const r of rows) {
      const d = Math.abs(r.strike - spotClose);
      if (d < minD) {
        minD = d;
        closest = r.strike;
      }
    }
    baseAtmStrike = closest;
  } else {
    const atmRow = rows.find(r => r.isATM);
    if (atmRow) {
      baseAtmStrike = atmRow.strike;
    } else {
      baseAtmStrike = rows[Math.floor(rows.length / 2)].strike;
    }
  }

  // 2. Bound the search window strictly NEAR the base ATM strike (within ±50 pts, e.g. 22900, 22950, 23000)
  // Evaluates ATM strike (e.g. 22936 -> 22950 ± 50 pts) to find the strike where |Call - Put| <= 25 pts
  const windowRange = 50;
  let nearbyRows = rows.filter(r => Math.abs(r.strike - baseAtmStrike) <= windowRange);
  if (nearbyRows.length === 0) {
    nearbyRows = rows.filter(r => Math.abs(r.strike - baseAtmStrike) <= 100);
  }
  const candidates = nearbyRows.length > 0 ? nearbyRows : rows;

  // Use settlement close if available (> 0), otherwise use closing LTP / close for post-market formula calculation
  const getCallVal = (r: ProcessedOptionRow) => {
    if (r.call_settlement_close && r.call_settlement_close > 0) return r.call_settlement_close;
    if (r.call_ltp && r.call_ltp > 0) return r.call_ltp;
    return r.call_close || 0;
  };
  const getPutVal = (r: ProcessedOptionRow) => {
    if (r.put_settlement_close && r.put_settlement_close > 0) return r.put_settlement_close;
    if (r.put_ltp && r.put_ltp > 0) return r.put_ltp;
    return r.put_close || 0;
  };

  // Filter strikes where |call_price - put_price| <= 25 pts
  const qualifying = candidates.filter(r => Math.abs(getCallVal(r) - getPutVal(r)) <= 25);

  let bestRow: ProcessedOptionRow;
  let minDiff: number;

  if (qualifying.length > 0) {
    // Pick the qualifying strike with lowest spread; if tied, closest to base ATM
    qualifying.sort((a, b) => {
      const diffA = Math.abs(getCallVal(a) - getPutVal(a));
      const diffB = Math.abs(getCallVal(b) - getPutVal(b));
      if (Math.abs(diffA - diffB) > 0.001) {
        return diffA - diffB;
      }
      return Math.abs(a.strike - baseAtmStrike) - Math.abs(b.strike - baseAtmStrike);
    });
    bestRow = qualifying[0];
    minDiff = Math.abs(getCallVal(bestRow) - getPutVal(bestRow));
  } else {
    // Fallback: If no strike has spread <= 25 pts, pick the nearby strike with the minimum spread
    bestRow = candidates[0];
    minDiff = Math.abs(getCallVal(candidates[0]) - getPutVal(candidates[0]));
    for (const r of candidates) {
      const diff = Math.abs(getCallVal(r) - getPutVal(r));
      if (diff < minDiff) {
        minDiff = diff;
        bestRow = r;
      }
    }
  }

  const formulaAtmStrike = bestRow.strike;
  const atmCallClose = round2(getCallVal(bestRow));
  const atmPutClose = round2(getPutVal(bestRow));
  const atmDiff = round2(minDiff);

  // Reference strikes: ATM + 100 and ATM - 100
  const plus100Strike = formulaAtmStrike + 100;
  const minus100Strike = formulaAtmStrike - 100;

  const plus100Row = rows.find(r => r.strike === plus100Strike);
  const minus100Row = rows.find(r => r.strike === minus100Strike);

  // For Break Down:
  // Call Close at (ATM + 100) [OTM Call]
  // Put Close at (ATM - 100) [OTM Put]
  const bdCallClose = plus100Row ? round2(getCallVal(plus100Row)) : 0;
  const bdPutClose = minus100Row ? round2(getPutVal(minus100Row)) : 0;
  const breakDownValue = round2((bdCallClose + bdPutClose) / 2);

  // For Break Up:
  // Call Close at (ATM - 100) [ITM Call]
  // Put Close at (ATM + 100) [ITM Put]
  const buCallClose = minus100Row ? round2(getCallVal(minus100Row)) : 0;
  const buPutClose = plus100Row ? round2(getPutVal(plus100Row)) : 0;
  const breakUpValue = round2((buCallClose + buPutClose) / 2);

  // For Break Even:
  // Take Formula ATM Strike (bestRow).
  // 4 values: Call High, Call Low, Put High, Put Low.
  // Formula: (Max High among all 4 + Min Low among all 4) / 2
  const callHigh = round2(bestRow.call_high || getCallVal(bestRow));
  const callLow = round2(bestRow.call_low || getCallVal(bestRow));
  const putHigh = round2(bestRow.put_high || getPutVal(bestRow));
  const putLow = round2(bestRow.put_low || getPutVal(bestRow));

  const highestValue = Math.max(callHigh, callLow, putHigh, putLow);
  const lowestValue = Math.min(callHigh, callLow, putHigh, putLow);
  const breakEvenValue = round2((highestValue + lowestValue) / 2);

  let highestSource = 'Call High';
  if (highestValue === putHigh) highestSource = 'Put High';
  else if (highestValue === callLow) highestSource = 'Call Low';
  else if (highestValue === putLow) highestSource = 'Put Low';

  let lowestSource = 'Put Low';
  if (lowestValue === callLow) lowestSource = 'Call Low';
  else if (lowestValue === callHigh) lowestSource = 'Call High';
  else if (lowestValue === putHigh) lowestSource = 'Put High';

  return {
    formulaAtmStrike,
    atmCallClose,
    atmPutClose,
    atmDiff,
    breakDown: {
      value: breakDownValue,
      callStrike: plus100Strike,
      callClose: bdCallClose,
      putStrike: minus100Strike,
      putClose: bdPutClose,
    },
    breakUp: {
      value: breakUpValue,
      callStrike: minus100Strike,
      callClose: buCallClose,
      putStrike: plus100Strike,
      putClose: buPutClose,
    },
    breakEven: {
      value: breakEvenValue,
      strike: formulaAtmStrike,
      highestValue,
      highestSource,
      lowestValue,
      lowestSource,
      callHigh,
      callLow,
      putHigh,
      putLow,
    },
  };
}

/**
 * Annotates rows with tags indicating their role in Break Up / Break Down calculations
 */
export function tagBreakLevelStrikes(
  rows: ProcessedOptionRow[], 
  breakLevels: BreakLevelsInfo | null
): ProcessedOptionRow[] {
  if (!breakLevels) return rows;

  return rows.map(r => {
    if (r.strike === breakLevels.formulaAtmStrike) {
      return { ...r, isFormulaAtm: true, breakLevelRole: 'FORMULA_ATM' };
    }
    if (r.strike === breakLevels.breakUp.callStrike) { // ATM - 100
      return { ...r, breakLevelRole: 'ATM_MINUS_100' };
    }
    if (r.strike === breakLevels.breakDown.callStrike) { // ATM + 100
      return { ...r, breakLevelRole: 'ATM_PLUS_100' };
    }
    return r;
  });
}

