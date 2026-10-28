import type { RawOptionData, ProcessedOptionRow, MarketMetrics, BrokerApiConfig, BrokerStatus } from '../types/optionChain';
import { generateBaseNiftyOptionData, processRawOptionRow, applyConditionalHighlights, round2 } from '../utils/formulas';
import { angelOneService } from './angelOneService';

export type TickListener = (data: {
  spotPrice: number;
  spotChange: number;
  rows: ProcessedOptionRow[];
  metrics: MarketMetrics;
}) => void;

export type BrokerStatusListener = (status: BrokerStatus) => void;

/**
 * Calculate the nearest upcoming Tuesday NSE Expiry Date (YYYY-MM-DD)
 */
export function calculateUpcomingExpiryDate(symbol: string = 'NIFTY'): string {
  const d = new Date();
  let targetDay = 2; // Tuesday default for NIFTY & FINNIFTY (NSE weekly expiry)
  if (symbol === 'FINNIFTY' || symbol === 'NIFTY') targetDay = 2; // Tuesday
  else if (symbol === 'BANKNIFTY') targetDay = 3; // Wednesday
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
  let targetDay = 2; // Tuesday default for NIFTY & FINNIFTY
  if (symbol === 'FINNIFTY' || symbol === 'NIFTY') targetDay = 2;
  else if (symbol === 'BANKNIFTY') targetDay = 3;
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
  private spotPrice: number = 22446.65;
  private previousClose: number = 22687.65;
  private openSpotPrice: number = 22580.00;
  private rawData: RawOptionData[] = [];
  private processedRows: ProcessedOptionRow[] = [];
  private listeners: Set<TickListener> = new Set();
  private statusListeners: Set<BrokerStatusListener> = new Set();
  private intervalId: any = null;
  private tickIntervalMs: number = 1000;
  private isRunning: boolean = false;
  private isSimulated: boolean = true;
  private hasSyncedQuoteToday: boolean = false;
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
    // Restore persistent previous day close if saved
    const savedPrevClose = localStorage.getItem('nifty_previous_close');
    if (savedPrevClose) {
      const parsed = parseFloat(savedPrevClose);
      if (!isNaN(parsed) && parsed > 0) {
        this.previousClose = round2(parsed);
      }
    }
    // Restore calibrated spot price if saved
    const savedSpot = localStorage.getItem('nifty_calibrated_spot');
    if (savedSpot) {
      const parsedSpot = parseFloat(savedSpot);
      if (!isNaN(parsedSpot) && parsedSpot > 0) {
        this.spotPrice = round2(parsedSpot);
      }
    }

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
    localStorage.setItem('nifty_calibrated_spot', String(this.spotPrice));
    this.recalculateAll();
  }

  public getPreviousClose(): number {
    return this.previousClose;
  }

  public setPreviousClose(newPrevClose: number): void {
    if (newPrevClose > 0) {
      this.previousClose = round2(newPrevClose);
      localStorage.setItem('nifty_previous_close', String(this.previousClose));
      this.recalculateAll();
    }
  }

  /**
   * Calibrate to official NSE closing price (e.g., between 8:30 PM and 9:30 PM Bhavcopy)
   * Resolves the 0.10 paise difference between 3:30 PM LTP tick and 30-min VWAP close.
   */
  public calibrateToOfficialClose(officialSpot: number, officialPrevClose?: number): void {
    if (officialSpot > 0) {
      this.spotPrice = round2(officialSpot);
      localStorage.setItem('nifty_calibrated_spot', String(this.spotPrice));
    }
    if (officialPrevClose && officialPrevClose > 0) {
      this.previousClose = round2(officialPrevClose);
      localStorage.setItem('nifty_previous_close', String(this.previousClose));
    }
    this.recalculateAll();
  }

  public getOpenSpotPrice(): number {
    return this.openSpotPrice;
  }

  /**
   * Real NSE Market Daily Change: Current Spot - Previous Day Close
   */
  public getSpotChange(): number {
    return round2(this.spotPrice - this.previousClose);
  }

  /**
   * Real NSE Market Daily Change %: (Change / Previous Close) * 100
   */
  public getSpotChangePercent(): number {
    if (!this.previousClose) return 0;
    return round2(((this.spotPrice - this.previousClose) / this.previousClose) * 100);
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

    const envAngelApiKey = (import.meta.env.VITE_ANGEL_API_KEY || '').trim();
    const envAngelClientCode = (import.meta.env.VITE_ANGEL_CLIENT_CODE || '').trim();
    const envAngelJwtToken = (import.meta.env.VITE_ANGEL_JWT_TOKEN || '').trim();

    const saved = localStorage.getItem('nifty_broker_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.brokerConfig = {
          provider: parsed.provider || envProvider,
          apiKey: parsed.apiKey !== undefined ? parsed.apiKey : envToken,
          symbol: parsed.symbol || envSymbol,
          expiryDate: parsed.expiryDate || envExpiry || calculateUpcomingExpiryDate(parsed.symbol || envSymbol),
          enabled: parsed.enabled !== undefined ? parsed.enabled : (envToken ? envEnabled : false),
          proxyUrl: parsed.proxyUrl || '',
          angelApiKey: parsed.angelApiKey || envAngelApiKey,
          angelClientCode: parsed.angelClientCode || envAngelClientCode,
          angelPin: parsed.angelPin || '',
          angelTotp: parsed.angelTotp || '',
          angelJwtToken: parsed.angelJwtToken || envAngelJwtToken,
          angelFeedToken: parsed.angelFeedToken || '',
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
        angelApiKey: envAngelApiKey,
        angelClientCode: envAngelClientCode,
        angelJwtToken: envAngelJwtToken,
      };
    }

    const hasAngelAuth = this.brokerConfig.provider === 'angelone' && (!!this.brokerConfig.angelJwtToken?.trim() || !!this.brokerConfig.angelApiKey?.trim());
    const hasUpstoxAuth = this.brokerConfig.provider === 'upstox' && !!this.brokerConfig.apiKey?.trim();
    this.isSimulated = !(this.brokerConfig.enabled && (hasUpstoxAuth || hasAngelAuth));
    return this.brokerConfig;
  }

  public setBrokerConfig(config: BrokerApiConfig): void {
    this.brokerConfig = config;
    localStorage.setItem('nifty_broker_config', JSON.stringify(config));
    const hasAngelAuth = config.provider === 'angelone' && (!!config.angelJwtToken?.trim() || !!config.angelApiKey?.trim());
    const hasUpstoxAuth = config.provider === 'upstox' && !!config.apiKey?.trim();
    if (config.enabled && (hasUpstoxAuth || hasAngelAuth)) {
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
    const spotChange = this.getSpotChange();
    const spotChangePercent = this.getSpotChangePercent();
    listener({
      spotPrice: this.spotPrice,
      spotChange,
      rows: highlightedRows,
      metrics: {
        ...metrics,
        spotPrice: this.spotPrice,
        spotChange,
        spotChangePercent,
      }
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(rows: ProcessedOptionRow[], metrics: MarketMetrics) {
    const spotChange = this.getSpotChange();
    const spotChangePercent = this.getSpotChangePercent();
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
   * Intraday Trade Engine simulation shock:
   * Forces ATM strike to meet the breakout condition for testing
   */
  public triggerBreakoutShock(type: 'CE' | 'PE'): void {
    if (!this.rawData || this.rawData.length === 0) return;
    let closestIndex = 0;
    let minDiff = Math.abs(this.rawData[0].strike - this.spotPrice);
    for (let i = 1; i < this.rawData.length; i++) {
      const diff = Math.abs(this.rawData[i].strike - this.spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    const atm = this.rawData[closestIndex];
    if (type === 'CE') {
      const prem = (atm.call_low + atm.put_high) / 2;
      const targetClose = round2(Math.max(prem + 15, atm.call_close + 20));
      this.rawData[closestIndex] = {
        ...atm,
        call_close: targetClose,
        call_high: round2(Math.max(atm.call_high, targetClose + 4)),
        call_volume: atm.call_volume + 60000,
      };
    } else {
      const prem = (atm.put_low + atm.call_high) / 2;
      const targetClose = round2(Math.max(prem + 15, atm.put_close + 20));
      this.rawData[closestIndex] = {
        ...atm,
        put_close: targetClose,
        put_high: round2(Math.max(atm.put_high, targetClose + 4)),
        put_volume: atm.put_volume + 60000,
      };
    }

    this.recalculateAll();
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
   * Fetch from External Broker API / Proxy (Upstox, Angel One, Custom Proxy)
   */
  private async fetchBrokerData() {
    if (this.brokerConfig.provider === 'angelone') {
      await this.fetchAngelOneData();
      return;
    }

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

              const callClose = callMd?.close_price ?? callMd?.ltp ?? 0;
              const callLtp = callMd?.ltp ?? callClose;
              const callLow = callMd?.low_price || callClose;
              const callHigh = callMd?.high_price || callClose;

              const putClose = putMd?.close_price ?? putMd?.ltp ?? 0;
              const putLtp = putMd?.ltp ?? putClose;
              const putLow = putMd?.low_price || putClose;
              const putHigh = putMd?.high_price || putClose;

              return {
                strike: Number(item.strike_price ?? item.strike),
                call_low: round2(callLow),
                call_high: round2(callHigh),
                call_close: round2(callClose),
                call_ltp: round2(callLtp),
                call_volume: Number(callMd?.volume || 0),
                call_oi: Number(callMd?.oi || 0),
                call_iv: callGreeks?.iv ? round2(callGreeks.iv) : undefined,
                put_low: round2(putLow),
                put_high: round2(putHigh),
                put_close: round2(putClose),
                put_ltp: round2(putLtp),
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

  /**
   * Fetch from Angel One SmartAPI
   */
  private async fetchAngelOneData() {
    const apiKey = (this.brokerConfig.angelApiKey || this.brokerConfig.apiKey || '').trim();
    const jwtToken = (this.brokerConfig.angelJwtToken || angelOneService.getStoredTokens().jwtToken || '').trim();

    if (!apiKey && !jwtToken) {
      this.updateBrokerStatus({
        connected: false,
        status: 'idle',
        error: 'Angel One SmartAPI Key or JWT Token missing in Settings.',
      });
      this.tickSimulation();
      return;
    }

    try {
      const res = await angelOneService.getNiftySpotQuote(apiKey, jwtToken);
      if (res.success && res.spotPrice) {
        this.spotPrice = round2(res.spotPrice);
        if (res.previousClose && res.previousClose > 0) {
          this.previousClose = round2(res.previousClose);
        }

        this.updateBrokerStatus({
          connected: true,
          status: 'connected',
          spotPrice: this.spotPrice,
          strikesCount: this.rawData.length,
          lastFetchedAt: new Date().toLocaleTimeString(),
          error: undefined,
        });
        this.recalculateAll();
        return;
      } else {
        this.updateBrokerStatus({
          connected: false,
          status: 'error',
          error: `Angel One: ${res.message}`,
        });
      }
    } catch (err: any) {
      this.updateBrokerStatus({
        connected: false,
        status: 'error',
        error: `Angel One fetch error: ${err.message}`,
      });
    }

    this.tickSimulation();
  }

  /**
   * Apply exact live snapshot from Angel One Market details (Spot 22,634.20)
   */
  public applyAngelOneSnapshot(): void {
    this.spotPrice = 22634.20;
    this.previousClose = 22749.75;
    localStorage.setItem('nifty_calibrated_spot', '22634.20');
    localStorage.setItem('nifty_previous_close', '22749.75');

    // Official data points visible on Angel One live option chain
    const angelStrikes: RawOptionData[] = [
      { strike: 22350, call_low: 350.00, call_high: 375.00, call_close: 359.30, call_ltp: 359.30, call_volume: 1406000, call_oi: 105000, put_low: 80.00, put_high: 95.00, put_close: 86.30, put_ltp: 86.30, put_volume: 25700000, put_oi: 1666000 },
      { strike: 22400, call_low: 315.00, call_high: 340.00, call_close: 324.05, call_ltp: 324.05, call_volume: 7949000, call_oi: 968000, put_low: 95.00, put_high: 110.00, put_close: 101.00, put_ltp: 101.00, put_volume: 54900000, put_oi: 4227000 },
      { strike: 22450, call_low: 280.00, call_high: 305.00, call_close: 289.65, call_ltp: 289.65, call_volume: 6562000, call_oi: 509000, put_low: 110.00, put_high: 125.00, put_close: 116.80, put_ltp: 116.80, put_volume: 34800000, put_oi: 1806000 },
      { strike: 22500, call_low: 248.00, call_high: 270.00, call_close: 257.25, call_ltp: 257.25, call_volume: 48900000, call_oi: 3470000, put_low: 128.00, put_high: 145.00, put_close: 134.90, put_ltp: 134.90, put_volume: 100200000, put_oi: 7268000 },
      { strike: 22550, call_low: 220.00, call_high: 240.00, call_close: 227.60, call_ltp: 227.60, call_volume: 52200000, call_oi: 2900000, put_low: 148.00, put_high: 165.00, put_close: 155.40, put_ltp: 155.40, put_volume: 70600000, put_oi: 3651000 },
      { strike: 22600, call_low: 192.00, call_high: 215.00, call_close: 199.85, call_ltp: 199.85, call_volume: 121000000, call_oi: 8153000, put_low: 170.00, put_high: 190.00, put_close: 177.50, put_ltp: 177.50, put_volume: 104100000, put_oi: 7440000 },
      { strike: 22650, call_low: 168.00, call_high: 188.00, call_close: 174.05, call_ltp: 174.05, call_volume: 55100000, call_oi: 3568000, put_low: 195.00, put_high: 215.00, put_close: 201.80, put_ltp: 201.80, put_volume: 33700000, put_oi: 1857000 },
      { strike: 22700, call_low: 145.00, call_high: 162.00, call_close: 150.65, call_ltp: 150.65, call_volume: 75300000, call_oi: 8649000, put_low: 220.00, put_high: 240.00, put_close: 228.30, put_ltp: 228.30, put_volume: 37400000, put_oi: 4232000 },
      { strike: 22750, call_low: 122.00, call_high: 138.00, call_close: 128.80, call_ltp: 128.80, call_volume: 31900000, call_oi: 2744000, put_low: 248.00, put_high: 268.00, put_close: 255.20, put_ltp: 255.20, put_volume: 77490000, put_oi: 788000 },
      { strike: 22800, call_low: 104.00, call_high: 118.00, call_close: 109.60, call_ltp: 109.60, call_volume: 58000000, call_oi: 7217000, put_low: 278.00, put_high: 298.00, put_close: 286.60, put_ltp: 286.60, put_volume: 11400000, put_oi: 2697000 },
      { strike: 22850, call_low: 88.00, call_high: 100.00, call_close: 92.35, call_ltp: 92.35, call_volume: 25400000, call_oi: 2489000, put_low: 310.00, put_high: 330.00, put_close: 318.50, put_ltp: 318.50, put_volume: 16300000, put_oi: 276000 },
      { strike: 22900, call_low: 72.00, call_high: 84.00, call_close: 77.05, call_ltp: 77.05, call_volume: 35300000, call_oi: 4485000, put_low: 345.00, put_high: 365.00, put_close: 353.95, put_ltp: 353.95, put_volume: 22290000, put_oi: 741000 },
    ];

    this.rawData = angelStrikes;
    this.updateBrokerStatus({
      connected: true,
      status: 'connected',
      spotPrice: this.spotPrice,
      strikesCount: angelStrikes.length,
      lastFetchedAt: 'Angel One Live Snapshot (Synced)',
      error: undefined,
    });
    this.recalculateAll();
  }

  /**
   * Sync official spot price and previous day close directly from broker (Upstox / Angel One) quote
   */
  public async syncBrokerQuote(): Promise<{
    success: boolean;
    spotPrice?: number;
    previousClose?: number;
    spotChange?: number;
    spotChangePercent?: number;
    message: string;
  }> {
    if (this.brokerConfig.provider === 'angelone') {
      const apiKey = (this.brokerConfig.angelApiKey || this.brokerConfig.apiKey || '').trim();
      const jwtToken = (this.brokerConfig.angelJwtToken || angelOneService.getStoredTokens().jwtToken || '').trim();
      const res = await angelOneService.getNiftySpotQuote(apiKey, jwtToken);
      if (res.success && res.spotPrice) {
        this.setSpotPrice(res.spotPrice);
        if (res.previousClose) {
          this.setPreviousClose(res.previousClose);
        }
        return {
          success: true,
          spotPrice: this.spotPrice,
          previousClose: this.previousClose,
          spotChange: this.getSpotChange(),
          spotChangePercent: this.getSpotChangePercent(),
          message: res.message,
        };
      }
      return { success: false, message: res.message };
    }

    const token = this.brokerConfig.apiKey?.trim();
    if (!token) {
      return { success: false, message: 'Broker API token is not configured.' };
    }

    const symbolKey = this.brokerConfig.symbol === 'BANKNIFTY' ? 'NSE_INDEX|Nifty Bank' : 'NSE_INDEX|Nifty 50';
    const quoteUrl = `/api/upstox/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbolKey)}`;

    try {
      const res = await fetch(quoteUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json();
        const dataObj = json.data || {};
        const keys = Object.keys(dataObj);
        if (keys.length > 0) {
          const item = dataObj[keys[0]];
          const lastPrice = item?.last_price;
          const prevClose = item?.ohlc?.close;

          if (prevClose && Number(prevClose) > 0) {
            this.setPreviousClose(Number(prevClose));
          }
          if (lastPrice && Number(lastPrice) > 0) {
            this.setSpotPrice(Number(lastPrice));
          }

          this.hasSyncedQuoteToday = true;

          return {
            success: true,
            spotPrice: this.spotPrice,
            previousClose: this.previousClose,
            spotChange: this.getSpotChange(),
            spotChangePercent: this.getSpotChangePercent(),
            message: `Synced with Upstox: Spot ₹${this.spotPrice}, Prev Close ₹${this.previousClose} (${this.getSpotChange()} pts / ${this.getSpotChangePercent()}%)`,
          };
        }
      }
      return { success: false, message: `Broker quote returned status ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to sync broker quote' };
    }
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
  if (config.provider === 'angelone') {
    const apiKey = (config.angelApiKey || config.apiKey || '').trim();
    const jwtToken = (config.angelJwtToken || angelOneService.getStoredTokens().jwtToken || '').trim();
    if (!apiKey && !jwtToken) {
      return {
        success: false,
        message: 'Angel One SmartAPI Key or JWT Token is required. Please enter credentials or log in with TOTP.',
      };
    }
    try {
      const res = await angelOneService.getNiftySpotQuote(apiKey, jwtToken);
      if (res.success && res.spotPrice) {
        return {
          success: true,
          statusCode: 200,
          spotPrice: res.spotPrice,
          message: `✓ Connected to Angel One SmartAPI successfully! Nifty Spot: ₹${res.spotPrice.toLocaleString('en-IN')}, Prev Close: ₹${res.previousClose?.toLocaleString('en-IN')}`,
        };
      }
      return {
        success: false,
        message: `Angel One connection failed: ${res.message}`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Angel One connection error: ${e.message}`,
      };
    }
  }

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
