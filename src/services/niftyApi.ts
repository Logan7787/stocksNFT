import type { RawOptionData, ProcessedOptionRow, MarketMetrics, BrokerApiConfig, BrokerStatus } from '../types/optionChain';
import { generateBaseNiftyOptionData, processRawOptionRow, applyConditionalHighlights, round2 } from '../utils/formulas';

export type TickListener = (data: {
  spotPrice: number;
  spotChange: number;
  rows: ProcessedOptionRow[];
  metrics: MarketMetrics;
}) => void;

export type BrokerStatusListener = (status: BrokerStatus) => void;

/**
 * Calculate the nearest upcoming Thursday/Tuesday NSE Expiry Date (YYYY-MM-DD)
 */
export function calculateUpcomingExpiryDate(symbol: string = 'NIFTY'): string {
  const d = new Date();
  let targetDay = 4; // Thursday default for NIFTY & BANKNIFTY
  if (symbol === 'FINNIFTY') targetDay = 2; // Tuesday
  else if (symbol === 'MIDCPNIFTY') targetDay = 1; // Monday

  const currentDay = d.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue, 3 is Wed, 4 is Thu, 5 is Fri, 6 is Sat
  let diff = (targetDay - currentDay + 7) % 7;

  // If today is targetDay, but market already closed (after 15:30 IST), jump to next week
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (diff === 0 && (hours > 15 || (hours === 15 && minutes >= 30))) {
    diff = 7;
  }

  const target = new Date(d.getTime() + diff * 86400000);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function generateFallbackExpiryDates(symbol: string = 'NIFTY'): string[] {
  const dates: string[] = [];
  const base = new Date();
  let targetDay = 4; // Thursday
  if (symbol === 'FINNIFTY') targetDay = 2;
  else if (symbol === 'MIDCPNIFTY') targetDay = 1;

  for (let i = 0; i < 8; i++) {
    const d = new Date(base.getTime() + i * 7 * 86400000);
    const day = d.getDay();
    const diff = (targetDay - day + 7) % 7;
    const target = new Date(d.getTime() + diff * 86400000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const formatted = `${yyyy}-${mm}-${dd}`;
    if (!dates.includes(formatted)) {
      dates.push(formatted);
    }
  }
  return dates;
}

class NiftyMarketDataService {
  private spotPrice: number = 22620.45;
  private openSpotPrice: number = 22580.00;
  private rawData: RawOptionData[] = [];
  private processedRows: ProcessedOptionRow[] = [];
  private listeners: Set<TickListener> = new Set();
  private statusListeners: Set<BrokerStatusListener> = new Set();
  private intervalId: any = null;
  private tickIntervalMs: number = 1000;
  private isRunning: boolean = false;
  private isSimulated: boolean = true;
  private brokerStatus: BrokerStatus = {
    connected: false,
    status: 'idle',
  };
  private brokerConfig: BrokerApiConfig = {
    provider: 'upstox',
    apiKey: '',
    symbol: 'NIFTY',
    expiryDate: calculateUpcomingExpiryDate('NIFTY'),
    enabled: false,
  };

  constructor() {
    this.initData();
    this.getBrokerConfig(); // Load initial broker configuration with .env fallback
  }

  private initData() {
    this.rawData = generateBaseNiftyOptionData(this.spotPrice);
    const initialProcessed = this.rawData.map(r => processRawOptionRow(r));
    const { highlightedRows } = applyConditionalHighlights(initialProcessed, this.spotPrice);
    this.processedRows = highlightedRows;
  }

  public getSpotPrice(): number {
    return this.spotPrice;
  }

  public setSpotPrice(newSpot: number): void {
    this.spotPrice = round2(newSpot);
    this.recalculateAll();
  }

  public getProcessedRows(): ProcessedOptionRow[] {
    return this.processedRows;
  }

  public getBrokerStatus(): BrokerStatus {
    return this.brokerStatus;
  }

  private updateBrokerStatus(status: Partial<BrokerStatus>) {
    this.brokerStatus = {
      ...this.brokerStatus,
      ...status,
    };
    this.statusListeners.forEach((fn) => {
      try {
        fn(this.brokerStatus);
      } catch (e) {
        console.error('Broker status listener error:', e);
      }
    });
  }

  public subscribeBrokerStatus(listener: BrokerStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.brokerStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Load broker config with full fallback support for .env variables (VITE_UPSTOX_ACCESS_TOKEN)
   */
  public getBrokerConfig(): BrokerApiConfig {
    const envToken = (import.meta.env.VITE_UPSTOX_ACCESS_TOKEN || import.meta.env.VITE_BROKER_ACCESS_TOKEN || '').trim();
    const envProvider = (import.meta.env.VITE_BROKER_PROVIDER || 'upstox') as any;
    const envSymbol = (import.meta.env.VITE_BROKER_SYMBOL || 'NIFTY').trim();
    const envExpiry = (import.meta.env.VITE_BROKER_EXPIRY_DATE || '').trim();
    const envEnabled = import.meta.env.VITE_BROKER_ENABLED === 'true' || import.meta.env.VITE_BROKER_ENABLED === true;

    const saved = localStorage.getItem('nifty_broker_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.brokerConfig = {
          provider: parsed.provider || envProvider,
          apiKey: parsed.apiKey || envToken,
          symbol: parsed.symbol || envSymbol,
          expiryDate: parsed.expiryDate || envExpiry || calculateUpcomingExpiryDate(parsed.symbol || envSymbol),
          enabled: parsed.enabled !== undefined ? parsed.enabled : (envToken ? envEnabled : false),
          proxyUrl: parsed.proxyUrl || '',
        };
      } catch (e) {
        console.error('Failed to parse saved broker config:', e);
      }
    } else {
      this.brokerConfig = {
        provider: envProvider,
        apiKey: envToken,
        symbol: envSymbol,
        expiryDate: envExpiry || calculateUpcomingExpiryDate(envSymbol),
        enabled: envToken ? envEnabled : false,
        proxyUrl: '',
      };
    }

    this.isSimulated = !(this.brokerConfig.enabled && this.brokerConfig.apiKey?.trim());
    return this.brokerConfig;
  }

  public setBrokerConfig(config: BrokerApiConfig): void {
    this.brokerConfig = config;
    localStorage.setItem('nifty_broker_config', JSON.stringify(config));
    if (config.enabled && config.apiKey?.trim()) {
      this.isSimulated = false;
      this.updateBrokerStatus({ connected: false, status: 'idle', error: undefined });
      // Trigger instant fetch
      this.fetchBrokerData();
    } else {
      this.isSimulated = true;
      this.updateBrokerStatus({ connected: false, status: 'idle', error: undefined });
    }
  }

  public setTickInterval(ms: number): void {
    this.tickIntervalMs = Math.max(200, ms);
    if (this.isRunning) {
      this.stopStreaming();
      this.startStreaming();
    }
  }

  public startStreaming(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      if (this.isSimulated) {
        this.tickSimulation();
      } else {
        this.fetchBrokerData();
      }
    }, this.tickIntervalMs);
  }

  public stopStreaming(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);
    // Send initial frame immediately
    const { highlightedRows, metrics } = applyConditionalHighlights(this.processedRows, this.spotPrice);
    listener({
      spotPrice: this.spotPrice,
      spotChange: round2(this.spotPrice - this.openSpotPrice),
      rows: highlightedRows,
      metrics: {
        ...metrics,
        spotChange: round2(this.spotPrice - this.openSpotPrice),
        spotChangePercent: round2(((this.spotPrice - this.openSpotPrice) / this.openSpotPrice) * 100),
      }
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(rows: ProcessedOptionRow[], metrics: MarketMetrics) {
    const spotChange = round2(this.spotPrice - this.openSpotPrice);
    const spotChangePercent = round2((spotChange / this.openSpotPrice) * 100);
    const updatedMetrics: MarketMetrics = {
      ...metrics,
      spotPrice: this.spotPrice,
      spotChange,
      spotChangePercent,
    };

    this.listeners.forEach((listener) => {
      try {
        listener({
          spotPrice: this.spotPrice,
          spotChange,
          rows,
          metrics: updatedMetrics,
        });
      } catch (e) {
        console.error('Tick listener error:', e);
      }
    });
  }

  private recalculateAll() {
    const prevMap = new Map(this.processedRows.map(r => [r.strike, r]));
    const updatedProcessed = this.rawData.map(r => processRawOptionRow(r, prevMap.get(r.strike)));
    const { highlightedRows, metrics } = applyConditionalHighlights(updatedProcessed, this.spotPrice);
    this.processedRows = highlightedRows;
    this.notify(this.processedRows, metrics);
  }

  /**
   * High-fidelity sub-second market simulator
   */
  private tickSimulation() {
    // 1. Realistic spot delta (Brownian motion micro-shock)
    const spotDelta = (Math.random() - 0.49) * 2.8;
    this.spotPrice = round2(Math.max(20000, this.spotPrice + spotDelta));

    const prevMap = new Map(this.processedRows.map(r => [r.strike, r]));

    // 2. Randomly tick strikes (approx 40-70% of strikes change per tick)
    this.rawData = this.rawData.map((item) => {
      const shouldTick = Math.random() > 0.35;
      if (!shouldTick) return item;

      const moneyness = item.strike - this.spotPrice;
      const deltaFactor = Math.exp(-Math.abs(moneyness) / 400);

      // Call Close micro-drift
      const callDelta = (spotDelta * 0.45 * deltaFactor) + (Math.random() - 0.49) * 1.2;
      const newCallClose = round2(Math.max(0.2, item.call_close + callDelta));
      const newCallLow = round2(Math.min(item.call_low, newCallClose));
      const newCallHigh = round2(Math.max(item.call_high, newCallClose));
      const callVolDelta = Math.floor(Math.random() * 850 * deltaFactor);

      // Put Close micro-drift (inverse to spot)
      const putDelta = (-spotDelta * 0.45 * deltaFactor) + (Math.random() - 0.49) * 1.2;
      const newPutClose = round2(Math.max(0.2, item.put_close + putDelta));
      const newPutLow = round2(Math.min(item.put_low, newPutClose));
      const newPutHigh = round2(Math.max(item.put_high, newPutClose));
      const putVolDelta = Math.floor(Math.random() * 800 * deltaFactor);

      return {
        ...item,
        call_close: newCallClose,
        call_low: newCallLow,
        call_high: newCallHigh,
        call_volume: item.call_volume + callVolDelta,
        put_close: newPutClose,
        put_low: newPutLow,
        put_high: newPutHigh,
        put_volume: item.put_volume + putVolDelta,
        call_change: round2(newCallClose - (item.call_low + item.call_high) / 2),
        put_change: round2(newPutClose - (item.put_low + item.put_high) / 2),
      };
    });

    const updatedProcessed = this.rawData.map(r => processRawOptionRow(r, prevMap.get(r.strike)));
    const { highlightedRows, metrics } = applyConditionalHighlights(updatedProcessed, this.spotPrice);
    this.processedRows = highlightedRows;
    this.notify(this.processedRows, metrics);
  }

  /**
   * Helper to get upcoming weekly expiry (YYYY-MM-DD)
   */
  public getUpcomingExpiryDate(): string {
    return calculateUpcomingExpiryDate(this.brokerConfig.symbol || 'NIFTY');
  }

  /**
   * Resolve target URL based on broker provider and user input
   */
  public resolveBrokerUrl(config: BrokerApiConfig): string {
    let url = config.proxyUrl?.trim() || '';

    // If user accidentally pasted the Pro web URL (pro.upstox.com), strip it to use the API
    if (url.includes('pro.upstox.com')) {
      url = '';
    }

    if (config.provider === 'upstox') {
      if (!url || url.includes('api.upstox.com') || url.includes('/api/upstox')) {
        const expiry = config.expiryDate?.trim() || calculateUpcomingExpiryDate(config.symbol || 'NIFTY');
        const symbolKey = config.symbol === 'BANKNIFTY' ? 'NSE_INDEX|Nifty Bank' : 'NSE_INDEX|Nifty 50';
        url = `/api/upstox/v2/option/chain?instrument_key=${encodeURIComponent(symbolKey)}&expiry_date=${expiry}`;
      }
    }

    // Auto-route Upstox direct URLs through local proxy to prevent CORS errors
    if (url.startsWith('https://api.upstox.com')) {
      url = url.replace('https://api.upstox.com', '/api/upstox');
    }

    return url;
  }

  /**
   * Fetch from External Broker API / Proxy (Upstox, Custom Proxy)
   */
  private async fetchBrokerData() {
    const targetUrl = this.resolveBrokerUrl(this.brokerConfig);
    const token = this.brokerConfig.apiKey?.trim();

    if (!targetUrl || !token) {
      this.updateBrokerStatus({ connected: false, status: 'idle' });
      this.tickSimulation();
      return;
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const json = await response.json();

        // 1. Direct Upstox API v2 Option Chain format
        if (Array.isArray(json.data) && json.data.length > 0 && (json.data[0].strike_price !== undefined || json.data[0].call_options !== undefined)) {
          if (json.data[0].underlying_spot_price) {
            this.spotPrice = round2(Number(json.data[0].underlying_spot_price));
          }

          const parsed = json.data
            .filter((item: any) => item && (item.strike_price !== undefined || item.strike !== undefined))
            .map((item: any) => {
              const callMd = item.call_options?.market_data;
              const putMd = item.put_options?.market_data;
              const callGreeks = item.call_options?.option_greeks;
              const putGreeks = item.put_options?.option_greeks;

              const callClose = callMd?.ltp ?? callMd?.close_price ?? 0;
              const callLow = callMd?.low_price || callClose;
              const callHigh = callMd?.high_price || callClose;

              const putClose = putMd?.ltp ?? putMd?.close_price ?? 0;
              const putLow = putMd?.low_price || putClose;
              const putHigh = putMd?.high_price || putClose;

              return {
                strike: Number(item.strike_price ?? item.strike),
                call_low: round2(callLow),
                call_high: round2(callHigh),
                call_close: round2(callClose),
                call_volume: Number(callMd?.volume || 0),
                call_oi: Number(callMd?.oi || 0),
                call_iv: callGreeks?.iv ? round2(callGreeks.iv) : undefined,
                put_low: round2(putLow),
                put_high: round2(putHigh),
                put_close: round2(putClose),
                put_volume: Number(putMd?.volume || 0),
                put_oi: Number(putMd?.oi || 0),
                put_iv: putGreeks?.iv ? round2(putGreeks.iv) : undefined,
              };
            });

          // Sort strikes ascending
          parsed.sort((a: any, b: any) => a.strike - b.strike);

          if (parsed.length > 0) {
            this.rawData = parsed;
            this.updateBrokerStatus({
              connected: true,
              status: 'connected',
              spotPrice: this.spotPrice,
              strikesCount: parsed.length,
              lastFetchedAt: new Date().toLocaleTimeString(),
              error: undefined,
            });
            this.recalculateAll();
            return;
          }
        }

        // 2. Custom Proxy format
        if (json.spotPrice) {
          this.spotPrice = round2(Number(json.spotPrice));
        }
        if (Array.isArray(json.data) && json.data.length > 0) {
          this.rawData = json.data;
          this.updateBrokerStatus({
            connected: true,
            status: 'connected',
            spotPrice: this.spotPrice,
            strikesCount: json.data.length,
            lastFetchedAt: new Date().toLocaleTimeString(),
            error: undefined,
          });
          this.recalculateAll();
          return;
        }
      } else {
        const errorText = await response.text();
        let parsedErr: any = null;
        try {
          parsedErr = JSON.parse(errorText);
        } catch {}

        if (response.status === 401) {
          this.updateBrokerStatus({
            connected: false,
            status: 'token_expired',
            error: 'Upstox Access Token Expired (401). Daily token reset occurs at 3:30 AM IST. Please generate a new token in Upstox Developer Portal and update Settings.',
          });
        } else if (response.status === 400) {
          const msg = parsedErr?.errors?.[0]?.message || parsedErr?.message || 'Invalid Expiry Date';
          this.updateBrokerStatus({
            connected: false,
            status: 'error',
            error: `Upstox API: ${msg}. Please select an active expiry date in Settings.`,
          });
        } else {
          this.updateBrokerStatus({
            connected: false,
            status: 'error',
            error: `Broker API error (${response.status}): ${parsedErr?.message || response.statusText}`,
          });
        }
      }
    } catch (err: any) {
      console.warn('External Broker API fetch error:', err);
      this.updateBrokerStatus({
        connected: false,
        status: 'error',
        error: `Network error: ${err.message || 'Failed to connect to Broker'}`,
      });
    }

    // Fallback simulation if broker fetch fails
    this.tickSimulation();
  }
}

