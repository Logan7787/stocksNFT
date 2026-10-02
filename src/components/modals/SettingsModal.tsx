import React, { useState } from 'react';
import { 
  X, 
  Database, 
  Server, 
  Zap, 
  Sliders, 
  CheckCircle2, 
  Save
} from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, getSupabase } from '../../services/supabaseClient';
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
  const [activeTab, setActiveTab] = useState<'supabase' | 'broker' | 'simulation'>('supabase');

  // Supabase state
  const creds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(creds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(creds.anonKey);
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);

  // Broker config state
  const [broker, setBroker] = useState<BrokerApiConfig>({ ...brokerConfig });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Spot shock state
  const [testSpot, setTestSpot] = useState(spotPrice);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

  const handleSaveBroker = () => {
    onSaveBrokerConfig(broker);
    showToast('Broker API settings saved!');
  };

  const handleApplySpotShock = () => {
    onSetSpotPrice(testSpot);
    showToast(`Spot price updated to ${testSpot.toFixed(2)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0f1523] border border-slate-300 dark:border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-xl text-cyan-600 dark:text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">System Settings & Data Feeds</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure database, broker integrations, and engine speed</p>
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
            onClick={() => setActiveTab('broker')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'broker'
                ? 'border-cyan-500 text-cyan-700 dark:text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Broker Live API / Proxy</span>
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
            <span>Engine & Spot Tester</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-800 dark:text-slate-200">
          {toastMessage && (
            <div className="p-3 bg-cyan-50 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300 text-xs rounded-xl flex items-center gap-2 font-mono shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 1. Supabase Tab */}
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

          {/* 2. Broker API Tab */}
          {activeTab === 'broker' && (
            <div className="space-y-4 font-mono text-xs">
              <p className="text-slate-600 dark:text-slate-300 font-sans text-xs">
                Connect external live brokers or custom NSE Proxy servers. When disabled, the zero-lag high-frequency market simulator runs automatically.
              </p>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="brokerEnabled"
                  checked={broker.enabled}
                  onChange={(e) => setBroker({ ...broker, enabled: e.target.checked })}
                  className="w-4 h-4 text-cyan-500 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-cyan-500 cursor-pointer"
                />
                <label htmlFor="brokerEnabled" className="text-slate-900 dark:text-white font-bold cursor-pointer">
                  Enable Live Broker Feed (Upstox / Dhan / AngelOne / Proxy)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                    Broker Provider
                  </label>
                  <select
                    value={broker.provider}
                    onChange={(e) => setBroker({ ...broker, provider: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="custom_proxy">Custom NSE / Node.js Proxy</option>
                    <option value="upstox">Upstox API v2</option>
                    <option value="dhan">Dhan HQ Feed</option>
                    <option value="angelone">AngelOne SmartAPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={broker.symbol}
                    onChange={(e) => setBroker({ ...broker, symbol: e.target.value })}
                    placeholder="NIFTY"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                  Broker API Key / Access Token
                </label>
                <input
                  type="password"
                  value={broker.apiKey}
                  onChange={(e) => setBroker({ ...broker, apiKey: e.target.value })}
                  placeholder="API Key or Bearer Token"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">
                  Proxy REST URL / WebSocket URL
                </label>
                <input
                  type="text"
                  value={broker.proxyUrl || ''}
                  onChange={(e) => setBroker({ ...broker, proxyUrl: e.target.value })}
                  placeholder="https://api.myoptionproxy.com/nifty/chain"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveBroker}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Broker Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Engine & Spot Tester Tab */}
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
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex justify-end">
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
