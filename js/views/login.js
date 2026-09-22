/**
 * Private Authentication View
 * Strict single-user isolation: No other users' profiles or accounts are visible.
 * Users authenticate with their Username/Email and PIN, or create their own account.
 */

import { loginUser, registerUser, getCurrentUser, setCurrentUser, findUserByEmail } from '../db.js';
import { GoogleAuthService } from '../auth.js';

let activeAuthTab = 'login'; // 'login' or 'signup'

export async function renderLogin(container, onLoginSuccess) {
  container.innerHTML = `
    <div style="max-width: 420px; margin: 20px auto 40px auto; padding: 10px; text-align: center;">
      <!-- Back to Home Link -->
      <div style="text-align: left; margin-bottom: 20px;">
        <button id="auth-back-to-landing-btn" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 4px 10px; border-radius: var(--radius-full);">
          ← Back to Home
        </button>
      </div>

      <!-- Brand Logo Badge -->
      <div style="width: 48px; height: 48px; margin: 0 auto 14px auto; border-radius: var(--radius-md); background: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; color: var(--text-inverse); box-shadow: var(--shadow-sm);">
        S
      </div>
      <h2 style="font-size: var(--text-2xl); font-weight: 800; letter-spacing: -0.025em; margin-bottom: 6px;">SBAFA Enclave</h2>
      <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 24px;">
        Zero-telemetry, 256-bit encrypted personal finance vault.
      </p>

      <!-- Segmented Auth Switcher -->
      <div class="segmented-control" style="margin-bottom: 20px;">
        <button type="button" class="segment-btn ${activeAuthTab === 'login' ? 'active' : ''}" id="auth-tab-login">
          Sign In
        </button>
        <button type="button" class="segment-btn ${activeAuthTab === 'signup' ? 'active' : ''}" id="auth-tab-signup">
          Create Account
        </button>
      </div>

      <!-- Google Sign-In Action -->
      <button type="button" id="google-signin-btn" class="btn btn-block" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; margin-bottom: 16px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-medium); border-radius: var(--radius-md); font-weight: 600; color: var(--text-primary); transition: all 0.2s ease;">
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
        <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px;">or with 6-digit pin</span>
        <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
      </div>

      <!-- Sign In Form -->
      <div class="card" id="login-card" style="text-align: left; display: ${activeAuthTab === 'login' ? 'block' : 'none'};">
        <form id="sign-in-form">
          <div class="form-group">
            <label class="form-label" for="login-identifier">Username or Email</label>
            <input type="text" id="login-identifier" class="form-input" placeholder="Enter username or email" required autofocus />
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" for="login-pin">6-Digit Security PIN</label>
            <input type="password" id="login-pin" class="form-input" maxlength="6" placeholder="••••••" style="letter-spacing: 6px; font-size: 1.3rem;" required />
          </div>

          <!-- Collapsible Bank Statement Password setup for existing logins -->
          <div style="margin-bottom: 18px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" id="login-bank-toggle-row">
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--accent-blue); display: flex; align-items: center; gap: 4px;">
                <span>⚙️</span> PDF Statement Password & Autofill
              </span>
              <span id="login-bank-toggle-arrow" style="font-size: 11px; color: var(--text-muted);">▼</span>
            </div>

            <div id="login-bank-expandable" style="display: none; margin-top: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px;">
              <div class="form-group">
                <label class="form-label">Primary Bank</label>
                <select id="login-bank-select" class="form-select">
                  <option value="HDFC">HDFC Bank</option>
                  <option value="FEDERAL">Federal Bank</option>
                  <option value="ICICI">ICICI Bank</option>
                  <option value="SBI">State Bank of India (SBI)</option>
                  <option value="AXIS">Axis Bank</option>
                  <option value="OTHER">Other Bank</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Statement Password</label>
                <input type="password" id="login-pdf-pwd" class="form-input" placeholder="Enter bank-provided password" />
                <div id="login-bank-hint" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                  Enter the bank-provided password for viewing protected statement PDFs
                </div>
              </div>

              <div style="display: flex; align-items: flex-start; gap: 8px;">
                <input type="checkbox" id="login-autofill-chk" checked style="width: 16px; height: 16px; margin-top: 2px; accent-color: var(--accent-emerald); cursor: pointer;" />
                <label for="login-autofill-chk" style="font-size: 11px; color: var(--text-secondary); cursor: pointer;">
                  Enable 1-Tap Statement Autofill (Turn off anytime)
                </label>
              </div>
            </div>
          </div>

          <button type="submit" id="login-submit-btn" class="btn btn-primary btn-block" style="padding: 13px;">
            Sign In to My Vault →
          </button>
        </form>

        <!-- Explainer Note Below -->
        <div class="bank-pwd-note" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px 14px; margin-top: 16px; font-size: 11px; line-height: 1.5; color: var(--text-secondary); text-align: left;">
          <div style="font-weight: 700; color: var(--accent-emerald); margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> Note: Protected Statement PDFs
          </div>
          <div>Please enter the bank-provided password required to view your bank statement for protected PDFs.</div>
          <div style="color: var(--text-muted); margin-top: 6px; font-size: 10.5px; border-top: 1px dashed var(--border-subtle); padding-top: 6px;">
            🔒 Stored 100% locally and encrypted on your device. Never shared or uploaded. You can toggle autofill on or off anytime.
          </div>
        </div>
      </div>

      <!-- Create Account Form -->
      <div class="card" id="signup-card" style="text-align: left; display: ${activeAuthTab === 'signup' ? 'block' : 'none'};">
        <form id="sign-up-form">
          <div class="form-group">
            <label class="form-label" for="signup-name">Your Full Name</label>
            <input type="text" id="signup-name" class="form-input" placeholder="Enter your full name" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="signup-email">Username or Email</label>
            <input type="text" id="signup-email" class="form-input" placeholder="Choose a username or email" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="signup-pin">Set a 6-Digit Security PIN</label>
            <input type="password" id="signup-pin" class="form-input" maxlength="6" placeholder="••••••" style="letter-spacing: 6px; font-size: 1.3rem;" required />
            <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 4px;">Used to unlock your private ledger on this device</span>
          </div>

          <!-- Specific Bank Selection -->
          <div class="form-group">
            <label class="form-label" for="signup-bank-select">Primary Bank for Statements</label>
            <select id="signup-bank-select" class="form-select">
              <option value="HDFC">HDFC Bank</option>
              <option value="FEDERAL">Federal Bank</option>
              <option value="ICICI">ICICI Bank</option>
              <option value="SBI">State Bank of India (SBI)</option>
              <option value="AXIS">Axis Bank</option>
              <option value="OTHER">Other Bank</option>
            </select>
          </div>

          <!-- PDF Statement Password -->
          <div class="form-group">
            <label class="form-label" for="signup-pdf-pwd" id="signup-pwd-label">Statement Password</label>
            <input type="password" id="signup-pdf-pwd" class="form-input" placeholder="Enter bank-provided password" />
            <div id="signup-bank-hint" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Enter the bank-provided password for viewing protected statement PDFs
            </div>
          </div>

          <!-- Autofill Checkbox (Can be toggled off) -->
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px;">
            <input type="checkbox" id="signup-autofill-chk" checked style="width: 17px; height: 17px; margin-top: 2px; accent-color: var(--accent-emerald); cursor: pointer;" />
            <label for="signup-autofill-chk" style="font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer; line-height: 1.4;">
              <strong>Enable 1-Tap Statement Autofill</strong><br/>
              <span style="color: var(--text-muted); font-size: 11px;">Automatically decrypt statement PDFs without asking every time. You can turn this off anytime.</span>
            </label>
          </div>

          <button type="submit" id="signup-submit-btn" class="btn btn-primary btn-block" style="padding: 13px;">
            Create My Vault & Start Tracking →
          </button>
        </form>

        <!-- Explainer Note Below -->
        <div class="bank-pwd-note" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px 14px; margin-top: 16px; font-size: 11px; line-height: 1.5; color: var(--text-secondary); text-align: left;">
          <div style="font-weight: 700; color: var(--accent-emerald); margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> Note: Protected Statement PDFs
          </div>
          <div>Please enter the bank-provided password required to view your bank statement for protected PDFs.</div>
          <div style="color: var(--text-muted); margin-top: 6px; font-size: 10.5px; border-top: 1px dashed var(--border-subtle); padding-top: 6px;">
            🔒 Stored 100% locally and encrypted on your device. Never shared or uploaded. You can toggle autofill on or off anytime.
          </div>
        </div>
      </div>

      <div style="margin-top: 20px; font-size: 11px; color: var(--text-muted);">
        🔒 Zero-Knowledge Privacy: Each account is completely isolated. No one can see your banks or transactions.
      </div>
    </div>
  `;

  // Bank hint updater helper
  const updateBankHint = (selectEl, hintEl, inputEl) => {
    if (hintEl) hintEl.innerText = 'Enter the bank-provided password for viewing protected statement PDFs';
    if (inputEl) inputEl.placeholder = 'Enter bank-provided password';
  };

  // Wire signup bank hint
  const signupBankSelect = container.querySelector('#signup-bank-select');
  const signupBankHint = container.querySelector('#signup-bank-hint');
  const signupPdfPwd = container.querySelector('#signup-pdf-pwd');
  if (signupBankSelect) {
    signupBankSelect.onchange = () => updateBankHint(signupBankSelect, signupBankHint, signupPdfPwd);
  }

  // Wire login bank hint and collapsible section
  const loginBankSelect = container.querySelector('#login-bank-select');
  const loginBankHint = container.querySelector('#login-bank-hint');
  const loginPdfPwd = container.querySelector('#login-pdf-pwd');
  if (loginBankSelect) {
    loginBankSelect.onchange = () => updateBankHint(loginBankSelect, loginBankHint, loginPdfPwd);
  }

  const loginToggleRow = container.querySelector('#login-bank-toggle-row');
  const loginExpandable = container.querySelector('#login-bank-expandable');
  const loginArrow = container.querySelector('#login-bank-toggle-arrow');
  if (loginToggleRow && loginExpandable) {
    loginToggleRow.onclick = () => {
      const isVisible = loginExpandable.style.display === 'block';
      loginExpandable.style.display = isVisible ? 'none' : 'block';
      if (loginArrow) loginArrow.innerText = isVisible ? '▼' : '▲';
    };
  }

  // Back to landing button
  const backBtn = container.querySelector('#auth-back-to-landing-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      window.location.hash = '#/landing';
    };
  }

  // Switch between Sign In and Sign Up tabs
  const tabLogin = container.querySelector('#auth-tab-login');
  const tabSignup = container.querySelector('#auth-tab-signup');
  const cardLogin = container.querySelector('#login-card');
  const cardSignup = container.querySelector('#signup-card');

  tabLogin.onclick = () => {
    activeAuthTab = 'login';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    cardLogin.style.display = 'block';
    cardSignup.style.display = 'none';
  };

  tabSignup.onclick = () => {
    activeAuthTab = 'signup';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    cardSignup.style.display = 'block';
    cardLogin.style.display = 'none';
  };

  // Google Sign-In Action Handler
  const googleBtn = container.querySelector('#google-signin-btn');
  if (googleBtn) {
    googleBtn.onclick = async () => {
      try {
        const googleProfile = await GoogleAuthService.signInWithGoogle();
        if (!googleProfile || !googleProfile.email) return;

        const existing = await findUserByEmail(googleProfile.email);
        if (existing) {
          setCurrentUser(existing);
          if (onLoginSuccess) onLoginSuccess(existing);
        } else {
          promptGooglePinSetup(googleProfile, onLoginSuccess);
        }
      } catch (err) {
        if (err && err.message && !err.message.includes('cancelled')) {
          alert(err.message);
        }
      }
    };
  }

  // Sign In Form Submission
  const loginForm = container.querySelector('#sign-in-form');
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const identifier = container.querySelector('#login-identifier').value.trim();
    const pin = container.querySelector('#login-pin').value.trim();

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      alert('Please enter your 6-digit numeric security PIN.');
      container.querySelector('#login-pin').focus();
      return;
    }

    const extraSettings = {};
    if (loginPdfPwd && loginPdfPwd.value.trim()) {
      extraSettings.pdfPassword = loginPdfPwd.value.trim();
      extraSettings.primaryBank = loginBankSelect ? loginBankSelect.value : 'HDFC';
    }
    const loginAutofillChk = container.querySelector('#login-autofill-chk');
    if (loginAutofillChk) {
      extraSettings.autofillEnabled = loginAutofillChk.checked;
    }

    try {
      const user = await loginUser(identifier, pin, extraSettings);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      alert(err.message);
      container.querySelector('#login-pin').value = '';
      container.querySelector('#login-pin').focus();
    }
  };

  // Sign Up Form Submission
  const signupForm = container.querySelector('#sign-up-form');
  signupForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = container.querySelector('#signup-name').value.trim();
    const email = container.querySelector('#signup-email').value.trim();
    const pin = container.querySelector('#signup-pin').value.trim();

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      alert('Please enter exactly 6 numeric digits for your security PIN.');
      container.querySelector('#signup-pin').focus();
      return;
    }

    const primaryBank = signupBankSelect ? signupBankSelect.value : 'HDFC';
    const pdfPassword = signupPdfPwd ? signupPdfPwd.value.trim() : '';
    const autofillEnabled = container.querySelector('#signup-autofill-chk')
      ? container.querySelector('#signup-autofill-chk').checked
      : true;

    try {
      const user = await registerUser(name, email, pin, {
        primaryBank,
        pdfPassword,
        autofillEnabled
      });
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      alert(err.message);
    }
  };
}

