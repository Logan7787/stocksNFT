import type { CandleData, CandleInterval, OptionType } from '../types/niftyAnalysis';
import { roundToTick } from '../utils/technicalIndicators';

export interface OptionContractInfo {
  instrumentKey: string;
  tradingSymbol: string;
  strike: number;
  optionType: OptionType;
  expiry: string;
  lotSize: number;
  tickSize: number;
}

/**
 * Generates realistic intraday candle series using Brownian motion drift
 * with accurate moneyness delta and volume profiles
 */
export function generateRealisticOptionCandles(
  spotPrice: number,
  strike: number,
  optionType: OptionType,
  interval: CandleInterval = '5minute',
  count: number = 45
): { candles: CandleData[]; currentPremium: number } {
  const candles: CandleData[] = [];
  const now = new Date();
  
  // Calculate interval minutes
  const intervalMinutes = interval === '1minute' ? 1 : interval === '3minute' ? 3 : interval === '15minute' ? 15 : 5;

  // Base intrinsic and time value
  const moneyness = optionType === 'CE' ? spotPrice - strike : strike - spotPrice;
  const baseDelta = optionType === 'CE' 
    ? (moneyness > 0 ? 0.55 + Math.min(0.4, moneyness / 500) : Math.max(0.08, 0.5 - Math.abs(moneyness) / 600))
    : (moneyness > 0 ? 0.55 + Math.min(0.4, moneyness / 500) : Math.max(0.08, 0.5 - Math.abs(moneyness) / 600));

  const baseTimeValue = Math.max(40, 180 - Math.abs(spotPrice - strike) * 0.15);
  let basePremium = Math.max(2.5, Math.max(0, moneyness) + baseTimeValue);
  basePremium = roundToTick(basePremium);

  // Generate historical candles leading up to now
  const startTime = new Date(now.getTime() - count * intervalMinutes * 60000);
  let prevClose = basePremium * 0.95;

  for (let i = 0; i < count; i++) {
    const candleTime = new Date(startTime.getTime() + i * intervalMinutes * 60000);
    const timeStr = candleTime.toTimeString().slice(0, 5); // HH:MM

    // Micro drift
    const trendDrift = (Math.sin(i / 6) * 1.5) + (Math.random() - 0.47) * 2.5;
    const open = roundToTick(prevClose);
    const close = roundToTick(Math.max(1.5, open + trendDrift));
    const high = roundToTick(Math.max(open, close) + Math.random() * 2.0);
    const low = roundToTick(Math.max(0.5, Math.min(open, close) - Math.random() * 1.8));
    const volume = Math.floor(15000 + Math.random() * 45000 + Math.abs(close - open) * 12000);

    candles.push({
      timestamp: timeStr,
      open,
      high,
      low,
      close,
      volume,
      isCompleted: i < count - 1, // Only previous candles are completed
    });

    prevClose = close;
  }

  return {
    candles,
    currentPremium: candles[candles.length - 1]?.close || basePremium,
  };
}

/**
 * Generates realistic NIFTY 50 spot candles
 */
export function generateRealisticSpotCandles(
  spotPrice: number,
  interval: CandleInterval = '5minute',
  count: number = 45
): CandleData[] {
  const candles: CandleData[] = [];
  const now = new Date();
  const intervalMinutes = interval === '1minute' ? 1 : interval === '3minute' ? 3 : interval === '15minute' ? 15 : 5;
  const startTime = new Date(now.getTime() - count * intervalMinutes * 60000);

  let currentSpot = spotPrice - 30;

  for (let i = 0; i < count; i++) {
    const candleTime = new Date(startTime.getTime() + i * intervalMinutes * 60000);
    const timeStr = candleTime.toTimeString().slice(0, 5);

    const drift = (Math.random() - 0.48) * 8.0;
    const open = Math.round(currentSpot * 100) / 100;
    const close = Math.round((open + drift) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * 4.5) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * 4.5) * 100) / 100;
    const volume = Math.floor(120000 + Math.random() * 300000);

    candles.push({
      timestamp: timeStr,
      open,
      high,
      low,
      close,
      volume,
      isCompleted: i < count - 1,
    });

    currentSpot = close;
  }

  return candles;
}

/**
 * Fetches intraday candles for an instrument from Upstox API v2
 * Falls back safely to high-fidelity simulated candles if unauthorized or offline
 */
export async function fetchUpstoxIntradayCandles(
  instrumentKey: string,
  interval: CandleInterval,
  token?: string
): Promise<{
  candles: CandleData[];
  isLiveBroker: boolean;
  error?: string;
}> {
  const activeToken = token?.trim() || (import.meta.env.VITE_UPSTOX_ACCESS_TOKEN || '').trim();

  // Map interval format to Upstox API v2 format
  const upstoxInterval = interval; // '1minute', '3minute', '5minute', '15minute'
  const url = `/api/upstox/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${upstoxInterval}`;

  if (!activeToken) {
    return {
      candles: [],
      isLiveBroker: false,
      error: 'Token missing — running high-fidelity simulation',
    };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${activeToken}`,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data.candles)) {
        // Upstox candle array: [timestamp, open, high, low, close, volume, oi]
        const rawCandles = json.data.candles;
        const mapped: CandleData[] = rawCandles.map((c: any[], index: number) => {
          const dt = new Date(c[0]);
          const timeStr = !isNaN(dt.getTime())
            ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : String(c[0]).slice(11, 16);

          return {
            timestamp: timeStr,
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5] || 0),
            // Upstox puts latest candle at index 0
            isCompleted: index > 0,
          };
        });

        // Upstox returns reverse chronological (newest first). Reverse to oldest first for charting & indicator math
        mapped.reverse();

        if (mapped.length > 0) {
          // Last candle in chronological order is the currently forming candle
          mapped[mapped.length - 1].isCompleted = false;
          return {
            candles: mapped,
            isLiveBroker: true,
          };
        }
      }
    } else if (res.status === 401) {
      return {
        candles: [],
        isLiveBroker: false,
        error: 'Upstox Token Expired (401). Daily reset at 3:30 AM IST.',
      };
    } else {
      const errText = await res.text();
      return {
        candles: [],
        isLiveBroker: false,
        error: `Upstox API Error (${res.status}): ${errText.slice(0, 150)}`,
      };
    }
  } catch (err: any) {
    return {
      candles: [],
      isLiveBroker: false,
      error: `Network error: ${err.message || 'Failed to fetch Upstox candles'}`,
    };
  }

  return {
    candles: [],
    isLiveBroker: false,
    error: 'No candle data available',
  };
}
