/**
 * Main Application Coordinator
 * Handles multi-user sessions, tab switching, hash routing, auth overlay,
 * toast notifications, and PWA lifecycle.
 */

import { seedInitialDataIfNeeded, drainOfflineQueue, getCurrentUser, getAllUsers, setCurrentUser } from './db.js';
import { BiometricAuthService } from './auth.js';
import { initPWAEngine, promptPWAInstall, dismissIOSInstallBanner } from './pwa.js';

import { renderDashboard } from './views/dashboard.js';
import { renderTransactions } from './views/transactions.js';
import { renderAddExpense } from './views/add-expense.js';
import { renderAccounts } from './views/accounts.js';
import { renderBudgets } from './views/budgets.js';
import { renderLogin } from './views/login.js';

class AppCoordinator {
  constructor() {
    this.currentRoute = 'dashboard';
    this.mainContainer = document.getElementById('view-container');
    this.bottomNav = document.querySelector('.bottom-nav');
    this.offlineBanner = document.getElementById('offline-sync-banner');
    this.toastContainer = document.getElementById('toast-container');
    this.appContainer = document.getElementById('app-container');
  }

  async init() {
    console.log('Starting Personal Finance Tracker PWA with Multi-User support...');

    // 1. Initialize Dexie DB with seeds
    await seedInitialDataIfNeeded();

    // 2. Setup PWA Engine & Service Worker
    initPWAEngine(
      (isOnline) => this.handleNetworkChange(isOnline),
      (syncedCount) => {
        if (syncedCount > 0) {
          this.showToast(`Synced ${syncedCount} offline transactions!`, 'success');
          this.refreshCurrentView();
        }
      }
    );

    // 3. Setup Navigation & Routing
    this.setupRouting();
    this.setupGlobalControls();

    // 4. Check active user profile
    const user = await getCurrentUser();
    this.updateHeaderUserProfile(user);

    if (!user) {
      this.navigate('#/login');
      return;
    }

    // 5. Check Biometric Lock
    const isLocked = await BiometricAuthService.isBiometricLockEnabled();
    if (isLocked) {
      this.showBiometricLockScreen();
    } else {
      this.navigate(window.location.hash || '#/dashboard');
    }
  }

  updateHeaderUserProfile(user) {
    const nameEl = document.getElementById('header-user-name');
    if (nameEl) {
      nameEl.innerText = user ? user.name : 'Login';
    }
  }

