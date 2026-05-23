// biga-calc.js — pure calculation functions, shared by biga.js (browser) and test.js (Node.js)
//
// Loaded as a plain <script> in the browser (functions become globals).
// In Node.js: const { bigaHours, ... } = require('./biga-calc.js')

// ---- Date helpers ----
function addMinutes(d, m) { return new Date(d.getTime() + m * 60 * 1000); }
function addHours(d, h)   { return new Date(d.getTime() + h * 3600 * 1000); }

// ---- Biga fermentation model ----
// Calibrated for STANDARD biga (1% fresh yeast / 0.33% dry) against multiple
// self-consistent anchors at 50-60% hydration:
//   50% · 12°C → 23h   50% · 18°C → 16h   50% · 26°C → 11h
//   60% · 12°C → 21h
// Hydration coefficient 0.01 (≈ 9% time change per +10% hydration — modest,
// matching real-world biga behavior). Earlier versions overstated hydration
// because they anchored to Giorilli's "fast fridge presets" (16h/24h at 4°C)
// which use boosted yeast and aren't a typical biga.
// Split Q10: cold side (≤18°C) ≈ 1.85, warm side (>18°C) ≈ 1.6.
function bigaHours(tempC, hydrationPct) {
  if (tempC <= 0) tempC = 0.5;
  const q10 = tempC <= 18 ? 1.85 : 1.6;
  const tempFactor = Math.pow(q10, (18 - tempC) / 10);
  const hydrationFactor = Math.exp((50 - hydrationPct) * 0.01);
  return 16 * tempFactor * hydrationFactor;
}

// ---- Estimate biga starting temp from water + flour temps ----
// Empirical approximation: biga starts at avg(water, flour) + 1°C friction.
// Giorilli's formula (water = 55 - flour - target) is what gives biga_start ≈ target.
function bigaStartTemp(waterTempC, flourTempC) {
  return (waterTempC + flourTempC) / 2 + 1;
}

// ---- Compute hours for one phase, with biga temperature equilibration ----
// Newton's law of cooling: biga cools/warms toward restTempC with time constant
// τ ≈ 6h (calibrated for typical home biga, 1-3kg in a covered container in
// a fridge or fermabiga). Slower than open-air cooling because of the cover
// and the dough's own thermal mass. Fermentation progress accumulates at the
// rate corresponding to the biga's current temperature; we integrate until
// progress = 1 (biga ready). Correctly handles small AND large temp deltas.
function phaseHours(restTempC, hydrationPct, bigaStartC) {
  if (bigaStartC == null || Math.abs(bigaStartC - restTempC) < 1.5) {
    return bigaHours(restTempC, hydrationPct);
  }
  const tau = 6;        // hours · dough thermal time constant
  const dt  = 0.1;      // 6-minute integration step
  let progress = 0;
  let temp = bigaStartC;
  let t = 0;
  while (progress < 1 && t < 200) {
    const rate = 1 / bigaHours(temp, hydrationPct);
    progress += rate * dt;
    temp += (restTempC - temp) * (dt / tau);
    t += dt;
  }
  return t;
}

// ---- Hybrid schedule (RT kickstart + cold rest) ----
// Numerically simulates biga temperature throughout BOTH phases. Phase 1: biga
// warms/cools toward rtTempC. Phase 2: biga continues from wherever it ended,
// cooling toward mainTempC — fermentation runs at the current temp throughout.
// This properly captures the productive cooling tail when biga goes warm → fridge.
function computeSchedule(startTime, hydPct, useHybrid, rtTempC, rtHours, mainTempC, bigaStartC) {
  if (!useHybrid) {
    const hours = phaseHours(mainTempC, hydPct, bigaStartC);
    return {
      hybrid: false,
      mainTempC,
      totalHours: hours,
      readyTime: addHours(startTime, hours),
    };
  }

  const tau = 6;        // dough thermal time constant (h)
  const dt  = 0.1;      // integration step (6 min)
  let progress = 0;
  let temp = (bigaStartC == null) ? rtTempC : bigaStartC;
  let t = 0;

  // Phase 1: room temperature kickstart
  while (t < rtHours && progress < 1 && t < 200) {
    const rate = 1 / bigaHours(temp, hydPct);
    progress += rate * dt;
    temp += (rtTempC - temp) * (dt / tau);
    t += dt;
  }

  if (progress >= 1) {
    // Biga finished during RT phase — no cold phase needed
    return {
      hybrid: true,
      rtTempC, rtHours: t,
      coldTempC: mainTempC, coldHours: 0,
      totalHours: t,
      moveToColdTime: addHours(startTime, t),
      readyTime: addHours(startTime, t),
      overflow: true,
    };
  }

  // Phase 2: cold storage — biga continues cooling from wherever phase 1 left it
  const rtEnd = t;
  while (progress < 1 && t < 200) {
    const rate = 1 / bigaHours(temp, hydPct);
    progress += rate * dt;
    temp += (mainTempC - temp) * (dt / tau);
    t += dt;
  }

  return {
    hybrid: true,
    rtTempC, rtHours,
    coldTempC: mainTempC, coldHours: t - rtEnd,
    totalHours: t,
    moveToColdTime: addHours(startTime, rtHours),
    readyTime: addHours(startTime, t),
    overflow: false,
  };
}

// Conditional export for Node.js (no-op in browser)
if (typeof module !== 'undefined') {
  module.exports = { bigaHours, bigaStartTemp, phaseHours, computeSchedule, addHours, addMinutes };
}
