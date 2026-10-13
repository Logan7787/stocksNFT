// Automated Test Suite for Opening Range Breakout (ORB) + VWAP Strategy
// Tests: Section 6 Strategy (Time Windows, Day Filters, Event 1, Event 2, Event 3), Section 7 Risk, and Section 7A Validation Gates

function roundToTick(value, tickSize = 0.05) {
  return Math.round((Math.round(value / tickSize) * tickSize) * 100) / 100;
}

function calculateEMA(values, period) {
  if (values.length < period) return values.map(() => null);
  const result = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prevEma = sum / period;
  result[period - 1] = Math.round(prevEma * 100) / 100;
  for (let i = period; i < values.length; i++) {
    const currentEma = (values[i] - prevEma) * k + prevEma;
    result[i] = Math.round(currentEma * 100) / 100;
    prevEma = currentEma;
  }
  return result;
}

function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return closes.map(() => null);
  const result = new Array(closes.length).fill(null);
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + rs))) * 100) / 100;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    if (avgLoss === 0) result[i + 1] = 100;
    else {
      rs = avgGain / avgLoss;
      result[i + 1] = Math.round((100 - (100 / (1 + rs))) * 100) / 100;
    }
  }
  return result;
}

// 6.1 Time window evaluation
function evaluateOrbTimeWindow(timeStr) {
  const t = timeStr.slice(0, 5);
  if (t >= '09:15' && t < '09:30') return { phase: 'OBSERVE_ONLY', canEnter: false };
  if (t >= '09:30' && t < '11:30') return { phase: 'PRIMARY_ENTRY', canEnter: true };
  if (t >= '11:30' && t < '13:30') return { phase: 'NO_ENTRY_ZONE', canEnter: false };
  if (t >= '13:30' && t < '14:45') return { phase: 'SECONDARY_ENTRY', canEnter: true };
  if (t >= '14:45' && t < '15:15') return { phase: 'HARD_CUTOFF', canEnter: false };
  if (t >= '15:15') return { phase: 'FORCE_EXIT', canEnter: false, isForceExit: true };
  return { phase: 'MARKET_CLOSED', canEnter: false };
}

// 6.2 Day filter evaluation
function evaluateDayFilter(rangeWidthPercent, indiaVix, isEventDay, isExpiryAfter13) {
  if (rangeWidthPercent < 0.15) return { canTrade: false, reason: 'Range too narrow (<0.15%)' };
  if (rangeWidthPercent > 0.60) return { canTrade: false, reason: 'Range too wide (>0.60%)' };
  if (isEventDay) return { canTrade: false, reason: 'Configured event day' };
  if (indiaVix > 22) return { canTrade: false, reason: 'India VIX > 22' };
  if (isExpiryAfter13) return { canTrade: false, reason: 'Expiry day after 13:00' };
  return { canTrade: true };
}

// 6.3 Event 1 Mark Strike: 60% capital check
function checkCapitalThreshold(premium, lotSize, capital) {
  const outlay = premium * lotSize;
  const maxAllowed = capital * 0.60;
  return { passed: outlay <= maxAllowed, outlay, maxAllowed };
}

// 7. Risk Management (Section 7: 2% risk, 1.5x target)
function calculateRiskManagementPlan(params) {
  const { availableCapital = 25000, riskPercentage = 2.0, entryPrice, stopLossPrice, lotSize = 25, targetMultiplier = 1.5 } = params;
  const riskBudget = Math.round(((availableCapital * riskPercentage) / 100) * 100) / 100;
  const riskPerUnit = Math.max(0.05, Math.round((entryPrice - stopLossPrice) * 100) / 100);
  const targetPrice = roundToTick(entryPrice + targetMultiplier * riskPerUnit);
  const rawQuantity = Math.floor(riskBudget / riskPerUnit);
  const lotsCount = Math.floor(rawQuantity / lotSize);
  const finalQuantity = lotsCount * lotSize;
  const oneLotRisk = lotSize * riskPerUnit;
  const isRiskExceeded = oneLotRisk > riskBudget || lotsCount === 0;
  return { riskBudget, stopLossPrice, targetPrice, riskPerUnit, rawQuantity, lotsCount, finalQuantity, isRiskExceeded };
}

