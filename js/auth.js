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
import { firebaseConfig as staticFirebaseConfig, loadFirebaseConfig } from './firebase-config.js';

let firebaseAppInstance = null;
let firebaseAuthInstance = null;

export class FirebaseAuthService {
  /**
   * Retrieve saved Firebase Configuration (asynchronously checks .env, localStorage, and hosting)
   */
  static async getFirebaseConfig() {
    // 1. Check if loaded via .env or hosting
    const loaded = await loadFirebaseConfig();
    if (loaded && loaded.apiKey) {
      return loaded;
    }

    // 2. Check localStorage cache
    try {
      const raw = localStorage.getItem('sbafa_firebase_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.apiKey) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored Firebase config:', e);
    }

    if (staticFirebaseConfig && staticFirebaseConfig.apiKey) {
      return staticFirebaseConfig;
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
   * Auto-detect Firebase Hosting initialization if deployed
   */
  static async detectHostingConfig() {
    try {
      const res = await fetch('/__/firebase/init.json');
      if (res.ok) {
        const config = await res.json();
        if (config && config.apiKey) {
          this.setFirebaseConfig(config);
          return config;
        }
      }
    } catch (e) {
      // Running locally or offline
    }
    return null;
  }

  /**
   * Check if Firebase is configured
   */
  static async isConfigured() {
    let config = await this.getFirebaseConfig();
    if (!config || !config.apiKey) {
      config = await this.detectHostingConfig();
    }
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
    const config = await this.getFirebaseConfig();
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
   * Optionally requests Gmail readonly scope for statement sync
   */
  static async signInWithGoogle(options = {}) {
    const { requestGmailScope = false } = options;
    const configured = await this.isConfigured();
    if (!configured) {
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
      if (requestGmailScope) {
        provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
      }
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await sdk.signInWithPopup(auth, provider);
      const user = cred.user;

      try {
        const oauthCred = sdk.GoogleAuthProvider.credentialFromResult(cred);
        if (oauthCred && oauthCred.accessToken) {
          sessionStorage.setItem('google_access_token', oauthCred.accessToken);
        }
      } catch (tokenErr) {
        console.warn('Could not extract Google access token:', tokenErr);
      }

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
        throw new Error('This domain (localhost) is not authorized yet. Go to Firebase Console > Authentication > Settings > Authorized domains and ensure localhost is listed.');
      }
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/invalid-api-key') {
        this.setFirebaseConfig(null);
        throw new Error('Invalid Firebase API key or configuration. Please check your key from Firebase Console.');
      }
      throw err;
    }
  }

  /**
   * Acquire an OAuth access token with Gmail readonly scope
   */
  static async getGmailAccessToken() {
    const existing = sessionStorage.getItem('google_access_token');
    if (existing) return existing;

    await this.signInWithGoogle({ requestGmailScope: true });
    const freshToken = sessionStorage.getItem('google_access_token');
    if (freshToken) return freshToken;

    throw new Error('Gmail authorization required. Please authorize Google access.');
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
                <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Connect Firebase Google Auth</h3>
                <div style="font-size: 11px; color: var(--text-muted);">Project: <strong>sbafa-ft</strong></div>
              </div>
            </div>

            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 14px; font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
              <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">🚀 2-Minute Setup in Firebase:</div>
              <div>1. <a href="https://console.firebase.google.com/project/sbafa-ft/authentication/providers" target="_blank" rel="noopener" style="color: var(--accent-blue); text-decoration: underline;">Enable Google Sign-in</a> under Authentication &gt; Sign-in method.</div>
              <div>2. Go to <a href="https://console.firebase.google.com/project/sbafa-ft/settings/general" target="_blank" rel="noopener" style="color: var(--accent-blue); text-decoration: underline;">Project Settings &gt; General</a>, under <em>Your apps</em> copy your Web API Key.</div>
              <div>3. Paste your Web API key below to sign in directly with Gmail!</div>
            </div>

            <div id="firebase-config-error" style="display: none; color: var(--signal-expense); font-size: 11.5px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 12px; text-align: center;"></div>

            <form id="firebase-config-form">
              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label" style="display: flex; justify-content: space-between;">
                  <span>Paste Web API Key OR Config Snippet</span>
                </label>
                <input type="text" id="firebase-api-key" class="form-input" placeholder="AIzaSy..." style="font-size: 12px;" />
              </div>

              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label">Project ID</label>
                <input type="text" id="firebase-project-id" class="form-input" value="sbafa-ft" placeholder="sbafa-ft" style="font-size: 12px;" />
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">Auth Domain</label>
                <input type="text" id="firebase-auth-domain" class="form-input" value="sbafa-ft.firebaseapp.com" placeholder="sbafa-ft.firebaseapp.com" style="font-size: 12px;" />
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <button type="submit" class="btn btn-primary btn-block">
                  Save & Sign In with Google →
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
      const modalErr = document.getElementById('firebase-config-error');

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
        if (modalErr) modalErr.style.display = 'none';
        const inputVal = document.getElementById('firebase-api-key').value.trim();
        const projectIdInput = document.getElementById('firebase-project-id').value.trim() || 'sbafa-ft';
        const authDomainInput = document.getElementById('firebase-auth-domain').value.trim() || `${projectIdInput}.firebaseapp.com`;
        let config = null;

        if (inputVal.includes('{')) {
          try {
            const jsonMatch = inputVal.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const normalized = jsonMatch[0]
                .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
                .replace(/'/g, '"')
                .replace(/,\s*\}/g, '}');
              config = JSON.parse(normalized);
            }
          } catch (err) {
            console.warn('Snippet parse failed, trying regex extraction:', err);
          }
          if (!config || !config.apiKey) {
            const keyMatch = inputVal.match(/apiKey\s*[:=]\s*["']([^"']+)["']/);
            if (keyMatch) {
              config = {
                apiKey: keyMatch[1],
                projectId: projectIdInput,
                authDomain: authDomainInput
              };
            }
          }
        }

        if (!config || !config.apiKey) {
          if (inputVal) {
            config = {
              apiKey: inputVal,
              projectId: projectIdInput,
              authDomain: authDomainInput
            };
          }
        }

        if (!config || !config.apiKey) {
          if (modalErr) {
            modalErr.innerText = 'Please enter your Web API Key from Firebase Console (Project Settings > General).';
            modalErr.style.display = 'block';
          }
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

