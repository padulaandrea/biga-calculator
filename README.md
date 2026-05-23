# 🍕 Biga Calculator

A Neapolitan-style pizza dough calculator focused on **biga** — the slow cold preferment that gives pizza its flavour, open crumb, and digestibility.

## Features

- **Biga fermentation model** — rest time calculated from temperature and hydration using a calibrated Q10 model (split cold/warm sides)
- **Thermal equilibration** — accounts for the biga warming or cooling toward the storage temperature over time (Newton's law of cooling), so rest times are accurate even when ingredients start at a different temperature than the rest environment
- **Hybrid schedule** — optional room-temperature kickstart before moving to cold storage, with full two-phase simulation
- **Pro mode** — set flour and water temperatures explicitly; uses the Giorilli formula (`water = 2 × target − flour − 2`) to land the biga at a precise starting temperature, with a readout showing the time impact of any temperature delta
- **Water temperature guidance** — shown in the recipe card for both Pro and non-Pro modes, always consistent with the rest time the calculator computed
- **Full recipe output** — biga ingredients, final mix (with split water addition), and a step-by-step timeline with clock times
- **Olive oil & malt** — optional additions with baker's percentage sliders

## Files

| File | Description |
|---|---|
| `biga.html` | HTML structure — panels, inputs, recipe card |
| `biga.css` | All styles — design tokens, layout, components |
| `biga.js` | All logic — fermentation model, schedule computation, DOM updates |

No build step, no dependencies, no server required. Open `biga.html` directly in a browser.

## The Science

### Fermentation model

Rest time is calculated as:

```
hours = 16 × Q10^((18 − temp) / 10) × exp((50 − hydration%) × 0.01)
```

- **Anchor**: 50% hydration at 18°C → 16 hours (standard 1% fresh yeast biga)
- **Q10**: 1.85 on the cold side (≤ 18°C), 1.6 on the warm side — matching real-world biga behaviour
- **Hydration factor**: modest 1% shift per percentage point, reflecting that biga hydration has a smaller effect on timing than in a poolish

### Temperature equilibration

The biga doesn't instantly reach its storage temperature — it cools or warms with a thermal time constant of ~6 hours (calibrated for a covered 1–3 kg home biga). Fermentation progress is integrated numerically (6-minute steps) at the biga's current temperature, not the storage temperature. This is why ingredient temperatures matter and are shown in the recipe.

### Water temperature formula

```
water = 2 × target − flour − 2
```

Derived from `bigaStart = (water + flour) / 2 + 1 = target`. The `+1` accounts for ~1°C of friction heat during mixing. This is a simplified version of Giorilli's classical `55 − flour − target`, which was calibrated for a ~19°C biga and doesn't generalise well to cold fermentation.

## Usage

1. Set the number and weight of dough balls
2. Choose when you'll knead the biga
3. Adjust biga hydration, rest temperature, and biga % of total flour
4. Optionally enable the RT kickstart (start warm, then move to cold)
5. Optionally enable Pro mode to dial in flour and water temperatures
6. Set total hydration, salt, oil, and malt for the final dough
7. Follow the recipe card and timeline

## License

MIT
