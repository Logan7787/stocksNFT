import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Server, 
  Zap, 
  Sliders, 
  CheckCircle2, 
  Save,
  RefreshCw,
  AlertCircle,
  Key,
  Calendar,
  Layers,
  FileCode
} from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, getSupabase } from '../../services/supabaseClient';
import { testBrokerConnection, fetchUpstoxExpiryDates, calculateUpcomingExpiryDate } from '../../services/niftyApi';
import type { BrokerApiConfig } from '../../types/optionChain';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerConfig: BrokerApiConfig;
  onSaveBrokerConfig: (config: BrokerApiConfig) => void;
  tickInterval: number;
  onSetTickInterval: (ms: number) => void;
  spotPrice: number;
  onSetSpotPrice: (price: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  brokerConfig,
  onSaveBrokerConfig,
  tickInterval,
  onSetTickInterval,
  spotPrice,
  onSetSpotPrice,
}) => {
  const [activeTab, setActiveTab] = useState<'broker' | 'supabase' | 'simulation'>('broker');

  // Supabase state
  const creds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(creds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(creds.anonKey);
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);

  // Broker config state
  const [broker, setBroker] = useState<BrokerApiConfig>({ ...brokerConfig });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTestingBroker, setIsTestingBroker] = useState<boolean>(false);
  const [isFetchingExpiries, setIsFetchingExpiries] = useState<boolean>(false);
  const [availableExpiries, setAvailableExpiries] = useState<string[]>([]);
  const [brokerTestResult, setBrokerTestResult] = useState<{
    success: boolean;
    message: string;
    spotPrice?: number;
    strikesCount?: number;
    urlUsed?: string;
    availableExpiries?: string[];
  } | null>(null);

  // Spot shock state
  const [testSpot, setTestSpot] = useState(spotPrice);

  const envToken = (import.meta.env.VITE_UPSTOX_ACCESS_TOKEN || import.meta.env.VITE_BROKER_ACCESS_TOKEN || '').trim();

  // Load available live expiries whenever modal opens or API key / symbol changes
  useEffect(() => {
    if (!isOpen) return;
    setBroker({ ...brokerConfig });
    loadExpiries(brokerConfig.apiKey || envToken, brokerConfig.symbol || 'NIFTY');
  }, [isOpen, brokerConfig]);

  const loadExpiries = async (key: string, symbol: string) => {
    setIsFetchingExpiries(true);
    try {
      const dates = await fetchUpstoxExpiryDates(key, symbol);
      setAvailableExpiries(dates);
      // If current expiryDate is empty or expired, set to nearest valid date
      if (dates.length > 0 && (!broker.expiryDate || !dates.includes(broker.expiryDate))) {
        setBroker(prev => ({ ...prev, expiryDate: dates[0] }));
      }
    } catch (e) {
      console.warn('Failed to fetch expiries:', e);
    } finally {
      setIsFetchingExpiries(false);
    }
  };

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTestBroker = async () => {
    setIsTestingBroker(true);
    setBrokerTestResult(null);
    try {
      const res = await testBrokerConnection(broker);
      setBrokerTestResult(res);
      if (res.availableExpiries && res.availableExpiries.length > 0) {
        setAvailableExpiries(res.availableExpiries);
      }
      if (res.success && res.spotPrice) {
        showToast(`Connected! Spot: ₹${res.spotPrice}`);
      }
    } catch (err: any) {
      setBrokerTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsTestingBroker(false);
    }
  };

  const handleResetToEnv = () => {
    if (!envToken) {
      showToast('No VITE_UPSTOX_ACCESS_TOKEN defined in .env');
      return;
    }
    const defaultExpiry = calculateUpcomingExpiryDate(broker.symbol || 'NIFTY');
    setBroker(prev => ({
      ...prev,
      apiKey: envToken,
      enabled: true,
      expiryDate: defaultExpiry,
    }));
    loadExpiries(envToken, broker.symbol || 'NIFTY');
    showToast('Loaded Access Token from .env!');
  };

  const handleSaveBroker = () => {
    onSaveBrokerConfig(broker);
    showToast(broker.enabled ? 'Live Broker Settings Saved & Activated!' : 'Broker Settings Saved (Simulator Active)');
  };

  const handleSaveSupabase = async () => {
    saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client.from('market_snapshots').select('id').limit(1);
        if (error) {
          setSupabaseStatus(`Connected to Supabase, but query error: ${error.message}`);
        } else {
          setSupabaseStatus('✓ Connected to Supabase PostgreSQL successfully!');
        }
      } catch (err: any) {
        setSupabaseStatus(`Connection error: ${err.message}`);
      }
    } else {
      setSupabaseStatus('No Supabase credentials configured.');
    }
    showToast('Supabase settings updated!');
  };

  const handleApplySpotShock = () => {
    onSetSpotPrice(testSpot);
    showToast(`Spot price updated to ${testSpot.toFixed(2)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0f1523] border border-slate-300 dark:border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-xl text-cyan-600 dark:text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">System Settings & Live Data Feeds</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure broker access token, live expiry date, and database sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('broker')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'broker'
                ? 'border-cyan-500 text-cyan-700 dark:text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Broker Live API (Upstox)</span>
          </button>

          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'supabase'
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Supabase PostgreSQL</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'simulation'
                ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Engine & Simulator</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-800 dark:text-slate-200">
          {toastMessage && (
            <div className="p-3 bg-cyan-50 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300 text-xs rounded-xl flex items-center gap-2 font-mono shadow-sm animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 1. Broker API Tab */}
          {activeTab === 'broker' && (
            <div className="space-y-4 font-mono text-xs">
              {/* Token Expiry Info Card */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-700/50 rounded-xl text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="font-sans text-[11px] leading-relaxed">
                  <strong>Upstox Daily Token Policy:</strong> Upstox access tokens are valid for 24 hours and reset daily at <strong>3:30 AM IST</strong>. 
                  You can set <code className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded text-blue-800 dark:text-blue-200">VITE_UPSTOX_ACCESS_TOKEN</code> in your <code className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded text-blue-800 dark:text-blue-200">.env</code> file so that every device automatically loads the active token without needing to paste it manually.
                </div>
              </div>

              {/* Enable Live Checkbox */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="brokerEnabled"
                    checked={broker.enabled}
                    onChange={(e) => setBroker({ ...broker, enabled: e.target.checked })}
                    className="w-4 h-4 text-cyan-500 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="brokerEnabled" className="text-slate-900 dark:text-white font-bold cursor-pointer select-none">
                    Enable Live Broker Feed (Upstox API v2)
                  </label>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  broker.enabled 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' 
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {broker.enabled ? 'Live Mode Active' : 'Simulator Mode'}
                </span>
              </div>

              {/* Provider & Symbol */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                    Broker Provider
                  </label>
                  <select
                    value={broker.provider}
                    onChange={(e) => {
                      const prov = e.target.value as any;
                      setBroker({ ...broker, provider: prov });
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="upstox">Upstox API v2 (Official)</option>
                    <option value="custom_proxy">Custom NSE / Node.js Proxy</option>
                    <option value="dhan">Dhan HQ Feed</option>
                    <option value="angelone">AngelOne SmartAPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                    Symbol / Instrument
                  </label>
                  <select
                    value={broker.symbol || 'NIFTY'}
                    onChange={(e) => {
                      const sym = e.target.value;
                      setBroker({ ...broker, symbol: sym, expiryDate: calculateUpcomingExpiryDate(sym) });
                      loadExpiries(broker.apiKey, sym);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="NIFTY">NIFTY 50 (NSE_INDEX|Nifty 50)</option>
                    <option value="BANKNIFTY">BANK NIFTY (NSE_INDEX|Nifty Bank)</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                    Target Option Expiry Date (YYYY-MM-DD)
                  </label>
                  {isFetchingExpiries && (
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Fetching live expiries...
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={broker.expiryDate || calculateUpcomingExpiryDate(broker.symbol || 'NIFTY')}
                      onChange={(e) => setBroker({ ...broker, expiryDate: e.target.value })}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => loadExpiries(broker.apiKey, broker.symbol || 'NIFTY')}
                      title="Refresh Available Expiries from Upstox"
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingExpiries ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Available Live Expiry Date Quick-Pills */}
                  {availableExpiries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-sans">Active Upstox Expiries:</span>
                      {availableExpiries.slice(0, 5).map((exp, idx) => (
                        <button
                          key={exp}
                          type="button"
                          onClick={() => setBroker({ ...broker, expiryDate: exp })}
                          className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer ${
                            broker.expiryDate === exp
                              ? 'bg-cyan-500 text-black shadow-xs'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {exp} {idx === 0 ? '(Current)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Must match the exact active option contract expiry date in Upstox (e.g. <code>{availableExpiries[0] || calculateUpcomingExpiryDate('NIFTY')}</code>).
                </p>
              </div>

              {/* Broker Access Token / API Key */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-500" />
                    Upstox Access Token
                  </label>
                  {envToken && (
                    <button
                      type="button"
                      onClick={handleResetToEnv}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <FileCode className="w-3 h-3" /> Load from .env
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="password"
                    value={broker.apiKey || ''}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      setBroker({ ...broker, apiKey: newKey });
                    }}
                    placeholder="Paste Upstox Access Token here (or set in .env file)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 pr-10"
                  />
                  {envToken && broker.apiKey === envToken && (
                    <span className="absolute right-3 top-2.5 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-bold border border-emerald-300 dark:border-emerald-800">
                      .env
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  💡 In Upstox Developer Portal &gt; My Apps &gt; click <strong>Generate Access Token</strong>, authenticate with OTP, and paste the generated token here.
                </p>
              </div>

              {/* Custom Proxy REST URL */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                  Custom Proxy REST URL (Optional)
                </label>
                <input
                  type="text"
                  value={broker.proxyUrl || ''}
                  onChange={(e) => setBroker({ ...broker, proxyUrl: e.target.value })}
                  placeholder="Leave blank for automatic local Vite proxy (/api/upstox)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                {broker.proxyUrl && broker.proxyUrl.includes('pro.upstox.com') && (
                  <p className="text-[11px] text-amber-500 mt-1 font-bold">
                    ⚠️ Note: <code>pro.upstox.com</code> is a web page URL. The app will automatically convert this to the official Upstox JSON API. You can leave this field empty.
                  </p>
                )}
              </div>

              {/* Diagnostic Test Results Box */}
              {brokerTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-mono space-y-1.5 animate-fadeIn ${
                    brokerTestResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600/50 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-600/50 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{brokerTestResult.success ? '✓ Live Connection Verified' : '✕ Connection Test Failed'}</span>
                  </div>
                  <div className="leading-relaxed">{brokerTestResult.message}</div>
                  {brokerTestResult.urlUsed && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      Target Endpoint: {brokerTestResult.urlUsed}
                    </div>
                  )}
                </div>
              )}

              {/* Buttons: Test Connection & Save Settings */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestBroker}
                  disabled={isTestingBroker}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 text-amber-500 ${isTestingBroker ? 'animate-spin' : ''}`} />
                  <span>{isTestingBroker ? 'Testing Live Connection...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveBroker}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Broker Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Supabase Tab */}
          {activeTab === 'supabase' && (
            <div className="space-y-4 font-mono text-xs">
              <p className="text-slate-600 dark:text-slate-300 font-sans text-xs">
                Configure your verified Supabase project credentials to authenticate users and persist hourly market snapshots securely into PostgreSQL.
              </p>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              {supabaseStatus && (
                <div className="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-300 text-[11px]">
                  {supabaseStatus}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={handleSaveSupabase}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Supabase Configuration</span>
                </button>
              </div>

              <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 font-sans">
                <strong className="text-slate-900 dark:text-white block mb-1">Database Setup Note:</strong>
                Run the SQL script located in <code className="text-emerald-700 dark:text-emerald-400 bg-slate-200 dark:bg-slate-950 px-1 py-0.5 rounded">supabase/schema.sql</code> in your Supabase SQL Editor to create the tables.
              </div>
            </div>
          )}

          {/* 3. Engine & Simulator Tab */}
          {activeTab === 'simulation' && (
            <div className="space-y-5 font-mono text-xs">
              <div>
                <label className="block text-slate-800 dark:text-slate-300 font-bold uppercase tracking-wider mb-2">
                  Tick Refresh Interval (Zero-Lag Engine)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[250, 500, 1000, 2000].map((ms) => (
                    <button
                      key={ms}
                      onClick={() => onSetTickInterval(ms)}
                      className={`py-2 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        tickInterval === ms
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spot Price Shock Slider */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-300 font-bold uppercase">Simulate Spot Price Shift (Stress Test)</span>
                  <span className="text-base font-black text-cyan-600 dark:text-cyan-400">{testSpot.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={22000}
                  max={23200}
                  step={10}
                  value={testSpot}
                  onChange={(e) => setTestSpot(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>22000 (Oversold)</span>
                  <span>22600 (Current Range)</span>
                  <span>23200 (Overbought)</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleApplySpotShock}
                    className="px-3 py-1.5 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 cursor-pointer shadow-sm"
                  >
                    Apply Spot Price
                  </button>
                  <button
                    onClick={() => {
                      setTestSpot(22620.45);
                      onSetSpotPrice(22620.45);
                    }}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Reset (22620.45)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            {broker.enabled ? '🟢 Live Broker Feed Enabled' : '🟡 Simulator Engine Active'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
