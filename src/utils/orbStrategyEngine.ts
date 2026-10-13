import type { 
  CandleData, 
  OptionType, 
  OpeningRange, 
  DayFilterResult, 
  MarkedStrike, 
  OrbTimeWindowState, 
  OrbExitSignal, 
  DailyDisciplineState, 
  ValidationGatesStatus,
  PerformanceAnalytics 
} from '../types/niftyAnalysis';
import type { OrbStrategyConfiguration } from '../config/orbStrategyConfig';
import { calculateEMA, calculateRSI, calculateVWAP, roundToTick } from './technicalIndicators';
import { calculateEstimatedCharges } from './riskCalculator';

/**
 * Resamples 5-minute candles into 15-minute candles
 */
export function resampleTo15MinCandles(candles5m: CandleData[]): CandleData[] {
  if (candles5m.length === 0) return [];
  const res: CandleData[] = [];
  const chunkSize = 3;

  for (let i = 0; i < candles5m.length; i += chunkSize) {
    const chunk = candles5m.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    chunk.forEach((c) => {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    });

    res.push({
      timestamp: chunk[chunk.length - 1].timestamp,
      open,
      high,
      low,
      close,
      volume,
      isCompleted: chunk.length === chunkSize && chunk[chunk.length - 1].isCompleted !== false,
    });
  }

  return res;
}

/**
 * Evaluates Current IST Time Window (Section 6.1)
 */
export function evaluateOrbTimeWindow(
  timeStr: string, // "HH:MM" in 24-hr IST
  config: OrbStrategyConfiguration
): OrbTimeWindowState {
  const { timeWindows } = config;
  const t = timeStr.slice(0, 5);

  let currentPhase: OrbTimeWindowState['currentPhase'] = 'MARKET_CLOSED';
  let canEnterNewTrade = false;
  let isForceExitTime = false;
  let label = 'Market Closed';
  let labelTamil = 'சந்தை மூடப்பட்டுள்ளது';

  if (t >= timeWindows.observeStart && t < timeWindows.observeEnd) {
    currentPhase = 'OBSERVE_ONLY';
    canEnterNewTrade = false;
    label = '09:15 - 09:30: Observe Only (Recording Opening Range)';
    labelTamil = '09:15 - 09:30: உற்றுநோக்கல் மட்டும் (தொடக்க வரம்பு பதிவு)';
  } else if (t >= timeWindows.primaryEntryStart && t < timeWindows.primaryEntryEnd) {
    currentPhase = 'PRIMARY_ENTRY';
    canEnterNewTrade = true;
    label = '09:30 - 11:30: Primary Entry Window (Active)';
    labelTamil = '09:30 - 11:30: முதன்மை நுழைவு சாளரம் (செயலில்)';
  } else if (t >= timeWindows.noEntryZoneStart && t < timeWindows.noEntryZoneEnd) {
    currentPhase = 'NO_ENTRY_ZONE';
    canEnterNewTrade = false;
    label = '11:30 - 13:30: Low-Momentum Zone (No New Entries)';
    labelTamil = '11:30 - 13:30: குறைந்த உந்த மண்டலம் (புதிய நுழைவு இல்லை)';
  } else if (
    timeWindows.secondaryWindowEnabled &&
    t >= timeWindows.secondaryEntryStart &&
    t < timeWindows.secondaryEntryEnd
  ) {
    currentPhase = 'SECONDARY_ENTRY';
    canEnterNewTrade = true;
    label = '13:30 - 14:45: Secondary Entry Window';
    labelTamil = '13:30 - 14:45: இரண்டாம் நிலை நுழைவு சாளரம்';
  } else if (t >= timeWindows.hardCutoffTime && t < timeWindows.forceExitTime) {
    currentPhase = 'HARD_CUTOFF';
    canEnterNewTrade = false;
    label = '14:45 - 15:15: Hard Cutoff (Managing Open Trades Only)';
    labelTamil = '14:45 - 15:15: புதிய வர்த்தகம் தடைசெய்யப்பட்ட நேரம்';
  } else if (t >= timeWindows.forceExitTime && t <= '15:30') {
    currentPhase = 'FORCE_EXIT';
    canEnterNewTrade = false;
    isForceExitTime = true;
    label = '15:15+: Force-Exit All Open Intraday Positions';
    labelTamil = '15:15+: கட்டாய வெளியேறும் நேரம் (Force Exit)';
  }

  return {
    currentTime: t,
    currentPhase,
    canEnterNewTrade,
    isForceExitTime,
    timeWindowLabel: label,
    timeWindowLabelTamil: labelTamil,
  };
}

/**
 * Calculates Opening Range High (ORH) and Opening Range Low (ORL) from 09:15 - 09:30 candles
 */
