import type { RawOptionData, BrokerApiConfig, BrokerStatus } from '../types/optionChain';
import { round2 } from '../utils/formulas';

export interface AngelLoginResponse {
  success: boolean;
  jwtToken?: string;
  feedToken?: string;
  refreshToken?: string;
  message: string;
}

export interface AngelQuoteItem {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  percentChange?: number;
  netChange?: number;
  totalTradedVolume?: number;
  opnInterest?: number;
}

const DEFAULT_ANGEL_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-UserType': 'USER',
  'X-SourceID': 'WEB',
  'X-ClientLocalIP': '192.168.1.1',
  'X-ClientPublicIP': '106.193.147.98',
  'X-MACAddress': 'fe80::216e:6507:4b83:30c6',
};

/**
 * Angel One SmartAPI Integration Service
 */
export class AngelOneService {
  private static instance: AngelOneService;
  private jwtToken: string = '';
  private feedToken: string = '';

  private constructor() {
    this.jwtToken = localStorage.getItem('angel_jwt_token') || '';
    this.feedToken = localStorage.getItem('angel_feed_token') || '';
  }

  public static getInstance(): AngelOneService {
    if (!AngelOneService.instance) {
      AngelOneService.instance = new AngelOneService();
    }
    return AngelOneService.instance;
  }

  public getStoredTokens(): { jwtToken: string; feedToken: string } {
    return {
      jwtToken: this.jwtToken,
      feedToken: this.feedToken,
    };
  }

  public setJwtToken(token: string, feedToken: string = ''): void {
    this.jwtToken = token.trim().startsWith('Bearer ') ? token.trim() : `Bearer ${token.trim()}`;
    this.feedToken = feedToken.trim();
    localStorage.setItem('angel_jwt_token', this.jwtToken);
    if (this.feedToken) {
      localStorage.setItem('angel_feed_token', this.feedToken);
    }
  }

  public clearTokens(): void {
    this.jwtToken = '';
    this.feedToken = '';
    localStorage.removeItem('angel_jwt_token');
    localStorage.removeItem('angel_feed_token');
  }