export const niftyMarketService = new NiftyMarketDataService();

/**
 * Diagnostic tool to test broker API connection and provide clear feedback
 */
export async function testBrokerConnection(config: BrokerApiConfig): Promise<{
  success: boolean;
  message: string;
  statusCode?: number;
  spotPrice?: number;
  strikesCount?: number;
  expiryDate?: string;
  urlUsed?: string;
  rawDetails?: string;
  availableExpiries?: string[];
}> {
  const token = config.apiKey?.trim();
  if (!token) {
    return {
      success: false,
      message: 'Access Token / API Key is empty. Please paste your token or set VITE_UPSTOX_ACCESS_TOKEN in .env.',
    };
  }

  // Also fetch available contract expiries for diagnostic help
  const availableExpiries = await fetchUpstoxExpiryDates(token, config.symbol || 'NIFTY');

  const expiryToUse = config.expiryDate?.trim() || (availableExpiries.length > 0 ? availableExpiries[0] : calculateUpcomingExpiryDate(config.symbol || 'NIFTY'));
  const testConfig = { ...config, expiryDate: expiryToUse };
  const url = niftyMarketService.resolveBrokerUrl(testConfig);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      // response wasn't JSON
    }

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          statusCode: 401,
          urlUsed: url,
          availableExpiries,
          message: 'Upstox Token Expired (401 Unauthorized). Upstox tokens expire daily at 3:30 AM IST. Please generate a new access token in your Upstox Developer Portal and save it.',
          rawDetails: responseText.slice(0, 300),
        };
      }

      const errMsg = json?.errors?.[0]?.message || json?.message || `HTTP ${response.status} ${response.statusText}`;
      return {
        success: false,
        statusCode: response.status,
        urlUsed: url,
        availableExpiries,
        message: `Upstox API Error (${response.status}): ${errMsg}. Check if the expiry date (${expiryToUse}) is valid for this instrument.`,
        rawDetails: responseText.slice(0, 300),
      };
    }

    if (json && Array.isArray(json.data) && json.data.length > 0) {
      const spot = json.data[0].underlying_spot_price || json.spotPrice;
      const expiry = json.data[0].expiry || expiryToUse;
      return {
        success: true,
        statusCode: 200,
        urlUsed: url,
        spotPrice: spot ? Number(spot) : undefined,
        strikesCount: json.data.length,
        expiryDate: expiry,
        availableExpiries,
        message: `✓ Successfully connected to Upstox Live Feed! Spot Price: ₹${spot?.toLocaleString('en-IN') || 'N/A'}, Loaded ${json.data.length} active option strikes (Expiry: ${expiry}).`,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      urlUsed: url,
      availableExpiries,
      message: `Connected to API, but no active option contracts returned for expiry '${expiryToUse}'. Available contract expiries: ${availableExpiries.slice(0, 4).join(', ')}.`,
      rawDetails: responseText.slice(0, 300),
    };
  } catch (err: any) {
    return {
      success: false,
      urlUsed: url,
      availableExpiries,
      message: `Network Error: ${err.message || 'Failed to connect'}. If running on Vite dev server, check proxy /api/upstox.`,
    };
  }
}

/**
 * Fetch available live option contract expiry dates directly from Upstox
 */
export async function fetchUpstoxExpiryDates(apiKey: string, symbol: string = 'NIFTY'): Promise<string[]> {
  const token = apiKey?.trim() || import.meta.env.VITE_UPSTOX_ACCESS_TOKEN || '';
  if (!token) return generateFallbackExpiryDates(symbol);

  const symbolKey = symbol === 'BANKNIFTY' ? 'NSE_INDEX|Nifty Bank' : 'NSE_INDEX|Nifty 50';
  const url = `/api/upstox/v2/option/contract?instrument_key=${encodeURIComponent(symbolKey)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const expiries = Array.from(
          new Set(
            json.data
              .map((d: any) => d.expiry)
              .filter((exp: any) => typeof exp === 'string' && exp >= todayStr)
          )
        ) as string[];
        expiries.sort();
        if (expiries.length > 0) {
          return expiries;
        }
      }
    }
  } catch (e) {
    console.warn('Error fetching Upstox contract expiries:', e);
  }
  return generateFallbackExpiryDates(symbol);
}
