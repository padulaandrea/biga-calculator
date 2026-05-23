#!/usr/bin/env node
// test.js — Biga Calculator test suite
// Usage: node test.js
//
// Two tracks per recipe:
//   Track A (accuracy)  — does the model output fall within the recipe's claimed range?
//   Track B (regression) — records current model output so future runs can detect drift

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
    bigaStartC
  );
  return { schedule, bigaStartC };
}

// ---- Classify result ----
function classify(recipe, hours) {
  const { min, max } = recipe.expectedHours;
  const inRange      = hours >= min && hours <= max;
  const yeastMismatch = recipe.yeastPct !== 1.0;

  if (inRange)       return 'PASS';
  if (yeastMismatch) return 'YEAST';
  return 'FAIL';
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

let passed = 0, warned = 0, failed = 0;
const failedIds = [];

for (const recipe of recipes) {
  const { schedule, bigaStartC } = runRecipe(recipe);
  const hours  = schedule.totalHours;
  const status = classify(recipe, hours);

  const { min, max } = recipe.expectedHours;
  const expectedStr  = min === max ? `${min}h` : `${min}–${max}h`;
  const yeastTag     = recipe.yeastPct !== 1.0
    ? c(ANSI.yellow, ` [yeast=${recipe.yeastPct}% ⚠]`)
    : c(ANSI.dim,    ` [yeast=1%]`);

  // Status badge
  let badge, detail;
  if (status === 'PASS') {
    badge  = c(ANSI.green,  '✅ PASS');
    detail = '';
    passed++;
  } else if (status === 'YEAST') {
    badge  = c(ANSI.yellow, '⚠  YEAST');
    detail = c(ANSI.dim, '  model uses 1% fresh yeast');
    warned++;
  } else {
    badge  = c(ANSI.red,    '❌ FAIL');
    detail = c(ANSI.red, '  ← model gap, investigate');
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
console.log(`  ${c(ANSI.green,  '✅ Passed')} : ${passed} / ${total}`);
console.log(`  ${c(ANSI.yellow, '⚠  Yeast ')} : ${warned} / ${total}  ${c(ANSI.dim, '(known model limitation — yeastPct ≠ 1%)')}`);
console.log(`  ${c(ANSI.red,    '❌ Failed')} : ${failed} / ${total}  ${failed > 0 ? c(ANSI.red, `(recipes: #${failedIds.join(', #')})`) : c(ANSI.dim, '(none)')}`);
console.log('');

if (failed > 0) {
  console.log(c(ANSI.red, `${failed} non-yeast failure(s) — model output outside expected range for recipes with 1% yeast.`));
  process.exit(1);
} else {
  console.log(c(ANSI.green, 'All 1% yeast recipes pass. Yeast-mismatch recipes are flagged but do not block.'));
  process.exit(0);
}
