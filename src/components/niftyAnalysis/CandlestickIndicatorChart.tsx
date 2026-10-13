import React, { useState, useMemo } from 'react';
import type { CandleData } from '../../types/niftyAnalysis';
import { calculateEMA, calculateRSI, calculateVWAP } from '../../utils/technicalIndicators';

interface CandlestickChartProps {
  candles: CandleData[];
  symbolName: string;
  underlyingPrice?: number;
  height?: number;
}

export const CandlestickIndicatorChart: React.FC<CandlestickChartProps> = ({
  candles,
  symbolName,
  underlyingPrice,
  height = 380,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Compute indicator series
  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const ema9Series = useMemo(() => calculateEMA(closes, 9), [closes]);
  const ema21Series = useMemo(() => calculateEMA(closes, 21), [closes]);
  const vwapSeries = useMemo(() => calculateVWAP(candles), [candles]);
  const rsiSeries = useMemo(() => calculateRSI(closes, 14), [closes]);

  // Chart dimensions
  const chartWidth = 900;
  const paddingLeft = 50;
  const paddingRight = 60;
  const paddingTop = 25;
  const mainChartHeight = 240;
  const gap = 15;
  const rsiHeight = 80;
  const totalHeight = paddingTop + mainChartHeight + gap + rsiHeight + 25;

  const innerWidth = chartWidth - paddingLeft - paddingRight;

  // Price Extents for Main Chart
  const { minPrice, maxPrice } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100 };
    let min = Infinity;
    let max = -Infinity;

    candles.forEach((c, idx) => {
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
      if (ema9Series[idx] !== null) {
        min = Math.min(min, ema9Series[idx]!);
        max = Math.max(max, ema9Series[idx]!);
      }
      if (ema21Series[idx] !== null) {
        min = Math.min(min, ema21Series[idx]!);
        max = Math.max(max, ema21Series[idx]!);
      }
      if (vwapSeries[idx] !== null) {
        min = Math.min(min, vwapSeries[idx]!);
        max = Math.max(max, vwapSeries[idx]!);
      }
    });

    const buffer = (max - min) * 0.08 || 5;
    return {
      minPrice: Math.max(0, min - buffer),
      maxPrice: max + buffer,
    };
  }, [candles, ema9Series, ema21Series, vwapSeries]);

  const priceRange = maxPrice - minPrice || 1;

  // Price to Y coordinate in main chart
  const priceToY = (price: number) => {
    return paddingTop + mainChartHeight - ((price - minPrice) / priceRange) * mainChartHeight;
  };

  // RSI to Y coordinate
  const rsiToY = (val: number) => {
    const rsiTop = paddingTop + mainChartHeight + gap;
    return rsiTop + rsiHeight - (Math.max(0, Math.min(100, val)) / 100) * rsiHeight;
  };

  const candleCount = candles.length;
  const stepX = candleCount > 1 ? innerWidth / (candleCount - 1) : innerWidth;
  const candleBarWidth = Math.max(2, Math.min(12, (innerWidth / candleCount) * 0.65));

  // Build SVG path strings for indicators
  const buildPath = (series: (number | null)[], yFunc: (val: number) => number) => {
    let d = '';
    series.forEach((val, idx) => {
      if (val === null) return;
      const x = paddingLeft + idx * stepX;
      const y = yFunc(val);
      if (!d) {
        d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
    return d;
  };

  const ema9Path = useMemo(() => buildPath(ema9Series, priceToY), [ema9Series, minPrice, maxPrice]);
  const ema21Path = useMemo(() => buildPath(ema21Series, priceToY), [ema21Series, minPrice, maxPrice]);
  const vwapPath = useMemo(() => buildPath(vwapSeries, priceToY), [vwapSeries, minPrice, maxPrice]);
  const rsiPath = useMemo(() => buildPath(rsiSeries, rsiToY), [rsiSeries]);

  // Active hover info
  const activeCandle = hoverIdx !== null && candles[hoverIdx] ? candles[hoverIdx] : candles[candles.length - 1];
  const activeIdx = hoverIdx !== null && hoverIdx >= 0 ? hoverIdx : candles.length - 1;

  return (
    <div className="w-full bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm font-mono text-xs">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900 dark:text-white text-sm">
            {symbolName}
          </span>
          {underlyingPrice && (
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
              Spot Ref: ₹{underlyingPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Legend Indicators */}
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold">
            <span className="w-2.5 h-0.5 bg-cyan-500 rounded" /> EMA 9: {ema9Series[activeIdx]?.toFixed(2) || '-'}
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
            <span className="w-2.5 h-0.5 bg-amber-500 rounded" /> EMA 21: {ema21Series[activeIdx]?.toFixed(2) || '-'}
          </span>
          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
            <span className="w-2.5 h-0.5 bg-purple-500 rounded" /> VWAP: {vwapSeries[activeIdx]?.toFixed(2) || '-'}
          </span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="w-2.5 h-0.5 bg-emerald-500 rounded" /> RSI 14: {rsiSeries[activeIdx]?.toFixed(1) || '-'}
          </span>
        </div>
      </div>

      {/* Hover Candle Data Stats */}
      {activeCandle && (
        <div className="flex items-center gap-3 text-[11px] text-slate-800 dark:text-slate-200 font-semibold mb-2 overflow-x-auto no-scrollbar">
          <span>நேரம் (Time): <strong className="text-slate-900 dark:text-white font-bold">{activeCandle.timestamp}</strong></span>
          <span>O: <strong className="text-slate-900 dark:text-white font-bold">{activeCandle.open.toFixed(2)}</strong></span>
          <span>H: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{activeCandle.high.toFixed(2)}</strong></span>
          <span>L: <strong className="text-rose-700 dark:text-rose-400 font-bold">{activeCandle.low.toFixed(2)}</strong></span>
          <span>C: <strong className="text-slate-900 dark:text-white font-bold">{activeCandle.close.toFixed(2)}</strong></span>
          <span>Vol: <strong className="text-slate-900 dark:text-white font-bold">{activeCandle.volume.toLocaleString('en-IN')}</strong></span>
        </div>
      )}

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${totalHeight}`}
          className="w-full h-auto max-h-115"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Main Chart Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = paddingTop + mainChartHeight * pct;
            const price = maxPrice - pct * priceRange;
            return (
              <g key={`grid-main-${pct}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartWidth - paddingRight + 6}
                  y={y + 3}
                  className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono"
                >
                  {price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Candlesticks Rendering */}
          {candles.map((candle, idx) => {
            const x = paddingLeft + idx * stepX;
            const isBullish = candle.close >= candle.open;
            const openY = priceToY(candle.open);
            const closeY = priceToY(candle.close);
            const highY = priceToY(candle.high);
            const lowY = priceToY(candle.low);
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

            return (
              <g
                key={`candle-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(idx)}
              >
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={isBullish ? '#10b981' : '#f43f5e'}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={x - candleBarWidth / 2}
                  y={bodyTop}
                  width={candleBarWidth}
                  height={bodyHeight}
                  fill={isBullish ? '#10b981' : '#f43f5e'}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Technical Indicator Overlay Paths */}
          {ema9Path && <path d={ema9Path} fill="none" stroke="#06b6d4" strokeWidth="1.8" />}
          {ema21Path && <path d={ema21Path} fill="none" stroke="#f59e0b" strokeWidth="1.8" />}
          {vwapPath && <path d={vwapPath} fill="none" stroke="#a855f7" strokeWidth="1.8" strokeDasharray="4 2" />}

          {/* RSI Sub-Chart Area */}
          {(() => {
            const rsiTop = paddingTop + mainChartHeight + gap;
            const rsi70Y = rsiToY(70);
            const rsi55Y = rsiToY(55);
            const rsi30Y = rsiToY(30);

            return (
              <g>
                {/* Subchart separator */}
                <line
                  x1={paddingLeft}
                  y1={rsiTop - 6}
                  x2={chartWidth - paddingRight}
                  y2={rsiTop - 6}
                  stroke="currentColor"
                  className="text-slate-300 dark:text-slate-700"
                />

                {/* Subchart Title */}
                <text
                  x={paddingLeft}
                  y={rsiTop + 10}
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-bold"
                >
                  RSI 14 (வாங்குதல் மண்டலம் / BUY ZONE: 55 - 70)
                </text>

                {/* Strategy Buy Zone Fill between 55 and 70 */}
                <rect
                  x={paddingLeft}
                  y={rsi70Y}
                  width={innerWidth}
                  height={Math.max(0, rsi55Y - rsi70Y)}
                  fill="rgba(16, 185, 129, 0.12)"
                />

                {/* RSI 70 Guideline */}
                <line
                  x1={paddingLeft}
                  y1={rsi70Y}
                  x2={chartWidth - paddingRight}
                  y2={rsi70Y}
                  stroke="#10b981"
                  strokeDasharray="2 2"
                  strokeWidth="0.8"
                />
                <text x={chartWidth - paddingRight + 6} y={rsi70Y + 3} className="fill-emerald-500 text-[8px]">
                  70
                </text>

                {/* RSI 55 Guideline */}
                <line
                  x1={paddingLeft}
                  y1={rsi55Y}
                  x2={chartWidth - paddingRight}
                  y2={rsi55Y}
                  stroke="#10b981"
                  strokeDasharray="2 2"
                  strokeWidth="0.8"
                />
                <text x={chartWidth - paddingRight + 6} y={rsi55Y + 3} className="fill-emerald-500 text-[8px]">
                  55
                </text>

                {/* RSI 30 Guideline */}
                <line
                  x1={paddingLeft}
                  y1={rsi30Y}
                  x2={chartWidth - paddingRight}
                  y2={rsi30Y}
                  stroke="#f43f5e"
                  strokeDasharray="2 2"
                  strokeWidth="0.8"
                />
                <text x={chartWidth - paddingRight + 6} y={rsi30Y + 3} className="fill-rose-500 text-[8px]">
                  30
                </text>

                {/* RSI Curve */}
                {rsiPath && <path d={rsiPath} fill="none" stroke="#10b981" strokeWidth="1.5" />}
              </g>
            );
          })()}

          {/* Vertical Crosshair Line on Hover */}
          {hoverIdx !== null && (
            <line
              x1={paddingLeft + hoverIdx * stepX}
              y1={paddingTop}
              x2={paddingLeft + hoverIdx * stepX}
              y2={totalHeight - 15}
              stroke="currentColor"
              className="text-cyan-500/60"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
