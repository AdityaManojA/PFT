# Graph Report - PFT  (2026-09-22)

## Corpus Check
- 37 files · ~36,918 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 301 nodes · 673 edges · 23 communities (12 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b01cb25`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.js
- accounts.js
- app.js
- formatINR
- categorizer.js
- manifest.json
- package.json
- email_pdf_streamline.py
- FirebaseAuthService
- rules/graphify.md
- workflows/graphify.md
- sw.js
- Design Scout
- pwa_maker_skill_finance_tracker.md
- db.js
- createParticleMesh
- Graphify + Antigravity Project Workflow & Setup Guide
- index.js

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 32 edges
2. `renderAccounts()` - 25 edges
3. `BankPDFParser` - 19 edges
4. `checkSpendingCaps()` - 18 edges
5. `formatINR()` - 17 edges
6. `AppCoordinator` - 15 edges
7. `renderDashboard()` - 15 edges
8. `BiometricAuthService` - 13 edges
9. `renderBudgets()` - 13 edges
10. `renderTransactions()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `sendLimitBreachEmail()` --calls--> `formatINR()`  [EXTRACTED]
  js/services/email-service.js → js/db.js
- `checkSpendingCaps()` --calls--> `formatINR()`  [EXTRACTED]
  js/services/notification-center.js → js/db.js
- `renderBankCardHtml()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `openSpendingCapModal()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/budgets.js → js/db.js
- `renderBudgets()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/budgets.js → js/db.js

## Import Cycles
- None detected.

## Communities (23 total, 11 thin omitted)

### Community 0 - "auth.js"
Cohesion: 0.26
Nodes (10): GoogleAuthService, findUserByEmail(), loginUser(), registerUser(), setCurrentUser(), firebaseConfig, loadFirebaseConfig(), escapeHtml() (+2 more)

### Community 1 - "accounts.js"
Cohesion: 0.10
Nodes (24): db, resetUserData(), BankPDFParser, GmailStatementSyncService, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml(), handlePdfFile() (+16 more)

### Community 2 - "app.js"
Cohesion: 0.18
Nodes (10): AppCoordinator, escapeHtml(), drainOfflineQueue(), getAllUsers(), purgeAllTestData(), seedInitialDataIfNeeded(), checkAndRenderIOSInstallPrompt(), dismissIOSInstallBanner() (+2 more)

### Community 3 - "formatINR"
Cohesion: 0.19
Nodes (13): BiometricAuthService, formatINR(), getCategoryMeta(), escapeHtml(), initSpendingChart(), renderCanvasDonutFallback(), renderDashboard(), renderTxnItemHtml() (+5 more)

### Community 4 - "categorizer.js"
Cohesion: 0.20
Nodes (9): BankStatementParser, ALL_CATEGORIES, categorizeTransaction(), CATEGORY_DEFINITIONS, extractCleanMerchant(), formatTitleCase(), SPECIFIC_VENDOR_RULES, res (+1 more)

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

### Community 17 - "db.js"
Cohesion: 0.14
Nodes (36): addNotification(), addTransaction(), AppDatabase, deleteNotification(), getCurrentUser(), getUnreadNotificationCount(), getUserAccounts(), getUserBudgets() (+28 more)

### Community 22 - "index.js"
Cohesion: 0.10
Nodes (21): admin, getTransporter(), monthEndExpenseReminder(), nodemailer, { onRequest }, { onSchedule }, sendAlertEmail(), dependencies (+13 more)

## Knowledge Gaps
- **75 isolated node(s):** `{ onSchedule }`, `{ onRequest }`, `admin`, `nodemailer`, `name` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 109 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `db.js` to `auth.js`, `accounts.js`, `app.js`, `formatINR`, `createParticleMesh`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `BankPDFParser` connect `accounts.js` to `app.js`, `categorizer.js`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `FirebaseAuthService` to `auth.js`, `accounts.js`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `{ onSchedule }`, `{ onRequest }`, `admin` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10241545893719807 - nodes in this community are weakly interconnected._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Design Scout` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._