export function calculateOpeningRange(
  candles5m: CandleData[],
  indexPrice: number,
  config: OrbStrategyConfiguration
): OpeningRange {
  // Opening range formed by first three 5-min candles (09:15, 09:20, 09:25)
  // or candles whose timestamp is between 09:15 and 09:30
  const openingCandles = candles5m.filter((c) => {
    const t = c.timestamp.slice(0, 5);
    return t >= '09:15' && t < '09:30';
  });

  if (openingCandles.length < 3) {
    // If fewer than 3 candles exist yet, calculate tentative high/low or fallback to first candle
    const high = openingCandles.length > 0 ? Math.max(...openingCandles.map((c) => c.high)) : indexPrice + 35;
    const low = openingCandles.length > 0 ? Math.min(...openingCandles.map((c) => c.low)) : indexPrice - 35;
    const width = roundToTick(high - low);
    const widthPercent = roundToTick((width / indexPrice) * 100);

    return {
      high: roundToTick(high),
      low: roundToTick(low),
      width,
      widthPercent,
      isFormed: false,
      isValidWidth: widthPercent >= config.dayFilter.minRangeWidthPercent && widthPercent <= config.dayFilter.maxRangeWidthPercent,
    };
  }

  let high = -Infinity;
  let low = Infinity;
  openingCandles.forEach((c) => {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  });

  const width = roundToTick(high - low);
  const widthPercent = roundToTick((width / indexPrice) * 100);
  const isValidWidth =
    widthPercent >= config.dayFilter.minRangeWidthPercent &&
    widthPercent <= config.dayFilter.maxRangeWidthPercent;

  return {
    high: roundToTick(high),
    low: roundToTick(low),
    width,
    widthPercent,
    isFormed: true,
    isValidWidth,
    timestampRecorded: '09:30 IST',
  };
}

/**
 * Evaluates Section 6.2 Day Filter at 09:30
 */
export function evaluateOrbDayFilter(params: {
  openingRange: OpeningRange;
  currentDateStr: string;   // "YYYY-MM-DD"
  contractExpiryStr: string;// "YYYY-MM-DD"
  currentTimeStr: string;   // "HH:MM"
  indiaVix?: number;
  config: OrbStrategyConfiguration;
}): DayFilterResult {
  const { openingRange, currentDateStr, contractExpiryStr, currentTimeStr, indiaVix, config } = params;
  const time = currentTimeStr.slice(0, 5);

  // 1. Opening range width filter: 0.15% to 0.60%
  if (openingRange.isFormed) {
    if (openingRange.widthPercent < config.dayFilter.minRangeWidthPercent) {
      return {
        canTrade: false,
        statusBadge: 'NO_TRADE_TODAY',
        rangeWidthPercent: openingRange.widthPercent,
        indiaVix,
        isEventDay: false,
        isExpiryAfter13: false,
        reason: `Opening range width too narrow (${openingRange.widthPercent.toFixed(2)}% < ${config.dayFilter.minRangeWidthPercent}%). Choppy market expected.`,
        reasonTamil: `தொடக்க வரம்பு அகலம் மிகவும் குறுகலானது (${openingRange.widthPercent.toFixed(2)}% < ${config.dayFilter.minRangeWidthPercent}%). சந்தை பக்கவாட்டு நகர்வில் (Chop) இருக்கும்.`,
      };
    }

    if (openingRange.widthPercent > config.dayFilter.maxRangeWidthPercent) {
      return {
        canTrade: false,
        statusBadge: 'NO_TRADE_TODAY',
        rangeWidthPercent: openingRange.widthPercent,
        indiaVix,
        isEventDay: false,
        isExpiryAfter13: false,
        reason: `Opening range width too wide (${openingRange.widthPercent.toFixed(2)}% > ${config.dayFilter.maxRangeWidthPercent}%). Move already exhausted.`,
        reasonTamil: `தொடக்க வரம்பு அகலம் மிகவும் அதிகம் (${openingRange.widthPercent.toFixed(2)}% > ${config.dayFilter.maxRangeWidthPercent}%). பெரிய நகர்வு முன்பே முடிந்துவிட்டது.`,
      };
    }
  }

  // 2. Configurable Event-Day Filter
  if (config.dayFilter.blacklistedEventDays.includes(currentDateStr)) {
    return {
      canTrade: false,
      statusBadge: 'NO_TRADE_TODAY',
      rangeWidthPercent: openingRange.widthPercent,
      indiaVix,
      isEventDay: true,
      isExpiryAfter13: false,
      reason: `Configured major event day (Budget / RBI Policy / Macro event).`,
      reasonTamil: `முக்கிய திட்டமிடப்பட்ட நிகழ்வு நாள் (பட்ஜெட் / ரிசர்வ் வங்கி கொள்கை / மேக்ரோ நிகழ்வு).`,
    };
  }

  // 3. India VIX Filter (> 22)
  if (indiaVix !== undefined && indiaVix > config.dayFilter.maxIndiaVix) {
    return {
      canTrade: false,
      statusBadge: 'NO_TRADE_TODAY',
      rangeWidthPercent: openingRange.widthPercent,
      indiaVix,
      isEventDay: false,
      isExpiryAfter13: false,
      reason: `India VIX is elevated (${indiaVix.toFixed(1)} > ${config.dayFilter.maxIndiaVix}). High volatility regime.`,
      reasonTamil: `இந்தியா VIX அதிகமாக உள்ளது (${indiaVix.toFixed(1)} > ${config.dayFilter.maxIndiaVix}). அதிக ஏற்ற இறக்கம்.`,
    };
  }

  // 4. Expiry day after 13:00 filter
  const isExpiryDay = currentDateStr === contractExpiryStr;
  if (isExpiryDay && time >= config.dayFilter.expiryCutoffTime) {
    return {
      canTrade: false,
      statusBadge: 'NO_TRADE_TODAY',
      rangeWidthPercent: openingRange.widthPercent,
      indiaVix,
      isEventDay: false,
      isExpiryAfter13: true,
      reason: `No new entries on expiry day after 13:00 (Theta & Gamma risk).`,
      reasonTamil: `காலாவதி நாளில் மதியம் 13:00 மணிக்கு மேல் புதிய வர்த்தகம் இல்லை (தீட்டா & காமா ஆபத்து).`,
    };
  }

  return {
    canTrade: true,
    statusBadge: 'PASSED',
    rangeWidthPercent: openingRange.widthPercent,
    indiaVix,
    isEventDay: false,
    isExpiryAfter13: false,
    reason: `Day filters passed: Range ${openingRange.widthPercent.toFixed(2)}%, VIX normal, no blocking events.`,
    reasonTamil: `நாள் வடிகட்டி பூர்த்தியானது: வரம்பு ${openingRange.widthPercent.toFixed(2)}%, இயல்பான சந்தை.`,
  };
}

