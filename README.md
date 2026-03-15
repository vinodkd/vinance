# Vinance

A local-only personal finance desktop app. No cloud, no accounts, no subscriptions — your data stays on your machine in a single `.vinance` file you control.

## Features

- Import OFX/QFX bank and credit card files (deduplication via FITID)
- Hierarchical categories with rule-based auto-categorisation
- Income/expense reports with drill-down charts
- Budget tracking with variance by category
- Transfer linking between accounts
- Multiple portfolios (`.vinance` files) with hot-switching

## Requirements

- [Node.js](https://nodejs.org) 20+
- npm 9+

## Quick start

```bash
git clone https://github.com/vinodkd/vinance.git
cd vinance
npm install
npm run dev
```

On first launch you'll be prompted to create or open a portfolio (`.vinance` file). Import any OFX/QFX file from your bank to get started, or load the built-in demo data.

## Building a distributable

```bash
npm run build        # compile
npm run dist         # package for your current OS (requires electron-builder)
```

## Project layout

```
src/
  main/         Electron main process — DB, IPC handlers, OFX parsing
  preload/      Context bridge (window.api)
  renderer/     React app — views, drawers, charts
sample-data/    OFX files for manual testing
docs/           GitHub Pages project site
```

## Tech stack

Electron · React · Vite · sql.js (SQLite in WASM) · Recharts · Tailwind CSS · React Router

## License

MIT
