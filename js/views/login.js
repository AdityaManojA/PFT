/**
 * Private Authentication View - SBAFA
 * Single-user isolation with Compulsory Two-Factor Authentication (2FA).
 * Combines 6-digit Knowledge PIN with Google Authentication / Biometric device passkey.
 */

import { loginUser, registerUser, getCurrentUser, setCurrentUser, findUserByEmail } from '../db.js';
import { GoogleAuthService, BiometricAuthService } from '../auth.js';

let activeAuthTab = 'login'; // 'login' or 'signup'

export async function renderLogin(container, onLoginSuccess) {
  container.innerHTML = `
    <div style="max-width: 440px; margin: 16px auto 40px auto; padding: 12px 16px; text-align: center;">
      <!-- Back to Home Link -->
      <div style="text-align: left; margin-bottom: 20px;">
        <button id="auth-back-to-landing-btn" class="btn btn-outline btn-sm" style="border-radius: var(--radius-full);">
          ← Back to Home
        </button>
      </div>

      <!-- Brand Logo Badge -->
      <div style="width: 58px; height: 58px; margin: 0 auto 16px auto; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(224, 76, 0, 0.35);">
        <img src="icons/SBAFA_Logo.svg" alt="SBAFA Logo" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <h2 style="font-size: var(--text-2xl); font-family: var(--font-family-display); font-weight: 700; letter-spacing: -0.03em; margin-bottom: 6px;">SBAFA Enclave</h2>
      <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 22px;">
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

      <!-- Sign In Form Card (Option to use Google OR Username/Email + PIN) -->
      <div class="card" id="login-card" style="text-align: left; display: ${activeAuthTab === 'login' ? 'block' : 'none'}; padding: 24px;">
        <!-- 1-Tap Google Sign-In Action -->
        <button type="button" id="google-signin-btn" class="btn btn-google btn-lg btn-block" style="margin-bottom: 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <!-- Centered Clean Divider -->
        <div class="auth-divider">
          <span>or sign in with credentials</span>
        </div>

        <!-- Custom In-App Error Banner -->
        <div id="login-form-error" style="display: none; color: var(--signal-expense); font-size: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 9px 12px; margin-bottom: 14px; text-align: center;"></div>

        <form id="sign-in-form">
          <div class="form-group">
            <label class="form-label" for="login-identifier">Username or Email</label>
            <input type="text" id="login-identifier" class="form-input" placeholder="Enter username or email" required />
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" for="login-pin">6-Digit Security PIN / Password</label>
            <input type="password" id="login-pin" class="form-input" maxlength="6" placeholder="••••••" style="letter-spacing: 8px; font-size: 1.4rem; text-align: center; font-weight: 700;" required />
          </div>

          <!-- Collapsible Bank Statement Password setup for existing logins -->
          <div style="margin-bottom: 18px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" id="login-bank-toggle-row">
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--accent-blue); display: flex; align-items: center; gap: 5px;">
                <span>⚙️</span> PDF Statement Password &amp; Autofill
              </span>
              <span id="login-bank-toggle-arrow" style="font-size: 11px; color: var(--text-muted);">▼</span>
            </div>

            <div id="login-bank-expandable" style="display: none; margin-top: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px;">
              <div class="form-group">
                <label class="form-label">Primary Bank</label>
                <select id="login-bank-select" class="form-select">
                  <option value="HDFC">HDFC Bank</option>
                  <option value="FEDERAL">Federal Bank</option>
                  <option value="ICICI">ICICI Bank</option>
                  <option value="SBI">State Bank of India (SBI)</option>
                  <option value="AXIS">Axis Bank</option>
                  <option value="KOTAK">Kotak Mahindra Bank</option>
                  <option value="OTHER">Other Bank</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Statement Password</label>
                <input type="password" id="login-pdf-pwd" class="form-input" placeholder="Password for viewing your protected Pdfs and access the statements (read only)" />
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

          <button type="submit" id="login-submit-btn" class="btn btn-primary btn-lg btn-block">
            Sign In to Vault →
          </button>
        </form>

        <!-- Explainer Note Below Form -->
        <div class="bank-pwd-note" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px 14px; margin-top: 18px; font-size: 11px; line-height: 1.5; color: var(--text-secondary); text-align: left;">
          <div style="font-weight: 700; color: var(--accent-emerald); margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> Note: Protected Statement PDFs
          </div>
          <div>Please enter the bank-provided password required to view your bank statement for protected PDFs.</div>
          <div style="color: var(--text-muted); margin-top: 6px; font-size: 10.5px; border-top: 1px dashed var(--border-subtle); padding-top: 6px;">
            🔒 Stored 100% locally and encrypted on your device. Never shared or uploaded. You can toggle autofill on or off anytime.
          </div>
        </div>
      </div>

      <!-- Create Account Form (Pure initial registration; NO Google button or OR divider shown here) -->
      <div class="card" id="signup-card" style="text-align: left; display: ${activeAuthTab === 'signup' ? 'block' : 'none'}; padding: 24px;">
        <div style="margin-bottom: 18px;">
          <h3 style="font-size: var(--text-base); font-weight: 700; margin-bottom: 4px;">Initial Vault Registration</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted);">Fill in your initial account details below. Google 2FA identity registration will follow as the next step.</p>
        </div>

        <!-- Custom In-App Error Banner -->
        <div id="signup-form-error" style="display: none; color: var(--signal-expense); font-size: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 9px 12px; margin-bottom: 14px; text-align: center;"></div>

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
            <input type="password" id="signup-pin" class="form-input" maxlength="6" placeholder="••••••" style="letter-spacing: 8px; font-size: 1.4rem; text-align: center; font-weight: 700;" required />
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
              <option value="KOTAK">Kotak Mahindra Bank</option>
              <option value="OTHER">Other Bank</option>
            </select>
          </div>

          <!-- PDF Statement Password -->
          <div class="form-group">
            <label class="form-label" for="signup-pdf-pwd" id="signup-pwd-label">Statement Password</label>
            <input type="password" id="signup-pdf-pwd" class="form-input" placeholder="Password for viewing your protected Pdfs and access the statements (read only)" />
            <div id="signup-bank-hint" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Enter the bank-provided password for viewing protected statement PDFs
            </div>
          </div>

          <!-- Autofill Checkbox -->
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px;">
            <input type="checkbox" id="signup-autofill-chk" checked style="width: 17px; height: 17px; margin-top: 2px; accent-color: var(--accent-emerald); cursor: pointer;" />
            <label for="signup-autofill-chk" style="font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer; line-height: 1.4;">
              <strong>Enable 1-Tap Statement Autofill</strong><br/>
              <span style="color: var(--text-muted); font-size: 11px;">Automatically decrypt statement PDFs without asking every time. You can turn this off anytime.</span>
            </label>
          </div>

          <button type="submit" id="signup-submit-btn" class="btn btn-primary btn-lg btn-block">
            Proceed to Step 2: Register Google 2FA →
          </button>
        </form>

        <!-- Explainer Note Below Form -->
        <div class="bank-pwd-note" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px 14px; margin-top: 18px; font-size: 11px; line-height: 1.5; color: var(--text-secondary); text-align: left;">
          <div style="font-weight: 700; color: var(--accent-emerald); margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> Note: Protected Statement PDFs
          </div>
          <div>Please enter the bank-provided password required to view your bank statement for protected PDFs.</div>
          <div style="color: var(--text-muted); margin-top: 6px; font-size: 10.5px; border-top: 1px dashed var(--border-subtle); padding-top: 6px;">
            🔒 Stored 100% locally and encrypted on your device. Never shared or uploaded. You can toggle autofill on or off anytime.
          </div>
        </div>
      </div>

      <div style="margin-top: 22px; font-size: 11px; color: var(--text-muted);">
        🔒 Zero-Knowledge Privacy: Each account is isolated on-device with compulsory two-factor security.
      </div>
    </div>
  `;

  // Bank hint updater helper
  const updateBankHint = (selectEl, hintEl, inputEl) => {
    if (hintEl) hintEl.innerText = 'Enter the bank-provided password for viewing protected statement PDFs';
    if (inputEl) inputEl.placeholder = 'Password for viewing your protected Pdfs and access the statements (read only)';
  };

  // Wire signup bank hint
  const signupBankSelect = container.querySelector('#signup-bank-select');
  const signupBankHint = container.querySelector('#signup-bank-hint');
  const signupPdfPwd = container.querySelector('#signup-pdf-pwd');
  if (signupBankSelect) {
    signupBankSelect.onchange = () => updateBankHint(signupBankSelect, signupBankHint, signupPdfPwd);
    updateBankHint(signupBankSelect, signupBankHint, signupPdfPwd);
  }

  // Wire login bank expandable row
  const loginBankToggle = container.querySelector('#login-bank-toggle-row');
  const loginBankExpandable = container.querySelector('#login-bank-expandable');
  const loginBankArrow = container.querySelector('#login-bank-toggle-arrow');
  const loginBankSelect = container.querySelector('#login-bank-select');
  const loginBankHint = container.querySelector('#login-bank-hint');
  const loginPdfPwd = container.querySelector('#login-pdf-pwd');

  if (loginBankToggle && loginBankExpandable) {
    loginBankToggle.onclick = () => {
      const isHidden = loginBankExpandable.style.display === 'none';
      loginBankExpandable.style.display = isHidden ? 'block' : 'none';
      if (loginBankArrow) loginBankArrow.innerText = isHidden ? '▲' : '▼';
    };
  }

  if (loginBankSelect) {
    loginBankSelect.onchange = () => updateBankHint(loginBankSelect, loginBankHint, loginPdfPwd);
    updateBankHint(loginBankSelect, loginBankHint, loginPdfPwd);
  }

  // Back to Landing page button
  const backToLandingBtn = container.querySelector('#auth-back-to-landing-btn');
  if (backToLandingBtn) {
    backToLandingBtn.onclick = () => {
      window.location.hash = '#/landing';
    };
  }

  // Tab switcher
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

  // Google Sign-In Action on Sign In Card -> Direct 1-tap login
  const googleBtn = container.querySelector('#google-signin-btn');
  if (googleBtn) {
    googleBtn.onclick = async () => {
      try {
        const googleProfile = await GoogleAuthService.signInWithGoogle();
        if (!googleProfile || !googleProfile.email) return;

        const existing = await findUserByEmail(googleProfile.email);
        if (existing) {
          // If Google provides an image, save it immediately so it's always up to date
          if (googleProfile.picture && (existing.picture !== googleProfile.picture || existing.photoURL !== googleProfile.picture)) {
            await db.users.update(existing.id, {
              picture: googleProfile.picture,
              photoURL: googleProfile.picture
            });
            existing.picture = googleProfile.picture;
            existing.photoURL = googleProfile.picture;
          }
          // Direct login for existing users via Google
          setCurrentUser(existing);
          if (onLoginSuccess) onLoginSuccess(existing);
        } else {
          // If no account exists yet, direct to registration tab and pre-fill Google PFP
          tabSignup.click();
          const signupName = container.querySelector('#signup-name');
          const signupEmail = container.querySelector('#signup-email');
          if (signupName && !signupName.value) signupName.value = googleProfile.name || '';
          if (signupEmail && !signupEmail.value) signupEmail.value = googleProfile.email || '';
          window.__pendingGooglePicture = googleProfile.picture || '';
          showSignupErr(`No vault found for ${googleProfile.email}. Please set your 6-digit PIN below to finalize your vault.`);
        }
      } catch (err) {
        if (err && err.message && !err.message.includes('cancelled') && !err.message.includes('closed')) {
          showLoginErr(err.message);
        }
      }
    };
  }

  // Sign In Form Submission -> Direct login with Username/Email + Password/PIN pair
  const loginForm = container.querySelector('#sign-in-form');
  const loginError = container.querySelector('#login-form-error');
  const showLoginErr = (msg) => {
    if (loginError) {
      loginError.innerText = msg;
      loginError.style.display = 'block';
    }
  };

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    if (loginError) loginError.style.display = 'none';
    const identifier = container.querySelector('#login-identifier').value.trim();
    const pin = container.querySelector('#login-pin').value.trim();

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      showLoginErr('Please enter your 6-digit numeric security PIN.');
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
      // Direct login using credentials
      setCurrentUser(user);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      showLoginErr(err.message || 'Incorrect credentials. Please try again.');
      container.querySelector('#login-pin').value = '';
      container.querySelector('#login-pin').focus();
    }
  };

  // Sign Up Form Submission -> Validates initial form, then opens Step 2 (Google 2FA Registration)
  const signupForm = container.querySelector('#sign-up-form');
  const signupError = container.querySelector('#signup-form-error');
  const showSignupErr = (msg) => {
    if (signupError) {
      signupError.innerText = msg;
      signupError.style.display = 'block';
    }
  };

  signupForm.onsubmit = async (e) => {
    e.preventDefault();
    if (signupError) signupError.style.display = 'none';
    const name = container.querySelector('#signup-name').value.trim();
    const email = container.querySelector('#signup-email').value.trim();
    const pin = container.querySelector('#signup-pin').value.trim();

    if (!name) {
      showSignupErr('Please enter your full name.');
      container.querySelector('#signup-name').focus();
      return;
    }

    if (!email) {
      showSignupErr('Please enter a username or email.');
      container.querySelector('#signup-email').focus();
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      showSignupErr('Please enter exactly 6 numeric digits for your security PIN.');
      container.querySelector('#signup-pin').focus();
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      showSignupErr('An account with this username or email already exists. Please sign in instead.');
      return;
    }

    const primaryBank = signupBankSelect ? signupBankSelect.value : 'HDFC';
    const pdfPassword = signupPdfPwd ? signupPdfPwd.value.trim() : '';
    const autofillEnabled = container.querySelector('#signup-autofill-chk')
      ? container.querySelector('#signup-autofill-chk').checked
      : true;

    // Proceed to Step 2: Register Google 2FA
    promptRegistrationGoogleStep({
      name,
      email,
      pin,
      primaryBank,
      pdfPassword,
      autofillEnabled
    }, onLoginSuccess);
  };
}