/**
 * Evaluates Section 6.3 EVENT 1: MARK STRIKE (Bias Confirmed, Strike Shortlisted)
 */
export function evaluateMarkStrike(params: {
  indexCandles5m: CandleData[];
  indexPrice: number;
  prevDayHigh?: number;
  prevDayLow?: number;
  openingRange: OpeningRange;
  optionChainRows?: any[]; // rows containing OI data
  availableCapital: number;
  lotSize: number;
  currentDateStr: string;
  contractExpiryStr: string;
  optionPremium: number;
  optionDelta?: number;
  bidPrice?: number;
  askPrice?: number;
  optionVolume?: number;
  optionOI?: number;
  selectedOptionType: OptionType;
  selectedStrike: number;
  config: OrbStrategyConfiguration;
}): {
  markedStrike: MarkedStrike | null;
  bias: 'BULLISH_CE' | 'BEARISH_PE' | 'NEUTRAL';
  biasReason: string;
  biasReasonTamil: string;
} {
  const {
    indexCandles5m,
    indexPrice,
    prevDayHigh = indexPrice + 100,
    prevDayLow = indexPrice - 100,
    openingRange,
    optionChainRows = [],
    availableCapital,
    lotSize,
    currentDateStr,
    contractExpiryStr,
    optionPremium,
    optionDelta = 0.55,
    bidPrice = optionPremium - 0.1,
    askPrice = optionPremium + 0.1,
    optionVolume = 15000,
    optionOI = 25000,
    selectedOptionType,
    selectedStrike,
    config,
  } = params;

  if (indexCandles5m.length < 5) {
    return {
      markedStrike: null,
      bias: 'NEUTRAL',
      biasReason: 'Warming up candle indicators',
      biasReasonTamil: 'மெழுகுவர்த்தி தரவு சேகரிக்கப்படுகிறது',
    };
  }

  // 1. Resample to 15-min candles for higher timeframe trend
  const candles15m = resampleTo15MinCandles(indexCandles5m);
  const closes15m = candles15m.map((c) => c.close);
  const ema9_15m = calculateEMA(closes15m, 9);
  const ema21_15m = calculateEMA(closes15m, 21);
  const vwap15m = calculateVWAP(candles15m);

  // 5-min index indicators
  const closes5m = indexCandles5m.map((c) => c.close);
  const ema9_5m = calculateEMA(closes5m, 9);
  const ema21_5m = calculateEMA(closes5m, 21);

  const last15Idx = candles15m.length - 1;
  const last5Idx = indexCandles5m.length - 1;

  const last15Close = closes15m[last15Idx] || indexPrice;
  const last15Vwap = vwap15m[last15Idx] || indexPrice;
  const last15Ema9 = ema9_15m[last15Idx];
  const last15Ema21 = ema21_15m[last15Idx];

  const last5Ema9 = ema9_5m[last5Idx];
  const last5Ema21 = ema21_5m[last5Idx];

  // Highest Call and Put OI walls from option chain
  let highestCallOiStrike = Infinity;
  let maxCallOi = 0;
  let highestPutOiStrike = -Infinity;
  let maxPutOi = 0;

  optionChainRows.forEach((r: any) => {
    if ((r.call_oi || 0) > maxCallOi && r.strike > indexPrice) {
      maxCallOi = r.call_oi;
      highestCallOiStrike = r.strike;
    }
    if ((r.put_oi || 0) > maxPutOi && r.strike < indexPrice) {
      maxPutOi = r.put_oi;
      highestPutOiStrike = r.strike;
    }
  });

  // Check Bullish Bias (CE)
  const is15mBullish = last15Close > last15Vwap && last15Ema9 !== null && last15Ema21 !== null && last15Ema9 > last15Ema21;
  const is5mBullish = last5Ema9 !== null && last5Ema21 !== null && last5Ema9 > last5Ema21;
  const isAboveOrhOrPdh = indexPrice > openingRange.high || indexPrice > prevDayHigh;
  const isNoCallOiWall = highestCallOiStrike === Infinity || highestCallOiStrike >= indexPrice + config.strikeMarking.oiWallBufferPoints;

  const isBullishConfirmed = is15mBullish && is5mBullish && isAboveOrhOrPdh && isNoCallOiWall;

  // Check Bearish Bias (PE)
  const is15mBearish = last15Close < last15Vwap && last15Ema9 !== null && last15Ema21 !== null && last15Ema9 < last15Ema21;
  const is5mBearish = last5Ema9 !== null && last5Ema21 !== null && last5Ema9 < last5Ema21;
  const isBelowOrlOrPdl = indexPrice < openingRange.low || indexPrice < prevDayLow;
  const isNoPutOiWall = highestPutOiStrike === -Infinity || highestPutOiStrike <= indexPrice - config.strikeMarking.oiWallBufferPoints;

  const isBearishConfirmed = is15mBearish && is5mBearish && isBelowOrlOrPdl && isNoPutOiWall;

  let bias: 'BULLISH_CE' | 'BEARISH_PE' | 'NEUTRAL' = 'NEUTRAL';
  let biasReason = 'Market structure neutral / No clear breakout';
  let biasReasonTamil = 'நடுநிலை போக்கு / தெளிவான பிரேக்அவுட் இல்லை';

  if (isBullishConfirmed) {
    bias = 'BULLISH_CE';
    biasReason = 'Bullish bias confirmed: 15m & 5m EMA9 > EMA21, above VWAP, above ORH, Call OI wall clear';
    biasReasonTamil = 'ஏறுமுகம் உறுதி: 15m & 5m EMA9 > 21, VWAP & ORH-க்கு மேல், OI சுவர் தடையில்லை';
  } else if (isBearishConfirmed) {
    bias = 'BEARISH_PE';
    biasReason = 'Bearish bias confirmed: 15m & 5m EMA9 < EMA21, below VWAP, below ORL, Put OI wall clear';
    biasReasonTamil = 'இறங்குமுகம் உறுதி: 15m & 5m EMA9 < 21, VWAP & ORL-க்கு கீழ், OI சுவர் தடையில்லை';
  }

  // If bias matches selected option type, evaluate strike criteria
  const isTargetType = (bias === 'BULLISH_CE' && selectedOptionType === 'CE') || (bias === 'BEARISH_PE' && selectedOptionType === 'PE');

  if (!isTargetType) {
    return { markedStrike: null, bias, biasReason, biasReasonTamil };
  }

  // Days to expiry
  const now = new Date(currentDateStr);
  const exp = new Date(contractExpiryStr);
  const diffDays = Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 3600 * 24)));

  // Liquidity and Spread Checks
  const spread = roundToTick(Math.max(0.05, askPrice - bidPrice));
  const spreadPercent = roundToTick((spread / optionPremium) * 100);

  // Capital Check: Premium * LotSize <= 60% of available capital
  const capitalCost = roundToTick(optionPremium * lotSize);
  const maxAllowedCost = roundToTick((availableCapital * config.strikeMarking.maxCapitalPerTradePercent) / 100);
  const capitalCheckPassed = capitalCost <= maxAllowedCost;

  if (!capitalCheckPassed) {
    return {
      markedStrike: {
        contractName: `NIFTY ${selectedStrike} ${selectedOptionType} (${contractExpiryStr})`,
        symbol: 'NIFTY',
        strike: selectedStrike,
        optionType: selectedOptionType,
        expiryDate: contractExpiryStr,
        daysToExpiry: diffDays,
        isAtmOrItm1: true,
        premium: optionPremium,
        delta: optionDelta,
        bid: bidPrice,
        ask: askPrice,
        spread,
        spreadPercent,
        volume: optionVolume,
        openInterest: optionOI,
        capitalCost,
        capitalCheckPassed: false,
        markedAtTime: indexCandles5m[last5Idx]?.timestamp || '09:30',
        markedCandleIndex: last5Idx,
        candlesElapsed: 0,
        isExpired: false,
        rejectionReason: `STRIKE REJECTED - CAPITAL (Cost ₹${capitalCost} > 60% limit ₹${maxAllowedCost})`,
      },
      bias,
      biasReason: `Strike rejected: Outlay ₹${capitalCost} exceeds 60% capital limit (₹${maxAllowedCost})`,
      biasReasonTamil: `ஸ்ட்ரைக் நிராகரிக்கப்பட்டது: மூலதன செலவு ₹${capitalCost} (60% வரம்பை தாண்டியது)`,
    };
  }

  // Min premium check (₹40)
  if (optionPremium < config.strikeMarking.minPremium) {
    return {
      markedStrike: null,
      bias,
      biasReason: `Strike skipped: Premium ₹${optionPremium} < minimum ₹${config.strikeMarking.minPremium}`,
      biasReasonTamil: `குறைந்த பிரீமியம் (₹${optionPremium} < ₹${config.strikeMarking.minPremium})`,
    };
  }

  const markedStrike: MarkedStrike = {
    contractName: `NIFTY ${selectedStrike} ${selectedOptionType} (${contractExpiryStr})`,
    symbol: 'NIFTY',
    strike: selectedStrike,
    optionType: selectedOptionType,
    expiryDate: contractExpiryStr,
    daysToExpiry: diffDays,
    isAtmOrItm1: true,
    premium: optionPremium,
    delta: optionDelta,
    bid: bidPrice,
    ask: askPrice,
    spread,
    spreadPercent,
    volume: optionVolume,
    openInterest: optionOI,
    capitalCost,
    capitalCheckPassed: true,
    markedAtTime: indexCandles5m[last5Idx]?.timestamp || '09:30',
    markedCandleIndex: last5Idx,
    candlesElapsed: 0,
    isExpired: false,
  };

  return {
    markedStrike,
    bias,
    biasReason: `Strike Marked: NIFTY ${selectedStrike} ${selectedOptionType} (Waiting for Event 2 entry trigger)`,
    biasReasonTamil: `ஸ்ட்ரைக் குறிக்கப்பட்டது: NIFTY ${selectedStrike} ${selectedOptionType} (நுழைவு சமிக்ஞைக்காக காத்திருக்கிறது)`,
  };
}

