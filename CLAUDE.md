# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vinance is a local desktop personal finance management application. It is a greenfield project — the codebase does not exist yet beyond this file and `requirements.md`.

**Planned stack:**
- Desktop runtime: Electron (or npx-runnable) for OS-agnostic delivery
- Language: JavaScript/Node.js
- Database: SQLite (local only, no server)

## Core Functional Requirements

- Import OFX/QFX files to create and populate accounts
- Rule-based hierarchical transaction categorization
- Account transfers to keep balances reconciled
- Reports: income/expense by month, year, and custom date ranges
- Budgets per category level with graphical variance reporting
- Multi-currency account support

## Non-Functional Requirements

- Fully local — no backend server, no network dependency
- OS-agnostic via Electron or npx packaging
- SQLite as the sole data store

## Commands

```bash
npm install       # install dependencies
npm run dev       # start Electron app in dev mode (hot reload)
npm run build     # build for production (output in out/)
npm run lint      # run ESLint on src/
```

## Architecture

```
src/main/       Electron main process (Node.js, direct SQLite access)
  index.js      app entry, window creation
  db.js         all SQLite queries, exported as { accounts, transactions, categories, rules, budgets, reports, imports }
  ipc.js        all IPC handler registrations (one place for all channel names)
  schema.sql    DB schema, run once on startup via db.exec()

src/preload/    Electron preload (contextBridge)
  index.js      exposes window.api — the only way the renderer talks to main

src/renderer/   React app (Vite, Tailwind, React Router)
  src/
    App.jsx               layout shell: left nav + main area + DrawerHost
    context/
      DrawerContext.jsx   global drawer state — openDrawer(name, data) / closeDrawer()
    drawers/
      DrawerHost.jsx      renders the active drawer over everything
      AddCategoryDrawer   create category from any view
      AddRuleDrawer       create rule, optionally pre-filled from a transaction
    views/
      AccountsView        account list with balances, import button per account
      TransactionsView    paginated table, filter by account/category/date, inline category picker
      RulesView           CRUD for categorization rules, re-apply all
      ReportsView         income/expense charts + category breakdown, chart drill-downs
      BudgetsView         budget table with inline edit, variance bar chart, drill-downs
```

**IPC pattern**: renderer calls `window.api.someMethod(args)` → preload's `ipcRenderer.invoke(channel, args)` → main's `ipcMain.handle(channel)` → `db.js` query. All channel names are defined only in `ipc.js` and `preload/index.js`.

**Drill-downs**: Recharts chart elements call `navigate()` with query params (`?categoryId=&dateFrom=&dateTo=`). TransactionsView reads these params on mount to apply initial filters.

**Non-modal UI**: All CRUD actions (add category, add rule, mark transfer) open as slide-out drawers via `DrawerContext.openDrawer(name, data)`. No view requires navigating away and back.

**Deduplication**: OFX transactions use `FITID` as unique key per account. `INSERT OR IGNORE` on `(account_id, fitid)` handles re-importing the same file.

**Database location**: `~/.vinance/vinance.db` (created on first launch).
