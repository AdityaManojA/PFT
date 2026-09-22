/**
 * Private Authentication View
 * Strict single-user isolation: No other users' profiles or accounts are visible.
 * Users authenticate with their Username/Email and PIN, or create their own account.
 */

import { loginUser, registerUser, getCurrentUser } from '../db.js';

let activeAuthTab = 'login'; // 'login' or 'signup'

export async function renderLogin(container, onLoginSuccess) {
  container.innerHTML = `
    <div style="max-width: 400px; margin: 30px auto; padding: 20px 10px; text-align: center;">
      <!-- Brand Logo -->
      <div style="width: 56px; height: 56px; margin: 0 auto 16px auto; border-radius: 16px; background: linear-gradient(135deg, var(--accent-emerald) 0%, var(--accent-blue) 100%); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; color: white; box-shadow: var(--shadow-glow-emerald);">
        ₹
      </div>
      <h2 style="font-size: var(--text-2xl); font-weight: 800; margin-bottom: 6px;">FinanceTracker</h2>
      <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 24px;">
        Private, encrypted offline personal finance tracker.
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

      <!-- Sign In Form -->
      <div class="card" id="login-card" style="text-align: left; display: ${activeAuthTab === 'login' ? 'block' : 'none'};">
        <form id="sign-in-form">
          <div class="form-group">
            <label class="form-label" for="login-identifier">Username or Email</label>
            <input type="text" id="login-identifier" class="form-input" placeholder="e.g. aditya or priya" required autofocus />
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label" for="login-pin">4-Digit PIN</label>
            <input type="password" id="login-pin" class="form-input" maxlength="4" placeholder="••••" style="letter-spacing: 6px; font-size: 1.3rem;" required />
          </div>

          <button type="submit" id="login-submit-btn" class="btn btn-primary btn-block" style="padding: 13px;">
            Sign In to My Vault →
          </button>
        </form>
      </div>

      <!-- Create Account Form -->
      <div class="card" id="signup-card" style="text-align: left; display: ${activeAuthTab === 'signup' ? 'block' : 'none'};">
        <form id="sign-up-form">
          <div class="form-group">
            <label class="form-label" for="signup-name">Your Full Name</label>
            <input type="text" id="signup-name" class="form-input" placeholder="e.g. Priya Sharma" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="signup-email">Username or Email</label>
            <input type="text" id="signup-email" class="form-input" placeholder="e.g. priya" required />
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label" for="signup-pin">Set a 4-Digit Security PIN</label>
            <input type="password" id="signup-pin" class="form-input" maxlength="4" placeholder="••••" value="1234" style="letter-spacing: 6px; font-size: 1.3rem;" required />
            <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 4px;">Used to unlock your private ledger</span>
          </div>

          <button type="submit" id="signup-submit-btn" class="btn btn-primary btn-block" style="padding: 13px;">
            Create My Vault & Start Tracking →
          </button>
        </form>
      </div>

      <div style="margin-top: 20px; font-size: 11px; color: var(--text-muted);">
        🔒 Zero-Knowledge Privacy: Each account is completely isolated. No one can see your banks or transactions.
      </div>
    </div>
  `;

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

  // Sign In Form Submission
  const loginForm = container.querySelector('#sign-in-form');
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const identifier = container.querySelector('#login-identifier').value.trim();
    const pin = container.querySelector('#login-pin').value.trim();

    try {
      const user = await loginUser(identifier, pin);
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

    try {
      const user = await registerUser(name, email, pin);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      alert(err.message);
    }
  };
}