/**
 * Evaluates Section 6.4 EVENT 2: ENTRY SIGNAL
 */
export function evaluateOrbEntrySignal(params: {
  indexCandles5m: CandleData[];
  markedStrike: MarkedStrike | null;
  openingRange: OpeningRange;
  currentOptionAsk: number;
  config: OrbStrategyConfiguration;
}): {
  isEntryValid: boolean;
  verdict: 'BUY_WATCH' | 'NO_TRADE';
  reason: string;
  reasonTamil: string;
  indexSlLevel: number;
  premiumSl: number;
  targetPrice: number;
  riskPoints: number;
  conditions: {
    priceAboveOrhAndVwap: boolean;
    ema9Above21: boolean;
    rsiInZone: boolean;
    candleBodyRatioMet: boolean;
    volumeSurgeMet: boolean;
    notExtended: boolean;
  };
} {
  const { indexCandles5m, markedStrike, openingRange, currentOptionAsk, config } = params;

  const defaultFail = {
    isEntryValid: false,
    verdict: 'NO_TRADE' as const,
    reason: 'Waiting for confirmed 5-min signal candle',
    reasonTamil: 'உறுதிப்படுத்தப்பட்ட 5 நிமிட மெழுகுவர்த்திக்காக காத்திருக்கிறது',
    indexSlLevel: 0,
    premiumSl: 0,
    targetPrice: 0,
    riskPoints: 0,
    conditions: {
      priceAboveOrhAndVwap: false,
      ema9Above21: false,
      rsiInZone: false,
      candleBodyRatioMet: false,
      volumeSurgeMet: false,
      notExtended: false,
    },
  };

  if (!markedStrike || markedStrike.isExpired || indexCandles5m.length < 20) {
    return defaultFail;
  }

  const completedCandles = indexCandles5m.filter((c) => c.isCompleted !== false);
  if (completedCandles.length < 20) return defaultFail;

  const signalCandle = completedCandles[completedCandles.length - 1];
  const closes5m = completedCandles.map((c) => c.close);
  const ema9 = calculateEMA(closes5m, 9)[closes5m.length - 1];
  const ema21 = calculateEMA(closes5m, 21)[closes5m.length - 1];
  const vwap = calculateVWAP(completedCandles)[completedCandles.length - 1];
  const rsi = calculateRSI(closes5m, 14)[closes5m.length - 1];

  // 20-candle average volume
  const last20Candles = completedCandles.slice(-20);
  const avgVolume20 = last20Candles.reduce((acc, c) => acc + c.volume, 0) / 20;

  const isCE = markedStrike.optionType === 'CE';

  // 1. Close > ORH and Close > VWAP (PE: Close < ORL and Close < VWAP)
  const priceAboveOrhAndVwap = isCE
    ? signalCandle.close > openingRange.high && vwap !== null && signalCandle.close > vwap
    : signalCandle.close < openingRange.low && vwap !== null && signalCandle.close < vwap;

  // 2. 5-min EMA 9 > EMA 21 (PE: EMA 9 < EMA 21)
  const ema9Above21 = isCE
    ? ema9 !== null && ema21 !== null && ema9 > ema21
    : ema9 !== null && ema21 !== null && ema9 < ema21;

  // 3. RSI in zone (CE: 55 to 70, PE: 30 to 45)
  const rsiInZone = isCE
    ? rsi !== null && rsi >= config.entryTrigger.rsiBullishMin && rsi <= config.entryTrigger.rsiBullishMax
    : rsi !== null && rsi >= config.entryTrigger.rsiBearishMin && rsi <= config.entryTrigger.rsiBearishMax;

  // 4. Candle body >= 50% of candle range (no long wicks)
  const candleRange = signalCandle.high - signalCandle.low || 1;
  const candleBody = Math.abs(signalCandle.close - signalCandle.open);
  const candleBodyRatio = candleBody / candleRange;
  const candleBodyRatioMet = candleBodyRatio >= config.entryTrigger.minCandleBodyRatio;

  // 5. Volume of signal candle >= 1.2x 20-candle average
  const volumeSurgeMet = signalCandle.volume >= config.entryTrigger.minVolumeMultiplier * avgVolume20;

  // 6. Not extended: close is no more than 0.25% beyond ORH / ORL
  const extensionRatio = isCE
    ? (signalCandle.close - openingRange.high) / openingRange.high
    : (openingRange.low - signalCandle.close) / openingRange.low;
  const notExtended = extensionRatio <= config.entryTrigger.maxExtendedPercent / 100;

  const allMet =
    priceAboveOrhAndVwap &&
    ema9Above21 &&
    rsiInZone &&
    candleBodyRatioMet &&
    volumeSurgeMet &&
    notExtended;

  if (!allMet) {
    return {
      isEntryValid: false,
      verdict: 'NO_TRADE',
      reason: 'Signal candle did not satisfy all 6 entry trigger criteria',
      reasonTamil: 'மெழுகுவர்த்தி அனைத்து 6 நுழைவு நிபந்தனைகளையும் பூர்த்தி செய்யவில்லை',
      indexSlLevel: 0,
      premiumSl: 0,
      targetPrice: 0,
      riskPoints: 0,
      conditions: {
        priceAboveOrhAndVwap,
        ema9Above21,
        rsiInZone,
        candleBodyRatioMet,
        volumeSurgeMet,
        notExtended,
      },
    };
  }

  // Chasing check: if premium moved more than 3% from marked price
  const premiumMovePercent = ((currentOptionAsk - markedStrike.premium) / markedStrike.premium) * 100;
  if (premiumMovePercent > config.entryTrigger.maxChasingSlippagePercent) {
    return {
      isEntryValid: false,
      verdict: 'NO_TRADE',
      reason: `MISSED - DO NOT CHASE (Premium moved ${premiumMovePercent.toFixed(1)}% > 3% from marked price)`,
      reasonTamil: `தவறியது - துரத்த வேண்டாம் (பிரீமியம் 3% மேல் உயர்ந்துவிட்டது)`,
      indexSlLevel: 0,
      premiumSl: 0,
      targetPrice: 0,
      riskPoints: 0,
      conditions: {
        priceAboveOrhAndVwap,
        ema9Above21,
        rsiInZone,
        candleBodyRatioMet,
        volumeSurgeMet,
        notExtended,
      },
    };
  }

  // Section 6.5: Stop-Loss derived from index structure
  // Index SL (CE) = lower of: signal candle low or VWAP. (PE: higher of signal candle high or VWAP)
  const indexSlLevel = isCE
    ? Math.min(signalCandle.low, vwap || signalCandle.low)
    : Math.max(signalCandle.high, vwap || signalCandle.high);

  const indexPointsToSl = Math.abs(signalCandle.close - indexSlLevel);
  const delta = markedStrike.delta || 0.55;
  const calculatedPremiumLoss = roundToTick(delta * indexPointsToSl);
  const premiumSl = roundToTick(Math.max(0.5, currentOptionAsk - calculatedPremiumLoss));
  const riskPoints = roundToTick(currentOptionAsk - premiumSl);

  // Reject if premium SL implies loss > 25% of premium
  const lossPercent = (riskPoints / currentOptionAsk) * 100;
  if (lossPercent > config.riskAndExit.maxPremiumLossPercent) {
    return {
      isEntryValid: false,
      verdict: 'NO_TRADE',
      reason: `REJECTED: Stop loss risk too wide (${lossPercent.toFixed(1)}% > 25% of premium)`,
      reasonTamil: `நிராகரிக்கப்பட்டது: நஷ்டத் தடுப்பு வரம்பு மிக அதிகம் (${lossPercent.toFixed(1)}% > 25%)`,
      indexSlLevel,
      premiumSl,
      targetPrice: 0,
      riskPoints,
      conditions: {
        priceAboveOrhAndVwap,
        ema9Above21,
        rsiInZone,
        candleBodyRatioMet,
        volumeSurgeMet,
        notExtended,
      },
    };
  }

  // Target = Entry + 1.5 * Risk
  const targetPrice = roundToTick(currentOptionAsk + config.riskAndExit.targetMultiplier * riskPoints);

  return {
    isEntryValid: true,
    verdict: 'BUY_WATCH',
    reason: `BUY WATCH ${markedStrike.optionType}: Entry at ₹${currentOptionAsk}, SL ₹${premiumSl}, Target ₹${targetPrice} (1:1.5 R:R)`,
    reasonTamil: `${markedStrike.optionType} வாங்குதல் சமிக்ஞை: நுழைவு ₹${currentOptionAsk}, SL ₹${premiumSl}, இலக்கு ₹${targetPrice}`,
    indexSlLevel,
    premiumSl,
    targetPrice,
    riskPoints,
    conditions: {
      priceAboveOrhAndVwap,
      ema9Above21,
      rsiInZone,
      candleBodyRatioMet,
      volumeSurgeMet,
      notExtended,
    },
  };
}