  setupRouting() {
    window.addEventListener('hashchange', () => {
      this.navigate(window.location.hash);
    });

    // Tab bar clicks
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.onclick = () => {
        const route = btn.dataset.route;
        window.location.hash = `#/${route}`;
      };
    });
  }

  navigate(hash = '#/dashboard') {
    const route = hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    this.currentRoute = route;

    // Toggle bottom nav visibility on login screen
    if (this.bottomNav) {
      this.bottomNav.style.display = route === 'login' ? 'none' : 'flex';
    }

    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.dataset.route === route) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Render target view
    this.refreshCurrentView();
  }

  async refreshCurrentView() {
    if (!this.mainContainer) return;

    this.mainContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div style="font-size: 1.8rem; animation: spin 1s infinite linear;">⚡</div></div>';

    switch (this.currentRoute) {
      case 'login':
        await renderLogin(this.mainContainer, (user) => this.handleLoginSuccess(user));
        break;
      case 'dashboard':
        await renderDashboard(this.mainContainer);
        break;
      case 'transactions':
        await renderTransactions(this.mainContainer);
        break;
      case 'add':
        await renderAddExpense(this.mainContainer, (msg, type) => this.showToast(msg, type));
        break;
      case 'accounts':
        await renderAccounts(this.mainContainer, (msg, type) => this.showToast(msg, type));
        break;
      case 'budgets':
        await renderBudgets(this.mainContainer, (msg, type) => this.showToast(msg, type));
        break;
      default:
        await renderDashboard(this.mainContainer);
    }
  }

  handleLoginSuccess(user) {
    this.updateHeaderUserProfile(user);
    this.showToast(`Logged in as ${user.name}!`, 'success');
    window.location.hash = '#/dashboard';
  }

  setupGlobalControls() {
    // User Profile Switcher Click
    const userBtn = document.getElementById('header-user-btn');
    if (userBtn) {
      userBtn.onclick = () => this.showUserProfileSheet();
    }

    // Install Header button
    const installBtn = document.getElementById('header-install-btn');
    if (installBtn) {
      installBtn.onclick = () => promptPWAInstall();
    }

    // Dismiss iOS banner button
    const dismissIosBtn = document.getElementById('ios-banner-dismiss-btn');
    if (dismissIosBtn) {
      dismissIosBtn.onclick = () => dismissIOSInstallBanner();
    }

    // Screen Simulator view toggle for desktop users
    const screenToggleBtn = document.getElementById('header-screen-toggle-btn');
    if (screenToggleBtn && this.appContainer) {
      screenToggleBtn.onclick = () => {
        this.appContainer.classList.toggle('phone-mockup-mode');
        const isMockup = this.appContainer.classList.contains('phone-mockup-mode');
        screenToggleBtn.innerText = isMockup ? '🖥️ Desktop' : '📱 Phone View';
      };
    }

    // Biometric Security lock toggle in header
    const lockBtn = document.getElementById('header-lock-btn');
    if (lockBtn) {
      lockBtn.onclick = () => this.showBiometricLockScreen();
    }

    // Universal Desktop & Mac Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Escape closes any open modal or sheet
      if (e.key === 'Escape') {
        const modalContainer = document.getElementById('global-modal-container');
        if (modalContainer && modalContainer.children.length > 0) {
          modalContainer.innerHTML = '';
        }
      }

      // Cmd+K or Ctrl+K -> Search Ledger
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.location.hash = '#/transactions';
        setTimeout(() => {
          const searchInput = document.getElementById('txns-search-input');
          if (searchInput) searchInput.focus();
        }, 150);
      }

      // Cmd+N or Ctrl+N -> Add Expense
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        window.location.hash = '#/add';
      }

      // Cmd+L or Ctrl+L -> Lock app
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.showBiometricLockScreen();
      }
    });
  }

  /**
   * Private Profile Sheet (Only shows currently logged-in user)
   */
  async showUserProfileSheet() {
    const modalContainer = document.getElementById('global-modal-container');
    if (!modalContainer) return;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.hash = '#/login';
      return;
    }

    const initial = (currentUser.name || 'U').charAt(0).toUpperCase();

    modalContainer.innerHTML = `
      <div class="modal-backdrop active" id="profile-sheet-backdrop">
        <div class="modal-sheet">
          <div class="sheet-handle"></div>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-emerald) 0%, var(--accent-blue) 100%); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; color: white; margin: 0 auto 10px auto; box-shadow: var(--shadow-glow-emerald);">
              ${initial}
            </div>
            <h3 class="sheet-title" style="margin-bottom: 2px;">${escapeHtml(currentUser.name)}</h3>
            <p style="font-size: var(--text-xs); color: var(--text-muted);">${escapeHtml(currentUser.email || 'Local User Vault')}</p>
            <span class="badge badge-emerald" style="margin-top: 8px;">🔒 Private Vault Active</span>
          </div>

          <div style="background: var(--bg-deep); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px; font-size: var(--text-xs); display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Account Status</span>
              <span style="font-weight: 600; color: var(--accent-emerald);">Isolated & Encrypted</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Storage Location</span>
              <span style="font-weight: 600;">IndexedDB (Device Memory)</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="sheet-add-bank-btn" class="btn btn-secondary btn-block">
              💳 Manage / Add Bank Accounts
            </button>
            <button id="logout-btn" class="btn btn-primary btn-block" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);">
              🚪 Log Out of Vault
            </button>
          </div>
        </div>
      </div>
    `;

    const backdrop = document.getElementById('profile-sheet-backdrop');
    backdrop.onclick = (e) => {
      if (e.target.id === 'profile-sheet-backdrop') modalContainer.innerHTML = '';
    };

    document.getElementById('sheet-add-bank-btn').onclick = () => {
      modalContainer.innerHTML = '';
      window.location.hash = '#/accounts';
    };

    document.getElementById('logout-btn').onclick = () => {
      setCurrentUser(null);
      this.updateHeaderUserProfile(null);
      modalContainer.innerHTML = '';
      this.showToast('Logged out successfully.', 'info');
      window.location.hash = '#/login';
      this.refreshCurrentView();
    };
  }

  handleNetworkChange(isOnline) {
    if (this.offlineBanner) {
      this.offlineBanner.style.display = isOnline ? 'none' : 'flex';
    }
    const statusPill = document.getElementById('header-network-pill');
    if (statusPill) {
      statusPill.className = `badge ${isOnline ? 'badge-blue' : 'badge-amber'}`;
      statusPill.innerText = isOnline ? 'Online' : 'Offline';
    }
  }

  showToast(message, type = 'success') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : 'ℹ';
    toast.innerHTML = `<span style="color: ${type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-blue)'}; font-weight: 800;">${icon}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  /**
   * Biometric Lock Screen Overlay (Section 6)
   */
  showBiometricLockScreen() {
    const modalContainer = document.getElementById('global-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="biometric-overlay" id="biometric-lock-overlay">
        <div class="biometric-icon-glow">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path><path d="M12 6v6l4 2"></path></svg>
        </div>
        <h2 style="font-size: var(--text-2xl); font-weight: 800; margin-bottom: 6px;">Finance Tracker</h2>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 24px;">
          Biometric authentication required to view financial records.
        </p>

        <button id="unlock-biometric-btn" class="btn btn-primary btn-block" style="padding: 14px; margin-bottom: 12px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Unlock with FaceID / Biometrics
        </button>

        <div style="font-size: var(--text-xs); color: var(--text-secondary); margin: 12px 0;">— OR ENTER PIN —</div>

        <div style="display: flex; gap: 8px; margin-bottom: 16px; justify-content: center;">
          <input type="password" id="pin-input" class="form-input" maxlength="4" placeholder="••••" style="width: 120px; text-align: center; font-size: 1.5rem; letter-spacing: 6px;" />
        </div>

        <button id="unlock-pin-btn" class="btn btn-secondary btn-block">
          Unlock with PIN (Default: 1234)
        </button>
      </div>
    `;

    const unlockBioBtn = document.getElementById('unlock-biometric-btn');
    unlockBioBtn.onclick = async () => {
      const success = await BiometricAuthService.authenticateBiometrics();
      if (success) {
        modalContainer.innerHTML = '';
        this.showToast('Unlocked with Biometrics!', 'success');
      } else {
        this.showToast('Biometric prompt was skipped or unavailable. Try PIN 1234.', 'info');
      }
    };

    const unlockPinBtn = document.getElementById('unlock-pin-btn');
    const pinInput = document.getElementById('pin-input');
    unlockPinBtn.onclick = async () => {
      const pin = pinInput.value;
      const isValid = await BiometricAuthService.verifyPin(pin);
      if (isValid) {
        modalContainer.innerHTML = '';
        this.showToast('Unlocked successfully!', 'success');
      } else {
        this.showToast('Invalid PIN! Try default sandbox PIN: 1234', 'info');
      }
    };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Start application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new AppCoordinator();
  app.init();
});