/**
 * Prompt new Google user to set their 6-digit security PIN for device encryption
 */
function promptGooglePinSetup(googleProfile, onLoginSuccess) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="google-pin-backdrop">
      <div class="modal-sheet" style="max-width: 400px;">
        <div class="sheet-handle"></div>
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="font-size: 2rem; margin-bottom: 6px;">🔐</div>
          <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Set 6-Digit PIN</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;">
            Signed in as <strong>${escapeHtml(googleProfile.email)}</strong>. Set a 6-digit security PIN to protect your local ledger.
          </p>
        </div>

        <form id="google-pin-form">
          <div class="form-group">
            <label class="form-label">6-Digit Security PIN</label>
            <input type="password" id="google-pin-input" class="form-input" maxlength="6" placeholder="••••••" style="letter-spacing: 6px; font-size: 1.3rem; text-align: center;" required autofocus />
            <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 4px;">Used for offline unlocking & biometric verification</span>
          </div>

          <div class="form-group">
            <label class="form-label">Primary Bank for Statements</label>
            <select id="google-bank-select" class="form-select">
              <option value="HDFC">HDFC Bank</option>
              <option value="FEDERAL">Federal Bank</option>
              <option value="ICICI">ICICI Bank</option>
              <option value="SBI">State Bank of India (SBI)</option>
              <option value="AXIS">Axis Bank</option>
              <option value="OTHER">Other Bank</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Statement Password (Optional)</label>
            <input type="password" id="google-pdf-pwd" class="form-input" placeholder="Enter bank-provided password" />
          </div>

          <button type="submit" id="google-pin-submit-btn" class="btn btn-primary btn-block" style="padding: 13px;">
            Create Vault & Open SBAFA →
          </button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('google-pin-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const pin = document.getElementById('google-pin-input').value.trim();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      alert('Please enter exactly 6 numeric digits for your PIN.');
      document.getElementById('google-pin-input').focus();
      return;
    }

    const primaryBank = document.getElementById('google-bank-select').value;
    const pdfPassword = document.getElementById('google-pdf-pwd').value.trim();

    try {
      const newUser = await registerUser(googleProfile.name, googleProfile.email, pin, {
        primaryBank,
        pdfPassword,
        autofillEnabled: true,
        authProvider: 'google',
        picture: googleProfile.picture || ''
      });
      modalContainer.innerHTML = '';
      if (onLoginSuccess) onLoginSuccess(newUser);
    } catch (err) {
      alert(err.message);
    }
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
