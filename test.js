#!/usr/bin/env node
// test.js — Biga Calculator test suite
// Usage: node test.js
//
// Each recipe is run using its actual yeastPct.
// Policy: overestimation is dangerous (baker waits too long → over-fermentation).
//         underestimation ≤ 2h is acceptable (baker checks early, waits a bit more).
//         underestimation > 2h is a warning (safe, but the mismatch is too large to ignore).

'use strict';

const { bigaStartTemp, computeSchedule } = require('./biga-calc.js');
const recipes = require('./recipes.json');

const ANSI = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
};

const c = (code, str) => `${code}${str}${ANSI.reset}`;

// ---- Run a single recipe through the model ----
function runRecipe(recipe) {
  const bigaStartC = bigaStartTemp(recipe.waterTemp, recipe.flourTemp);
  const schedule   = computeSchedule(
    new Date('2025-01-01T08:00:00'),  // fixed reference time — totalHours is independent
    recipe.bigaHyd,
    recipe.useRT,
    recipe.rtTemp  || 20,
    recipe.rtHours || 0,
    recipe.restTemp,
    bigaStartC,
    recipe.yeastPct
  );
  return { schedule, bigaStartC };
}

// ---- Classify result ----
const UNDER_TOLERANCE = 2.5; // hours — acceptable underestimation (baker checks early, waits a bit more)
const OVER_TOLERANCE  = 1; // hours — acceptable overestimation  (small buffer for model noise)

function classify(recipe, hours) {
  const { min, max } = recipe.expectedHours;
  if (hours >= min - UNDER_TOLERANCE && hours <= max + OVER_TOLERANCE) return 'PASS';       // ✅
  if (hours > max + OVER_TOLERANCE)                                     return 'FAIL_OVER';  // ❌
  return 'WARN_EARLY';                                                                       // ⬇
}

// ---- Format schedule detail ----
function scheduleDetail(schedule) {
  if (!schedule.hybrid) {
    return `${schedule.totalHours.toFixed(1)}h @ ${schedule.mainTempC}°C`;
  }
  if (schedule.overflow) {
    return `${schedule.totalHours.toFixed(1)}h (finished during RT phase)`;
  }
  return `${schedule.rtHours.toFixed(1)}h@RT + ${schedule.coldHours.toFixed(1)}h@${schedule.coldTempC}°C = ${schedule.totalHours.toFixed(1)}h total`;
}

// ---- Main ----
console.log(`\n${c(ANSI.bold, '=== Biga Calculator — Test Suite ===')} ${c(ANSI.dim, `(${recipes.length} recipes)`)}\n`);

let passed = 0, early = 0, failed = 0;
const failedIds = [], earlyIds = [];

for (const recipe of recipes) {
  const { schedule, bigaStartC } = runRecipe(recipe);
  const hours  = schedule.totalHours;
  const status = classify(recipe, hours);

  const { min, max } = recipe.expectedHours;
  const expectedStr  = min === max ? `${min}h` : `${min}–${max}h`;
  const yeastTag     = recipe.yeastPct !== 1.0
    ? c(ANSI.yellow, ` [yeast=${recipe.yeastPct}%]`)
    : c(ANSI.dim,    ` [yeast=1%]`);

  // Status badge
  let badge, detail;
  if (status === 'PASS') {
    badge  = c(ANSI.green,  '✅ PASS');
    detail = '';
    passed++;
  } else if (status === 'WARN_EARLY') {
    const gap = (recipe.expectedHours.min - hours).toFixed(1);
    badge  = c(ANSI.cyan,   '⬇  EARLY');
    detail = c(ANSI.dim, `  underestimates by ${gap}h — baker checks early, safe`);
    early++;
    earlyIds.push(recipe.id);
  } else {
    const gap = (hours - recipe.expectedHours.max).toFixed(1);
    badge  = c(ANSI.red,    '❌ OVER');
    detail = c(ANSI.red, `  overestimates by ${gap}h — baker may over-ferment`);
    failed++;
    failedIds.push(recipe.id);
  }

  // RT context string
  const rtStr = recipe.useRT
    ? `kickstart=${recipe.rtHours.toFixed(1)}h@${recipe.rtTemp}°C  `
    : '';

  console.log(`${c(ANSI.bold, `#${String(recipe.id).padStart(2)}`)}  ${recipe.source}${yeastTag}`);
  console.log(`     ${c(ANSI.dim, `rest=${recipe.restTemp}°C  ${rtStr}water=${recipe.waterTemp}°C  flour=${recipe.flourTemp}°C  → bigaStart≈${bigaStartC.toFixed(1)}°C`)}`);
  console.log(`     expected: ${c(ANSI.cyan, expectedStr.padEnd(8))} model: ${c(ANSI.bold, `${hours.toFixed(1)}h`)}  (${scheduleDetail(schedule)})`);
  console.log(`     ${badge}${detail}`);
  console.log('');
}

// ---- Summary ----
const total = recipes.length;
console.log(c(ANSI.bold, '=== Summary ==='));
console.log(`  ${c(ANSI.green, '✅ Passed     ')} : ${passed} / ${total}`);
console.log(`  ${c(ANSI.cyan,  '⬇  Early      ')} : ${early}  / ${total}  ${c(ANSI.dim, `(underestimates >2h — safe but imprecise)${earlyIds.length ? '  #' + earlyIds.join(', #') : ''}`)}`);
console.log(`  ${c(ANSI.red,   '❌ Overestimate')} : ${failed} / ${total}  ${failed > 0 ? c(ANSI.red, `(model gap — investigate)  #${failedIds.join(', #')}`) : c(ANSI.dim, '(none — ✓)')}`);
console.log('');

if (failed > 0) {
  console.log(c(ANSI.red, `${failed} overestimate(s) — model predicts longer than reality, risk of over-fermentation.`));
  process.exit(1);
} else {
  console.log(c(ANSI.green, 'No overestimates. Model is safe (may underestimate, baker just waits a bit longer).'));
  process.exit(0);
}
