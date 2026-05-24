(() => {
  const $ = id => document.getElementById(id);

  const inputs = {
    balls:      $('balls'),
    ballWeight: $('ballWeight'),
    startTime:  $('startTime'),
    bigaHyd:    $('bigaHyd'),
    temp:       $('temp'),
    useRT:      $('useRT'),
    rtTemp:     $('rtTemp'),
    rtHours:    $('rtHours'),
    usePro:     $('usePro'),
    flourTemp:  $('flourTemp'),
    waterTemp:  $('waterTemp'),
    yeastPct:   $('yeastPct'),
    bigaPct:    $('bigaPct'),
    totalHyd:   $('totalHyd'),
    salt:       $('salt'),
    oil:        $('oil'),
    malt:       $('malt'),
  };

  const out = {
    bigaHydVal:         $('bigaHydVal'),
    tempVal:            $('tempVal'),
    rtTempVal:          $('rtTempVal'),
    rtHoursVal:         $('rtHoursVal'),
    flourTempVal:       $('flourTempVal'),
    waterTempVal:       $('waterTempVal'),
    yeastPctVal:        $('yeastPctVal'),
    bigaPctVal:         $('bigaPctVal'),
    totalHydVal:        $('totalHydVal'),
    saltVal:            $('saltVal'),
    oilVal:             $('oilVal'),
    maltVal:            $('maltVal'),
    recipeMeta:         $('recipeMeta'),
    bigaList:           $('bigaList'),
    finalList:          $('finalList'),
    schedule:           $('schedule'),
    bigaResultsContent: $('bigaResultsContent'),
    bigaPreviewContent: $('bigaPreviewContent'),
    rtControls:         $('rtControls'),
    useRTRow:           $('useRTRow'),
    proControls:        $('proControls'),
    useProRow:          $('useProRow'),
    proReadout:         $('proReadout'),
    tempHint:           $('tempHint'),
  };

  // ---- Init datetime to "now" rounded to next quarter hour ----
  function nowForInput() {
    const d = new Date();
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    d.setMinutes(m + ((15 - (m % 15)) % 15));
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  inputs.startTime.value = nowForInput();

  // ---- Helpers ----
  const fmt = (n, dp = 0) => {
    if (n < 1 && dp === 0) return n.toFixed(2);
    return n.toFixed(dp);
  };

  const row = (name, sub, amount, accent = false, isSub = false) => `
    <div class="ing-row${isSub ? ' ing-sub' : ''}">
      <div class="ing-name">${name}${sub ? `<small>${sub}</small>` : ''}</div>
      <div class="ing-amount">${accent ? `<em>${amount}</em>` : amount}</div>
    </div>`;

  const resultRow = (label, sub, value, isTotal = false) => `
    <div class="biga-results-row${isTotal ? ' is-total' : ''}">
      <span class="br-label">${label}${sub ? `<small>${sub}</small>` : ''}</span>
      <span class="br-value">${value}</span>
    </div>`;

  function fmtClock(d) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  function fmtDay(d) {
    return d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
  }
  // addMinutes, addHours, bigaHours, bigaStartTemp, phaseHours, computeSchedule
  // are loaded from biga-calc.js (global scope) — see index.html script order.

  // ---- Progressive slider fills ----
  function updateSliderFill(el) {
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const pct = ((parseFloat(el.value) - min) / (max - min) * 100).toFixed(2) + '%';
    el.style.setProperty('--fill', pct);
  }
  function updateAllSliderFills() {
    document.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
  }

  // ---- Live label updates ----
  function updateLabels() {
    out.bigaHydVal.textContent   = `${inputs.bigaHyd.value}%`;
    out.tempVal.textContent      = `${inputs.temp.value}°C`;
    out.rtTempVal.textContent    = `${inputs.rtTemp.value}°C`;
    out.rtHoursVal.textContent   = `${parseFloat(inputs.rtHours.value).toFixed(1)} h`;
    out.flourTempVal.textContent = `${inputs.flourTemp.value}°C`;
    out.waterTempVal.textContent = `${inputs.waterTemp.value}°C`;
    out.yeastPctVal.textContent  = `${parseFloat(inputs.yeastPct.value).toFixed(2)}%`;
    out.bigaPctVal.textContent   = `${inputs.bigaPct.value}%`;
    out.totalHydVal.textContent  = `${inputs.totalHyd.value}%`;
    out.saltVal.textContent      = `${parseFloat(inputs.salt.value).toFixed(1)}%`;
    out.oilVal.textContent       = `${parseFloat(inputs.oil.value).toFixed(1)}%`;
    out.maltVal.textContent      = `${parseFloat(inputs.malt.value).toFixed(2)}%`;
  }

  // ---- Visibility ----
  function syncRTVisibility() {
    const on = inputs.useRT.checked;
    out.rtControls.classList.toggle('visible', on);
    out.useRTRow.classList.toggle('is-on', on);
  }
  function syncProVisibility() {
    const on = inputs.usePro.checked;
    out.proControls.classList.toggle('visible', on);
    out.useProRow.classList.toggle('is-on', on);
  }

  // ---- Temperature hint under Rest Temp (non-Pro only) ----
  // Assumes normal room-temperature flour (~20°C) and computes the water temp
  // that lands biga at the first-phase target (rest temp, or RT phase if
  // hybrid is on). Hidden when Pro mode is on (Pro mode shows fuller info).
  function updateTempHint() {
    if (inputs.usePro.checked) {
      out.tempHint.style.display = 'none';
      return;
    }
    out.tempHint.style.display = '';

    const useRT = inputs.useRT.checked;
    const target = useRT
      ? parseFloat(inputs.rtTemp.value)
      : parseFloat(inputs.temp.value);
    const phaseLabel = useRT ? `kickstart phase (${target}°C)` : `${target}°C rest`;
    const flourAssume = 20;
    const recommendedWater = 2 * target - flourAssume - 2;

    let hint;
    if (recommendedWater >= 0 && recommendedWater <= 40) {
      hint = `<span class="label">Tip</span> To land biga at the ${phaseLabel} with normal room-temp flour (~${flourAssume}°C), use water at <span class="value">~${recommendedWater}°C</span>.`;
    } else if (recommendedWater < 0) {
      const chilledTemp = Math.max(0, target - 1);
      hint = `<span class="label">Tip</span> For the ${phaseLabel}, chill <strong>both</strong> flour and water to ≈ <span class="value">${chilledTemp}°C</span> — water alone can't take biga that cold from room-temp flour.`;
    } else {
      const warmedTemp = Math.min(35, target - 3);
      hint = `<span class="label">Tip</span> For the ${phaseLabel}, warm flour and water to ≈ <span class="value">${warmedTemp}°C</span> each.`;
    }
    hint += ` <span class="muted">Enable Pro mode to fine-tune.</span>`;
    out.tempHint.innerHTML = hint;
  }

  // ---- Build the biga results HTML (used by both preview + recipe card) ----
  function buildResultsHTML(s, bigaStartC) {
    const dayClock = d => `<span class="muted">${fmtDay(d)}</span> <span class="strong">${fmtClock(d)}</span>`;

    // Contextual emoji for the starting temperature
    function tempBadge(c) {
      if (c <=  4) return ' ❄️';
      if (c <= 10) return ' 🧊';
      if (c <= 22) return '';
      if (c <= 27) return ' 🌡️';
      return ' ♨️';
    }
    const kneadTempRow = resultRow(
      'Temperature after kneading', 'biga starts here',
      `<span class="strong">${bigaStartC.toFixed(1)}°C${tempBadge(bigaStartC)}</span>`
    );

    if (!s.hybrid) {
      return [
        kneadTempRow,
        resultRow('Biga rest time', null, `<span class="strong">${Math.round(s.totalHours)} hours</span>`),
        resultRow('Biga ready',     null, dayClock(s.readyTime)),
      ].join('');
    }
    return [
      kneadTempRow,
      resultRow('Room temp phase', `at ${s.rtTempC}°C`,   `<span class="strong">${s.rtHours.toFixed(1)} h</span>`),
      resultRow('Cold phase',      `at ${s.coldTempC}°C`, `<span class="strong">${s.coldHours.toFixed(1)} h</span>`),
      resultRow('Total rest time', null, `<span class="strong">${s.totalHours.toFixed(1)} hours</span>`, true),
      resultRow('Biga ready',      null, dayClock(s.readyTime)),
    ].join('');
  }

  // ---- Pro mode readout ----
  function updateProReadout(targetTempC, bigaStartC, hydPct) {
    const flourT  = parseFloat(inputs.flourTemp.value);
    const waterT  = parseFloat(inputs.waterTemp.value);
    const delta   = bigaStartC - targetTempC;  // + = starts warm · − = starts cold
    const absDelta = Math.abs(delta);

    // Time shift vs a biga that starts exactly at target
    const timeDelta = phaseHours(targetTempC, hydPct, bigaStartC) - bigaHours(targetTempC, hydPct);
    function fmtShift(h) {
      const abs = Math.abs(h);
      if (abs < 0.1) return null;
      const dir = h < 0 ? 'earlier' : 'later';
      return abs < 1 ? `~${Math.round(abs * 60)} min ${dir}` : `~${abs.toFixed(1)} h ${dir}`;
    }

    // ── Block 1: biga starting temperature ──────────────────────────────────
    let startNote;
    if (absDelta < 1.5) {
      startNote = `✓ right at target — fermentation starts clean`;
    } else {
      const direction = delta > 0 ? 'warm' : 'cold';
      const action    = delta > 0 ? `cools toward ${targetTempC}°C` : `warms toward ${targetTempC}°C`;
      const shift     = fmtShift(timeDelta);
      startNote = `starts ${absDelta.toFixed(1)}°C ${direction} — ${action} in storage${shift ? ` · ready ${shift}` : ''}`;
      if (delta > 12 && targetTempC < 14) {
        startNote += ` · ⚠ very warm start before cold storage — consider chilling the flour`;
      }
    }

    // ── Block 2: ideal water temperature ────────────────────────────────────
    // bigaStartTemp = (water + flour) / 2 + 1 = target  →  water = 2×target − flour − 2
    const recommended  = 2 * targetTempC - flourT - 2;
    let waterBlock;
    if (recommended < 0) {
      const idealT = Math.max(0, targetTempC - 1);
      waterBlock = `
        <span class="label">Water to start biga at ${targetTempC}°C</span>
        can't reach ${targetTempC}°C with water alone at ${flourT}°C flour —
        chill both ingredients to ~<span class="value">${idealT}°C</span> for a clean start`;
    } else if (recommended > 40) {
      const idealT = Math.min(35, targetTempC - 1);
      waterBlock = `
        <span class="label">Water to start biga at ${targetTempC}°C</span>
        would need ${recommended}°C — too hot for yeast.
        Warm both flour and water to ~<span class="value">${idealT}°C</span> instead`;
    } else {
      const diff = waterT - recommended;
      let matchNote;
      if (Math.abs(diff) < 1.5) {
        matchNote = `<span class="note">✓ biga will start right at ${targetTempC}°C</span>`;
      } else {
        matchNote = `<span class="note">you set ${waterT}°C — biga will start at ${bigaStartC.toFixed(1)}°C</span>`;
      }
      waterBlock = `
        <span class="label">Water to start biga at ${targetTempC}°C</span>
        <span class="value">${recommended}°C</span> &ensp;${matchNote}`;
    }

    out.proReadout.innerHTML = `
      <div>
        <span class="label">Biga starts at</span>
        <span class="value">${bigaStartC.toFixed(1)}°C</span>
        &ensp;<span class="note" style="font-style:normal;opacity:.55">target ${targetTempC}°C</span>
        <br><span class="note">${startNote}</span>
      </div>
      <div>${waterBlock}</div>`;
  }

  // ---- Main calc ----
  function calc() {
    updateLabels();
    updateAllSliderFills();
    syncRTVisibility();
    syncProVisibility();
    updateTempHint();

    const N        = Math.max(1, parseInt(inputs.balls.value) || 1);
    const W        = Math.max(50, parseFloat(inputs.ballWeight.value) || 260);
    const bigaHyd  = parseFloat(inputs.bigaHyd.value)  / 100;
    const tempC    = parseFloat(inputs.temp.value);
    const bigaPct  = parseFloat(inputs.bigaPct.value)  / 100;
    const totalHyd = parseFloat(inputs.totalHyd.value) / 100;
    const saltPct  = parseFloat(inputs.salt.value)     / 100;
    const oilPct   = parseFloat(inputs.oil.value)      / 100;
    const maltPct  = parseFloat(inputs.malt.value)     / 100;

    const totalDough = N * W;

    // baker's percentages
    const flour      = totalDough / (1 + totalHyd + saltPct + oilPct + maltPct);
    const totalWater = flour * totalHyd;
    const salt       = flour * saltPct;
    const oil        = flour * oilPct;
    const malt       = flour * maltPct;

    const bigaFlour      = flour * bigaPct;
    const bigaWater      = bigaFlour * bigaHyd;
    const freshYeastPct  = inputs.usePro.checked ? parseFloat(inputs.yeastPct.value) : 1.0;
    const bigaYeast      = bigaFlour * freshYeastPct / 100;

    const finalFlour = flour - bigaFlour;
    const finalWater = totalWater - bigaWater;

    // ---- Ingredient temperatures & biga start temp ----
    // These drive both the recipe card display and the schedule calculation,
    // so they must stay in sync. bigaStartC is always derived — never null —
    // to keep non-Pro and Pro rest-time estimates consistent for the same values.
    const flourAssume = 20; // assumed room-temp flour when Pro mode is off
    const targetTempC = inputs.useRT.checked
      ? parseFloat(inputs.rtTemp.value)
      : tempC;

    let flourTempForCalc, waterTempForCalc, bigaStartC;
    let flourNote, waterNote;

    if (inputs.usePro.checked) {
      flourTempForCalc = parseFloat(inputs.flourTemp.value);
      waterTempForCalc = parseFloat(inputs.waterTemp.value);
      flourNote = `"00" or strong bread flour · at ${flourTempForCalc}°C`;
      waterNote = `${(bigaHyd*100).toFixed(0)}% hydration · at ${waterTempForCalc}°C`;
      bigaStartC = bigaStartTemp(waterTempForCalc, flourTempForCalc);
      updateProReadout(targetTempC, bigaStartC, parseFloat(inputs.bigaHyd.value));
    } else {
      // When RT kickstart is on, flour sits at room temperature (which the user
      // has set via the RT slider); otherwise assume standard ~20°C room temp.
      flourTempForCalc = inputs.useRT.checked
        ? parseFloat(inputs.rtTemp.value)
        : flourAssume;
      // Water temp to land biga at targetTempC:
      //   bigaStart = (water + flour) / 2 + 1 = target  →  water = 2×target − flour − 2
      // Clamped at 0°C (ice water) — the physical lower limit.
      waterTempForCalc = Math.max(0, Math.round(2 * targetTempC - flourTempForCalc - 2));
      flourNote = `"00" or strong bread flour · ~${flourTempForCalc}°C`;
      waterNote = `${(bigaHyd*100).toFixed(0)}% hydration · ~${waterTempForCalc}°C`;
      bigaStartC = bigaStartTemp(waterTempForCalc, flourTempForCalc);
    }

    // ---- Meta ----
    out.recipeMeta.textContent = `${N} ${N === 1 ? 'ball' : 'balls'} × ${W} g · total ${Math.round(totalDough)} g`;

    out.bigaList.innerHTML =
      row('Flour',       flourNote, `${fmt(bigaFlour)} g`, true) +
      row('Water',       waterNote, `${fmt(bigaWater)} g`, true) +
      row('Fresh yeast', `or ${fmt(bigaYeast/3, 2)} g dry · ${freshYeastPct.toFixed(2)}% of biga flour`, `${fmt(bigaYeast, 2)} g`);

    // ---- Biga schedule ----
    const startTime = inputs.startTime.value ? new Date(inputs.startTime.value) : new Date();
    const schedule = computeSchedule(
      startTime,
      parseFloat(inputs.bigaHyd.value),
      inputs.useRT.checked,
      parseFloat(inputs.rtTemp.value),
      parseFloat(inputs.rtHours.value),
      tempC,
      bigaStartC,
      freshYeastPct
    );

    // ---- Render biga results (both blocks) ----
    const resultsHTML = buildResultsHTML(schedule, bigaStartC);
    out.bigaResultsContent.innerHTML = resultsHTML;
    out.bigaPreviewContent.innerHTML = resultsHTML;

    // ---- Final mix ----
    let finalRows =
      row('Biga (all of it)', '', `${fmt(bigaFlour + bigaWater + bigaYeast)} g`) +
      row('Flour',             'remaining', `${fmt(finalFlour)} g`, true) +
      row('Water (total)',     `to reach ${(totalHyd*100).toFixed(0)}% total hydration`, `${fmt(finalWater)} g`, true) +
      row('add immediately',   `55–60% of total · pour over the biga`, `${fmt(finalWater * 0.55)}–${fmt(finalWater * 0.60)} g`, true, true) +
      row('add gradually',     `40–45% of total · stream in while kneading`, `${fmt(finalWater * 0.40)}–${fmt(finalWater * 0.45)} g`, true, true) +
      row('Salt',              `${(saltPct*100).toFixed(1)}%`, `${fmt(salt, 1)} g`);
    if (oil  > 0.05) finalRows += row('Olive oil', `${(oilPct*100).toFixed(1)}%`,  `${fmt(oil, 1)} g`);
    if (malt > 0.05) finalRows += row('Malt',      `${(maltPct*100).toFixed(2)}%`, `${fmt(malt, 2)} g`);
    out.finalList.innerHTML = finalRows;

    // ---- Timeline ----
    const oilStr  = oilPct  > 0.005 ? 'olive oil, ' : '';
    const maltStr = maltPct > 0.005 ? 'malt, '      : '';

    const tKnead   = startTime;
    const tReady   = schedule.readyTime;
    const tMixDone = addMinutes(tReady, 15);
    const tBulkEnd = addMinutes(tMixDone, 30);
    const tShaped  = addMinutes(tBulkEnd, 15);
    const tBake    = addMinutes(tShaped, 4 * 60 + 30);

    // Pro-mode water guidance for the knead step
    const kneadDetail = inputs.usePro.checked
      ? ` Use water at <strong>${inputs.waterTemp.value}°C</strong>.`
      : '';

    let steps;
    if (!schedule.hybrid) {
      steps = [
        { t: tKnead,   icon: '🤌', text: `<strong>Knead the biga.</strong>${kneadDetail} Crumble yeast into the water, then combine with flour. Mix to rough lumps — do NOT develop gluten.` },
        { t: tKnead,   icon: '⏳', text: `<strong>Cover and wait.</strong> Rest the biga at <strong>${schedule.mainTempC}°C</strong> for <strong>${Math.round(schedule.totalHours)} hours</strong>.` },
        { t: tReady,   icon: '✅', text: `<strong>Biga ready — start the bulk.</strong> Break the biga into the <strong>first 55–60% of the water</strong>. Add flour, ${oilStr}${maltStr}then salt. Knead 8–12 min, streaming in the reserved water gradually until fully absorbed.` },
        { t: tMixDone, icon: '💤', text: `<strong>Bulk rest.</strong> Cover and rest at room temperature for ~30 minutes.` },
        { t: tBulkEnd, icon: '✂️', text: `<strong>Divide & shape.</strong> Form <strong>${N} × ${W} g</strong> balls and round them tightly.` },
        { t: tShaped,  icon: '🕐', text: `<strong>Final proof.</strong> Cover and proof at 22–24°C until visibly puffy and jiggly (~4–5 h).` },
        { t: tBake,    icon: '🔥', text: `<strong>Bake!</strong> Stretch by hand and bake on a hot stone, steel, or wood-fired oven at the highest heat you can manage.` },
      ];
    } else {
      const moveT = schedule.moveToColdTime;
      const overflowStr = schedule.overflow
        ? `Watch closely — the biga may be ready at room temp before reaching the fridge.`
        : `Then move it to <strong>${schedule.coldTempC}°C</strong> for <strong>${schedule.coldHours.toFixed(1)} more hours</strong>.`;
      steps = [
        { t: tKnead,   icon: '🤌', text: `<strong>Knead the biga.</strong>${kneadDetail} Crumble yeast into the water, then combine with flour. Mix to rough lumps — do NOT develop gluten.` },
        { t: tKnead,   icon: '🏠', text: `<strong>Rest at room temperature.</strong> Cover and let the biga sit at <strong>${schedule.rtTempC}°C</strong> for <strong>${schedule.rtHours.toFixed(1)} hours</strong> to kickstart fermentation.` },
        { t: moveT,    icon: '❄️', text: `<strong>Move to cold storage.</strong> Transfer the biga to <strong>${schedule.coldTempC}°C</strong>. ${overflowStr}` },
        { t: tReady,   icon: '✅', text: `<strong>Biga ready — start the bulk.</strong> Break the biga into the <strong>first 55–60% of the water</strong>. Add flour, ${oilStr}${maltStr}then salt. Knead 8–12 min, streaming in the reserved water gradually until fully absorbed.` },
        { t: tMixDone, icon: '💤', text: `<strong>Bulk rest.</strong> Cover and rest at room temperature for ~30 minutes.` },
        { t: tBulkEnd, icon: '✂️', text: `<strong>Divide & shape.</strong> Form <strong>${N} × ${W} g</strong> balls and round them tightly.` },
        { t: tShaped,  icon: '🕐', text: `<strong>Final proof.</strong> Cover and proof at 22–24°C until visibly puffy and jiggly (~4–5 h).` },
        { t: tBake,    icon: '🔥', text: `<strong>Bake!</strong> Stretch by hand and bake on a hot stone, steel, or wood-fired oven at the highest heat you can manage.` },
      ];
    }

    out.schedule.innerHTML = steps.map((s) => `
      <div class="step">
        <div class="step-num">${s.icon}</div>
        <div class="step-text">${s.text}</div>
        <div class="step-time">
          <span class="day">${fmtDay(s.t)}</span>
          <span class="clock">${fmtClock(s.t)}</span>
        </div>
      </div>`).join('');
  }

  Object.values(inputs).forEach(el => {
    el.addEventListener('input', calc);
    el.addEventListener('change', calc);
  });
  calc();

  // ---- Mobile tab switching ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`[data-pane="${btn.dataset.target}"]`).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
})();
