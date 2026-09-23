# Graph Report - PFT  (2026-09-23)

## Corpus Check
- 42 files · ~47,146 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 343 nodes · 819 edges · 25 communities (13 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b952439f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- createParticleMesh
- accounts.js
- .init
- dashboard.js
- categorizer.js
- manifest.json
- package.json
- email_pdf_streamline.py
- FirebaseAuthService
- rules/graphify.md
- workflows/graphify.md
- sw.js
- auth.js
- Design Scout
- pwa_maker_skill_finance_tracker.md
- db.js
- Graphify + Antigravity Project Workflow & Setup Guide
- index.js
- email-service.js

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 39 edges
2. `renderAccounts()` - 27 edges
3. `formatINR()` - 20 edges
4. `BankPDFParser` - 20 edges
5. `renderDashboard()` - 19 edges
6. `checkSpendingCaps()` - 18 edges
7. `renderTransactions()` - 16 edges
8. `AppCoordinator` - 15 edges
9. `BiometricAuthService` - 13 edges
10. `renderBudgets()` - 13 edges

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

## Communities (25 total, 12 thin omitted)

### Community 1 - "accounts.js"
Cohesion: 0.12
Nodes (23): addStatementUploadHistory(), getStatementUploadHistory(), resetUserData(), BankPDFParser, GmailStatementSyncService, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml() (+15 more)

### Community 2 - ".init"
Cohesion: 0.24
Nodes (3): AppCoordinator, dismissIOSInstallBanner(), CloudVaultSyncService

### Community 3 - "dashboard.js"
Cohesion: 0.14
Nodes (25): BiometricAuthService, escapeHtml(), openEditTransactionModal(), addTransaction(), db, formatINR(), getActiveAccountFilter(), getUserAccounts() (+17 more)

### Community 4 - "categorizer.js"
Cohesion: 0.11
Nodes (17): BankStatementParser, ALL_CATEGORIES, categorizeTransaction(), CATEGORY_DEFINITIONS, detectMCC(), extractCleanMerchant(), formatTitleCase(), NPCI_MCC_MAP (+9 more)

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, display_override, icons, id, lang (+7 more)

### Community 6 - "package.json"
Cohesion: 0.13
Nodes (14): author, description, keywords, license, main, name, scripts, build (+6 more)

### Community 7 - "email_pdf_streamline.py"
Cohesion: 0.22
Nodes (9): csv, os, pypdf, re, batch_decrypt_directory(), decrypt_pdf(), Bank Email Statement Streamliner & Auto-Decryptor…, Decrypt a password-protected bank PDF statement. (+1 more)

### Community 12 - "auth.js"
Cohesion: 0.18
Nodes (15): https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js, https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js, GoogleAuthService, findUserByEmail(), loginUser(), registerUser(), setCurrentUser(), firebaseConfig (+7 more)

### Community 15 - "Design Scout"
Cohesion: 0.10
Nodes (19): Animation and Interaction, CSS Frameworks, Design Principles to Apply (from frontend-design), Design Scout, Framework Reference, Phase 1: Understand the Brief, Phase 2: Scout the Design Galleries, Phase 3: Synthesize and Report (+11 more)

### Community 16 - "pwa_maker_skill_finance_tracker.md"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Architecture, 2. Web App Manifest (`public/manifest.json`), 3. iOS Native Fit & HTML Meta Tags, 4. Service Worker & Caching Strategy Matrix, 5. Offline Architecture & IndexedDB Sync Queue, 6. PWA Mobile UX Guidelines, 7. iOS Custom Install Prompt Component, 8. Feature Core & Execution Checklist (+5 more)

### Community 17 - "db.js"
Cohesion: 0.13
Nodes (37): escapeHtml(), addNotification(), AppDatabase, deleteNotification(), drainOfflineQueue(), getAllUsers(), getCurrentUser(), getUnreadNotificationCount() (+29 more)

### Community 22 - "index.js"
Cohesion: 0.10
Nodes (21): admin, getTransporter(), monthEndExpenseReminder(), nodemailer, { onRequest }, { onSchedule }, sendAlertEmail(), dependencies (+13 more)

### Community 23 - "email-service.js"
Cohesion: 0.36
Nodes (5): dispatchEmail(), escapeHtml(), SENDER_EMAIL, sendLimitBreachEmail(), sendMonthEndReminderEmail()

## Knowledge Gaps
- **82 isolated node(s):** `isSyncing`, `THEME_PALETTES`, `short_name`, `name`, `icons` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `db.js` to `accounts.js`, `.init`, `dashboard.js`, `auth.js`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `BankPDFParser` connect `accounts.js` to `db.js`, `categorizer.js`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `FirebaseAuthService` to `accounts.js`, `auth.js`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `isSyncing`, `THEME_PALETTES`, `short_name` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12070874861572536 - nodes in this community are weakly interconnected._
- **Should `dashboard.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1365079365079365 - nodes in this community are weakly interconnected._
- **Should `categorizer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._