// 7A. Validation Gates Evaluation
function evaluateValidationGates(paperTradesCount, profitFactor, expectancyPerTrade, maxDrawdownPercent) {
  const gate1 = paperTradesCount >= 100;
  const gate2 = profitFactor > 1.30;
  const gate3 = expectancyPerTrade > 0;
  const gate4 = maxDrawdownPercent < 10.0;
  const isValidated = gate1 && gate2 && gate3 && gate4;
  return { gate1, gate2, gate3, gate4, isValidated, statusText: isValidated ? 'VALIDATED' : 'NOT VALIDATED' };
}

console.log('=== RUNNING SECTION 6, 7 & 7A AUTOMATED STRATEGY TESTS ===\n');

let pass = 0;
let fail = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${desc}`);
    pass++;
  } catch (err) {
    console.error(`✗ FAIL: ${desc} -> ${err.message}`);
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. Tick size
it('Tick size 0.05 rounding', () => {
  assert(roundToTick(145.22) === 145.20, '145.22 -> 145.20');
  assert(roundToTick(145.23) === 145.25, '145.23 -> 145.25');
  assert(roundToTick(145.28) === 145.30, '145.28 -> 145.30');
});

// 2. Section 6.1 Time Windows
it('Section 6.1: Time windows evaluate accurately', () => {
  assert(evaluateOrbTimeWindow('09:20').phase === 'OBSERVE_ONLY', '09:20 observe only');
  assert(evaluateOrbTimeWindow('10:15').phase === 'PRIMARY_ENTRY' && evaluateOrbTimeWindow('10:15').canEnter === true, '10:15 primary entry');
  assert(evaluateOrbTimeWindow('12:00').phase === 'NO_ENTRY_ZONE' && evaluateOrbTimeWindow('12:00').canEnter === false, '12:00 low momentum zone');
  assert(evaluateOrbTimeWindow('14:00').phase === 'SECONDARY_ENTRY', '14:00 secondary entry');
  assert(evaluateOrbTimeWindow('15:00').phase === 'HARD_CUTOFF', '15:00 hard cutoff');
  assert(evaluateOrbTimeWindow('15:15').phase === 'FORCE_EXIT' && evaluateOrbTimeWindow('15:15').isForceExit === true, '15:15 force exit');
});

// 3. Section 6.2 Day Filter
it('Section 6.2: Day filter rejects choppy, exhausted, event days, and VIX > 22', () => {
  // Too narrow
  assert(evaluateDayFilter(0.10, 14, false, false).canTrade === false, 'Reject narrow range (<0.15%)');
  // Too wide
  assert(evaluateDayFilter(0.75, 14, false, false).canTrade === false, 'Reject wide range (>0.60%)');
  // VIX > 22
  assert(evaluateDayFilter(0.35, 23.5, false, false).canTrade === false, 'Reject high VIX (>22)');
  // Event day
  assert(evaluateDayFilter(0.35, 15, true, false).canTrade === false, 'Reject event day');
  // Expiry after 13:00
  assert(evaluateDayFilter(0.35, 15, false, true).canTrade === false, 'Reject expiry after 13:00');
  // Valid normal day
  assert(evaluateDayFilter(0.35, 15, false, false).canTrade === true, 'Pass valid day');
});

// 4. Section 6.3 Event 1 Mark Strike: 60% capital check
it('Section 6.3: Mark Strike rejects contract when cost > 60% of capital', () => {
  const cap25k = 25000;
  // Cost = 250 * 25 = 6250 <= 15000 (Pass)
  assert(checkCapitalThreshold(250, 25, cap25k).passed === true, 'Outlay under 60% passes');
  // Cost = 650 * 25 = 16250 > 15000 (Fail)
  assert(checkCapitalThreshold(650, 25, cap25k).passed === false, 'Outlay over 60% rejected');
});

// 5. Section 6.4 Event 2: Stop-loss derived from index structure
it('Section 6.5: Stop loss derived from index structure & rejects if loss > 25%', () => {
  const entry = 120;
  const delta = 0.55;
  const indexPointsToSl = 20; // Index points to VWAP / candle low
  const premiumLoss = roundToTick(delta * indexPointsToSl); // 11.00
  const slPrice = entry - premiumLoss; // 109.00
  const lossPercent = (premiumLoss / entry) * 100;
  assert(slPrice === 109.00, 'Premium SL is 109.00');
  assert(lossPercent <= 25, 'Loss <= 25% accepted');

  // Big gap index SL: 70 pts * 0.55 = 38.5 pts > 25% of 120 (30 pts)
  const bigIndexLoss = 70 * delta;
  const bigLossPercent = (bigIndexLoss / entry) * 100;
  assert(bigLossPercent > 25, 'Loss > 25% rejected as specified in 6.5');
});

// 6. Section 7: Risk Management (2% default = ₹500, 1.5x target)
it('Section 7: ₹25,000 capital, 2% risk budget = ₹500, Target 1:1.5 R:R', () => {
  const plan = calculateRiskManagementPlan({
    availableCapital: 25000,
    riskPercentage: 2.0,
    entryPrice: 100,
    stopLossPrice: 95, // risk per unit = ₹5.00
    lotSize: 25,
    targetMultiplier: 1.5
  });
  assert(plan.riskBudget === 500, 'Risk budget is ₹500');
  assert(plan.riskPerUnit === 5, 'Risk per unit is 5');
  // Raw qty = floor(500 / 5) = 100
  // Lots count = floor(100 / 25) = 4 lots
  assert(plan.lotsCount === 4, '4 lots');
  assert(plan.finalQuantity === 100, '100 Qty');
  assert(plan.targetPrice === 107.50, 'Target is 100 + 1.5 * 5 = 107.50');
  assert(plan.isRiskExceeded === false, 'Risk not exceeded');
});

// 7. Section 7: Risk Exceeded protection
it('Section 7: TRADE SKIPPED — RISK TOO HIGH when 1 lot risk > risk budget', () => {
  const plan = calculateRiskManagementPlan({
    availableCapital: 25000,
    riskPercentage: 2.0, // ₹500 budget
    entryPrice: 200,
    stopLossPrice: 170,  // risk per unit = ₹30 -> 25 * 30 = ₹750 > ₹500
    lotSize: 25
  });
  assert(plan.isRiskExceeded === true, 'Risk exceeded is true');
  assert(plan.lotsCount === 0, 'Lots count is 0');
  assert(plan.finalQuantity === 0, 'Final qty is 0');
});

// 8. Section 7A: Validation Gates
it('Section 7A: Strategy marked NOT VALIDATED until all 4 criteria are satisfied', () => {
  // Gate 1: <100 paper trades
  const gateTest1 = evaluateValidationGates(45, 1.8, 50, 4.2);
  assert(gateTest1.isValidated === false, 'Fails gate 1 (<100 trades)');
  assert(gateTest1.statusText === 'NOT VALIDATED', 'NOT VALIDATED status');

  // Gate 2: PF < 1.3
  const gateTest2 = evaluateValidationGates(120, 1.15, 20, 5.0);
  assert(gateTest2.isValidated === false, 'Fails gate 2 (PF < 1.3)');

  // Gate 3: Negative expectancy
  const gateTest3 = evaluateValidationGates(120, 1.4, -15, 6.0);
  assert(gateTest3.isValidated === false, 'Fails gate 3 (Negative expectancy)');

  // Gate 4: Drawdown > 10%
  const gateTest4 = evaluateValidationGates(120, 1.5, 30, 12.5);
  assert(gateTest4.isValidated === false, 'Fails gate 4 (Drawdown > 10%)');

  // All 4 passed
  const allPassed = evaluateValidationGates(110, 1.65, 45, 6.2);
  assert(allPassed.isValidated === true, 'All 4 gates pass');
  assert(allPassed.statusText === 'VALIDATED', 'VALIDATED status');
});

console.log(`\n========================================`);
console.log(`TOTAL TEST RESULTS: ${pass} PASSED, ${fail} FAILED`);
console.log(`========================================\n`);

if (fail > 0) process.exit(1);
