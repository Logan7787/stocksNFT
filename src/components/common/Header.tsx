import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Settings, 
  LogOut, 
  Play, 
  Pause, 
  Save, 
  HelpCircle, 
  Radio, 
  Calendar, 
  Layers,
  History,
  Sun,
  Moon
} from 'lucide-react';
import { HOURLY_SLOTS } from '../../services/snapshotService';
import type { MarketSnapshotRecord, ConnectionMode } from '../../types/optionChain';

interface HeaderProps {
  spotPrice: number;
  spotChange: number;
  spotChangePercent: number;
  selectedDate: string;
  selectedSlot: string; // 'LIVE' or '09:15', '10:15', etc.
  onSelectSlot: (slot: string) => void;
  onSelectDate: (date: string) => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onSaveSnapshot: () => void;
  isSaving: boolean;
  onOpenSettings: () => void;
  onOpenFormulas: () => void;
  onOpenSnapshotsManager: () => void;
  connectionMode: ConnectionMode;
  historicalSnapshots: MarketSnapshotRecord[];
  isMobileCompact: boolean;
  onToggleMobileCompact: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  spotPrice,
  spotChange,
  spotChangePercent,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  onSelectDate,
  isStreaming,
  onToggleStreaming,
  onSaveSnapshot,
  isSaving,
  onOpenSettings,
  onOpenFormulas,
  onOpenSnapshotsManager,
  connectionMode,
  historicalSnapshots,
  isMobileCompact: _isMobileCompact,
  onToggleMobileCompact,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isPositive = spotChange >= 0;

  // Filter snapshot slots for selected date
  const availableSlotsForDate = historicalSnapshots
    .filter(s => s.snapshot_date === selectedDate)
    .map(s => s.hour_slot);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0a0e1a]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl transition-colors">
      {/* Top micro ticker bar */}
      <div className="bg-slate-100 dark:bg-[#05070c] px-3 sm:px-6 py-1 border-b border-slate-200 dark:border-slate-900/80 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 transition-colors">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            NSE NIFTY 50 INDEX
          </span>
          <span className="text-slate-400 dark:text-slate-600">|</span>
          <span className="text-slate-600 dark:text-slate-400">EXPIRY: CURRENT WEEKLY (THURSDAY)</span>
          <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-600 dark:text-slate-400 hidden sm:inline">LOT SIZE: 25 / 50</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 hidden md:inline">Admin: {user?.email}</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              connectionMode === 'broker_api' ? 'bg-cyan-500' :
              connectionMode === 'supabase_synced' ? 'bg-emerald-500' :
              connectionMode === 'historical' ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'
            }`} />
            <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300">
              {connectionMode === 'broker_api' ? 'Broker Live' :
               connectionMode === 'supabase_synced' ? 'Supabase Realtime' :
               connectionMode === 'historical' ? 'Historical Mode' : 'Live Simulated'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand Title & Spot Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-cyan-500 to-blue-600 rounded-xl shadow-md shadow-cyan-500/20">
              <TrendingUp className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                NIFTY <span className="bg-linear-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-sky-200 bg-clip-text text-transparent">Option Chain</span>
              </h1>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden sm:block">
                INSTITUTIONAL ZERO-LAG ANALYTICS
              </span>
            </div>
          </div>

          {/* Live Spot Close Badge */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-inner transition-colors">
            <div className="mr-2.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block leading-none">Spot Close</span>
              <span className="text-base sm:text-lg font-black font-mono text-slate-950 dark:text-white tracking-tight">
                {spotPrice.toFixed(2)}
              </span>
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
              isPositive 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' 
                : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'
            }`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{isPositive ? '+' : ''}{spotChange.toFixed(2)}</span>
              <span className="text-[10px] opacity-80">({isPositive ? '+' : ''}{spotChangePercent.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* Center: Live / Historical Hourly Selector */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 p-1 rounded-xl transition-colors">
          {/* Live Stream Button */}
          <button
            onClick={() => onSelectSlot('LIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedSlot === 'LIVE'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${selectedSlot === 'LIVE' ? 'animate-pulse' : ''}`} />
            <span>LIVE</span>
          </button>

          {/* Date Selector */}
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/70 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            />
          </div>

          {/* Hourly Slot Selector */}
          <div className="relative flex items-center">
            <Clock className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
            <select
              value={selectedSlot}
              onChange={(e) => onSelectSlot(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/70 rounded-lg pl-7 pr-3 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="LIVE">Live Feed</option>
              <optgroup label="Hourly Database Snapshots">
                {HOURLY_SLOTS.map((slot) => {
                  const hasData = availableSlotsForDate.includes(slot);
                  return (
                    <option key={slot} value={slot}>
                      {slot} IST {hasData ? '✓' : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Right: Actions & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Day / Night Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Day Theme (Light Mode)' : 'Switch to Night Theme (Dark Mode)'}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-yellow-400 transition-all cursor-pointer shadow-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Stream Play/Pause */}
          {selectedSlot === 'LIVE' && (
            <button
              onClick={onToggleStreaming}
              title={isStreaming ? 'Pause Real-Time Updates' : 'Resume Real-Time Updates'}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isStreaming
                  ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  : 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-400 hover:bg-amber-200'
              }`}
            >
              {isStreaming ? <Pause className="w-4 h-4 text-slate-700 dark:text-slate-300" /> : <Play className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
              <span className="hidden lg:inline">{isStreaming ? 'Pause' : 'Resume'}</span>
            </button>
          )}

          {/* Save Snapshot Button */}
          <button
            onClick={onSaveSnapshot}
            disabled={isSaving}
            title="Save Current Option Chain State to Database"
            className="px-3 py-2 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden md:inline">{isSaving ? 'Saving...' : 'Save Snapshot Now'}</span>
          </button>

          {/* Historical Snapshot Explorer */}
          <button
            onClick={onOpenSnapshotsManager}
            title="Snapshot Archive & DB Records"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
          >
            <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </button>

          {/* Formulas Explainer */}
          <button
            onClick={onOpenFormulas}
            title="Option Chain Custom Formula Rules"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </button>

          {/* Settings Modal */}
          <button
            onClick={onOpenSettings}
            title="Settings & Broker API"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          </button>

          {/* Mobile View Switcher */}
          <button
            onClick={onToggleMobileCompact}
            title="Toggle Compact Mobile View"
            className="lg:hidden p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 rounded-xl transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign Out Admin"
            className="p-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
