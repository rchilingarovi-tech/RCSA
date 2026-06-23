# RCSA Portal

A Risk & Control Self-Assessment portal for tracking an asset catalogue, a risk register, treatment workflows, controls, and reporting. This is a typed, modular React rebuild of the original single-file `New Version.html` prototype — same visuals and behavior, real architecture underneath.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check (tsc --noEmit) + production build to dist/
npm run preview  # serve the production build
npm run lint     # type-check only
```

> Requires Node.js (LTS). No backend needed — data is mock + browser-local.

## What it does

- **Dashboard**: 7 KPI cards + 8 charts (criticality, treatment status, residual heat map, risks by department, top threats, overdue by owner, accepted by department, control gaps). Every card and chart segment is a **cross-filter** — click to filter the whole portal.
- **Asset Catalog**: searchable/filterable table; full CRUD via modal; per-asset summary modal with connected risks.
- **Risk Register**: scoped to a selected asset or an active global filter; level/status/decision filters; 4-tab CRUD modal (Basic / Controls / Treatment / Comments); residual-risk heat-map grid.
- **Export**: Assets and Risks to CSV.
- **Persistence**: all changes are saved to browser `localStorage` and survive refresh. Use **Reset demo data** to restore the original sample set.

## Architecture

```
src/
  data/            # swappable persistence layer
    models.ts        # typed entities (Asset, Risk) + literal-union types
    seed.ts          # sample data set
    repository.ts    # RcsaRepository interface (the swap boundary)
    localStorageRepo.ts
    index.ts         # `export const repo` — single line to swap for a real API
  domain/          # pure logic: scoring (value, criticality, risk level, overdue), constants
  state/           # AppStore (Context + reducer), filters (selectors), ModalsProvider
  csv/             # CSV export
  components/      # Header, KpiCards, charts/, assets/, risks/, common/
  index.css        # design tokens + ported cyber theme
```

**Swapping the data layer:** implement `RcsaRepository` (e.g. against HTTP) and change the one export in `src/data/index.ts`. No component changes required — the interface is async-ready.

**State:** a single store holds `{ assets, risks, selectedAssetId, globalFilter, assetFilters, riskFilters }`. All tables, charts, and the heat map read from the same filtered view, so everything stays in sync.
