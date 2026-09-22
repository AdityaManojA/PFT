/**
 * Biometric & Privacy Security Module
 * Implements WebAuthn API biometric verification per Section 6,
 * with quick PIN fallback and balance privacy masking.
 */

import { db } from './db.js';

export class BiometricAuthService {
  /**
   * Check if WebAuthn Biometric hardware is available
   */
  static isBiometricAvailable() {
    return Boolean(
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.get === 'function'
    );
  }

  /**
   * Trigger WebAuthn Biometric authentication prompt (FaceID / TouchID / Windows Hello)
   */
  static async authenticateBiometrics() {
    if (!this.isBiometricAvailable()) {
      console.warn('WebAuthn is not supported in this browser environment.');
      return false;
    }

    try {
      // In real devices, challenge is issued by server; for client-only PWA, generate 32 random bytes
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required'
        }
      });

      return Boolean(credential);
    } catch (err) {
      console.warn('Biometric challenge cancelled or not configured:', err.message);
      return false;
    }
  }

  /**
   * Verify PIN code fallback against active user profile
   */
  static async verifyPin(pin) {
    const curId = localStorage.getItem('pft_active_user_id');
    if (curId) {
      const user = await db.users.get(curId);
      if (user && user.pin) {
        return String(pin).trim() === String(user.pin).trim();
      }
    }
    const setting = await db.settings.get('customPin');
    if (setting && setting.value) {
      return String(pin).trim() === String(setting.value).trim();
    }
    return false;
  }

  /**
   * Toggle balance privacy masking state
   */
  static async togglePrivacyMode() {
    const current = await this.getPrivacyMode();
    const nextState = !current;
    await db.settings.put({ key: 'privacyMode', value: nextState });
    return nextState;
  }

  static async getPrivacyMode() {
    const setting = await db.settings.get('privacyMode');
    return setting ? Boolean(setting.value) : false;
  }

  static async isBiometricLockEnabled() {
    const setting = await db.settings.get('biometricEnabled');
    return setting ? Boolean(setting.value) : false;
  }

  static async setBiometricLockEnabled(enabled) {
    await db.settings.put({ key: 'biometricEnabled', value: Boolean(enabled) });
  }
}

/**
 * Firebase Google Authentication Service
 * Connects to Firebase Authentication modular SDK (v10) for genuine
 * Google OAuth popup authentication with automatic domain handling
 * and seamless fallback for local environments.
 */
let firebaseAppInstance = null;
let firebaseAuthInstance = null;

export class FirebaseAuthService {
  /**
   * Retrieve saved Firebase Configuration
   */
  static getFirebaseConfig() {
    try {
      const raw = localStorage.getItem('sbafa_firebase_config');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse stored Firebase config:', e);
    }
    return null;
  }

  /**
   * Save Firebase Configuration
   */
  static setFirebaseConfig(config) {
    if (!config) {
      localStorage.removeItem('sbafa_firebase_config');
      firebaseAppInstance = null;
      firebaseAuthInstance = null;
      return;
    }
    localStorage.setItem('sbafa_firebase_config', JSON.stringify(config));
    firebaseAppInstance = null;
    firebaseAuthInstance = null;
  }

  /**
   * Check if Firebase is configured
   */
  static isConfigured() {
    const config = this.getFirebaseConfig();
    return Boolean(config && config.apiKey && (config.projectId || config.authDomain));
  }

  /**
   * Dynamically import modular Firebase v10 SDK
   */
  static async loadFirebaseSdk() {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    return { ...appMod, ...authMod };
  }

  /**
   * Initialize or retrieve Firebase Auth instance
   */
  static async getAuth() {
    const config = this.getFirebaseConfig();
    if (!config) throw new Error('Firebase configuration missing.');

    const sdk = await this.loadFirebaseSdk();
    if (!firebaseAppInstance) {
      firebaseAppInstance = sdk.getApps().length === 0 ? sdk.initializeApp(config) : sdk.getApp();
    }
    if (!firebaseAuthInstance) {
      firebaseAuthInstance = sdk.getAuth(firebaseAppInstance);
    }
    return { auth: firebaseAuthInstance, sdk };
  }

