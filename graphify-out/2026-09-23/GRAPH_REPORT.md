# Graph Report - PFT  (2026-09-22)

## Corpus Check
- 37 files · ~39,314 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 308 nodes · 695 edges · 23 communities (14 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b87adb1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- login.js
- accounts.js
- app.js
- dashboard.js
- categorizer.js
- manifest.json
- package.json
- email_pdf_streamline.py
- auth.js
- rules/graphify.md
- workflows/graphify.md
- sw.js
- transactions.js
- Design Scout
- pwa_maker_skill_finance_tracker.md
- db.js
- createParticleMesh
- Graphify + Antigravity Project Workflow & Setup Guide
- index.js

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 32 edges
2. `renderAccounts()` - 27 edges
3. `BankPDFParser` - 19 edges
4. `checkSpendingCaps()` - 18 edges
5. `formatINR()` - 17 edges
6. `AppCoordinator` - 15 edges
7. `renderDashboard()` - 15 edges
8. `BiometricAuthService` - 13 edges
9. `renderBudgets()` - 13 edges
10. `renderTransactions()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `renderBankCardHtml()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `initSpendingChart()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/dashboard.js → js/db.js
- `renderDashboard()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/dashboard.js → js/db.js
- `renderTxnItemHtml()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/dashboard.js → js/db.js
- `renderGroupedList()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/transactions.js → js/db.js

## Import Cycles
- None detected.

## Communities (23 total, 9 thin omitted)

### Community 0 - "login.js"
Cohesion: 0.61
Nodes (7): findUserByEmail(), loginUser(), registerUser(), setCurrentUser(), escapeHtml(), promptRegistrationGoogleStep(), renderLogin()

### Community 1 - "accounts.js"
Cohesion: 0.10
Nodes (27): addStatementUploadHistory(), db, getStatementUploadHistory(), resetUserData(), BankPDFParser, GmailStatementSyncService, confirmDeleteAccountModal(), confirmRemovePasskeyModal() (+19 more)

### Community 2 - "app.js"
Cohesion: 0.18
Nodes (10): AppCoordinator, escapeHtml(), drainOfflineQueue(), getAllUsers(), purgeAllTestData(), seedInitialDataIfNeeded(), checkAndRenderIOSInstallPrompt(), dismissIOSInstallBanner() (+2 more)

### Community 3 - "dashboard.js"
Cohesion: 0.24
Nodes (7): BiometricAuthService, getCategoryMeta(), escapeHtml(), initSpendingChart(), renderCanvasDonutFallback(), renderDashboard(), renderTxnItemHtml()

### Community 4 - "categorizer.js"
Cohesion: 0.20
Nodes (9): BankStatementParser, ALL_CATEGORIES, categorizeTransaction(), CATEGORY_DEFINITIONS, extractCleanMerchant(), formatTitleCase(), SPECIFIC_VENDOR_RULES, res (+1 more)

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, display_override, icons, id, lang (+7 more)

### Community 6 - "package.json"
Cohesion: 0.15
Nodes (12): author, description, keywords, license, main, name, scripts, dev (+4 more)

### Community 7 - "email_pdf_streamline.py"
Cohesion: 0.22
Nodes (9): csv, os, pypdf, re, batch_decrypt_directory(), decrypt_pdf(), Bank Email Statement Streamliner & Auto-Decryptor…, Decrypt a password-protected bank PDF statement. (+1 more)

### Community 8 - "auth.js"
Cohesion: 0.20
Nodes (7): https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js, https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js, FirebaseAuthService, GoogleAuthService, firebaseConfig, loadFirebaseConfig(), ref_https

### Community 12 - "transactions.js"
Cohesion: 0.36
Nodes (9): addTransaction(), getUserAccounts(), escapeHtml(), renderAddExpense(), escapeHtml(), exportTransactionsCSV(), renderGroupedList(), renderTransactions() (+1 more)

### Community 15 - "Design Scout"
Cohesion: 0.10
Nodes (19): Animation and Interaction, CSS Frameworks, Design Principles to Apply (from frontend-design), Design Scout, Framework Reference, Phase 1: Understand the Brief, Phase 2: Scout the Design Galleries, Phase 3: Synthesize and Report (+11 more)

### Community 16 - "pwa_maker_skill_finance_tracker.md"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Architecture, 2. Web App Manifest (`public/manifest.json`), 3. iOS Native Fit & HTML Meta Tags, 4. Service Worker & Caching Strategy Matrix, 5. Offline Architecture & IndexedDB Sync Queue, 6. PWA Mobile UX Guidelines, 7. iOS Custom Install Prompt Component, 8. Feature Core & Execution Checklist (+5 more)

### Community 17 - "db.js"
Cohesion: 0.13
Nodes (35): addNotification(), AppDatabase, deleteNotification(), formatINR(), getCurrentUser(), getUnreadNotificationCount(), getUserBudgets(), getUserNotifications() (+27 more)

### Community 22 - "index.js"
Cohesion: 0.10
Nodes (21): admin, getTransporter(), monthEndExpenseReminder(), nodemailer, { onRequest }, { onSchedule }, sendAlertEmail(), dependencies (+13 more)

## Knowledge Gaps
- **77 isolated node(s):** `CATEGORY_DEFINITIONS`, `SPECIFIC_VENDOR_RULES`, `short_name`, `name`, `icons` (+72 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 110 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `db.js` to `login.js`, `accounts.js`, `app.js`, `dashboard.js`, `transactions.js`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `BankPDFParser` connect `accounts.js` to `app.js`, `categorizer.js`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `auth.js` to `accounts.js`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `CATEGORY_DEFINITIONS`, `SPECIFIC_VENDOR_RULES`, `short_name` to the rest of the system?**
  _77 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0977891156462585 - nodes in this community are weakly interconnected._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Design Scout` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._