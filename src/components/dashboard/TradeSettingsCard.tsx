import React, { useState } from 'react';
import { 
  Sliders, 
  ShieldAlert, 
  Target, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Info,
  CheckCircle2
} from 'lucide-react';
import type { TradeSettings } from '../../types/optionChain';
import { DEFAULT_TRADE_SETTINGS } from '../../utils/tradeEngine';

interface TradeSettingsCardProps {
  settings: TradeSettings;
  onUpdateSettings: (newSettings: TradeSettings) => void;
}

export const TradeSettingsCard: React.FC<TradeSettingsCardProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [saveToast, setSaveToast] = useState<boolean>(false);

  const handleMaxSlChange = (val: number) => {
    const clamped = Math.max(1, Math.min(100, Math.round(val * 10) / 10));
    onUpdateSettings({ ...settings, maxSlPoints: clamped });
    flashToast();
  };

  const handleRrChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(10, Math.round(val * 10) / 10));
    onUpdateSettings({ ...settings, riskRewardRatio: clamped });
    flashToast();
  };

  const handleResetDefaults = () => {
    onUpdateSettings(DEFAULT_TRADE_SETTINGS);
    flashToast();
  };

  const flashToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 1500);
  };

  const slPresets = [5, 8, 10, 15, 20];
  const rrPresets = [
    { label: '1:1', ratio: 1 },
    { label: '1:1.5', ratio: 1.5 },
    { label: '1:2 (Default)', ratio: 2 },
    { label: '1:2.5', ratio: 2.5 },
    { label: '1:3', ratio: 3 },
  ];

  return (
    <div className="w-full mb-3 bg-white dark:bg-[#0c101c] rounded-xl border border-slate-200 dark:border-slate-800 shadow-md transition-all font-mono text-xs">
      {/* Settings Card Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0e1424]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
            Global Trade Settings (Admin Panel)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold hidden sm:inline-block">
            Strict 1:2 R:R Engine
          </span>
          {saveToast && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fadeIn">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            title="Reset to default settings (Max SL: 10 pts, R:R: 1:2)"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Settings' : 'Expand Settings'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content Body */}
      {isExpanded && (
        <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-950/30">
          {/* Setting 1: Max SL Points */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <label className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Max SL Points
                </label>
              </div>
              <span className="text-[11px] text-slate-500 font-sans">Default: 10 pts</span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Caps maximum trade risk. If calculated premium spread exceeds this, SL is clamped to <code className="text-rose-500 font-bold">Entry - Max SL</code>.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMaxSlChange(settings.maxSlPoints - 1)}
                className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center justify-center text-sm"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={settings.maxSlPoints}
                onChange={(e) => handleMaxSlChange(parseFloat(e.target.value) || 1)}
                className="w-20 px-2 py-1 text-center font-bold text-sm bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <button
                onClick={() => handleMaxSlChange(settings.maxSlPoints + 1)}
                className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center justify-center text-sm"
              >
                +
              </button>
              <span className="text-slate-500 text-xs">points</span>
            </div>

            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {slPresets.map((pts) => (
                <button
                  key={pts}
                  onClick={() => handleMaxSlChange(pts)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    settings.maxSlPoints === pts
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {pts} pts {pts === 10 ? '★' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Setting 2: Risk-to-Reward Ratio */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-500" />
                <label className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Risk-to-Reward Ratio
                </label>
              </div>
              <span className="text-[11px] text-slate-500 font-sans">Default: 1:2</span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Automated target formula: <code className="text-emerald-500 font-bold">Entry + (Risk * R:R)</code>. Strict 1:2 ratio multiplies risk points by 2.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold">1 :</span>
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={settings.riskRewardRatio}
                onChange={(e) => handleRrChange(parseFloat(e.target.value) || 1)}
                className="w-20 px-2 py-1 text-center font-bold text-sm bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-slate-500 text-xs">Multiplier</span>
            </div>

            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {rrPresets.map((p) => (
                <button
                  key={p.ratio}
                  onClick={() => handleRrChange(p.ratio)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    settings.riskRewardRatio === p.ratio
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Engine Rules Card */}
          <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 shadow-xs flex flex-col justify-between space-y-2 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Intraday Breakout Rules</span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">CE:</span>
                <span>Trigger if <strong className="text-slate-900 dark:text-white">call_close &gt; call_avg</strong> AND <strong className="text-slate-900 dark:text-white">&gt; call_premium</strong> on ATM/ITM.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-rose-500 font-bold">PE:</span>
                <span>Trigger if <strong className="text-slate-900 dark:text-white">put_close &gt; put_avg</strong> AND <strong className="text-slate-900 dark:text-white">&gt; put_premium</strong> on ATM/ITM.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold">SL:</span>
                <span>Higher of Premium or (Entry - {settings.maxSlPoints} pts).</span>
              </div>
            </div>

            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/50 p-1.5 rounded font-mono">
              Live Target Formula: Entry + (Risk × {settings.riskRewardRatio})
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