/**
 * Evaluates Section 6.6 EVENT 3: EXIT SIGNALS for an active position
 */
export function evaluateOrbExitSignal(params: {
  position: {
    entryPrice: number;
    stopLossPrice: number;
    targetPrice: number;
    currentPrice: number;
    quantity: number;
    indexSlLevel: number;
    optionType: OptionType;
    candlesInTrade: number;
  };
  currentIndexPrice: number;
  latest5mCandle: CandleData;
  ema9_5m: number | null;
  ema21_5m: number | null;
  vwap5m: number | null;
  currentTimeStr: string;
  isFeedStale?: boolean;
  config: OrbStrategyConfiguration;
}): OrbExitSignal {
  const {
    position,
    currentIndexPrice,
    latest5mCandle,
    ema9_5m,
    ema21_5m,
    vwap5m,
    currentTimeStr,
    isFeedStale = false,
    config,
  } = params;

  const t = currentTimeStr.slice(0, 5);
  const isCE = position.optionType === 'CE';
  const initialRisk = position.entryPrice - position.stopLossPrice;
  const currentGain = position.currentPrice - position.entryPrice;
  const currentR = initialRisk > 0 ? currentGain / initialRisk : 0;

  // 8. Stale data or feed disconnected alert
  if (isFeedStale) {
    return {
      shouldExit: true,
      exitReason: 'STALE_FEED',
      exitReasonTamil: 'தரவு இணைப்பு துண்டிக்கப்பட்டது / கைமுறையாக சரிபார்க்கவும் (STALE FEED)',
      suggestedExitPrice: position.currentPrice,
      currentRMultiple: currentR,
      trailStopLevel: position.stopLossPrice,
    };
  }

  // 7. 15:15 forced exit signal
  if (t >= config.timeWindows.forceExitTime) {
    return {
      shouldExit: true,
      exitReason: 'FORCE_EXIT_1515',
      exitReasonTamil: '15:15 கட்டாய தினசரி வெளியேற்றம் (Forced Intraday Square-off)',
      suggestedExitPrice: position.currentPrice,
      currentRMultiple: currentR,
      trailStopLevel: position.stopLossPrice,
    };
  }

  // 1. Stop-loss hit (premium SL or index closed beyond index SL level)
  const indexSlBroken = isCE
    ? latest5mCandle.close < position.indexSlLevel
    : latest5mCandle.close > position.indexSlLevel;

  if (position.currentPrice <= position.stopLossPrice || indexSlBroken) {
    return {
      shouldExit: true,
      exitReason: 'STOP_LOSS',
      exitReasonTamil: 'நஷ்டத் தடுப்பு வரம்பு எட்டப்பட்டது (Stop-Loss Hit)',
      suggestedExitPrice: Math.min(position.currentPrice, position.stopLossPrice),
      currentRMultiple: currentR,
      trailStopLevel: position.stopLossPrice,
    };
  }

  // 2. Target: 1.5 x risk -> exit signal
  if (position.currentPrice >= position.targetPrice) {
    return {
      shouldExit: true,
      exitReason: 'TARGET_HIT',
      exitReasonTamil: 'இலக்கு விலை எட்டப்பட்டது (Target 1:1.5 Reached)',
      suggestedExitPrice: position.targetPrice,
      currentRMultiple: currentR,
      trailStopLevel: position.entryPrice,
    };
  }

  // 3. Breakeven rule: once reaches +1R, trail SL to entry + costs
  let trailStopLevel = position.stopLossPrice;
  const costBuffer = 1.0; // Approx ₹1.00 buffer for charges
  if (currentR >= 1.0) {
    trailStopLevel = Math.max(trailStopLevel, position.entryPrice + costBuffer);
  }

  // 4. Trailing: after breakeven, trail SL below 5-min EMA 9 (CE) or swing low
  if (currentR >= 1.0 && ema9_5m !== null) {
    const trailingIndexDelta = Math.abs(currentIndexPrice - ema9_5m);
    const trailAdjustment = roundToTick(0.55 * trailingIndexDelta);
    if (isCE && currentIndexPrice > ema9_5m) {
      trailStopLevel = Math.max(trailStopLevel, roundToTick(position.currentPrice - trailAdjustment));
    }
  }

  // 5. Momentum failure: 5-min index close crosses VWAP against position, or EMA 9 crosses EMA 21 against it
  const momentumFailed = isCE
    ? (vwap5m !== null && latest5mCandle.close < vwap5m) || (ema9_5m !== null && ema21_5m !== null && ema9_5m < ema21_5m)
    : (vwap5m !== null && latest5mCandle.close > vwap5m) || (ema9_5m !== null && ema21_5m !== null && ema9_5m > ema21_5m);

  if (momentumFailed && currentR >= 0.2) {
    return {
      shouldExit: true,
      exitReason: 'MOMENTUM_FAILURE',
      exitReasonTamil: 'உந்த முறிவு: விலை VWAP அல்லது EMA 9/21-க்கு எதிராக திரும்பியது',
      suggestedExitPrice: position.currentPrice,
      currentRMultiple: currentR,
      trailStopLevel,
    };
  }

  // 6. Time stop: if position hasn't reached +0.5R within 6 candles (30 min)
  if (position.candlesInTrade >= config.riskAndExit.timeStopCandles && currentR < 0.5) {
    return {
      shouldExit: true,
      exitReason: 'TIME_STOP',
      exitReasonTamil: 'நேர நிறுத்தம்: 30 நிமிடங்களில் +0.5R அடையவில்லை (Time Stop)',
      suggestedExitPrice: position.currentPrice,
      currentRMultiple: currentR,
      trailStopLevel,
    };
  }

  return {
    shouldExit: false,
    exitReason: 'NONE',
    exitReasonTamil: 'வர்த்தகம் தொடர்கிறது (Holding Position)',
    suggestedExitPrice: position.currentPrice,
    currentRMultiple: currentR,
    trailStopLevel,
  };
}

