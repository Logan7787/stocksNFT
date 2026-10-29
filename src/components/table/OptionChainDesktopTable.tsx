import React, { memo } from 'react';
import type { ProcessedOptionRow } from '../../types/optionChain';

export type TableFontSize = 'normal' | 'large' | 'xlarge';

interface OptionChainDesktopTableProps {
  rows: ProcessedOptionRow[];
  spotPrice: number;
  fontSize?: TableFontSize;
  atmStrike?: number;
  printAtmRangeOnly?: boolean;
}

// Memoized single row component to ensure zero-lag rendering
const OptionRowItem = memo(({ 
  row, 
  spotPrice, 
  fontSize = 'large',
  isPrintHidden = false,
}: { 
  row: ProcessedOptionRow; 
  spotPrice: number;
  fontSize?: TableFontSize;
  isPrintHidden?: boolean;
}) => {
  const isCallITM = row.strike < spotPrice;
  const isPutITM = row.strike > spotPrice;

  const sizeConfig = {
    normal: {
      tr: 'text-[14px]',
      cell: 'py-2 px-3',
      strike: 'text-[15px]',
      badge: 'text-[10px]',
      signal: 'text-xs px-2 py-0.5',
    },
    large: {
      tr: 'text-[16px]',
      cell: 'py-2.5 px-3.5',
      strike: 'text-[17px]',
      badge: 'text-[11px]',
      signal: 'text-[13px] px-2.5 py-1',
    },
    xlarge: {
      tr: 'text-[18px]',
      cell: 'py-3.5 px-4',
      strike: 'text-[19px]',
      badge: 'text-xs',
      signal: 'text-sm px-3 py-1.5',
    },
  }[fontSize];

  return (
    <tr className={`border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-100/90 dark:hover:bg-slate-800/50 transition-colors font-mono ${sizeConfig.tr} group ${isPrintHidden ? 'print:hidden' : ''}`}>
      {/* ============================================================== */}
      {/* CALL SECTION (LEFT): VOLUME | PREMIUM | AVG | CLOSE           */}
      {/* ============================================================== */}

      {/* 1. CALL VOLUME */}
      <td
        className={`${sizeConfig.cell} text-right font-medium transition-all ${
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
            <span className={`${sizeConfig.badge} px-1.5 py-0.5 bg-black/80 text-yellow-300 rounded font-bold uppercase`}>
              TOP
            </span>
          )}
          <span>{row.call_volume.toLocaleString('en-IN')}</span>
        </span>
      </td>

      {/* 2. CALL PREMIUM: (Call Low + Put High) / 2 */}
      <td
        className={`${sizeConfig.cell} text-right transition-all ${
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
            <span className={`${sizeConfig.badge} px-1.5 py-0.5 bg-black/80 text-sky-300 rounded font-bold uppercase`}>
              MIN
            </span>
          )}
          <span>{row.call_premium.toFixed(2)}</span>
        </div>
      </td>

      {/* 3. CALL AVG: (Call Close + Put Close) / 2 */}
      <td
        className={`${sizeConfig.cell} text-right transition-all ${
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
            <span className={`${sizeConfig.badge} px-1.5 py-0.5 bg-black/80 text-emerald-300 rounded font-bold uppercase`}>
              MIN
            </span>
          )}
          <span>{row.call_avg.toFixed(2)}</span>
        </div>
      </td>

      {/* 4. CALL CLOSE */}
      <td
        className={`${sizeConfig.cell} text-right font-bold transition-colors ${
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

      {/* 5. CALL LTP */}
      <td
        className={`${sizeConfig.cell} text-right font-black transition-colors ${
          isCallITM
            ? 'bg-cyan-50/80 dark:bg-cyan-950/25 text-cyan-950 dark:text-cyan-200 font-extrabold'
            : 'text-cyan-900 dark:text-cyan-300 font-bold'
        }`}
        title={`Call LTP (Last Traded Price): ${((row.call_ltp && row.call_ltp > 0) ? row.call_ltp : row.call_close).toFixed(2)}`}
      >
        <span>{((row.call_ltp && row.call_ltp > 0) ? row.call_ltp : row.call_close).toFixed(2)}</span>
      </td>

      {/* ============================================================== */}
      {/* CENTER SECTION: STRIKE PRICE (Orange ATM Highlight)            */}
      {/* ============================================================== */}
      <td
        className={`${sizeConfig.cell} text-center font-black transition-all border-x-2 border-slate-300 dark:border-slate-700/80 ${
          row.isATM
            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/40 scale-105 z-10 ring-2 ring-orange-400'
            : row.isFormulaAtm
            ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400 font-black'
            : row.breakLevelRole === 'ATM_MINUS_100'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/60'
            : row.breakLevelRole === 'ATM_PLUS_100'
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 ring-1 ring-rose-500/60'
            : 'bg-slate-100 dark:bg-slate-900/95 text-slate-900 dark:text-slate-200'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className="flex items-center justify-center gap-1.5">
            {row.isATM && <span className="text-[10px] px-1.5 py-0.5 bg-black/70 rounded text-amber-200 font-sans font-black">ATM</span>}
            {row.isFormulaAtm && !row.isATM && (
              <span className="text-[9px] px-1.5 py-0.5 bg-black text-amber-300 rounded font-black font-sans uppercase">
                FORMULA ATM
              </span>
            )}
            <span className={sizeConfig.strike}>{row.strike}</span>
          </div>
          {row.breakLevelRole === 'ATM_MINUS_100' && (
            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 rounded font-sans font-bold whitespace-nowrap">
              ATM - 100
            </span>
          )}
          {row.breakLevelRole === 'ATM_PLUS_100' && (
            <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-400/40 rounded font-sans font-bold whitespace-nowrap">
              ATM + 100
            </span>
          )}
        </div>
      </td>

      {/* ============================================================== */}
      {/* ACTION SIGNALS COLUMN: BUY CE (Green) / BUY PE (Red) Badges    */}
      {/* ============================================================== */}
      <td
        className={`${sizeConfig.cell} text-center transition-all border-r-2 border-slate-300 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60`}
        title={
          row.ceSignal && row.peSignal
            ? 'Dual Breakout: Both CE and PE breakout conditions triggered!'
            : row.ceSignal
            ? `Bullish Breakout: Call Close (${row.call_close.toFixed(2)}) > AVG (${row.call_avg.toFixed(2)}) & > Premium (${row.call_premium.toFixed(2)})`
            : row.peSignal
            ? `Bearish Breakout: Put Close (${row.put_close.toFixed(2)}) > AVG (${row.put_avg.toFixed(2)}) & > Premium (${row.put_premium.toFixed(2)})`
            : 'No signal: Waiting for breakout condition (Close > AVG & Close > Premium)'
        }
      >
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {row.ceSignal && (
            <span className={`inline-flex items-center gap-1.5 rounded-lg font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400/60 transition-transform scale-100 hover:scale-105 cursor-default ${sizeConfig.signal}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
              BUY CE
            </span>
          )}
          {row.peSignal && (
            <span className={`inline-flex items-center gap-1.5 rounded-lg font-black bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/30 ring-1 ring-rose-400/60 transition-transform scale-100 hover:scale-105 cursor-default ${sizeConfig.signal}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              BUY PE
            </span>
          )}
          {!row.ceSignal && !row.peSignal && (
            <span className="text-slate-400 dark:text-slate-600 font-mono font-bold">-</span>
          )}
        </div>
      </td>

      {/* ============================================================== */}
      {/* PUT SECTION (RIGHT): LTP | CLOSE | AVG | PREMIUM | VOLUME      */}
      {/* ============================================================== */}

      {/* 1. PUT LTP */}
      <td
        className={`${sizeConfig.cell} text-left font-black transition-colors ${
          isPutITM
            ? 'bg-cyan-50/80 dark:bg-cyan-950/25 text-cyan-950 dark:text-cyan-200 font-extrabold'
            : 'text-cyan-900 dark:text-cyan-300 font-bold'
        }`}
        title={`Put LTP (Last Traded Price): ${((row.put_ltp && row.put_ltp > 0) ? row.put_ltp : row.put_close).toFixed(2)}`}
      >
        <span>{((row.put_ltp && row.put_ltp > 0) ? row.put_ltp : row.put_close).toFixed(2)}</span>
      </td>

      {/* 2. PUT CLOSE */}
      <td
        className={`${sizeConfig.cell} text-left font-bold transition-colors ${
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
        className={`${sizeConfig.cell} text-left transition-all ${
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
            <span className={`${sizeConfig.badge} px-1.5 py-0.5 bg-black/80 text-emerald-300 rounded font-bold uppercase`}>
              MIN
            </span>
          )}
        </div>
      </td>

      {/* 7. PUT PREMIUM: (Put Low + Call High) / 2 */}
      <td
        className={`${sizeConfig.cell} text-left transition-all ${
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
            <span className={`${sizeConfig.badge} px-1.5 py-0.5 bg-black/80 text-sky-300 rounded font-bold uppercase`}>
              MIN
            </span>
          )}
        </div>
      </td>

      {/* 8. PUT VOLUME */}
      <td
        className={`${sizeConfig.cell} text-left font-medium transition-all ${
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
            <span className={`${sizeConfig.badge} px-1.5 py-0.5 bg-black/80 text-yellow-300 rounded font-bold uppercase`}>
              TOP
            </span>
          )}
        </span>
      </td>
    </tr>
  );
});

OptionRowItem.displayName = 'OptionRowItem';

export const OptionChainDesktopTable: React.FC<OptionChainDesktopTableProps> = ({ 
  rows, 
  spotPrice, 
  fontSize = 'large',
  atmStrike,
  printAtmRangeOnly = true,
}) => {
  const effectiveAtm = atmStrike ?? rows.find((r) => r.isATM)?.strike ?? (spotPrice ? Math.round(spotPrice / 50) * 50 : undefined);
  const headerSizes = {
    normal: {
      super: 'py-2.5 px-4 text-xs font-black',
      col: 'py-2 px-3 text-xs font-bold',
    },
    large: {
      super: 'py-3 px-4 text-sm font-black',
      col: 'py-2.5 px-3.5 text-[13px] font-extrabold',
    },
    xlarge: {
      super: 'py-3.5 px-4 text-base font-black',
      col: 'py-3 px-4 text-[15px] font-extrabold',
    },
  }[fontSize];
  return (
    <div className="w-full overflow-x-auto shadow-2xl rounded-b-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080b12] transition-colors">
      <table className="w-full text-left border-collapse select-text min-w-4xl">
        {/* Table Header Container */}
        <thead>
          {/* Top Super Header: CALLS (CE) | STRIKE | ACTION | PUTS (PE) */}
          <tr className="border-b border-slate-300 dark:border-slate-700 uppercase tracking-wider">
            <th colSpan={5} className={`${headerSizes.super} text-center text-cyan-800 dark:text-cyan-400 bg-cyan-100/70 dark:bg-cyan-950/40 border-r border-slate-300 dark:border-slate-700/80`}>
              CALLS (CE)
            </th>
            <th className={`${headerSizes.super} text-center text-amber-800 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 border-r border-slate-300 dark:border-slate-700/80`}>
              STRIKE
            </th>
            <th className={`${headerSizes.super} text-center text-emerald-800 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 border-r border-slate-300 dark:border-slate-700/80`}>
              ACTION SIGNALS
            </th>
            <th colSpan={5} className={`${headerSizes.super} text-center text-rose-800 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/40`}>
              PUTS (PE)
            </th>
          </tr>

          {/* Exact Columns Header: VOLUME | PREMIUM | AVG | CLOSE | LTP | STRIKE | ACTION | LTP | CLOSE | AVG | PREMIUM | VOLUME */}
          <tr className="border-b border-slate-300 dark:border-slate-800 font-mono uppercase text-slate-700 dark:text-slate-300 bg-slate-200/90 dark:bg-[#0f172a]">
            {/* CALLS */}
            <th className={`${headerSizes.col} text-right bg-amber-100/90 text-amber-950 font-bold dark:bg-amber-950/70 dark:text-amber-300 border-r border-slate-300/80 dark:border-slate-800`}>
              VOLUME
            </th>
            <th className={`${headerSizes.col} text-right bg-sky-100/90 text-sky-950 font-bold dark:bg-sky-950/70 dark:text-sky-300 border-r border-slate-300/80 dark:border-slate-800`}>
              PREMIUM
            </th>
            <th className={`${headerSizes.col} text-right bg-emerald-100/90 text-emerald-950 font-bold dark:bg-emerald-950/70 dark:text-emerald-300 border-r border-slate-300/80 dark:border-slate-800`}>
              AVG
            </th>
            <th className={`${headerSizes.col} text-right bg-purple-100/90 text-purple-950 font-bold dark:bg-purple-950/70 dark:text-purple-300 border-r border-slate-300/80 dark:border-slate-800`}>
              CLOSE
            </th>
            <th className={`${headerSizes.col} text-right bg-cyan-100/90 text-cyan-950 font-black dark:bg-cyan-950/70 dark:text-cyan-300`}>
              LTP
            </th>

            {/* CENTER STRIKE */}
            <th className={`${headerSizes.col} text-center bg-slate-300/80 dark:bg-slate-950 text-amber-900 dark:text-amber-400 border-x-2 border-slate-400 dark:border-slate-700`}>
              STRIKE
            </th>

            {/* ACTION SIGNALS COLUMN */}
            <th className={`${headerSizes.col} text-center bg-slate-200 dark:bg-slate-900/90 text-emerald-800 dark:text-emerald-400 border-r-2 border-slate-400 dark:border-slate-700`}>
              ACTION
            </th>

            {/* PUTS */}
            <th className={`${headerSizes.col} text-left bg-cyan-100/90 text-cyan-950 font-black dark:bg-cyan-950/70 dark:text-cyan-300 border-r border-slate-300/80 dark:border-slate-800`}>
              LTP
            </th>
            <th className={`${headerSizes.col} text-left bg-purple-100/90 text-purple-950 font-bold dark:bg-purple-950/70 dark:text-purple-300 border-r border-slate-300/80 dark:border-slate-800`}>
              CLOSE
            </th>
            <th className={`${headerSizes.col} text-left bg-emerald-100/90 text-emerald-950 font-bold dark:bg-emerald-950/70 dark:text-emerald-300 border-r border-slate-300/80 dark:border-slate-800`}>
              AVG
            </th>
            <th className={`${headerSizes.col} text-left bg-sky-100/90 text-sky-950 font-bold dark:bg-sky-950/70 dark:text-sky-300 border-r border-slate-300/80 dark:border-slate-800`}>
              PREMIUM
            </th>
            <th className={`${headerSizes.col} text-left bg-amber-100/90 text-amber-950 font-bold dark:bg-amber-950/70 dark:text-amber-300`}>
              VOLUME
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
          {rows.map((row) => {
            const isOutsidePrintRange =
              printAtmRangeOnly &&
              effectiveAtm != null &&
              Math.abs(row.strike - effectiveAtm) > 500;

            return (
              <OptionRowItem
                key={row.strike}
                row={row}
                spotPrice={spotPrice}
                fontSize={fontSize}
                isPrintHidden={isOutsidePrintRange}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