  /**
   * Trigger Google Sign-In with Firebase Popup
   */
  static async signInWithGoogle() {
    if (!this.isConfigured()) {
      const result = await this.promptFirebaseConfigModal();
      if (!result) {
        throw new Error('Firebase authentication setup was cancelled.');
      }
      // If the user selected the instant local profile fallback
      if (result.email && result.authProvider === 'local-google') {
        return result;
      }
    }

    try {
      const { auth, sdk } = await this.getAuth();
      const provider = new sdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await sdk.signInWithPopup(auth, provider);
      const user = cred.user;

      return {
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Google User'),
        email: (user.email || '').toLowerCase(),
        picture: user.photoURL || '',
        uid: user.uid,
        authProvider: 'firebase-google'
      };
    } catch (err) {
      console.error('Firebase Google Auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Google sign-in popup was closed before completing.');
      }
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in your Firebase Console. Go to Firebase Console > Authentication > Settings > Authorized domains and add localhost.');
      }
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/invalid-api-key') {
        this.setFirebaseConfig(null);
        throw new Error('Invalid Firebase API key or configuration. Please re-enter your config.');
      }
      throw err;
    }
  }

  /**
   * Modal dialog to configure Firebase keys or choose instant dev fallback
   */
  static promptFirebaseConfigModal() {
    return new Promise((resolve, reject) => {
      const modalContainer = document.getElementById('global-modal-container');
      if (!modalContainer) {
        reject(new Error('Modal container not found'));
        return;
      }

      modalContainer.innerHTML = `
        <div class="modal-backdrop active" id="firebase-config-backdrop">
          <div class="modal-sheet" style="max-width: 440px;">
            <div class="sheet-handle"></div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #FFCA28; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#E65100">
                  <path d="M12.97 2.59a.75.75 0 0 0-1.28-.15L8.9 6.27 4.9 3.3a.75.75 0 0 0-1.22.61L1.24 17.5a1.75 1.75 0 0 0 .74 1.63l8.76 5.84a2.25 2.25 0 0 0 2.52 0l8.76-5.84a1.75 1.75 0 0 0 .74-1.63L20.32 3.9a.75.75 0 0 0-1.22-.61l-4-2.97-2.13 2.27z"/>
                </svg>
              </div>
              <div>
                <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Connect to Firebase</h3>
                <div style="font-size: 11px; color: var(--text-muted);">Enable live Google OAuth authentication</div>
              </div>
            </div>

            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px;">
              Google authentication uses <strong>Firebase Auth</strong> for secure popup sign-in. Enter your project config from the
              <a href="https://console.firebase.google.com" target="_blank" rel="noopener" style="color: var(--accent-blue); text-decoration: underline;">Firebase Console</a>.
            </p>

            <form id="firebase-config-form">
              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label" style="display: flex; justify-content: space-between;">
                  <span>Paste Firebase Config (JSON or snippet)</span>
                  <span style="font-size: 10px; color: var(--text-muted);">Optional</span>
                </label>
                <textarea id="firebase-raw-json" class="form-textarea" rows="3" placeholder='const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "..." };' style="font-family: var(--font-family-mono); font-size: 11px;"></textarea>
              </div>

              <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-bottom: 10px;">— OR ENTER INDIVIDUAL KEYS —</div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label">API Key</label>
                  <input type="text" id="firebase-api-key" class="form-input" placeholder="AIzaSy..." style="font-size: 12px;" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label">Project ID</label>
                  <input type="text" id="firebase-project-id" class="form-input" placeholder="my-finance-app" style="font-size: 12px;" />
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">Auth Domain</label>
                <input type="text" id="firebase-auth-domain" class="form-input" placeholder="my-finance-app.firebaseapp.com" style="font-size: 12px;" />
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <button type="submit" class="btn btn-primary btn-block">
                  Save & Connect with Google →
                </button>
                <button type="button" id="firebase-demo-fallback-btn" class="btn btn-secondary btn-block" style="font-size: 12px;">
                  ⚡ Quick Test with Local Google Profile
                </button>
                <button type="button" id="firebase-cancel-btn" class="btn btn-outline btn-block" style="font-size: 12px;">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      const cleanup = () => { modalContainer.innerHTML = ''; };
      const cancelBtn = document.getElementById('firebase-cancel-btn');
      const backdrop = document.getElementById('firebase-config-backdrop');
      const form = document.getElementById('firebase-config-form');
      const demoBtn = document.getElementById('firebase-demo-fallback-btn');

      cancelBtn.onclick = () => { cleanup(); resolve(null); };
      backdrop.onclick = (e) => {
        if (e.target.id === 'firebase-config-backdrop') {
          cleanup();
          resolve(null);
        }
      };

      demoBtn.onclick = () => {
        cleanup();
        resolve({
          name: 'Demo Google User',
          email: 'demo.user@gmail.com',
          picture: '',
          authProvider: 'local-google',
          uid: 'google-demo-' + Math.random().toString(36).substring(2, 8)
        });
      };

      form.onsubmit = (e) => {
        e.preventDefault();
        const rawJson = document.getElementById('firebase-raw-json').value.trim();
        let config = null;

        if (rawJson) {
          try {
            // Attempt to parse JSON or extract key-values from JS object snippet
            const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              // Convert unquoted keys to quoted keys for standard JSON parsing
              const normalized = jsonMatch[0]
                .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
                .replace(/'/g, '"')
                .replace(/,\s*\}/g, '}');
              config = JSON.parse(normalized);
            }
          } catch (err) {
            console.warn('Direct JSON parse failed, trying field extractions:', err);
          }
        }

        if (!config || !config.apiKey) {
          const apiKey = document.getElementById('firebase-api-key').value.trim();
          const projectId = document.getElementById('firebase-project-id').value.trim();
          const authDomain = document.getElementById('firebase-auth-domain').value.trim() || `${projectId}.firebaseapp.com`;
          if (apiKey && projectId) {
            config = { apiKey, projectId, authDomain };
          }
        }

        if (!config || !config.apiKey) {
          alert('Please enter at least your Firebase API Key and Project ID.');
          return;
        }

        FirebaseAuthService.setFirebaseConfig(config);
        cleanup();
        resolve(true);
      };
    });
  }
}

// Backward-compatible alias
export const GoogleAuthService = FirebaseAuthService;

