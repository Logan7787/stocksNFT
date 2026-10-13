import type { 
  CandleData, 
  TechnicalIndicators, 
  StrategySignal, 
  StrategyConfig,
  SignalVerdict 
} from '../types/niftyAnalysis';

/**
 * Rounds a number to a specific tick size (default 0.05 for NSE)
 */
export function roundToTick(value: number, tickSize: number = 0.05): number {
  return Math.round((Math.round(value / tickSize) * tickSize) * 100) / 100;
}

/**
 * Calculates Exponential Moving Average (EMA) series
 */
export function calculateEMA(values: number[], period: number): (number | null)[] {
  if (values.length < period) {
    return values.map(() => null);
  }

  const result: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEma = sum / period;
  result[period - 1] = Math.round(prevEma * 100) / 100;

  for (let i = period; i < values.length; i++) {
    const currentEma = (values[i] - prevEma) * k + prevEma;
    result[i] = Math.round(currentEma * 100) / 100;
    prevEma = currentEma;
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's Smoothing
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  if (closes.length <= period) {
    return closes.map(() => null);
  }

  const result: (number | null)[] = new Array(closes.length).fill(null);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  // Initial Average Gain & Loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + rs))) * 100) / 100;

  // Wilder's smoothing for remaining points
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      result[i + 1] = 100;
    } else {
      rs = avgGain / avgLoss;
      result[i + 1] = Math.round((100 - (100 / (1 + rs))) * 100) / 100;
    }
  }

  return result;
}

/**
 * Calculates Intraday Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: CandleData[]): (number | null)[] {
  if (candles.length === 0) return [];

  const result: (number | null)[] = [];
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = Math.max(1, c.volume);

    cumulativeTypicalVolume += typicalPrice * vol;
    cumulativeVolume += vol;

    const vwap = cumulativeTypicalVolume / cumulativeVolume;
    result.push(Math.round(vwap * 100) / 100);
  }

  return result;
}

/**
 * Extracts latest technical indicator snapshot for the most recent completed candle
 */
export function getLatestTechnicalIndicators(
  candles: CandleData[],
  config: StrategyConfig = {
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    rsiPeriod: 14,
    rsiLowerBound: 55,
    rsiUpperBound: 70,
    stopLossPercent: 2,
    riskRewardMultiplier: 2,
    underlyingFilterEnabled: true,
  },
  freshness: 'LIVE' | 'DELAYED' | 'STALE' | 'SIMULATED' = 'LIVE'
): TechnicalIndicators {
  if (candles.length === 0) {
    return {
      ema9: null,
      ema21: null,
      rsi14: null,
      vwap: null,
      prevCandleHigh: null,
      prevCandleLow: null,
      trend: 'NEUTRAL',
      isEmaBullishCross: false,
      isAboveVwap: false,
      isRsiInZone: false,
      isBreakoutHigh: false,
      candleConfirmed: false,
      dataFreshness: freshness,
      lastUpdated: new Date().toLocaleTimeString(),
    };
  }

  // Use completed candles for indicators, ignoring incomplete live forming candle
  const completedCandles = candles.filter((c) => c.isCompleted !== false);
  const evalCandles = completedCandles.length >= 2 ? completedCandles : candles;

  const closes = evalCandles.map((c) => c.close);
  const ema9Series = calculateEMA(closes, config.emaFastPeriod);
  const ema21Series = calculateEMA(closes, config.emaSlowPeriod);
  const rsiSeries = calculateRSI(closes, config.rsiPeriod);
  const vwapSeries = calculateVWAP(evalCandles);

  const lastIdx = evalCandles.length - 1;
  const prevIdx = lastIdx - 1;

  const latestClose = closes[lastIdx];
  const ema9 = ema9Series[lastIdx];
  const ema21 = ema21Series[lastIdx];
  const rsi14 = rsiSeries[lastIdx];
  const vwap = vwapSeries[lastIdx];

  const prevCandleHigh = prevIdx >= 0 ? evalCandles[prevIdx].high : null;
  const prevCandleLow = prevIdx >= 0 ? evalCandles[prevIdx].low : null;

  const isEmaBullishCross = ema9 !== null && ema21 !== null && ema9 > ema21;
  const isAboveVwap = vwap !== null && latestClose > vwap;
  const isRsiInZone = rsi14 !== null && rsi14 >= config.rsiLowerBound && rsi14 <= config.rsiUpperBound;
  const isBreakoutHigh = prevCandleHigh !== null && latestClose > prevCandleHigh;

  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (isEmaBullishCross && isAboveVwap) {
    trend = 'BULLISH';
  } else if (ema9 !== null && ema21 !== null && ema9 < ema21 && vwap !== null && latestClose < vwap) {
    trend = 'BEARISH';
  }

  return {
    ema9,
    ema21,
    rsi14,
    vwap,
    prevCandleHigh,
    prevCandleLow,
    trend,
    isEmaBullishCross,
    isAboveVwap,
    isRsiInZone,
    isBreakoutHigh,
    candleConfirmed: evalCandles[lastIdx]?.isCompleted ?? true,
    dataFreshness: freshness,
    lastUpdated: evalCandles[lastIdx]?.timestamp || new Date().toLocaleTimeString(),
  };
}

