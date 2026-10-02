import React, { useState } from 'react';
import type { ProcessedOptionRow, MarketMetrics } from '../../types/optionChain';

interface OptionChainMobileTableProps {
  rows: ProcessedOptionRow[];
  spotPrice: number;
  metrics: MarketMetrics;
}

type MobileTab = 'CALLS' | 'PUTS' | 'COMBINED' | 'METRICS';

export const OptionChainMobileTable: React.FC<OptionChainMobileTableProps> = ({
  rows,
  spotPrice,
  metrics,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('COMBINED');

  return (
    <div className="w-full bg-white dark:bg-[#080b12] rounded-xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl overflow-hidden transition-colors">
      {/* Mobile Tab Navigation Switcher */}
      <div className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-[#0f1523] border-b border-slate-200 dark:border-slate-800 transition-colors">
        <button
          onClick={() => setActiveTab('CALLS')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'CALLS'
              ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/40 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
          }`}
        >
          CALLS (CE)
        </button>
        <button
          onClick={() => setActiveTab('COMBINED')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'COMBINED'
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
          }`}
        >
          COMBINED
        </button>
        <button
          onClick={() => setActiveTab('PUTS')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'PUTS'
              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/40 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
          }`}
        >
          PUTS (PE)
        </button>
        <button
          onClick={() => setActiveTab('METRICS')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'METRICS'
              ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/40 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
          }`}
        >
          METRICS
        </button>
      </div>

      {/* 1. CALLS TAB VIEW */}
      {activeTab === 'CALLS' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3 text-center bg-slate-200 dark:bg-slate-950 text-amber-800 dark:text-amber-400 sticky left-0 z-10 border-r border-slate-300 dark:border-slate-800 font-bold">
                  STRIKE
                </th>
                <th className="py-2.5 px-3 text-right text-slate-900 dark:text-white">CLOSE</th>
                <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300">AVG</th>
                <th className="py-2.5 px-3 text-right text-sky-700 dark:text-sky-300">PREMIUM</th>
                <th className="py-2.5 px-3 text-right text-yellow-700 dark:text-yellow-300">VOLUME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {rows.map((row) => (
                <tr key={row.strike} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td
                    className={`py-2 px-3 text-center font-bold sticky left-0 z-10 border-r border-slate-300 dark:border-slate-800 ${
                      row.isATM ? 'bg-[#f97316] text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {row.strike}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-900 dark:text-white font-bold">{row.call_close.toFixed(2)}</td>
                  <td
                    className={`py-2 px-3 text-right ${
                      row.isMinAvg ? 'bg-[#86efac] text-slate-950 font-bold' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {row.call_avg.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      row.isMinCallPremium ? 'bg-[#7dd3fc] text-slate-950 font-bold' : 'text-sky-700 dark:text-sky-400'
                    }`}
                  >
                    {row.call_premium.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      row.isTopCallVolume ? 'bg-[#fde047] text-slate-950 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.call_volume.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. PUTS TAB VIEW */}
      {activeTab === 'PUTS' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3 text-center bg-slate-200 dark:bg-slate-950 text-amber-800 dark:text-amber-400 sticky left-0 z-10 border-r border-slate-300 dark:border-slate-800 font-bold">
                  STRIKE
                </th>
                <th className="py-2.5 px-3 text-right text-slate-900 dark:text-white">CLOSE</th>
                <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300">AVG</th>
                <th className="py-2.5 px-3 text-right text-sky-700 dark:text-sky-300">PREMIUM</th>
                <th className="py-2.5 px-3 text-right text-yellow-700 dark:text-yellow-300">VOLUME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {rows.map((row) => (
                <tr key={row.strike} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td
                    className={`py-2 px-3 text-center font-bold sticky left-0 z-10 border-r border-slate-300 dark:border-slate-800 ${
                      row.isATM ? 'bg-[#f97316] text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {row.strike}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-900 dark:text-white font-bold">{row.put_close.toFixed(2)}</td>
                  <td
                    className={`py-2 px-3 text-right ${
                      row.isMinAvg ? 'bg-[#86efac] text-slate-950 font-bold' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {row.put_avg.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      row.isMinPutPremium ? 'bg-[#7dd3fc] text-slate-950 font-bold' : 'text-sky-700 dark:text-sky-400'
                    }`}
                  >
                    {row.put_premium.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      row.isTopPutVolume ? 'bg-[#fde047] text-slate-950 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.put_volume.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. COMBINED SUMMARY VIEW (Scrollable with sticky center strike) */}
      {activeTab === 'COMBINED' && (
        <div className="overflow-x-auto relative">
          <table className="w-full text-left font-mono text-xs border-collapse min-w-160">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <th className="py-2 px-2 text-right text-yellow-700 dark:text-yellow-300">CE VOL</th>
                <th className="py-2 px-2 text-right text-sky-700 dark:text-sky-300">CE PREM</th>
                <th className="py-2 px-2 text-right text-emerald-700 dark:text-emerald-300">AVG</th>
                <th className="py-2 px-2 text-right text-slate-900 dark:text-white">CE LTP</th>
                <th className="py-2 px-3 text-center bg-slate-200 dark:bg-slate-950 text-amber-900 dark:text-amber-400 sticky left-0 z-20 border-x border-slate-300 dark:border-slate-700 font-black">
                  STRIKE
                </th>
                <th className="py-2 px-2 text-left text-slate-900 dark:text-white">PE LTP</th>
                <th className="py-2 px-2 text-left text-emerald-700 dark:text-emerald-300">AVG</th>
                <th className="py-2 px-2 text-left text-sky-700 dark:text-sky-300">PE PREM</th>
                <th className="py-2 px-2 text-left text-yellow-700 dark:text-yellow-300">PE VOL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
              {rows.map((row) => (
                <tr key={row.strike} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td
                    className={`py-1.5 px-2 text-right ${
                      row.isTopCallVolume ? 'bg-[#fde047] text-slate-950 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.call_volume.toLocaleString('en-IN')}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right ${
                      row.isMinCallPremium ? 'bg-[#7dd3fc] text-slate-950 font-bold' : 'text-sky-700 dark:text-sky-400'
                    }`}
                  >
                    {row.call_premium.toFixed(2)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right ${
                      row.isMinAvg ? 'bg-[#86efac] text-slate-950 font-bold' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {row.call_avg.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-slate-900 dark:text-white font-bold">{row.call_close.toFixed(2)}</td>

                  {/* Sticky Center Strike */}
                  <td
                    className={`py-1.5 px-3 text-center font-bold sticky left-0 z-10 border-x border-slate-300 dark:border-slate-700 ${
                      row.isATM ? 'bg-[#f97316] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {row.strike}
                  </td>

                  <td className="py-1.5 px-2 text-left text-slate-900 dark:text-white font-bold">{row.put_close.toFixed(2)}</td>
                  <td
                    className={`py-1.5 px-2 text-left ${
                      row.isMinAvg ? 'bg-[#86efac] text-slate-950 font-bold' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {row.put_avg.toFixed(2)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-left ${
                      row.isMinPutPremium ? 'bg-[#7dd3fc] text-slate-950 font-bold' : 'text-sky-700 dark:text-sky-400'
                    }`}
                  >
                    {row.put_premium.toFixed(2)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-left ${
                      row.isTopPutVolume ? 'bg-[#fde047] text-slate-950 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.put_volume.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. METRICS TAB VIEW */}
      {activeTab === 'METRICS' && (
        <div className="p-4 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Spot Price</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{spotPrice.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">ATM Strike</span>
              <span className="text-lg font-black text-orange-600 dark:text-orange-400">{metrics.atmStrike}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Total CE Volume</span>
              <span className="text-base font-bold text-yellow-600 dark:text-yellow-400">{metrics.totalCallVolume.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Total PE Volume</span>
              <span className="text-base font-bold text-yellow-600 dark:text-yellow-400">{metrics.totalPutVolume.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">PCR (Put-Call Ratio)</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{metrics.pcrVolume.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Max Pain Strike</span>
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{metrics.maxPainStrike}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
