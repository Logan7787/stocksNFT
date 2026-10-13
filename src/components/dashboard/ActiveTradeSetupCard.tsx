import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Target, 
  Sliders
} from 'lucide-react';
import type { TradeSetup, TradeSettings, ProcessedOptionRow } from '../../types/optionChain';

interface ActiveTradeSetupCardProps {
  activeSetups: TradeSetup[];
  settings: TradeSettings;
  atmRow?: ProcessedOptionRow;
  nearestItmCeRow?: ProcessedOptionRow;
  nearestItmPeRow?: ProcessedOptionRow;
  spotPrice: number;
  onOpenSettings?: () => void;
  onTriggerTestBreakout?: (type: 'CE' | 'PE') => void;
  isSimulated?: boolean;
}

export const ActiveTradeSetupCard: React.FC<ActiveTradeSetupCardProps> = ({
  activeSetups,
  settings,
  atmRow,
  nearestItmCeRow,
  nearestItmPeRow,
  spotPrice,
  onOpenSettings,
  onTriggerTestBreakout,
  isSimulated = false,
}) => {
  const hasActiveTrade = activeSetups.length > 0;

  return (
    <div className="w-full mb-3 transition-all animate-fadeIn">
      {hasActiveTrade ? (
        /* ============================================================ */
        /* ACTIVE TRADE SETUP BANNER (LIVE BREAKOUT TRIGGERED)          */
        /* ============================================================ */
        <div className="space-y-2">
          {activeSetups.map((setup, idx) => {
            const isCE = setup.type === 'BUY_CE';
            return (
              <div
                key={`${setup.type}-${setup.strike}-${idx}`}
                className={`p-3.5 sm:p-4 rounded-xl shadow-xl border backdrop-blur-xl transition-all relative overflow-hidden ${
                  isCE
                    ? 'bg-linear-to-r from-emerald-950/90 via-slate-900 to-slate-950 border-emerald-500/70 text-emerald-100 ring-1 ring-emerald-500/30'
                    : 'bg-linear-to-r from-rose-950/90 via-slate-900 to-slate-950 border-rose-500/70 text-rose-100 ring-1 ring-rose-500/30'
                }`}
              >
                {/* Glow accent bar on the left */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isCE ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'
                  }`}
                />

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 font-mono">
                  {/* Left Column: Symbol, Signal Badge, Strike Role */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Live Indicator Icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                        isCE
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                      }`}
                    >
                      {isCE ? <TrendingUp className="w-5 h-5 animate-bounce" /> : <TrendingDown className="w-5 h-5 animate-bounce" />}
                    </div>

                    {/* Badge & Title: e.g. 🔴 NIFTY 22600 PE */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                        <span className="text-sm">{isCE ? '🟢' : '🔴'}</span>
                        <span>NIFTY {setup.strike} {isCE ? 'CE' : 'PE'}</span>
                      </span>

                      <span
                        className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm tracking-wider flex items-center gap-1 ${
                          isCE
                            ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40'
                            : 'bg-rose-500 text-white shadow-rose-500/40'
                        }`}
                      >
                        <Zap className="w-3 h-3 shrink-0" />
                        {isCE ? 'CE Bullish Breakout' : 'PE Bearish Breakout'}
                      </span>

                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-black/60 text-slate-300 border border-slate-700/60">
                        {setup.strikeRole === 'ATM' ? 'ATM STRIKE' : 'NEAREST ITM STRIKE'}
                      </span>
                    </div>
                  </div>

                  {/* Center Column: Live Calculation Stats */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs w-full lg:w-auto bg-black/40 p-2 sm:p-2.5 rounded-lg border border-slate-800">
                    {/* Entry Price */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-slate-700">
                      <span className="text-slate-400 text-[10px] uppercase font-sans">Entry</span>
                      <span className="font-black text-white text-sm">₹{setup.entryPrice.toFixed(2)}</span>
                    </div>

                    {/* Stop Loss Price */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-slate-700">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="text-slate-400 text-[10px] uppercase font-sans">SL</span>
                      <span className="font-black text-rose-300 text-sm">₹{setup.slPrice.toFixed(2)}</span>
                      <span className="text-[11px] text-rose-400 font-bold">(-{setup.effectiveRisk.toFixed(2)} pts)</span>
                      {setup.isSlOverridden && (
                        <span
                          className="text-[9px] px-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded uppercase font-bold"
                          title={`Risk capped at Max SL Points (${settings.maxSlPoints} pts) instead of full Premium spread (${setup.calculatedRisk.toFixed(2)} pts)`}
                        >
                          Max SL Enforced
                        </span>
                      )}
                    </div>

                    {/* Target Price (Strict 1:2 Reward) */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-slate-700">
                      <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-400 text-[10px] uppercase font-sans">Target</span>
                      <span className="font-black text-emerald-300 text-sm">₹{setup.targetPrice.toFixed(2)}</span>
                      <span className="text-[11px] text-emerald-400 font-bold">(+{setup.rewardPoints.toFixed(2)} pts)</span>
                    </div>

                    {/* Risk to Reward Ratio */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs">
                      <span className="text-[10px] uppercase font-sans text-amber-400/80">R:R</span>
                      <span>1:{setup.rrRatio}</span>
                    </div>
                  </div>

                  {/* Right Column: Settings trigger */}
                  {onOpenSettings && (
                    <button
                      onClick={onOpenSettings}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 rounded-lg border border-slate-700/60 cursor-pointer transition-colors"
                      title="Adjust Max SL Points or R:R Ratio in Admin Panel"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Adjust Risk (Max SL: {settings.maxSlPoints}pts)</span>
                    </button>
                  )}
                </div>

                {/* Micro formula breakdown footer */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Condition: <strong className="text-slate-200">Close ({setup.details.close.toFixed(2)})</strong> &gt; <strong className="text-slate-200">AVG ({setup.details.avg.toFixed(2)})</strong> &amp; &gt; <strong className="text-slate-200">Premium ({setup.details.premium.toFixed(2)})</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Risk: ₹{setup.entryPrice.toFixed(2)} - ₹{setup.slPrice.toFixed(2)} = <strong className="text-amber-300">{setup.effectiveRisk.toFixed(2)} pts</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Target: ₹{setup.entryPrice.toFixed(2)} + ({setup.effectiveRisk.toFixed(2)} × {setup.rrRatio}) = <strong className="text-emerald-300">₹{setup.targetPrice.toFixed(2)}</strong>
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono">Triggered at {setup.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ============================================================ */
        /* STANDBY / MONITORING BANNER (NO CURRENT ACTIVE BREAKOUT)     */
        /* ============================================================ */
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 dark:bg-[#0b0f19] border border-slate-700/60 dark:border-slate-800 text-slate-200 shadow-md backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono text-xs">
            {/* Left: Engine Status & ATM Watch */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Zap className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-amber-400 flex items-center gap-1.5 text-xs sm:text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    ENGINE ACTIVE: STANDBY
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    Monitoring ATM ({atmRow?.strike ?? Math.round(spotPrice / 50) * 50}) &amp; Nearest ITM
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Strict 1:2 R:R (Max SL: {settings.maxSlPoints} pts)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Awaiting breakout: <span className="text-slate-300 font-semibold">Close &gt; AVG</span> AND <span className="text-slate-300 font-semibold">Close &gt; Premium</span> on ATM or nearest ITM strike.
                </p>
              </div>
            </div>

            {/* Right: Live strike readiness monitor & Test Triggers */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
              {atmRow && (
                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[9px] uppercase">ATM CE ({atmRow.strike}):</span>
                    <span className={atmRow.call_close > atmRow.call_avg && atmRow.call_close > atmRow.call_premium ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                      ₹{atmRow.call_close.toFixed(2)}
                    </span>
                    <span className="text-slate-500 text-[10px]">/ Avg ₹{atmRow.call_avg.toFixed(2)}</span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[9px] uppercase">ATM PE ({atmRow.strike}):</span>
                    <span className={atmRow.put_close > atmRow.put_avg && atmRow.put_close > atmRow.put_premium ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      ₹{atmRow.put_close.toFixed(2)}
                    </span>
                    <span className="text-slate-500 text-[10px]">/ Avg ₹{atmRow.put_avg.toFixed(2)}</span>
                  </div>
                  {nearestItmCeRow && (
                    <>
                      <span className="text-slate-600 hidden sm:inline">|</span>
                      <div className="hidden sm:flex items-center gap-1 text-slate-400 text-[10px]">
                        <span>ITM CE {nearestItmCeRow.strike}</span>
                      </div>
                    </>
                  )}
                  {nearestItmPeRow && (
                    <>
                      <span className="text-slate-600 hidden sm:inline">|</span>
                      <div className="hidden sm:flex items-center gap-1 text-slate-400 text-[10px]">
                        <span>ITM PE {nearestItmPeRow.strike}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Simulation Quick Trigger Buttons to test the breakout live */}
              {isSimulated && onTriggerTestBreakout && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onTriggerTestBreakout('CE')}
                    className="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-[10px] rounded border border-emerald-400/40 cursor-pointer transition-colors shadow-xs"
                    title="Simulate CE Bullish Breakout on ATM strike"
                  >
                    + Test CE
                  </button>
                  <button
                    onClick={() => onTriggerTestBreakout('PE')}
                    className="px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[10px] rounded border border-rose-400/40 cursor-pointer transition-colors shadow-xs"
                    title="Simulate PE Bearish Breakout on ATM strike"
                  >
                    + Test PE
                  </button>
                </div>
              )}

              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="px-2 py-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded text-[11px] border border-slate-700 cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Config</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
