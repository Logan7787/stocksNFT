import React from 'react';
import type { MarketMetrics } from '../../types/optionChain';
import { Zap, BarChart2 } from 'lucide-react';

interface HighlightLegendProps {
  metrics: MarketMetrics;
  autoSaveCountdown: number;
  isAutoSaveEnabled: boolean;
  totalStrikesCount: number;
}

export const HighlightLegend: React.FC<HighlightLegendProps> = ({
  metrics,
  autoSaveCountdown,
  isAutoSaveEnabled,
  totalStrikesCount,
}) => {
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-50 dark:bg-[#0b0f19] border-b border-slate-200 dark:border-slate-800/80 px-3 sm:px-6 py-2 transition-colors">
      {/* Highlighting Rules Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Interactive Legend Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono mr-1">
            Rules & Highlights:
          </span>

          {/* ATM Strike (Orange) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f97316] text-white font-bold text-[11px] shadow-sm shadow-orange-500/20">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>ATM STRIKE:</span>
            <span className="font-mono text-xs">{metrics.atmStrike}</span>
          </div>

          {/* Min AVG (Light Green) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#86efac] text-slate-950 font-bold text-[11px] shadow-sm shadow-green-500/10 ring-1 ring-emerald-500/40">
            <span>MIN AVG:</span>
            <span className="font-mono text-xs">{metrics.minAvgValue.toFixed(2)}</span>
          </div>

          {/* Min Call Premium (Light Blue) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#7dd3fc] text-slate-950 font-bold text-[11px] shadow-sm shadow-sky-500/10 ring-1 ring-sky-500/40">
            <span>MIN CE PREM:</span>
            <span className="font-mono text-xs">{metrics.minCallPremiumValue.toFixed(2)}</span>
          </div>

          {/* Min Put Premium (Light Blue) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#7dd3fc] text-slate-950 font-bold text-[11px] shadow-sm shadow-sky-500/10 ring-1 ring-sky-500/40">
            <span>MIN PE PREM:</span>
            <span className="font-mono text-xs">{metrics.minPutPremiumValue.toFixed(2)}</span>
          </div>

          {/* Top 2 Volume (Light Yellow) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fde047] text-slate-950 font-bold text-[11px] shadow-sm shadow-yellow-500/10 ring-1 ring-yellow-500/40">
            <span>TOP 2 VOL:</span>
            <span className="font-mono text-[10px]">
              CE: {metrics.topCallVolumeStrikes.join(', ') || 'N/A'} | PE: {metrics.topPutVolumeStrikes.join(', ') || 'N/A'}
            </span>
          </div>
        </div>

        {/* Right: Key Derivatives Metrics */}
        <div className="flex items-center gap-3 text-xs font-mono text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 px-2.5 py-1 rounded-lg shadow-sm">
            <BarChart2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">PCR (Vol):</span>
            <span className={`font-bold ${metrics.pcrVolume >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {metrics.pcrVolume.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 px-2.5 py-1 rounded-lg shadow-sm hidden sm:flex">
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-yellow-400" />
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Max Pain:</span>
            <span className="font-bold text-slate-900 dark:text-white">{metrics.maxPainStrike}</span>
          </div>

          {isAutoSaveEnabled && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/90 border border-emerald-400 dark:border-emerald-500/30 px-2.5 py-1 rounded-lg shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">Next Auto-Snapshot:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCountdown(autoSaveCountdown)}</span>
            </div>
          )}

          <span className="text-slate-500 text-[11px] hidden md:inline">
            {totalStrikesCount} strikes visible
          </span>
        </div>
      </div>
    </div>
  );
};