/**
 * Evaluates Experimental Strategy Signal
 * 
 * BUY WATCH conditions:
 * 1. EMA 9 > EMA 21
 * 2. Latest completed candle close > VWAP
 * 3. RSI 14 between 55 and 70
 * 4. Latest completed candle close > previous completed candle high
 */
export function evaluateStrategySignal(
  optionCandles: CandleData[],
  underlyingCandles: CandleData[] = [],
  config: StrategyConfig = {
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    rsiPeriod: 14,
    rsiLowerBound: 55,
    rsiUpperBound: 70,
    stopLossPercent: 2,
    riskRewardMultiplier: 2,
    underlyingFilterEnabled: true,
  }
): StrategySignal {
  const warnings: string[] = [];
  const warningsTamil: string[] = [];

  if (optionCandles.length < config.emaSlowPeriod) {
    return {
      verdict: 'NO_TRADE',
      verdictTamil: 'வர்த்தகம் இல்லை (NO TRADE)',
      reason: `Insufficient candle data (need at least ${config.emaSlowPeriod} completed candles)`,
      reasonTamil: `போதுமான மெழுகுவர்த்தி தரவு இல்லை (${config.emaSlowPeriod} மெழுகுவர்த்திகள் தேவை)`,
      underlyingTrend: 'NEUTRAL',
      optionPremiumTrend: 'NEUTRAL',
      conditions: {
        emaCondition: false,
        vwapCondition: false,
        rsiCondition: false,
        highBreakCondition: false,
      },
      warnings: ['Data buffer warming up'],
      warningsTamil: ['தரவு சேகரிக்கப்படுகிறது'],
      referenceLevels: null,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  const indicators = getLatestTechnicalIndicators(optionCandles, config);
  const completedCandles = optionCandles.filter((c) => c.isCompleted !== false);
  const lastCandle = completedCandles.length > 0 ? completedCandles[completedCandles.length - 1] : optionCandles[optionCandles.length - 1];
  const entryPrice = lastCandle.close;

  // Underlying Trend Filter
  let underlyingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (underlyingCandles.length >= config.emaSlowPeriod) {
    const underIndicators = getLatestTechnicalIndicators(underlyingCandles, config);
    underlyingTrend = underIndicators.trend;
  }

  const { isEmaBullishCross, isAboveVwap, isRsiInZone, isBreakoutHigh } = indicators;
  const allConditionsMet = isEmaBullishCross && isAboveVwap && isRsiInZone && isBreakoutHigh;

  // Check weakness conditions
  const isWeakness =
    (indicators.ema9 !== null && indicators.ema21 !== null && indicators.ema9 < indicators.ema21) ||
    (indicators.vwap !== null && entryPrice < indicators.vwap) ||
    (indicators.rsi14 !== null && (indicators.rsi14 < 45 || indicators.rsi14 > 72));

  let verdict: SignalVerdict = 'NO_TRADE';
  let verdictTamil = 'வர்த்தகம் இல்லை (NO TRADE)';
  let reason = 'Strategy conditions not fully aligned';
  let reasonTamil = 'வியூக நிபந்தனைகள் முழுமையாக பூர்த்தியாகவில்லை';

  if (allConditionsMet) {
    verdict = 'BUY_WATCH';
    verdictTamil = 'வாங்கக் காத்திருங்கள் (BUY WATCH)';
    reason = 'All experimental BUY WATCH rules satisfied on confirmed candle close';
    reasonTamil = 'அனைத்து வாங்குதல் விதிகளும் உறுதிப்படுத்தப்பட்ட மெழுகுவர்த்தியில் பூர்த்தியாகின';
  } else if (isWeakness) {
    verdict = 'WEAKNESS_WARNING';
    verdictTamil = 'பலவீன எச்சரிக்கை (WEAKNESS WARNING)';
    reason = 'Momentum weakness detected: EMA 9 < EMA 21 or Price below VWAP';
    reasonTamil = 'உந்த பலவீனம் கண்டறியப்பட்டது: EMA 9 < 21 அல்லது விலை VWAP-க்குக் கீழ் உள்ளது';
    warnings.push('Option premiums decay over time (Theta). Do not treat weakness as an automatic sell/short entry.');
    warningsTamil.push('ஆப்ஷன் பிரீமியம் காலப்போக்கில் குறையும் (தீட்டா தேய்வு). பலவீனத்தை உடனடியாக விற்பனைக்கான வாய்ப்பாகக் கருதாதீர்கள்.');
  }

  // Additional market context warnings
  warnings.push('Option premiums are heavily affected by underlying index moves, Implied Volatility (IV), and time decay.');
  warningsTamil.push('ஆப்ஷன் பிரீமியங்கள் நிஃப்டி குறியீட்டின் நகர்வு, மறைமுக மாறுபாட்டுத் தன்மை (IV) மற்றும் நேரத் தேய்வால் பாதிக்கப்படுகின்றன.');

  if (config.underlyingFilterEnabled && underlyingTrend !== 'BULLISH' && verdict === 'BUY_WATCH') {
    warnings.push(`Caution: Underlying NIFTY 50 trend is ${underlyingTrend}, which may create headwind.`);
    warningsTamil.push(`எச்சரிக்கை: நிஃப்டி 50 குறியீட்டு போக்கு ${underlyingTrend === 'BEARISH' ? 'கரடிப் போக்கு (இறங்குமுகம்)' : 'நடுநிலை'} ஆக உள்ளது.`);
  }

  // Calculate Experimental Reference Levels (Tick rounded to 0.05)
  // Default: Stop Loss = Entry * 0.98, Target = Entry + 2 * (Entry - Stop Loss)
  const stopLossPrice = roundToTick(entryPrice * (1 - config.stopLossPercent / 100));
  const riskPerUnit = entryPrice - stopLossPrice;
  const targetPrice = roundToTick(entryPrice + config.riskRewardMultiplier * riskPerUnit);

  return {
    verdict,
    verdictTamil,
    reason,
    reasonTamil,
    underlyingTrend,
    optionPremiumTrend: indicators.trend,
    conditions: {
      emaCondition: isEmaBullishCross,
      vwapCondition: isAboveVwap,
      rsiCondition: isRsiInZone,
      highBreakCondition: isBreakoutHigh,
    },
    warnings,
    warningsTamil,
    referenceLevels: {
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLossPrice,
      targetPrice,
      riskRewardRatio: config.riskRewardMultiplier,
    },
    timestamp: indicators.lastUpdated,
  };
}
