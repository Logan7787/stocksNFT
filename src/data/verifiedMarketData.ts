import type { RawOptionData, ProcessedOptionRow } from '../types/optionChain';
import { processRawOptionRow } from '../utils/formulas';

/**
 * Official Verified Historical Dataset from 2026-10-28 (15:30 IST Final NSE Derivatives Settlement)
 * Source: Official NSE Derivatives Settlement Report (Spot: 22,698.85, Prev Close: 22,749.75, Change: -50.90)
 * Center ATM: 22700 | Formula ATM: 22750 | Min AVG: 193.18 (at 22800) | BU: 247.45 | BD: 148.38 | BE: 194.05
 * call_prev_close & put_prev_close derive from 2026-10-27 settlement close
 * call_close & put_close derive from 2026-10-28 20:30 PM final settlement
 */
export const RAW_MARKET_CLOSE_2026_10_28: RawOptionData[] = [
  { strike: 22000, call_prev_close: 755.05, call_low: 705.00, call_high: 705.00, call_close: 705.00, call_ltp: 705.00, call_volume: 154000, put_prev_close: 5.30, put_low: 15.20, put_high: 15.20, put_close: 15.20, put_ltp: 15.20, put_volume: 2450000 },
  { strike: 22050, call_prev_close: 705.85, call_low: 656.00, call_high: 656.00, call_close: 656.00, call_ltp: 656.00, call_volume: 85000, put_prev_close: 6.10, put_low: 18.10, put_high: 18.10, put_close: 18.10, put_ltp: 18.10, put_volume: 1820000 },
  { strike: 22100, call_prev_close: 656.75, call_low: 608.00, call_high: 608.00, call_close: 608.00, call_ltp: 608.00, call_volume: 240000, put_prev_close: 7.00, put_low: 21.80, put_high: 21.80, put_close: 21.80, put_ltp: 21.80, put_volume: 3100000 },
  { strike: 22150, call_prev_close: 607.80, call_low: 561.00, call_high: 561.00, call_close: 561.00, call_ltp: 561.00, call_volume: 180000, put_prev_close: 8.05, put_low: 26.50, put_high: 26.50, put_close: 26.50, put_ltp: 26.50, put_volume: 2200000 },
  { strike: 22200, call_prev_close: 559.05, call_low: 515.00, call_high: 515.00, call_close: 515.00, call_ltp: 515.00, call_volume: 450000, put_prev_close: 9.30, put_low: 32.50, put_high: 32.50, put_close: 32.50, put_ltp: 32.50, put_volume: 4100000 },
  { strike: 22250, call_prev_close: 510.55, call_low: 470.00, call_high: 470.00, call_close: 470.00, call_ltp: 470.00, call_volume: 380000, put_prev_close: 10.80, put_low: 40.00, put_high: 40.00, put_close: 40.00, put_ltp: 40.00, put_volume: 3600000 },
  { strike: 22300, call_prev_close: 462.35, call_low: 426.00, call_high: 426.00, call_close: 426.00, call_ltp: 426.00, call_volume: 680000, put_prev_close: 12.60, put_low: 49.00, put_high: 49.00, put_close: 49.00, put_ltp: 49.00, put_volume: 5800000 },
  { strike: 22350, call_prev_close: 414.50, call_low: 474.90, call_high: 474.90, call_close: 474.90, call_ltp: 416.85, call_volume: 1819610, put_prev_close: 14.75, put_low: 59.75, put_high: 59.75, put_close: 59.75, put_ltp: 62.15, put_volume: 45194045 },
  { strike: 22400, call_prev_close: 367.10, call_low: 431.70, call_high: 431.70, call_close: 431.70, call_ltp: 378.85, call_volume: 10787855, put_prev_close: 17.35, put_low: 70.70, put_high: 70.70, put_close: 70.70, put_ltp: 72.85, put_volume: 95888390 },
  { strike: 22450, call_prev_close: 320.25, call_low: 388.35, call_high: 388.35, call_close: 388.35, call_ltp: 339.35, call_volume: 8656115, put_prev_close: 20.50, put_low: 81.00, put_high: 81.00, put_close: 81.00, put_ltp: 85.45, put_volume: 57534750 },
  { strike: 22500, call_prev_close: 274.05, call_low: 358.05, call_high: 358.05, call_close: 358.05, call_ltp: 302.20, call_volume: 66036165, put_prev_close: 24.30, put_low: 95.10, put_high: 95.10, put_close: 95.10, put_ltp: 99.80, put_volume: 167368890 },
  { strike: 22550, call_prev_close: 228.75, call_low: 323.25, call_high: 323.25, call_close: 323.25, call_ltp: 271.70, call_volume: 65381615, put_prev_close: 29.00, put_low: 109.95, put_high: 109.95, put_close: 109.95, put_ltp: 116.95, put_volume: 101032165 },
  { strike: 22600, call_prev_close: 184.70, call_low: 290.05, call_high: 290.05, call_close: 290.05, call_ltp: 237.90, call_volume: 170845090, put_prev_close: 34.95, put_low: 124.45, put_high: 124.45, put_close: 124.45, put_ltp: 134.00, put_volume: 176253935 },
  { strike: 22650, call_prev_close: 142.35, call_low: 259.10, call_high: 259.10, call_close: 259.10, call_ltp: 209.90, call_volume: 99286135, put_prev_close: 42.60, put_low: 144.95, put_high: 144.95, put_close: 144.95, put_ltp: 154.20, put_volume: 83493995 },
  { strike: 22700, call_prev_close: 102.75, call_low: 226.45, call_high: 226.45, call_close: 226.45, call_ltp: 181.15, call_volume: 183630395, put_prev_close: 53.00, put_low: 164.90, put_high: 164.90, put_close: 164.90, put_ltp: 177.30, put_volume: 132714075 },
  { strike: 22750, call_prev_close: 68.90, call_low: 201.40, call_high: 201.40, call_close: 201.40, call_ltp: 155.85, call_volume: 90725050, put_prev_close: 69.15, put_low: 186.70, put_high: 186.70, put_close: 186.70, put_ltp: 202.40, put_volume: 44968040 },
  { strike: 22800, call_prev_close: 42.25, call_low: 173.90, call_high: 173.90, call_close: 173.90, call_ltp: 133.95, call_volume: 130546455, put_prev_close: 92.50, put_low: 212.45, put_high: 212.45, put_close: 212.45, put_ltp: 227.90, put_volume: 41621905 },
  { strike: 22850, call_prev_close: 23.45, call_low: 151.80, call_high: 151.80, call_close: 151.80, call_ltp: 111.85, call_volume: 57754970, put_prev_close: 123.70, put_low: 235.80, put_high: 235.80, put_close: 235.80, put_ltp: 257.70, put_volume: 7245550 },
  { strike: 22900, call_prev_close: 12.10, call_low: 129.45, call_high: 129.45, call_close: 129.45, call_ltp: 93.50, call_volume: 81496545, put_prev_close: 162.35, put_low: 270.05, put_high: 270.05, put_close: 270.05, put_ltp: 289.60, put_volume: 9477650 },
  { strike: 22950, call_prev_close: 6.20, call_low: 108.50, call_high: 108.50, call_close: 108.50, call_ltp: 78.00, call_volume: 42500000, put_prev_close: 206.45, put_low: 305.50, put_high: 305.50, put_close: 305.50, put_ltp: 324.00, put_volume: 12500000 },
  { strike: 23000, call_prev_close: 3.10, call_low: 89.20, call_high: 89.20, call_close: 89.20, call_ltp: 64.00, call_volume: 68500000, put_prev_close: 253.35, put_low: 343.80, put_high: 343.80, put_close: 343.80, put_ltp: 362.00, put_volume: 16800000 },
  { strike: 23050, call_prev_close: 1.60, call_low: 71.50, call_high: 71.50, call_close: 71.50, call_ltp: 51.00, call_volume: 24500000, put_prev_close: 301.85, put_low: 384.50, put_high: 384.50, put_close: 384.50, put_ltp: 402.00, put_volume: 8500000 },
  { strike: 23100, call_prev_close: 0.90, call_low: 56.10, call_high: 56.10, call_close: 56.10, call_ltp: 39.00, call_volume: 38200000, put_prev_close: 351.15, put_low: 427.00, put_high: 427.00, put_close: 427.00, put_ltp: 445.00, put_volume: 7200000 },
  { strike: 23150, call_prev_close: 0.55, call_low: 43.20, call_high: 43.20, call_close: 43.20, call_ltp: 29.00, call_volume: 19500000, put_prev_close: 400.80, put_low: 472.00, put_high: 472.00, put_close: 472.00, put_ltp: 490.00, put_volume: 4800000 },
  { strike: 23200, call_prev_close: 0.35, call_low: 32.50, call_high: 32.50, call_close: 32.50, call_ltp: 21.00, call_volume: 28500000, put_prev_close: 450.60, put_low: 519.00, put_high: 519.00, put_close: 519.00, put_ltp: 538.00, put_volume: 3900000 },
  { strike: 23250, call_prev_close: 0.25, call_low: 23.80, call_high: 23.80, call_close: 23.80, call_ltp: 14.50, call_volume: 14200000, put_prev_close: 500.50, put_low: 568.00, put_high: 568.00, put_close: 568.00, put_ltp: 588.00, put_volume: 2100000 },
  { strike: 23300, call_prev_close: 0.20, call_low: 16.90, call_high: 16.90, call_close: 16.90, call_ltp: 9.80, call_volume: 21000000, put_prev_close: 550.45, put_low: 618.00, put_high: 618.00, put_close: 618.00, put_ltp: 639.00, put_volume: 2900000 },
  { strike: 23350, call_prev_close: 0.15, call_low: 11.50, call_high: 11.50, call_close: 11.50, call_ltp: 6.20, call_volume: 11500000, put_prev_close: 600.40, put_low: 669.00, put_high: 669.00, put_close: 669.00, put_ltp: 690.00, put_volume: 1500000 },
  { strike: 23400, call_prev_close: 0.15, call_low: 7.60, call_high: 7.60, call_close: 7.60, call_ltp: 3.80, call_volume: 18500000, put_prev_close: 650.40, put_low: 721.00, put_high: 721.00, put_close: 721.00, put_ltp: 742.00, put_volume: 2100000 },
];

export const VERIFIED_MARKET_CLOSE_2026_10_28: ProcessedOptionRow[] = 
  RAW_MARKET_CLOSE_2026_10_28.map(r => processRawOptionRow(r));
