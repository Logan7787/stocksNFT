// Standalone execution of technical indicators, position sizing, lot rounding, charges & paper trade tests

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

function calculateEstimatedCharges(entryPrice, exitPrice, quantity, brokeragePerOrder = 20) {
  if (quantity <= 0) return { brokerage: 0, stt: 0, exchangeTurnoverFee: 0, sebiCharges: 0, stampDuty: 0, gst: 0, totalCharges: 0 };
  const buyTurnover = entryPrice * quantity;
  const sellTurnover = exitPrice * quantity;
  const totalTurnover = buyTurnover + sellTurnover;
  const brokerage = brokeragePerOrder * 2;
  const stt = Math.round(sellTurnover * 0.001 * 100) / 100;
  const exchangeTurnoverFee = Math.round(totalTurnover * 0.0005 * 100) / 100;
  const sebiCharges = Math.round(totalTurnover * 0.000001 * 100) / 100;
  const stampDuty = Math.round(buyTurnover * 0.00003 * 100) / 100;
  const gst = Math.round((brokerage + exchangeTurnoverFee + sebiCharges) * 0.18 * 100) / 100;
  const totalCharges = Math.round((brokerage + stt + exchangeTurnoverFee + sebiCharges + stampDuty + gst) * 100) / 100;
  return { brokerage, stt, exchangeTurnoverFee, sebiCharges, stampDuty, gst, totalCharges };
}

function calculateRiskManagementPlan(params) {
  const { availableCapital = 25000, riskPercentage = 1.0, entryPrice, lotSize = 25 } = params;
  const riskBudget = Math.round(((availableCapital * riskPercentage) / 100) * 100) / 100;
  const defaultSl = roundToTick(entryPrice * 0.98);
  const stopLossPrice = params.stopLossPrice !== undefined && params.stopLossPrice > 0 ? roundToTick(params.stopLossPrice) : defaultSl;
  const riskPerUnit = Math.max(0.05, Math.round((entryPrice - stopLossPrice) * 100) / 100);
  const targetPrice = roundToTick(entryPrice + 2.0 * riskPerUnit);
  const rawQuantity = Math.floor(riskBudget / riskPerUnit);
  const lotsCount = Math.floor(rawQuantity / lotSize);
  const finalQuantity = lotsCount * lotSize;
  const oneLotRisk = lotSize * riskPerUnit;
  const isRiskExceeded = oneLotRisk > riskBudget || lotsCount === 0;
  return { riskBudget, stopLossPrice, targetPrice, riskPerUnit, rawQuantity, lotsCount, finalQuantity, isRiskExceeded };
}

console.log('=== RUNNING AUTOMATED UNIT TESTS ===');

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

// Suite
it('Tick size 0.05 rounding', () => {
  assert(roundToTick(145.22) === 145.20, '145.22 -> 145.20');
  assert(roundToTick(145.23) === 145.25, '145.23 -> 145.25');
  assert(roundToTick(145.28) === 145.30, '145.28 -> 145.30');
});

it('EMA 9 series math test', () => {
  const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const ema = calculateEMA(prices, 9);
  assert(ema[8] !== null, '9th item is SMA');
  assert(ema[10] > ema[8], 'Trending up');
});

it('RSI 14 bounded range test', () => {
  const prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112, 114, 113, 115, 117, 116, 118, 120];
  const rsi = calculateRSI(prices, 14);
  const latest = rsi[rsi.length - 1];
  assert(latest > 50 && latest < 100, 'RSI in valid range');
});

it('Position Sizing: ₹25,000 capital, 1% risk budget = ₹250', () => {
  const plan = calculateRiskManagementPlan({
    availableCapital: 25000,
    riskPercentage: 1.0,
    entryPrice: 100,
    stopLossPrice: 98, // risk per unit = ₹2.00
    lotSize: 25
  });
  assert(plan.riskBudget === 250, 'Budget is 250');
  assert(plan.riskPerUnit === 2, 'Risk per unit is 2');
  assert(plan.lotsCount === 5, 'Lots count is 5');
  assert(plan.finalQuantity === 125, 'Final qty is 125');
  assert(plan.isRiskExceeded === false, 'Risk not exceeded');
});

it('Risk Exceeded: TRADE SKIPPED — RISK TOO HIGH when 1 lot risk > risk budget', () => {
  const plan = calculateRiskManagementPlan({
    availableCapital: 25000,
    riskPercentage: 1.0, // ₹250 budget
    entryPrice: 300,
    stopLossPrice: 280, // risk per unit = ₹20 -> 25 * 20 = ₹500 > ₹250
    lotSize: 25
  });
  assert(plan.isRiskExceeded === true, 'Risk exceeded is true');
  assert(plan.lotsCount === 0, 'Lots count is 0');
  assert(plan.finalQuantity === 0, 'Final qty is 0');
});

it('Statutory Charges & Brokerage calculation', () => {
  const charges = calculateEstimatedCharges(100, 104, 50, 20);
  assert(charges.brokerage === 40, 'Brokerage buy+sell is 40');
  assert(charges.stt > 0, 'STT is positive');
  assert(charges.gst > 0, 'GST is positive');
  assert(charges.totalCharges > 40, 'Total charges covers all duties');
});

console.log(`\nTEST RESULTS: ${pass} PASSED, ${fail} FAILED`);
if (fail > 0) process.exit(1);
