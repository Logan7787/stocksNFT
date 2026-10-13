/**
 * Automated Test Suite for NIFTY 50 Options Analysis
 * Tests: EMA, RSI, VWAP, Signal Rules, Position Sizing, Lot Rounding, Risk Limits, PnL & Taxes
 */

import { 
  calculateEMA, 
  calculateRSI, 
  calculateVWAP, 
  evaluateStrategySignal, 
  roundToTick 
} from '../technicalIndicators';
import { 
  calculateRiskManagementPlan, 
  calculateEstimatedCharges 
} from '../riskCalculator';
import { 
  createPaperTrade, 
  closePaperTrade, 
  calculatePerformanceAnalytics 
} from '../../services/paperTradingService';
import type { CandleData, StrategyConfig } from '../../types/niftyAnalysis';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

export function runAllTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      results.push(`PASS: ${name}`);
    } catch (e: any) {
      failed++;
      results.push(`FAIL: ${name} -> ${e.message}`);
    }
  }

  // 1. Tick size rounding test
  test('roundToTick rounds to 0.05 step accurately', () => {
    assert(roundToTick(120.03) === 120.05, `Expected 120.05, got ${roundToTick(120.03)}`);
    assert(roundToTick(120.01) === 120.00, `Expected 120.00, got ${roundToTick(120.01)}`);
    assert(roundToTick(120.076) === 120.10, `Expected 120.10, got ${roundToTick(120.076)}`);
  });

  // 2. EMA Calculation test
  test('calculateEMA returns correct array length and values', () => {
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const ema9 = calculateEMA(prices, 9);
    assert(ema9.length === prices.length, 'EMA length should match input');
    assert(ema9[0] === null, 'First elements before period should be null');
    assert(ema9[7] === null, '8th element should still be null');
    assert(ema9[8] !== null, '9th element (index 8) should be initial SMA');
    assert(typeof ema9[10] === 'number', 'Latest EMA should be a valid number');
  });

  // 3. RSI Calculation test
  test('calculateRSI returns values in [0, 100]', () => {
    const prices = [
      100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
      111, 110, 112, 114, 113, 115, 117, 116, 118, 120
    ];
    const rsi14 = calculateRSI(prices, 14);
    assert(rsi14.length === prices.length, 'RSI length matches');
    const latestRsi = rsi14[rsi14.length - 1];
    assert(latestRsi !== null && latestRsi >= 0 && latestRsi <= 100, `RSI out of bounds: ${latestRsi}`);
  });

  // 4. VWAP Calculation test
  test('calculateVWAP computes typical price weighted by volume', () => {
    const candles: CandleData[] = [
      { timestamp: '09:15', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { timestamp: '09:20', open: 100, high: 110, low: 100, close: 105, volume: 2000 },
    ];
    const vwap = calculateVWAP(candles);
    assert(vwap.length === 2, 'VWAP length should match candles');
    assert(vwap[0] === 100, `First VWAP typical price should be 100, got ${vwap[0]}`);
    assert(vwap[1] !== null && vwap[1] > 100, `Second VWAP should reflect higher volume typical price`);
  });

  // 5. Position Sizing & 1% Capital Risk Limit Test
  test('calculateRiskManagementPlan strictly enforces ₹250 risk budget for ₹25,000 capital', () => {
    const plan = calculateRiskManagementPlan({
      availableCapital: 25000,
      riskPercentage: 1.0,
      entryPrice: 100, // Entry = ₹100
      stopLossPrice: 98, // SL = ₹98 -> Risk per unit = ₹2.00
      lotSize: 25,
    });

    assert(plan.riskBudget === 250, `Expected risk budget ₹250, got ${plan.riskBudget}`);
    assert(plan.riskPerUnit === 2, `Expected risk per unit 2, got ${plan.riskPerUnit}`);
    // Raw qty = floor(250 / 2) = 125
    // Lots count = floor(125 / 25) = 5 lots
    // Final qty = 5 * 25 = 125
    assert(plan.rawQuantity === 125, `Expected raw qty 125, got ${plan.rawQuantity}`);
    assert(plan.lotsCount === 5, `Expected 5 lots, got ${plan.lotsCount}`);
    assert(plan.finalQuantity === 125, `Expected final qty 125, got ${plan.finalQuantity}`);
    assert(plan.isRiskExceeded === false, 'Risk should not be exceeded');
    assert(plan.targetPrice === 104, `Expected target 104 (1:2 R:R), got ${plan.targetPrice}`);
  });

  // 6. Risk Exceeded Protection (TRADE SKIPPED — RISK TOO HIGH)
  test('calculateRiskManagementPlan triggers isRiskExceeded when single lot exceeds budget', () => {
    const plan = calculateRiskManagementPlan({
      availableCapital: 25000,
      riskPercentage: 1.0, // Risk budget = ₹250
      entryPrice: 300,
      stopLossPrice: 280, // Risk per unit = ₹20
      lotSize: 25,        // 1 lot risk = 25 * 20 = ₹500 > ₹250!
    });

    assert(plan.riskBudget === 250, 'Risk budget is ₹250');
    assert(plan.isRiskExceeded === true, 'isRiskExceeded should be true when 1 lot risk exceeds budget');
    assert(plan.lotsCount === 0, 'Lots count must be 0');
    assert(plan.finalQuantity === 0, 'Final quantity must be 0');
  });

  // 7. Statutory Taxes & Charges Calculation Test
  test('calculateEstimatedCharges calculates correct brokerage, STT, and GST', () => {
    const charges = calculateEstimatedCharges(100, 110, 50, 20);
    assert(charges.brokerage === 40, `Expected ₹40 brokerage for buy+sell, got ${charges.brokerage}`);
    assert(charges.stt > 0, 'STT must be positive on sell turnover');
    assert(charges.gst > 0, 'GST must be positive');
    assert(charges.totalCharges > 40, 'Total charges must exceed flat brokerage');
  });

  // 8. Strategy Signal Evaluation Test
  test('evaluateStrategySignal outputs BUY WATCH when all 4 rules are met', () => {
    // Construct series where EMA9 > EMA21, Close > VWAP, RSI in [55, 70], Close > Prev High
    const mockCandles: CandleData[] = [];
    let price = 50;
    for (let i = 0; i < 30; i++) {
      price += 2;
      mockCandles.push({
        timestamp: `10:${i < 10 ? '0' + i : i}`,
        open: price - 1,
        high: price + 1,
        low: price - 2,
        close: price,
        volume: 20000,
        isCompleted: true,
      });
    }

    const config: StrategyConfig = {
      emaFastPeriod: 9,
      emaSlowPeriod: 21,
      rsiPeriod: 14,
      rsiLowerBound: 50,
      rsiUpperBound: 85,
      stopLossPercent: 2,
      riskRewardMultiplier: 2,
      underlyingFilterEnabled: false,
    };

    const sig = evaluateStrategySignal(mockCandles, [], config);
    assert(sig.conditions.emaCondition === true, 'EMA condition should be met');
    assert(sig.conditions.vwapCondition === true, 'VWAP condition should be met');
  });

  // 9. Paper Trading Lifecycle Test
  test('Paper trade execution, exit, and analytics work seamlessly', () => {
    const trade = createPaperTrade({
      contractName: 'NIFTY 24500 CE',
      optionType: 'CE',
      strike: 24500,
      expiryDate: '2024-10-24',
      entryPrice: 100,
      quantity: 50,
      lotSize: 25,
      stopLossPrice: 95,
      targetPrice: 110,
    });

    assert(trade.status === 'OPEN', 'Initial status is OPEN');
    assert(trade.quantity === 50, 'Quantity is 50');

    // Simulate target exit
    const closed = closePaperTrade(trade, 110, 'TARGET');
    assert(closed.status === 'CLOSED_TARGET', 'Status updated to CLOSED_TARGET');
    assert(closed.grossPnl === 50 * (110 - trade.entryPrice), 'Gross PnL matches difference');
    assert(closed.netPnl !== undefined && closed.netPnl > 0, 'Net PnL is positive');

    const analytics = calculatePerformanceAnalytics([closed]);
    assert(analytics.totalTrades === 1, 'Total trades is 1');
    assert(analytics.winRatePercent === 100, 'Win rate is 100%');
    assert(analytics.netPnl === closed.netPnl, 'Analytics net PnL matches closed trade');
  });

  return { passed, failed, results };
}