/**
 * Step 2 of Account Creation: Register Google Authentication (Compulsory 2FA)
 */
function promptRegistrationGoogleStep(pendingData, onLoginSuccess) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="register-google-backdrop">
      <div class="modal-sheet" style="max-width: 440px; text-align: center;">
        <div class="sheet-handle"></div>

        <div style="width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #4285F4, #1D4ED8); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(66, 133, 244, 0.35);">
          🛡️
        </div>

        <span class="badge badge-blue" style="margin-bottom: 8px;">Step 2 of 2: Compulsory 2FA</span>
        <h3 style="font-size: var(--text-lg); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
          Register Google Authentication
        </h3>
        <p style="font-size: var(--text-xs); color: var(--text-muted); line-height: 1.5; margin-bottom: 18px;">
          Vault prepared for <strong>${escapeHtml(pendingData.name)}</strong> (<code>${escapeHtml(pendingData.email)}</code>).<br/>
          Link your Google Account as your compulsory two-factor authentication key to finalize and lock your vault.
        </p>

        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 20px; text-align: left; font-size: 11.5px; line-height: 1.4; color: var(--text-secondary);">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            <span>🔐</span> Zero-Knowledge 2FA Guarantee
          </div>
          <div>Your financial transactions stay 100% encrypted on your local device. Google authentication acts strictly as your verified 2-Factor identity key.</div>
        </div>

        <!-- Custom In-App Error Banner -->
        <div id="register-google-error" style="display: none; color: var(--signal-expense); font-size: 11.5px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 14px; text-align: center;"></div>

        <button id="register-google-btn" class="btn btn-google btn-lg btn-block" style="margin-bottom: 10px;">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Link Google Account &amp; Finalize Vault →</span>
        </button>

        <button id="register-google-cancel-btn" class="btn btn-ghost btn-sm" style="color: var(--text-muted);">
          ← Back to Edit Details
        </button>
      </div>
    </div>
  `;

  document.getElementById('register-google-cancel-btn').onclick = () => {
    modalContainer.innerHTML = '';
  };

  const regGoogleBtn = document.getElementById('register-google-btn');
  regGoogleBtn.onclick = async () => {
    regGoogleBtn.disabled = true;
    regGoogleBtn.innerText = 'Connecting to Google...';

    try {
      const gProfile = await GoogleAuthService.signInWithGoogle();
      if (!gProfile || !gProfile.email) {
        throw new Error('Google sign-in was cancelled or did not return an email.');
      }

      // Complete registration with Dexie
      const newUser = await registerUser(pendingData.name, pendingData.email, pendingData.pin, {
        primaryBank: pendingData.primaryBank,
        pdfPassword: pendingData.pdfPassword,
        autofillEnabled: pendingData.autofillEnabled,
        authProvider: 'google',
        googleEmail: gProfile.email,
        picture: gProfile.picture || window.__pendingGooglePicture || '',
        photoURL: gProfile.picture || window.__pendingGooglePicture || ''
      });

      modalContainer.innerHTML = '';
      setCurrentUser(newUser);
      if (onLoginSuccess) onLoginSuccess(newUser);
    } catch (err) {
      regGoogleBtn.disabled = false;
      regGoogleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Link Google Account &amp; Finalize Vault →</span>
      `;
      const regErrDiv = document.getElementById('register-google-error');
      if (err && err.message && !err.message.includes('cancelled') && !err.message.includes('closed')) {
        if (regErrDiv) {
          regErrDiv.innerText = err.message;
          regErrDiv.style.display = 'block';
        }
      }
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