/**
 * Evaluates Section 7A Validation Gates
 */
export function evaluateValidationGates(
  analytics: PerformanceAnalytics,
  capital: number = 25000,
  config: OrbStrategyConfiguration
): ValidationGatesStatus {
  const { validationGates } = config;

  const paperTradesCount = analytics.totalTrades;
  const profitFactor = analytics.profitFactor;
  const maxDrawdownPercent = (analytics.maxDrawdown / capital) * 100;

  // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss) - AvgCharges
  const winRateFrac = analytics.winRatePercent / 100;
  const lossRateFrac = 1 - winRateFrac;
  const avgCharges = analytics.totalTrades > 0 ? analytics.totalCharges / analytics.totalTrades : 40;
  const expectancyPerTrade =
    roundToTick((winRateFrac * analytics.averageWin) - (lossRateFrac * analytics.averageLoss) - avgCharges);

  const gate1PaperTradesMet = paperTradesCount >= validationGates.minPaperTrades;
  const gate2ProfitFactorMet = profitFactor > validationGates.minProfitFactor;
  const gate3ExpectancyMet = expectancyPerTrade > 0;
  const gate4DrawdownMet = maxDrawdownPercent < validationGates.maxDrawdownPercent;

  const isValidated = gate1PaperTradesMet && gate2ProfitFactorMet && gate3ExpectancyMet && gate4DrawdownMet;

  return {
    paperTradesCount,
    profitFactor,
    expectancyPerTrade,
    maxDrawdownPercent: roundToTick(maxDrawdownPercent),
    gate1PaperTradesMet,
    gate2ProfitFactorMet,
    gate3ExpectancyMet,
    gate4DrawdownMet,
    isValidated,
    statusText: isValidated ? 'VALIDATED' : 'NOT VALIDATED',
  };
}
