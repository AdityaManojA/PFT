# pwa_maker_skill_finance_tracker.md

## System Role & Instructions for AI Developer

You are an expert Senior Full-Stack Engineer specializing in mobile-first Progressive Web Applications (PWAs), web performance, and offline-first database architectures. 

Your objective is to build a high-performance, installable **Personal Finance Tracker PWA** optimized for mobile devices (specifically iOS Safari and Android Chrome) tailored for the Indian financial ecosystem (incorporating Account Aggregator data pipelines and CSV statement parsers).

---

## 1. Project Overview & Architecture

* **App Type:** Mobile-first Progressive Web App (PWA)
* **Target Audience:** Personal finance tracking in India (HDFC, Federal Bank, SBI, ICICI, etc.)
* **Data Sources:** 
  1. RBI Account Aggregator (AA) framework (e.g., Setu SDK / Sandbox) for live bank sync.
  2. Native client-side CSV/XLS statement parsing for manual uploads.
  3. Manual entry via offline-first IndexedDB queue.
* **Key PWA Characteristics:** Standalone launch mode, zero-latency offline expense logging, safe-area UI inset awareness, background synchronization, and WebAuthn biometric security.

---

## 2. Web App Manifest (`public/manifest.json`)

Configure the application manifest to support standalone launch, masking, theme matching, and quick action app shortcuts.

```json
{
  "short_name": "FinanceTracker",
  "name": "Personal Finance Tracker",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "type": "image/png",
      "sizes": "192x192",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "type": "image/png",
      "sizes": "512x512",
      "purpose": "any maskable"
    }
  ],
  "id": "/?source=pwa",
  "start_url": "/?source=pwa",
  "background_color": "#0F172A",
  "theme_color": "#0F172A",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "description": "Track expenses, HDFC/Federal bank connections, and budgets offline and online.",
  "shortcuts": [
    {
      "name": "Add Expense",
      "short_name": "Add",
      "description": "Log a manual expense",
      "url": "/transactions/new?source=shortcut",
      "icons": [{ "src": "/icons/add-icon.png", "sizes": "192x192" }]
    }
  ]
}
```

---

## 3. iOS Native Fit & HTML Meta Tags

Place the following tags in the main HTML document `<head>` to override default iOS Safari UI chrome, handle notch/home-bar safe areas, and specify app icons.

```html
<!-- Mobile Viewport & Safe Areas for iPhone Notch / Home Bar -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

<!-- iOS PWA Standalone Mode -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="FinanceTracker" />

<!-- iOS App Icons & Manifest -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.json" />

<!-- iOS Splash Screen Image -->
<link rel="apple-touch-startup-image" href="/splash/iphone-14-pro.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
```

---

## 4. Service Worker & Caching Strategy Matrix

Implement Service Worker caching (using Workbox or custom Service Worker listeners) according to resource type:

| Asset / Endpoint | Strategy | Cache Expiry / Limits | Behavioral Target |
|---|---|---|---|
| **HTML Shell / App Routes** | `StaleWhileRevalidate` | 7 Days | Render UI shell instantly, update page in background. |
| **JS / CSS Bundles** | `CacheFirst` | 30 Days (Versioned) | Serve immutable web assets directly from cache. |
| **Financial API Data (`/api/*`)** | `NetworkFirst` | Max 24 Hours | Attempt network fetch; fallback to cached JSON or IndexedDB when offline. |
| **CSV/Bank File Uploads** | Client-Side Exec | Immediate | Process bank statements directly on device inside browser memory. |

---

## 5. Offline Architecture & IndexedDB Sync Queue

Ensure zero-latency transaction logging by maintaining an offline database queue using **Dexie.js**.

### Offline Workflow Logic
1. **Log Action:** When an expense is submitted, save it directly to IndexedDB with `synced: false`.
2. **Optimistic UI:** Immediately append the entry to local state and notify the user.
3. **Background Sync:**
   - Register a `sync` task: `registration.sync.register('sync-transactions')`.
   - When connection is restored, the Service Worker drains the offline queue, posts data to the backend API, and updates local records to `synced: true`.

```typescript
// db/schema.ts - Dexie.js Schema Definition
import Dexie, { Table } from 'dexie';

export interface OfflineTransaction {
  id?: number;
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  date: string;
  account_id: string;
  synced: boolean;
  created_at: string;
}

export class AppDatabase extends Dexie {
  transactions!: Table<OfflineTransaction>;

  constructor() {
    super('FinanceTrackerPWA');
    this.version(1).stores({
      transactions: '++id, date, category, synced, account_id'
    });
  }
}

export const db = new AppDatabase();
```

---

## 6. PWA Mobile UX Guidelines

### CSS Insets & Touch Tweaks
Apply global layout styling to respect physical phone boundaries (notch, dynamic island, bottom home bar) and eliminate browser touch artifacts:

```css
/* Respect screen cutouts and home bar */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  overscroll-behavior-y: contain; /* Prevent unwanted pull-to-refresh pull down */
}

/* Remove grey box highlight on mobile tap */
button, a, input, select {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
```

### Biometric Lock Trigger (WebAuthn API)
Implement optional FaceID/TouchID app locking before displaying account balances:

```javascript
async function authenticateBiometrics() {
  if (window.PublicKeyCredential) {
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          userVerification: "required"
        }
      });
      return !!credential;
    } catch (err) {
      console.error("Biometric authentication failed:", err);
      return false;
    }
  }
  return false;
}
```

---

## 7. iOS Custom Install Prompt Component

Because iOS Safari does not fire `beforeinstallprompt`, build an in-app banner for non-standalone iOS users.

```typescript
// Component Logic Outline
import { useEffect, useState } from 'react';

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const inStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

    setIsIOS(isIosDevice);
    setIsStandalone(inStandaloneMode);
  }, []);

  if (isIOS && !isStandalone) {
    return (
      <div className="fixed bottom-4 left-4 right-4 p-4 bg-slate-900 text-white rounded-xl shadow-2xl z-50 border border-slate-700">
        <p className="text-sm font-medium">Install app on your iPhone:</p>
        <p className="text-xs text-slate-400 mt-1">
          Tap the <strong className="text-blue-400">Share</strong> button in Safari, then select <strong className="text-blue-400">Add to Home Screen</strong>.
        </p>
      </div>
    );
  }

  return null;
}
```

---

## 8. Feature Core & Execution Checklist

1. **Authentication & PWA Shell:**
   - Configure local session/OTP auth.
   - Serve PWA App Shell with tab bar navigation (Dashboard, Transactions, Add, Accounts, Settings).
2. **Offline Transaction Flow:**
   - Implement `Add Transaction` form storing directly to IndexedDB first.
   - Sync data automatically via Service Worker when network status changes from `offline` to `online`.
3. **Data Ingestion (India Context):**
   - **AA Integration:** Integrate Setu Account Aggregator sandbox SDK for bank consent and transaction sync.
   - **CSV Fallback Parser:** Build client-side parser (`PapaParse` or `xlsx`) supporting HDFC Bank and Federal Bank CSV/XLS export formats.
4. **Visual Dashboard:**
   - Expense categorization (auto-rule tagging based on UPI/vendor keywords like "SWIGGY", "AMAZON", "SIP").
   - Category budget tracking with visual status bars and alerts.