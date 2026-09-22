# Graph Report - PFT  (2026-09-22)

## Corpus Check
- 29 files · ~27,587 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .css 3, .csv 2)

## Summary
- 229 nodes · 484 edges · 20 communities (10 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa7b72c9`
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
- rules/graphify.md
- workflows/graphify.md
- sw.js
- Design Scout
- pwa_maker_skill_finance_tracker.md
- auth.js
- createParticleMesh
- Graphify + Antigravity Project Workflow & Setup Guide

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 26 edges
2. `renderAccounts()` - 21 edges
3. `AppCoordinator` - 15 edges
4. `BiometricAuthService` - 13 edges
5. `formatINR()` - 13 edges
6. `BankPDFParser` - 13 edges
7. `renderDashboard()` - 13 edges
8. `renderTransactions()` - 13 edges
9. `renderBudgets()` - 11 edges
10. `categorizeTransaction()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `renderBankCardHtml()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `renderAddExpense()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/add-expense.js → js/db.js
- `renderBudgets()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/budgets.js → js/db.js
- `renderDashboard()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/dashboard.js → js/db.js
- `renderLanding()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/landing.js → js/db.js

## Import Cycles
- None detected.

## Communities (20 total, 10 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.20
Nodes (17): escapeHtml(), AppDatabase, drainOfflineQueue(), findUserByEmail(), getAllUsers(), loginUser(), purgeAllTestData(), registerUser() (+9 more)

### Community 1 - "accounts.js"
Cohesion: 0.17
Nodes (17): getCurrentUser(), BankPDFParser, SetuAccountAggregatorService, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml(), handlePdfFile(), handleUploadedFile() (+9 more)

### Community 3 - "dashboard.js"
Cohesion: 0.23
Nodes (16): formatINR(), getUserBudgets(), getUserTransactions(), escapeHtml(), openBudgetEditModal(), renderBudgets(), escapeHtml(), initSpendingChart() (+8 more)

### Community 4 - "categorizeTransaction"
Cohesion: 0.19
Nodes (11): addTransaction(), db, getUserAccounts(), BankStatementParser, ALL_CATEGORIES, categorizeTransaction(), CATEGORY_RULES, extractCleanMerchant() (+3 more)

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, display_override, icons, id, lang (+7 more)

### Community 6 - "package.json"
Cohesion: 0.17
Nodes (11): author, description, keywords, license, main, name, scripts, dev (+3 more)

### Community 7 - "email_pdf_streamline.py"
Cohesion: 0.22
Nodes (9): csv, os, pypdf, re, batch_decrypt_directory(), decrypt_pdf(), Bank Email Statement Streamliner & Auto-Decryptor…, Decrypt a password-protected bank PDF statement. (+1 more)

### Community 15 - "Design Scout"
Cohesion: 0.10
Nodes (19): Animation and Interaction, CSS Frameworks, Design Principles to Apply (from frontend-design), Design Scout, Framework Reference, Phase 1: Understand the Brief, Phase 2: Scout the Design Galleries, Phase 3: Synthesize and Report (+11 more)

### Community 16 - "pwa_maker_skill_finance_tracker.md"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Architecture, 2. Web App Manifest (`public/manifest.json`), 3. iOS Native Fit & HTML Meta Tags, 4. Service Worker & Caching Strategy Matrix, 5. Offline Architecture & IndexedDB Sync Queue, 6. PWA Mobile UX Guidelines, 7. iOS Custom Install Prompt Component, 8. Feature Core & Execution Checklist (+5 more)

### Community 17 - "auth.js"
Cohesion: 0.19
Nodes (4): BiometricAuthService, GoogleAuthService, firebaseConfig, loadFirebaseConfig()

## Knowledge Gaps
- **56 isolated node(s):** `CATEGORY_RULES`, `short_name`, `name`, `icons`, `id` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 85 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `accounts.js` to `app.js`, `AppCoordinator`, `dashboard.js`, `categorizeTransaction`, `createParticleMesh`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `FirebaseAuthService` to `auth.js`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `CATEGORY_RULES`, `short_name`, `name` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Design Scout` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `pwa_maker_skill_finance_tracker.md` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._