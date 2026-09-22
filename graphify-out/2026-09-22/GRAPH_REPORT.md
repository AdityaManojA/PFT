# Graph Report - PFT  (2026-09-22)

## Corpus Check
- 33 files · ~31,922 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 252 nodes · 536 edges · 22 communities (11 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad61b2cc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- accounts.js
- AppCoordinator
- dashboard.js
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
- auth.js
- getCurrentUser
- Graphify + Antigravity Project Workflow & Setup Guide

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 26 edges
2. `renderAccounts()` - 25 edges
3. `BankPDFParser` - 19 edges
4. `AppCoordinator` - 15 edges
5. `renderDashboard()` - 15 edges
6. `BiometricAuthService` - 13 edges
7. `renderTransactions()` - 13 edges
8. `formatINR()` - 12 edges
9. `FirebaseAuthService` - 11 edges
10. `renderBudgets()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `renderBankCardHtml()` --calls--> `formatINR()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `handlePdfFile()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `parseAndIngestPdfText()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `processCsvText()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/accounts.js → js/db.js
- `promptPdfPasswordModal()` --calls--> `getCurrentUser()`  [EXTRACTED]
  js/views/accounts.js → js/db.js

## Import Cycles
- None detected.

## Communities (22 total, 11 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.19
Nodes (18): escapeHtml(), AppDatabase, drainOfflineQueue(), findUserByEmail(), getAllUsers(), loginUser(), purgeAllTestData(), registerUser() (+10 more)

### Community 1 - "accounts.js"
Cohesion: 0.14
Nodes (18): resetUserData(), BankPDFParser, GmailStatementSyncService, confirmDeleteAccountModal(), confirmRemovePasskeyModal(), escapeHtml(), handlePdfFile(), handleUploadedFile() (+10 more)

### Community 3 - "dashboard.js"
Cohesion: 0.22
Nodes (18): formatINR(), getUserAccounts(), getUserBudgets(), getUserTransactions(), getCategoryMeta(), escapeHtml(), openBudgetEditModal(), renderBudgets() (+10 more)

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

### Community 17 - "auth.js"
Cohesion: 0.16
Nodes (9): GoogleAuthService, db, firebaseConfig, loadFirebaseConfig(), ref_fs, ref_path, checkFiles(), parsed (+1 more)

### Community 18 - "getCurrentUser"
Cohesion: 0.21
Nodes (6): addTransaction(), getCurrentUser(), escapeHtml(), renderAddExpense(), createParticleMesh(), renderLanding()

## Knowledge Gaps
- **61 isolated node(s):** `CATEGORY_DEFINITIONS`, `SPECIFIC_VENDOR_RULES`, `short_name`, `name`, `icons` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 95 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BankPDFParser` connect `accounts.js` to `app.js`, `auth.js`, `categorizer.js`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `getCurrentUser` to `app.js`, `accounts.js`, `AppCoordinator`, `dashboard.js`, `auth.js`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `FirebaseAuthService` connect `FirebaseAuthService` to `auth.js`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `CATEGORY_DEFINITIONS`, `SPECIFIC_VENDOR_RULES`, `short_name` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13513513513513514 - nodes in this community are weakly interconnected._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Design Scout` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._