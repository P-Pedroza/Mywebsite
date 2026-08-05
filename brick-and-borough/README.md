# Brick & Borough

A playable browser game: a 7-deal isometric real-estate tycoon campaign set in Indianapolis.

## Gameplay

- Explore an isometric neighborhood and scout a distressed property each round.
- Analyze the deal, then negotiate an offer against a seller's acceptance floor.
- Finance the purchase with 25% down and a 9.5% investor loan.
- Choose an essential or full renovation, trading cost against resale value.
- Exit through a flip, rental hold, or BRRRR refinance — each behaves differently:
  flips return a lump sum, rentals bank monthly cash flow, BRRRR recycles your
  down payment back into cash while keeping the property.
- Held rentals and BRRRR refis quietly generate cash flow in the background as
  later deals take time to close, funding your next acquisition.
- Progress through all 7 Indianapolis properties, then review your final
  portfolio, net worth, and personal best.
- Cash, debt, equity, reputation, and monthly cash flow are all tracked live.
- Simple procedural sound effects on offers, renovations, and exits (toggle in the top bar).
- Save progress locally in the browser; reload to resume mid-campaign.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Project boundaries

- `src/simulation.ts` owns the real-estate rules, the property pool, and financial state.
- `src/game.ts` owns the Phaser world, camera, and map visuals.
- `src/audio.ts` owns the small WebAudio sound-effect synth.
- `src/main.ts` connects player actions and the responsive interface to the simulation.
- `src/style.css` owns the HUD, property panel, and mobile layout.

The simulation is intentionally kept outside Phaser so future districts, properties,
lenders, contractors, tenants, and market events can reuse the same rules.
