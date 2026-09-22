# Graph Report - PFT  (2026-09-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 183 nodes · 435 edges · 15 communities (8 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `754669d5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- accounts.js
- AppCoordinator
- dashboard.js
- categorizeTransaction
- manifest.json
- package.json
- email_pdf_streamline.py
- FirebaseAuthService
- createParticleMesh
- add-expense.js
- sw.js

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 26 edges
2. `renderAccounts()` - 21 edges
3. `AppCoordinator` - 15 edges
4. `BankPDFParser` - 13 edges
5. `formatINR()` - 13 edges
6. `renderDashboard()` - 13 edges
7. `renderTransactions()` - 13 edges
8. `BiometricAuthService` - 12 edges
9. `renderBudgets()` - 11 edges
10. `categorizeTransaction()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `renderAddExpense()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/add-expense.js → js/db.js
- `renderBudgets()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/budgets.js → js/db.js
- `renderDashboard()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/dashboard.js → js/db.js
- `renderLanding()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/landing.js → js/db.js
- `renderTransactions()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/transactions.js → js/db.js

## Import Cycles
- None detected.

## Communities (15 total, 7 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.17
Nodes (17): escapeHtml(), GoogleAuthService, AppDatabase, drainOfflineQueue(), findUserByEmail(), getAllUsers(), loginUser(), registerUser() (+9 more)

### Community 1 - "accounts.js"
Cohesion: 0.21
Nodes (15): getCurrentUser(), BankPDFParser, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml(), handlePdfFile(), handleUploadedFile(), openAddAccountModal() (+7 more)

### Community 3 - "dashboard.js"
Cohesion: 0.23
Nodes (16): formatINR(), getUserBudgets(), getUserTransactions(), escapeHtml(), openBudgetEditModal(), renderBudgets(), escapeHtml(), initSpendingChart() (+8 more)

### Community 4 - "categorizeTransaction"
Cohesion: 0.19
Nodes (8): db, BankStatementParser, categorizeTransaction(), CATEGORY_RULES, extractCleanMerchant(), formatTitleCase(), SetuAccountAggregatorService, openSetuAAModal()

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, display_override, icons, id, lang (+7 more)

### Community 6 - "package.json"
Cohesion: 0.17
Nodes (11): author, description, keywords, license, main, name, scripts, dev (+3 more)

### Community 7 - "email_pdf_streamline.py"
Cohesion: 0.22
Nodes (9): csv, os, pypdf, re, batch_decrypt_directory(), decrypt_pdf(), Bank Email Statement Streamliner & Auto-Decryptor…, Decrypt a password-protected bank PDF statement. (+1 more)

### Community 10 - "add-expense.js"
Cohesion: 0.53
Nodes (5): addTransaction(), getUserAccounts(), ALL_CATEGORIES, escapeHtml(), renderAddExpense()

## Knowledge Gaps
- **28 isolated node(s):** `STATIC_ASSETS`, `VENDOR_URLS`, `CATEGORY_RULES`, `background_color`, `categories` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 52 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `accounts.js` to `app.js`, `AppCoordinator`, `dashboard.js`, `categorizeTransaction`, `createParticleMesh`, `add-expense.js`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `FirebaseAuthService` to `app.js`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `STATIC_ASSETS`, `VENDOR_URLS`, `CATEGORY_RULES` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._