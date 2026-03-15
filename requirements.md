I want to build a personal finance management software. 
Functionally, itt must:
- Import ofx/qfx files and create accounts
- allow creation of rules to categorize transactions into heirarchical categories
- allow transfers between accounts to keep them balanced
- display reports of income and expense by month, year and date
- allow creation of simple budgets by each level of the category and show variation from budget in a graphical report
- be currency agnostic, ie allow accounts to be held in multiple currencies.

Non-functional requirements are:
- Completely local, no server needed
- use technology like npx and/or electron so its OS agnostic
- use sqlite as its backing store
