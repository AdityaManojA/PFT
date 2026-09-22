# Graph Report - PFT  (2026-09-23)

## Corpus Check
- 42 files · ~45,929 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 340 nodes · 804 edges · 24 communities (14 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5dc7b38f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- accounts.js
- getCurrentUser
- dashboard.js
- categorizer.js
- manifest.json
- package.json
- email_pdf_streamline.py
- auth.js
- rules/graphify.md
- workflows/graphify.md
- sw.js
- BiometricAuthService
- Design Scout
- pwa_maker_skill_finance_tracker.md
- db.js
- Graphify + Antigravity Project Workflow & Setup Guide
- index.js

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

## Communities (24 total, 10 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.16
Nodes (9): escapeHtml(), drainOfflineQueue(), getAllUsers(), checkAndRenderIOSInstallPrompt(), dismissIOSInstallBanner(), initPWAEngine(), promptPWAInstall(), createParticleMesh() (+1 more)

### Community 1 - "accounts.js"
Cohesion: 0.13
Nodes (21): resetUserData(), BankPDFParser, GmailStatementSyncService, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml(), findAccountByBankAndLast4(), handleUploadedFile() (+13 more)

### Community 2 - "getCurrentUser"
Cohesion: 0.19
Nodes (8): AppCoordinator, addStatementUploadHistory(), getCurrentUser(), getStatementUploadHistory(), notifyCloudSync(), triggerCloudSync(), CloudVaultSyncService, isSyncing

### Community 3 - "dashboard.js"
Cohesion: 0.19
Nodes (22): escapeHtml(), openEditTransactionModal(), addTransaction(), formatINR(), getActiveAccountFilter(), getUserAccounts(), setActiveAccountFilter(), getCategoryMeta() (+14 more)

### Community 4 - "categorizer.js"
Cohesion: 0.14
Nodes (12): BankStatementParser, ALL_CATEGORIES, categorizeTransaction(), CATEGORY_DEFINITIONS, detectMCC(), extractCleanMerchant(), formatTitleCase(), NPCI_MCC_MAP (+4 more)

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, display_override, icons, id, lang (+7 more)

### Community 6 - "package.json"
Cohesion: 0.13
Nodes (14): author, description, keywords, license, main, name, scripts, build (+6 more)

### Community 7 - "email_pdf_streamline.py"
Cohesion: 0.22
Nodes (9): csv, os, pypdf, re, batch_decrypt_directory(), decrypt_pdf(), Bank Email Statement Streamliner & Auto-Decryptor…, Decrypt a password-protected bank PDF statement. (+1 more)

### Community 8 - "auth.js"
Cohesion: 0.13
Nodes (10): FirebaseAuthService, db, firebaseConfig, loadFirebaseConfig(), ref_fs, ref_https, ref_path, checkFiles() (+2 more)

### Community 12 - "BiometricAuthService"
Cohesion: 0.24
Nodes (9): BiometricAuthService, GoogleAuthService, findUserByEmail(), loginUser(), registerUser(), setCurrentUser(), escapeHtml(), promptRegistrationGoogleStep() (+1 more)

### Community 15 - "Design Scout"
Cohesion: 0.10
Nodes (19): Animation and Interaction, CSS Frameworks, Design Principles to Apply (from frontend-design), Design Scout, Framework Reference, Phase 1: Understand the Brief, Phase 2: Scout the Design Galleries, Phase 3: Synthesize and Report (+11 more)

### Community 16 - "pwa_maker_skill_finance_tracker.md"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Architecture, 2. Web App Manifest (`public/manifest.json`), 3. iOS Native Fit & HTML Meta Tags, 4. Service Worker & Caching Strategy Matrix, 5. Offline Architecture & IndexedDB Sync Queue, 6. PWA Mobile UX Guidelines, 7. iOS Custom Install Prompt Component, 8. Feature Core & Execution Checklist (+5 more)

### Community 17 - "db.js"
Cohesion: 0.12
Nodes (33): addNotification(), AppDatabase, deleteNotification(), getUnreadNotificationCount(), getUserBudgets(), getUserNotifications(), getUserSpendingCap(), getUserTransactions() (+25 more)

### Community 22 - "index.js"
Cohesion: 0.10
Nodes (21): admin, getTransporter(), monthEndExpenseReminder(), nodemailer, { onRequest }, { onSchedule }, sendAlertEmail(), dependencies (+13 more)

## Knowledge Gaps
- **80 isolated node(s):** `{ onSchedule }`, `{ onRequest }`, `admin`, `nodemailer`, `name` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `app.js`, `accounts.js`, `dashboard.js`, `auth.js`, `BiometricAuthService`, `db.js`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `BankPDFParser` connect `accounts.js` to `app.js`, `auth.js`, `categorizer.js`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `auth.js` to `getCurrentUser`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `{ onSchedule }`, `{ onRequest }`, `admin` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `categorizer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14130434782608695 - nodes in this community are weakly interconnected._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._