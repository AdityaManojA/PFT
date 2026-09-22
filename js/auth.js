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
   * Verify PIN code fallback (Default sandbox PIN: 1234)
   */
  static async verifyPin(pin) {
    const setting = await db.settings.get('customPin');
    const expected = setting ? setting.value : '1234';
    return String(pin) === String(expected);
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
