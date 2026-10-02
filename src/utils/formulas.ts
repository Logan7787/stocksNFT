import type { RawOptionData, ProcessedOptionRow, MarketMetrics } from '../types/optionChain';

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
  const avgPrice = calculateAveragePrice(raw.call_close, raw.put_close);

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
    call_low: round2(raw.call_low),
    call_high: round2(raw.call_high),
    call_change: raw.call_change ? round2(raw.call_change) : 0,

    // PUT Section
    put_close: round2(raw.put_close),
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

    return {
      ...row,
      isATM,
      isMinAvg,
      isMinCallPremium,
      isMinPutPremium,
      isTopCallVolume,
      isTopPutVolume,
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

    return {
      strike,
      call_low,
      call_high,
      call_close: round2(callClose),
      call_volume: Math.max(10000, call_volume),
      put_low,
      put_high,
      put_close: round2(putClose),
      put_volume: Math.max(10000, put_volume),
    };
  });
}
