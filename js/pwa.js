/**
 * PWA Service Worker Registration & Install Prompt Engine
 * Implements iOS Custom Install Card (Section 7) and Network status listeners.
 */

import { drainOfflineQueue } from './db.js';

let deferredInstallPrompt = null;

export function initPWAEngine(onNetworkChange, onSyncComplete) {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('Service Worker registered with scope:', reg.scope);

          // Handle updates
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content is available; refreshing to activate latest version.');
                  window.location.reload();
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Listen for messages from Service Worker (e.g. background sync)
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'TRIGGER_OFFLINE_SYNC') {
          const syncedCount = await drainOfflineQueue();
          if (onSyncComplete) onSyncComplete(syncedCount);
        }
      });
    });
  }

  // 2. Listen for Android / Chrome beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('header-install-btn');
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
    }
  });

  // 3. Online / Offline network status listeners
  window.addEventListener('online', async () => {
    console.log('Device returned ONLINE');
    if (onNetworkChange) onNetworkChange(true);
    const syncedCount = await drainOfflineQueue();
    if (onSyncComplete) onSyncComplete(syncedCount);
  });

  window.addEventListener('offline', () => {
    console.log('Device went OFFLINE');
    if (onNetworkChange) onNetworkChange(false);
  });

  // Check iOS custom install prompt
  checkAndRenderIOSInstallPrompt();
}

/**
 * Trigger native install prompt
 */
export async function promptPWAInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    console.log('User install choice:', choice.outcome);
    deferredInstallPrompt = null;
    const installBtn = document.getElementById('header-install-btn');
    if (installBtn) installBtn.style.display = 'none';
  } else {
    // Show iOS instruction modal if on iOS or desktop
    const iosBanner = document.getElementById('ios-install-banner');
    if (iosBanner) iosBanner.style.display = 'flex';
  }
}

/**
 * Section 7: iOS Custom Install Prompt Component
 */
function checkAndRenderIOSInstallPrompt() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isStandalone = ('standalone' in window.navigator) && window.navigator.standalone;

  const banner = document.getElementById('ios-install-banner');
  if (!banner) return;

  // Show if on iOS and not yet in standalone mode, and user hasn't dismissed it
  const dismissed = sessionStorage.getItem('ios_install_dismissed');
  if (isIOS && !isStandalone && !dismissed) {
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

export function dismissIOSInstallBanner() {
  sessionStorage.setItem('ios_install_dismissed', 'true');
  const banner = document.getElementById('ios-install-banner');
  if (banner) banner.style.display = 'none';
}
