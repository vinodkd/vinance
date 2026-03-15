# Sample OFX Files

Four files covering Q1 2024 across three fictional accounts.

| File | Account | Transactions |
|------|---------|-------------|
| `checking-jan2024.ofx` | Checking (021000021 / 4501234567) | Jan 2024 — 25 txns |
| `checking-feb2024.ofx` | Checking (same account) | Feb 2024 — 22 txns |
| `checking-mar2024.ofx` | Checking (same account) | Mar 2024 — 21 txns |
| `savings-q1-2024.ofx`  | Savings (021000021 / 4509876543) | Jan–Mar 2024 — 6 txns |
| `creditcard-q1-2024.ofx` | Credit Card (4111222233334444) | Jan–Mar 2024 — 28 txns |

## Suggested test sequence

1. Import `checking-jan2024.ofx` → creates the checking account
2. Import `checking-jan2024.ofx` **again** → should show 0 imported, 25 skipped (deduplication test)
3. Import `checking-feb2024.ofx` → adds to same account
4. Import `checking-mar2024.ofx` → adds to same account
5. Import `savings-q1-2024.ofx` → creates savings account
6. Import `creditcard-q1-2024.ofx` → creates credit card account
7. Link the 3 × "TRANSFER TO SAVINGS" (checking) with the 3 × "TRANSFER FROM CHECKING" (savings) as transfers
8. Create rules: `WHOLE FOODS` / `TRADER JOES` → Food/Groceries, `SHELL OIL` → Transport/Fuel, etc.
9. Check Reports for income vs expense across Q1
