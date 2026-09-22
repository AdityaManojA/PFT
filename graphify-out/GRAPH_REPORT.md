# Graph Report - PFT  (2026-09-23)

## Corpus Check
- 40 files · ~41,149 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 321 nodes · 726 edges · 24 communities (12 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38ecf6de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.js
- accounts.js
- .init
- formatINR
- categorizer.js
- manifest.json
- package.json
- email_pdf_streamline.py
- FirebaseAuthService
- rules/graphify.md
- workflows/graphify.md
- sw.js
- createParticleMesh
- Design Scout
- pwa_maker_skill_finance_tracker.md
- getCurrentUser
- Graphify + Antigravity Project Workflow & Setup Guide
- index.js
- test_verification.mjs

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 32 edges
2. `renderAccounts()` - 27 edges
3. `BankPDFParser` - 20 edges
4. `formatINR()` - 19 edges
5. `checkSpendingCaps()` - 18 edges
6. `renderDashboard()` - 16 edges
7. `AppCoordinator` - 15 edges
8. `renderTransactions()` - 14 edges
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

## Communities (24 total, 12 thin omitted)

### Community 0 - "db.js"
Cohesion: 0.12
Nodes (23): https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js, https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js, escapeHtml(), GoogleAuthService, AppDatabase, drainOfflineQueue(), findUserByEmail(), getAllUsers() (+15 more)

### Community 1 - "accounts.js"
Cohesion: 0.13
Nodes (19): addStatementUploadHistory(), getStatementUploadHistory(), resetUserData(), BankPDFParser, GmailStatementSyncService, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml() (+11 more)

### Community 3 - "formatINR"
Cohesion: 0.18
Nodes (21): escapeHtml(), openEditTransactionModal(), addTransaction(), formatINR(), getUserAccounts(), getUserTransactions(), ALL_CATEGORIES, CATEGORY_DEFINITIONS (+13 more)

### Community 4 - "categorizer.js"
Cohesion: 0.15
Nodes (11): db, BankStatementParser, categorizeTransaction(), detectMCC(), extractCleanMerchant(), formatTitleCase(), NPCI_MCC_MAP, SPECIFIC_VENDOR_RULES (+3 more)

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, display_override, icons, id, lang (+7 more)

### Community 6 - "package.json"
Cohesion: 0.15
Nodes (12): author, description, keywords, license, main, name, scripts, dev (+4 more)

### Community 7 - "email_pdf_streamline.py"
Cohesion: 0.22
Nodes (9): csv, os, pypdf, re, batch_decrypt_directory(), decrypt_pdf(), Bank Email Statement Streamliner & Auto-Decryptor…, Decrypt a password-protected bank PDF statement. (+1 more)

### Community 15 - "Design Scout"
Cohesion: 0.10
Nodes (19): Animation and Interaction, CSS Frameworks, Design Principles to Apply (from frontend-design), Design Scout, Framework Reference, Phase 1: Understand the Brief, Phase 2: Scout the Design Galleries, Phase 3: Synthesize and Report (+11 more)

### Community 16 - "pwa_maker_skill_finance_tracker.md"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Architecture, 2. Web App Manifest (`public/manifest.json`), 3. iOS Native Fit & HTML Meta Tags, 4. Service Worker & Caching Strategy Matrix, 5. Offline Architecture & IndexedDB Sync Queue, 6. PWA Mobile UX Guidelines, 7. iOS Custom Install Prompt Component, 8. Feature Core & Execution Checklist (+5 more)

### Community 17 - "getCurrentUser"
Cohesion: 0.13
Nodes (32): addNotification(), deleteNotification(), getCurrentUser(), getUnreadNotificationCount(), getUserBudgets(), getUserNotifications(), getUserSpendingCap(), markAllNotificationsAsRead() (+24 more)

### Community 22 - "index.js"
Cohesion: 0.10
Nodes (21): admin, getTransporter(), monthEndExpenseReminder(), nodemailer, { onRequest }, { onSchedule }, sendAlertEmail(), dependencies (+13 more)

### Community 23 - "test_verification.mjs"
Cohesion: 0.33
Nodes (5): ref_fs, ref_path, checkFiles(), parsed, testHeaders

## Knowledge Gaps
- **78 isolated node(s):** `Workflow: graphify`, `STATIC_ASSETS`, `VENDOR_URLS`, `Animation and Interaction`, `CSS Frameworks` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 117 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `db.js`, `accounts.js`, `.init`, `formatINR`, `categorizer.js`, `createParticleMesh`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `BankPDFParser` connect `accounts.js` to `db.js`, `categorizer.js`, `test_verification.mjs`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `FirebaseAuthService` to `db.js`, `categorizer.js`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `Workflow: graphify`, `STATIC_ASSETS`, `VENDOR_URLS` to the rest of the system?**
  _78 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13229018492176386 - nodes in this community are weakly interconnected._
- **Should `categorizer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._