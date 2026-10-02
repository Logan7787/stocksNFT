import React, { memo } from 'react';
import type { ProcessedOptionRow } from '../../types/optionChain';

interface OptionChainDesktopTableProps {
  rows: ProcessedOptionRow[];
  spotPrice: number;
}

// Memoized single row component to ensure zero-lag rendering
const OptionRowItem = memo(({ row, spotPrice }: { row: ProcessedOptionRow; spotPrice: number }) => {
  const isCallITM = row.strike < spotPrice;
  const isPutITM = row.strike > spotPrice;

  return (
    <tr className="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-100/90 dark:hover:bg-slate-800/50 transition-colors font-mono text-[13px] group">
      {/* ============================================================== */}
      {/* CALL SECTION (LEFT): VOLUME | PREMIUM | AVG | CLOSE           */}
      {/* ============================================================== */}

      {/* 1. CALL VOLUME */}
      <td
        className={`py-2 px-3 text-right font-medium transition-all ${
          row.isTopCallVolume
            ? 'bg-[#fde047] text-slate-950 font-black shadow-inner'
            : isCallITM
            ? 'bg-emerald-50/80 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-200'
            : 'text-slate-700 dark:text-slate-300'
        }`}
        title={`Call Volume: ${row.call_volume.toLocaleString('en-IN')} ${row.isTopCallVolume ? '(Top 2 Highest CE Volume)' : ''}`}
      >
        <span className="flex items-center justify-end gap-1">
          {row.isTopCallVolume && (
            <span className="text-[9px] px-1 py-0.5 bg-black/80 text-yellow-300 rounded font-bold uppercase">
              TOP
            </span>
          )}
          <span>{row.call_volume.toLocaleString('en-IN')}</span>
        </span>
      </td>

      {/* 2. CALL PREMIUM: (Call Low + Put High) / 2 */}
      <td
        className={`py-2 px-3 text-right transition-all ${
          row.isMinCallPremium
            ? 'bg-[#7dd3fc] text-slate-950 font-black shadow-inner ring-1 ring-sky-500'
            : isCallITM
            ? 'bg-emerald-50/90 dark:bg-emerald-950/25 text-sky-700 dark:text-sky-300 font-semibold'
            : 'text-sky-600 dark:text-sky-400 font-medium'
        }`}
        title={`Call Premium = (${row.call_low.toFixed(2)} + ${row.put_high.toFixed(2)}) / 2 = ${row.call_premium.toFixed(2)} ${row.isMinCallPremium ? '(Lowest CE Premium)' : ''}`}
      >
        <div className="flex items-center justify-end gap-1">
          {row.isMinCallPremium && (
            <span className="text-[9px] px-1 py-0.5 bg-black/80 text-sky-300 rounded font-bold uppercase">
              MIN
            </span>
          )}
          <span>{row.call_premium.toFixed(2)}</span>
        </div>
      </td>

      {/* 3. CALL AVG: (Call Close + Put Close) / 2 */}
      <td
        className={`py-2 px-3 text-right transition-all ${
          row.isMinAvg
            ? 'bg-[#86efac] text-slate-950 font-black shadow-inner ring-1 ring-emerald-500'
            : isCallITM
            ? 'bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-semibold'
            : 'text-emerald-700 dark:text-emerald-400 font-medium'
        }`}
        title={`AVG Price = (${row.call_close.toFixed(2)} + ${row.put_close.toFixed(2)}) / 2 = ${row.call_avg.toFixed(2)} ${row.isMinAvg ? '(Lowest AVG across table)' : ''}`}
      >
        <div className="flex items-center justify-end gap-1">
          {row.isMinAvg && (
            <span className="text-[9px] px-1 py-0.5 bg-black/80 text-emerald-300 rounded font-bold uppercase">
              MIN
            </span>
          )}
          <span>{row.call_avg.toFixed(2)}</span>
        </div>
      </td>

      {/* 4. CALL CLOSE */}
      <td
        className={`py-2 px-3 text-right font-bold transition-colors ${
          row.callTickDirection === 'up'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-300'
            : row.callTickDirection === 'down'
            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/30 dark:text-rose-300'
            : isCallITM
            ? 'bg-emerald-100/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-white font-extrabold'
            : 'text-slate-900 dark:text-slate-100'
        }`}
        title={`Call Close: ${row.call_close.toFixed(2)} | Low: ${row.call_low.toFixed(2)} | High: ${row.call_high.toFixed(2)}`}
      >
        <span>{row.call_close.toFixed(2)}</span>
      </td>

      {/* ============================================================== */}
      {/* CENTER SECTION: STRIKE PRICE (Orange ATM Highlight)            */}
      {/* ============================================================== */}
      <td
        className={`py-2 px-4 text-center font-black transition-all border-x-2 border-slate-300 dark:border-slate-700/80 ${
          row.isATM
            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/40 text-sm scale-105 z-10 ring-2 ring-orange-400'
            : 'bg-slate-100 dark:bg-slate-900/95 text-slate-900 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          {row.isATM && <span className="text-[10px] px-1 bg-black/70 rounded text-amber-200 font-sans">ATM</span>}
          <span>{row.strike}</span>
        </div>
      </td>

      {/* ============================================================== */}
      {/* PUT SECTION (RIGHT): CLOSE | AVG | PREMIUM | VOLUME            */}
      {/* ============================================================== */}

      {/* 5. PUT CLOSE */}
      <td
        className={`py-2 px-3 text-left font-bold transition-colors ${
          row.putTickDirection === 'up'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-300'
            : row.putTickDirection === 'down'
            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/30 dark:text-rose-300'
            : isPutITM
            ? 'bg-rose-100/70 dark:bg-rose-950/30 text-rose-950 dark:text-white font-extrabold'
            : 'text-slate-900 dark:text-slate-100'
        }`}
        title={`Put Close: ${row.put_close.toFixed(2)} | Low: ${row.put_low.toFixed(2)} | High: ${row.put_high.toFixed(2)}`}
      >
        <span>{row.put_close.toFixed(2)}</span>
      </td>

      {/* 6. PUT AVG: (Call Close + Put Close) / 2 */}
      <td
        className={`py-2 px-3 text-left transition-all ${
          row.isMinAvg
            ? 'bg-[#86efac] text-slate-950 font-black shadow-inner ring-1 ring-emerald-500'
            : isPutITM
            ? 'bg-rose-50/80 dark:bg-rose-950/20 text-emerald-800 dark:text-emerald-300 font-semibold'
            : 'text-emerald-700 dark:text-emerald-400 font-medium'
        }`}
        title={`AVG Price = (${row.call_close.toFixed(2)} + ${row.put_close.toFixed(2)}) / 2 = ${row.put_avg.toFixed(2)} ${row.isMinAvg ? '(Lowest AVG across table)' : ''}`}
      >
        <div className="flex items-center justify-start gap-1">
          <span>{row.put_avg.toFixed(2)}</span>
          {row.isMinAvg && (
            <span className="text-[9px] px-1 py-0.5 bg-black/80 text-emerald-300 rounded font-bold uppercase">
              MIN
            </span>
          )}
        </div>
      </td>

      {/* 7. PUT PREMIUM: (Put Low + Call High) / 2 */}
      <td
        className={`py-2 px-3 text-left transition-all ${
          row.isMinPutPremium
            ? 'bg-[#7dd3fc] text-slate-950 font-black shadow-inner ring-1 ring-sky-500'
            : isPutITM
            ? 'bg-rose-50/90 dark:bg-rose-950/25 text-sky-700 dark:text-sky-300 font-semibold'
            : 'text-sky-600 dark:text-sky-400 font-medium'
        }`}
        title={`Put Premium = (${row.put_low.toFixed(2)} + ${row.call_high.toFixed(2)}) / 2 = ${row.put_premium.toFixed(2)} ${row.isMinPutPremium ? '(Lowest PE Premium)' : ''}`}
      >
        <div className="flex items-center justify-start gap-1">
          <span>{row.put_premium.toFixed(2)}</span>
          {row.isMinPutPremium && (
            <span className="text-[9px] px-1 py-0.5 bg-black/80 text-sky-300 rounded font-bold uppercase">
              MIN
            </span>
          )}
        </div>
      </td>

      {/* 8. PUT VOLUME */}
      <td
        className={`py-2 px-3 text-left font-medium transition-all ${
          row.isTopPutVolume
            ? 'bg-[#fde047] text-slate-950 font-black shadow-inner'
            : isPutITM
            ? 'bg-rose-50/80 dark:bg-rose-950/20 text-slate-900 dark:text-slate-200'
            : 'text-slate-700 dark:text-slate-300'
        }`}
        title={`Put Volume: ${row.put_volume.toLocaleString('en-IN')} ${row.isTopPutVolume ? '(Top 2 Highest PE Volume)' : ''}`}
      >
        <span className="flex items-center justify-start gap-1">
          <span>{row.put_volume.toLocaleString('en-IN')}</span>
          {row.isTopPutVolume && (
            <span className="text-[9px] px-1 py-0.5 bg-black/80 text-yellow-300 rounded font-bold uppercase">
              TOP
            </span>
          )}
        </span>
      </td>
    </tr>
  );
});

OptionRowItem.displayName = 'OptionRowItem';

export const OptionChainDesktopTable: React.FC<OptionChainDesktopTableProps> = ({ rows, spotPrice }) => {
  return (
    <div className="w-full overflow-x-auto shadow-2xl rounded-b-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080b12] transition-colors">
      <table className="w-full text-left border-collapse select-text min-w-4xl">
        {/* Table Header Container */}
        <thead>
          {/* Top Super Header: CALLS (CE) | STRIKE | PUTS (PE) */}
          <tr className="border-b border-slate-300 dark:border-slate-700 text-xs font-bold uppercase tracking-wider">
            <th colSpan={4} className="py-2.5 px-4 text-center text-cyan-800 dark:text-cyan-400 bg-cyan-100/70 dark:bg-cyan-950/40 border-r border-slate-300 dark:border-slate-700/80">
              CALLS (CE)
            </th>
            <th className="py-2.5 px-4 text-center text-amber-800 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 font-black border-r border-slate-300 dark:border-slate-700/80">
              STRIKE
            </th>
            <th colSpan={4} className="py-2.5 px-4 text-center text-rose-800 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/40">
              PUTS (PE)
            </th>
          </tr>

          {/* Exact Columns Header: VOLUME | PREMIUM | AVG | CLOSE | STRIKE | CLOSE | AVG | PREMIUM | VOLUME */}
          <tr className="border-b border-slate-300 dark:border-slate-800 text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 bg-slate-200/90 dark:bg-[#0f172a]">
            {/* CALLS */}
            <th className="py-2.5 px-3 text-right text-yellow-700 dark:text-yellow-300/90">
              VOLUME
            </th>
            <th className="py-2.5 px-3 text-right text-sky-700 dark:text-sky-300/90">
              PREMIUM
            </th>
            <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300/90">
              AVG
            </th>
            <th className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
              CLOSE
            </th>

            {/* CENTER STRIKE */}
            <th className="py-2.5 px-4 text-center bg-slate-300/80 dark:bg-slate-950 text-amber-900 dark:text-amber-400 font-black border-x-2 border-slate-400 dark:border-slate-700">
              STRIKE
            </th>

            {/* PUTS */}
            <th className="py-2.5 px-3 text-left text-slate-900 dark:text-white">
              CLOSE
            </th>
            <th className="py-2.5 px-3 text-left text-emerald-700 dark:text-emerald-300/90">
              AVG
            </th>
            <th className="py-2.5 px-3 text-left text-sky-700 dark:text-sky-300/90">
              PREMIUM
            </th>
            <th className="py-2.5 px-3 text-left text-yellow-700 dark:text-yellow-300/90">
              VOLUME
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
          {rows.map((row) => (
            <OptionRowItem key={row.strike} row={row} spotPrice={spotPrice} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