  /**
   * Resilient request executor:
   * 1. Attempts `/api/angelone${endpointPath}` (Vite dev proxy / Vercel rewrite)
   * 2. Automatically falls back to direct `https://apiconnect.angelone.in${endpointPath}`
   *    if the proxy returns HTML, 404/405, or network error (Angel One supports CORS natively)
   */
  private async executeAngelRequest(
    endpointPath: string,
    options: RequestInit
  ): Promise<{ ok: boolean; status: number; json: any; rawText: string }> {
    const urls = [
      `/api/angelone${endpointPath}`,
      `https://apiconnect.angelone.in${endpointPath}`,
    ];

    let lastError: any = null;
    let lastStatus = 0;
    let lastText = '';

    for (const url of urls) {
      try {
        const response = await fetch(url, options);
        lastStatus = response.status;
        const text = await response.text();
        lastText = text;

        if (text && text.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            return {
              ok: response.ok,
              status: response.status,
              json: parsed,
              rawText: text,
            };
          } catch {
            // Invalid JSON, try fallback url
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError && !lastText) {
      throw lastError;
    }

    return {
      ok: false,
      status: lastStatus,
      json: null,
      rawText: lastText,
    };
  }

  /**
   * Log in to Angel One SmartAPI using client credentials:
   * Client Code, Password/MPIN, TOTP, and SmartAPI Key
   */
  public async login(
    apiKey: string,
    clientCode: string,
    pinOrPassword: string,
    totp: string
  ): Promise<AngelLoginResponse> {
    if (!apiKey?.trim() || !clientCode?.trim() || !pinOrPassword?.trim() || !totp?.trim()) {
      return {
        success: false,
        message: 'Please provide SmartAPI Key, Client Code, MPIN/Password, and 6-digit TOTP.',
      };
    }

    try {
      const { ok, status, json, rawText } = await this.executeAngelRequest(
        '/rest/auth/angelbroking/user/v1/loginByPassword',
        {
          method: 'POST',
          headers: {
            ...DEFAULT_ANGEL_HEADERS,
            'X-PrivateKey': apiKey.trim(),
          },
          body: JSON.stringify({
            clientcode: clientCode.trim(),
            password: pinOrPassword.trim(),
            totp: totp.trim(),
          }),
        }
      );

      if (json && json.status && json.data) {
        const rawJwt = json.data.jwtToken || '';
        const token = rawJwt.startsWith('Bearer ') ? rawJwt : `Bearer ${rawJwt}`;
        const feed = json.data.feedToken || '';
        const refresh = json.data.refreshToken || '';

        this.setJwtToken(token, feed);

        return {
          success: true,
          jwtToken: token,
          feedToken: feed,
          refreshToken: refresh,
          message: 'Angel One login successful! Active session token generated.',
        };
      } else {
        const errorMsg = json?.message || json?.errorcode || (rawText ? rawText.slice(0, 140) : `HTTP ${status}`);
        return {
          success: false,
          message: `Angel One login failed: ${errorMsg}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Network error connecting to Angel One API: ${err.message || 'Please check connection / credentials'}`,
      };
    }
  }

  /**
   * Fetch Live Market Quote from Angel One for NIFTY Index & Strikes
   */
  public async getMarketQuote(
    apiKey: string,
    exchangeTokens: { [exchange: string]: string[] },
    tokenOverride?: string
  ): Promise<{ success: boolean; data?: AngelQuoteItem[]; message: string }> {
    const authHeader = tokenOverride?.trim() || this.jwtToken;
    if (!authHeader) {
      return { success: false, message: 'Angel One JWT Token is missing. Please login or enter token.' };
    }
    if (!apiKey) {
      return { success: false, message: 'Angel One API Key is missing.' };
    }

    try {
      const { ok, status, json, rawText } = await this.executeAngelRequest(
        '/rest/secure/angelbroking/market/v1/quote/',
        {
          method: 'POST',
          headers: {
            ...DEFAULT_ANGEL_HEADERS,
            'Authorization': authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`,
            'X-PrivateKey': apiKey.trim(),
          },
          body: JSON.stringify({
            mode: 'FULL',
            exchangeTokens,
          }),
        }
      );

      if (json && json.status && json.data) {
        const fetched = json.data.fetched || [];
        return {
          success: true,
          data: fetched,
          message: `Fetched ${fetched.length} quote items from Angel One.`,
        };
      } else {
        return {
          success: false,
          message: json?.message || (rawText ? rawText.slice(0, 140) : `Angel One Quote error (${status})`),
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Error fetching Angel One quote: ${err.message}`,
      };
    }
  }

  /**
   * Fetch NIFTY 50 Spot Details (Spot Price, Previous Close, Change)
   */
  public async getNiftySpotQuote(apiKey: string, tokenOverride?: string): Promise<{
    success: boolean;
    spotPrice?: number;
    previousClose?: number;
    spotChange?: number;
    spotChangePercent?: number;
    message: string;
  }> {
    // 99926000 is Angel One's standard Nifty 50 Index token on NSE
    const result = await this.getMarketQuote(apiKey, { 'NSE': ['99926000', '26000'] }, tokenOverride);
    if (!result.success || !result.data || result.data.length === 0) {
      return {
        success: false,
        message: result.message || 'Unable to retrieve Nifty Spot from Angel One.',
      };
    }

    const item = result.data[0];
    const spot = round2(item.ltp || item.close);
    const prevClose = round2(item.close || (item.ltp - (item.netChange || 0)));
    const change = round2(item.netChange ?? (spot - prevClose));
    const changePct = round2(item.percentChange ?? (prevClose > 0 ? (change / prevClose) * 100 : 0));

    return {
      success: true,
      spotPrice: spot,
      previousClose: prevClose,
      spotChange: change,
      spotChangePercent: changePct,
      message: `Nifty Spot: ₹${spot} (${change > 0 ? '+' : ''}${change})`,
    };
  }
}

export const angelOneService = AngelOneService.getInstance();
