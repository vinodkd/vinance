# Vinance — Implemented Features

## Portfolios
- Create a named portfolio backed by a `.vinance` file (saved to a user-chosen location)
- Open an existing `.vinance` file
- Switch between portfolios with hot-reload (no app restart)
- Set a default portfolio (auto-opened on launch)
- Remove a portfolio from the recent list (does not delete the file)
- Registry of known portfolios stored in `~/.vinance/portfolios.json`
- Portfolios page is the home/landing page; accessible from the top of the left nav

## Accounts
- Create accounts manually with name, type (checking / savings / credit), and currency
- Import OFX/QFX files to auto-create accounts (type and currency inferred from file)
- Import additional OFX/QFX files into an existing account (deduplication via FITID)
- Validation: file currency and type must match the target account on import
- Balances computed as sum of non-transfer transactions
- Total balance shown per currency at the top of the Overview page
- Multi-currency: each account has its own currency; totals grouped by currency

## Transactions
- Paginated transaction list (50 per page)
- Filter by account, category, date range
- Category filter includes transactions from child categories (recursive)
- Inline category assignment via dropdown
- Transfer badge shown on linked transfer transactions
- Mark any transaction as a transfer: select the other account, app finds the closest match by amount + date and asks for confirmation
- Unlink a transfer from the transaction row
- Quick-create a rule from any transaction row (pre-filled with payee)

## Categories
- Hierarchical categories with arbitrary depth (parent–child via `parent_id`)
- Paths computed dynamically via recursive CTE — no `/` ambiguity
- Add top-level or child categories from any view via the drawer
- Rename categories inline in the Categories view
- Add subcategory from the Categories view

## Categorization Rules
- Rules match transactions by payee or memo field (substring or regex)
- Priority ordering (higher priority applied first)
- Rules applied automatically on each OFX import
- "Re-apply all rules" button applies rules to all currently uncategorized transactions
- Create a rule directly from a transaction row (payee pre-filled)
- Inline category creation inside the Add Rule drawer
- Delete rules from the Rules view

## Transfers
- Link two transactions (one debit, one credit) as a matched transfer
- App auto-finds the best match in the selected target account (by amount proximity, then date)
- Confirm or cancel before linking
- Transfers excluded from income/expense totals and reports
- Unlink a transfer from either transaction row

## Reports
- Income vs expense bar chart by calendar month
- Expense breakdown by category (pie chart + table)
- Custom date range picker with "This month" and "This year" presets
- Default range covers all imported data
- Click any chart element or category row to drill down to matching transactions
- Transfers excluded from all report calculations

## Budgets
- Set a budget per category for a monthly or yearly period
- Any year selectable via numeric input (not limited to current year)
- Budget vs actual bar chart (green = under, red = over)
- Inline amount editing in the budget table
- Variance column (actual − budget)
- Click a budget row or chart bar to drill down to matching transactions

## Data
- Local-only: all data stored in a `.vinance` SQLite file chosen by the user
- No server, no cloud sync, no accounts required
- Incremental OFX/QFX imports: duplicate transactions skipped via FITID
- Import history logged per account
