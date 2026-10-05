import type { RawOptionData, ProcessedOptionRow, MarketMetrics, BrokerApiConfig } from '../types/optionChain';
import { generateBaseNiftyOptionData, processRawOptionRow, applyConditionalHighlights, round2 } from '../utils/formulas';

export type TickListener = (data: {
  spotPrice: number;
  spotChange: number;
  rows: ProcessedOptionRow[];
  metrics: MarketMetrics;
}) => void;

class NiftyMarketDataService {
  private spotPrice: number = 22620.45;
  private openSpotPrice: number = 22580.00;
  private rawData: RawOptionData[] = [];
  private processedRows: ProcessedOptionRow[] = [];
  private listeners: Set<TickListener> = new Set();
  private intervalId: any = null;
  private tickIntervalMs: number = 1000;
  private isRunning: boolean = false;
  private isSimulated: boolean = true;
  private brokerConfig: BrokerApiConfig = {
    provider: 'custom_proxy',
    apiKey: '',
    symbol: 'NIFTY',
    expiryDate: '',
    enabled: false,
  };

  constructor() {
    this.initData();
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

  public getBrokerConfig(): BrokerApiConfig {
    const saved = localStorage.getItem('nifty_broker_config');
    if (saved) {
      try {
        this.brokerConfig = JSON.parse(saved);
      } catch (e) {}
    }
    return this.brokerConfig;
  }

  public setBrokerConfig(config: BrokerApiConfig): void {
    this.brokerConfig = config;
    localStorage.setItem('nifty_broker_config', JSON.stringify(config));
    if (config.enabled && config.apiKey) {
      this.isSimulated = false;
    } else {
      this.isSimulated = true;
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
   * Helper to get upcoming weekly Tuesday/Thursday expiry (YYYY-MM-DD)
   */
  public getUpcomingExpiryDate(): string {
    const d = new Date();
    const day = d.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue, 4 is Thu
    // If today is Monday (1) or Tuesday (2), default to current week's Thursday (or user selected date)
    const diff = (4 - day + 7) % 7;
    const target = new Date(d.getTime() + (diff === 0 ? 0 : diff) * 86400000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
        const expiry = config.expiryDate?.trim() || this.getUpcomingExpiryDate();
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

    if (!targetUrl || !this.brokerConfig.apiKey) {
      this.tickSimulation();
      return;
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${this.brokerConfig.apiKey.trim()}`,
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
          this.recalculateAll();
          return;
        }
      } else {
        const errorText = await response.text();
        console.warn(`Broker API returned error status ${response.status}:`, errorText);
      }
    } catch (err) {
      console.warn('External Broker API fetch error, falling back to live simulator:', err);
    }

    // Fallback simulation if broker fetch fails or during off-market hours
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
}> {
  if (!config.apiKey?.trim()) {
    return {
      success: false,
      message: 'Access Token / API Key is empty. Please generate and paste your token.',
    };
  }

  const url = niftyMarketService.resolveBrokerUrl(config);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.apiKey.trim()}`,
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
      const errMsg = json?.errors?.[0]?.message || json?.message || `HTTP ${response.status} ${response.statusText}`;
      return {
        success: false,
        statusCode: response.status,
        urlUsed: url,
        message: `Upstox API Error (${response.status}): ${errMsg}`,
        rawDetails: responseText.slice(0, 300),
      };
    }

    if (json && Array.isArray(json.data) && json.data.length > 0) {
      const spot = json.data[0].underlying_spot_price || json.spotPrice;
      const expiry = json.data[0].expiry || config.expiryDate;
      return {
        success: true,
        statusCode: 200,
        urlUsed: url,
        spotPrice: spot ? Number(spot) : undefined,
        strikesCount: json.data.length,
        expiryDate: expiry,
        message: `Successfully connected to Upstox! Spot Price: ₹${spot?.toLocaleString('en-IN') || 'N/A'}, Loaded ${json.data.length} option strikes (Expiry: ${expiry}).`,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      urlUsed: url,
      message: `Connected to API, but no option contracts were found for expiry date '${config.expiryDate || '2026-10-08'}'. In Upstox, please switch Target Option Expiry Date to '2026-10-06' (or click the '06-Oct' quick button).`,
      rawDetails: responseText.slice(0, 300),
    };
  } catch (err: any) {
    return {
      success: false,
      urlUsed: url,
      message: `Network Error: ${err.message || 'Failed to connect'}.`,
    };
  }
}

/**
 * Fetch available live option contract expiry dates directly from Upstox
 */
export async function fetchUpstoxExpiryDates(apiKey: string, symbol: string = 'NIFTY'): Promise<string[]> {
  if (!apiKey?.trim()) return [];
  const symbolKey = symbol === 'BANKNIFTY' ? 'NSE_INDEX|Nifty Bank' : 'NSE_INDEX|Nifty 50';
  const url = `/api/upstox/v2/option/contract?instrument_key=${encodeURIComponent(symbolKey)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data)) {
        const expiries = Array.from(new Set(json.data.map((d: any) => d.expiry).filter(Boolean))) as string[];
        expiries.sort();
        return expiries;
      }
    }
  } catch (e) {
    console.warn('Error fetching Upstox contract expiries:', e);
  }
  return ['2026-10-06', '2026-10-13', '2026-10-19', '2026-10-27', '2026-11-03'];
}
