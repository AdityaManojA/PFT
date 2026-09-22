/**
 * Accounts View - SBAFA Financial Enclave
 * Handles connected Indian banks (Edit/Remove accounts), PDF statement imports,
 * and automated weekly Gmail statement sync with zero third-party telemetry.
 */

import { db, formatINR, getCurrentUser, getUserAccounts, purgeAllTestData, resetUserData, addNotification, getStatementUploadHistory, addStatementUploadHistory } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { BankStatementParser } from '../parsers/bank-parser.js';
import { BankPDFParser } from '../parsers/pdf-parser.js';
import { GmailStatementSyncService } from '../services/gmail-sync.js';
import { checkSpendingCaps } from '../services/notification-center.js';

export async function renderAccounts(container, showToastCallback) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : null;
  const accounts = userId ? await getUserAccounts(userId) : [];
  const isAutofill = userId ? await BankPDFParser.isAutofillEnabled(userId) : false;
  const userBank = userId ? await BankPDFParser.getPrimaryBank(userId) : 'Federal';
  const savedPasskey = userId ? await BankPDFParser.getSavedPasswordRaw(userBank, userId) : '';
  const isWeeklyDue = GmailStatementSyncService.isWeeklySyncDue();
  const statementHistory = userId ? await getStatementUploadHistory(userId) : [];

  let bankCardsHtml = '';
  if (accounts.length === 0) {
    bankCardsHtml = `
      <div style="text-align: center; padding: 28px 16px; background: var(--bg-surface); border: 2px dashed var(--border-medium); border-radius: var(--radius-lg); margin-bottom: 12px;">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🏦</div>
        <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
          ${!user ? 'Vault Locked (0 Accounts)' : 'No Bank Accounts Linked Yet'}
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 14px; max-width: 280px; margin-left: auto; margin-right: auto;">
          ${!user ? 'Sign in to access your connected banks and balances.' : 'Add your primary savings, current, or cash wallet using the button below.'}
        </p>
        <button id="empty-add-account-btn" class="btn btn-primary btn-sm">
          ${!user ? 'Sign In' : 'Add Bank Account'}
        </button>
      </div>
    `;
  } else {
    bankCardsHtml = accounts.map(a => renderBankCardHtml(a, isPrivacy)).join('');
  }

  container.innerHTML = `
    <!-- Gmail Weekly Statement Auto-Pull Card (Direct Email Sync) -->
    <div class="glass-card glass-card-glow-blue" style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span class="badge badge-blue">Direct Email Sync</span>
            <span class="badge ${isWeeklyDue ? 'badge-amber' : 'badge-emerald'}" style="font-size: 10px;">
              ${isWeeklyDue ? '📅 Weekly Check Due' : '✓ Up to Date'}
            </span>
          </div>
          <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">
            Fetch Bank Statements from Gmail
          </h3>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
            Automatically scans your inbox weekly for e-statements from <strong>${escapeHtml(userBank)}</strong> with keyword <code>STATEMENT</code>, decrypts the PDF locally with your saved passkey, and imports your transactions.
          </p>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            Last checked: <strong>${GmailStatementSyncService.getLastSyncLabel()}</strong> • Zero external server sharing
          </div>
        </div>
      </div>
      <button id="start-gmail-sync-btn" class="btn btn-accent-blue btn-block">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <span>Fetch Latest Statement from Gmail</span>
      </button>
    </div>

    <!-- Connected Bank Accounts List with Edit / Remove capability -->
    <div class="section-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h3 class="section-title">Connected Accounts</h3>
        <span class="badge badge-emerald">${accounts.length} Active</span>
      </div>
      <button id="add-bank-account-btn" class="btn btn-primary btn-sm" style="padding: 5px 12px; font-size: 11px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add Account
      </button>
    </div>
    <div class="bank-cards-stack">
      ${bankCardsHtml}
    </div>

    <!-- Statement PDF Passkey Management Box -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="section-header" style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.25rem;">🔑</span>
          <div>
            <h3 class="section-title" style="margin-bottom: 2px;">Statement PDF Passkey</h3>
            <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">
              Stored encrypted locally on your device for effortless statement unlocks.
            </p>
          </div>
        </div>
        <span class="badge ${savedPasskey ? 'badge-emerald' : 'badge-neutral'}">
          ${savedPasskey ? 'Passkey Configured' : 'No Passkey Saved'}
        </span>
      </div>

      <div style="background: var(--bg-deep); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">
              Primary Bank & Autofill
            </div>
            <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-top: 3px; display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(userBank)} Bank</span>
              <span class="badge ${isAutofill ? 'badge-emerald' : 'badge-amber'}" style="font-size: 10px;">
                ${isAutofill ? '⚡ Autofill Active' : 'Autofill Off'}
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${savedPasskey ? `
              <button id="toggle-passkey-reveal-btn" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 5px 10px;" title="Reveal or Mask Passkey">
                <span id="passkey-eye-icon">👁️</span> <span id="passkey-reveal-text">Show</span>
              </button>
              <button id="edit-passkey-btn" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 5px 12px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: -1px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Edit Passkey
              </button>
              <button id="remove-passkey-btn" class="btn btn-danger btn-sm" style="font-size: 11px; padding: 5px 12px;" title="Remove Passkey Completely">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: -1px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Remove Passkey
              </button>
            ` : `
              <button id="add-passkey-btn" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 5px 12px;">
                + Set Statement Passkey
              </button>
            `}
          </div>
        </div>

        ${savedPasskey ? `
          <div style="padding-top: 10px; border-top: 1px dashed var(--border-subtle); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: var(--text-xs); color: var(--text-muted);">Stored Passkey:</span>
              <code id="passkey-masked-display" style="font-size: var(--text-sm); font-family: var(--font-mono, monospace); letter-spacing: 2px; background: rgba(0,0,0,0.2); padding: 3px 10px; border-radius: var(--radius-sm); color: var(--text-primary); border: 1px solid var(--border-subtle);">••••••••</code>
            </div>
            <button id="toggle-accounts-autofill-btn" class="btn btn-ghost btn-sm" style="font-size: 11px; color: var(--accent-blue); text-decoration: underline; padding: 0;">
              ${isAutofill ? 'Turn Off Autofill' : 'Turn On Autofill'}
            </button>
          </div>
        ` : `
          <div style="font-size: 11px; color: var(--text-muted); padding-top: 6px; border-top: 1px dashed var(--border-subtle);">
            No passkey saved. You can save your statement password to avoid entering it each time you upload a PDF statement.
          </div>
        `}
      </div>

      <!-- Explainer Note -->
      <div class="bank-pwd-note" style="background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px; margin-top: 12px; font-size: 11px; line-height: 1.5; color: var(--text-secondary);">
        <div style="font-weight: 700; color: var(--accent-emerald); margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
          <span>🔒</span> Private &amp; Encrypted Locally
        </div>
        <div>Statement passkeys are stored 100% on your device. You can update the password or remove it completely at any time.</div>
      </div>
    </div>

    <!-- Bank Statement PDF Upload Section -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="section-header">
        <div>
          <h3 class="section-title">Upload Bank Statement PDF</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">
            Supports official password-protected e-Statement PDFs from HDFC, Federal, ICICI, SBI, Axis, Kotak.
          </p>
        </div>
      </div>

      <!-- Dropzone -->
      <div class="upload-dropzone" id="statement-dropzone">
        <div class="dropzone-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        </div>
        <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
          Choose Protected Bank PDF Statement
        </div>
        <div style="font-size: var(--text-xs); color: var(--text-muted);">
          Auto-decrypted using your saved statement passkey. 100% private on your device.
        </div>
        <input type="file" id="statement-file-input" accept="application/pdf,.pdf,.csv,text/csv" multiple style="display: none;" />
      </div>

      <!-- Past Uploaded Statements Text Block (3 Recent + Popup Modal for Full History) -->
      <div class="past-statements-container" style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-medium);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <span>Past Uploaded Statements (3 Recent)</span>
          </div>
          <button type="button" id="view-statement-history-btn" class="btn btn-ghost btn-sm" style="font-size: 11px; padding: 3px 8px; color: var(--accent-primary); font-weight: 700;">
            View Full History (${statementHistory.length}) →
          </button>
        </div>

        <div class="past-statements-list" style="display: flex; flex-direction: column; gap: 6px;">
          ${statementHistory.length === 0 ? `
            <div style="font-size: 11px; color: var(--text-muted); font-style: italic; padding: 4px 0;">No statements uploaded yet.</div>
          ` : statementHistory.slice(0, 3).map((stmt, idx) => `
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 11.5px;">
              <div style="display: flex; align-items: center; gap: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px;">
                <span style="font-size: 14px;">📄</span>
                <span style="font-weight: 600; color: var(--text-primary); font-family: monospace; font-size: 11.5px;" title="${escapeHtml(stmt.fileName)}">
                  ${escapeHtml(stmt.fileName)}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; font-size: 11px; color: var(--text-muted);">
                <span>${escapeHtml(stmt.uploadedAt || stmt.date || '')}</span>
                <span style="background: rgba(46, 125, 91, 0.12); color: var(--signal-income); padding: 2px 7px; border-radius: var(--radius-full); font-weight: 600; font-size: 10px; border: 1px solid rgba(46, 125, 91, 0.25);">
                  ✓ ${escapeHtml(stmt.status || 'Processed')}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Reset Full Account (Fresh Statement Ready) -->
    <div class="card" style="margin-bottom: 24px; border: 1px solid rgba(239, 68, 68, 0.3); background: linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(239, 68, 68, 0.02) 100%);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div style="max-width: 500px;">
          <div style="font-size: var(--text-sm); font-weight: 700; color: var(--signal-expense); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.15rem;">⚠️</span> Reset Full Account (Fresh Statement Ready)
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5;">
            Permanently wipes all bank accounts, transactions, balances, and budgets so you can upload a fresh statement from scratch. Your login profile, statement passkey, and 6-digit PIN remain securely saved.
          </div>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          ${user ? `
            <button id="reset-vault-data-btn" class="btn btn-danger btn-sm" style="font-size: 12px; padding: 9px 18px; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(239, 68, 68, 0.35);">
              <span>💥</span> Reset Full Account
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // --- Passkey Reveal / Hide Toggle (PIN-Gated) ---
  let passkeyVisible = false;
  const revealPasskeyBtn = container.querySelector('#toggle-passkey-reveal-btn');
  const passkeyDisplay = container.querySelector('#passkey-masked-display');
  const eyeIcon = container.querySelector('#passkey-eye-icon');
  const revealText = container.querySelector('#passkey-reveal-text');
  if (revealPasskeyBtn && passkeyDisplay) {
    revealPasskeyBtn.onclick = () => {
      if (passkeyVisible) {
        passkeyVisible = false;
        passkeyDisplay.textContent = '••••••••';
        passkeyDisplay.style.letterSpacing = '2px';
        if (eyeIcon) eyeIcon.textContent = '👁️';
        if (revealText) revealText.textContent = 'Show';
      } else {
        // Enforce PIN gating every time
        promptPinAuthModal(user, 'view your statement passkey', () => {
          passkeyVisible = true;
          passkeyDisplay.textContent = savedPasskey;
          passkeyDisplay.style.letterSpacing = 'normal';
          if (eyeIcon) eyeIcon.textContent = '🙈';
          if (revealText) revealText.textContent = 'Hide';
        });
      }
    };
  }

  // --- Edit Passkey modal trigger (PIN-Gated) ---
  const editPasskeyBtn = container.querySelector('#edit-passkey-btn');
  if (editPasskeyBtn) {
    editPasskeyBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      promptPinAuthModal(user, 'edit your statement passkey', () => {
        openEditPasskeyModal(userId, userBank, savedPasskey, isAutofill, showToastCallback, () => renderAccounts(container, showToastCallback));
      });
    };
  }

  // --- Add Passkey modal trigger (when none saved - PIN Gated) ---
  const addPasskeyBtn = container.querySelector('#add-passkey-btn');
  if (addPasskeyBtn) {
    addPasskeyBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      promptPinAuthModal(user, 'configure a statement passkey', () => {
        openEditPasskeyModal(userId, userBank, '', true, showToastCallback, () => renderAccounts(container, showToastCallback));
      });
    };
  }

  // --- Remove Passkey Completely trigger (PIN-Gated) ---
  const removePasskeyBtn = container.querySelector('#remove-passkey-btn');
  if (removePasskeyBtn) {
    removePasskeyBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      promptPinAuthModal(user, 'remove your statement passkey', () => {
        confirmRemovePasskeyModal(userId, userBank, showToastCallback, () => renderAccounts(container, showToastCallback));
      });
    };
  }

  // --- Toggle Statement Autofill handler ---
  const toggleAutofillBtn = container.querySelector('#toggle-accounts-autofill-btn');
  if (toggleAutofillBtn) {
    toggleAutofillBtn.onclick = async () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      const newPref = !isAutofill;
      await BankPDFParser.setAutofillEnabled(newPref, userId);
      showToastCallback(
        newPref ? 'Statement PDF Autofill is now ENABLED.' : 'Statement PDF Autofill is now TURNED OFF.',
        'info'
      );
      renderAccounts(container, showToastCallback);
    };
  }

  // --- Bank Card Actions: Edit & Remove Accounts ---
  container.querySelectorAll('.edit-acc-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const accId = btn.getAttribute('data-id');
      const acc = accounts.find(a => a.id === accId);
      if (acc) {
        openEditAccountModal(acc, showToastCallback, () => renderAccounts(container, showToastCallback));
      }
    };
  });

  container.querySelectorAll('.delete-acc-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const accId = btn.getAttribute('data-id');
      const acc = accounts.find(a => a.id === accId);
      if (acc) {
        confirmDeleteAccountModal(acc, showToastCallback, () => renderAccounts(container, showToastCallback));
      }
    };
  });

  // --- Add Bank Account modal triggers ---
  const addAccountBtn = container.querySelector('#add-bank-account-btn');
  if (addAccountBtn) {
    addAccountBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      openAddAccountModal(userId, showToastCallback, () => renderAccounts(container, showToastCallback));
    };
  }

  const emptyAddBtn = container.querySelector('#empty-add-account-btn');
  if (emptyAddBtn) {
    emptyAddBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      openAddAccountModal(userId, showToastCallback, () => renderAccounts(container, showToastCallback));
    };
  }

  // --- Gmail Statement Sync trigger ---
  const gmailSyncBtn = container.querySelector('#start-gmail-sync-btn');
  if (gmailSyncBtn) {
    gmailSyncBtn.onclick = () => {
      if (!user) {
        showToastCallback('Please sign in to sync statements from Gmail.', 'warning');
        window.location.hash = '#/login';
        return;
      }
      openGmailSyncModal(userId, userBank, savedPasskey, showToastCallback, () => renderAccounts(container, showToastCallback));
    };
  }

  // --- Attach File Dropzone & Picker ---
  const dropzone = container.querySelector('#statement-dropzone');
  const fileInput = container.querySelector('#statement-file-input');

  dropzone.onclick = () => fileInput.click();

  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  };
  dropzone.ondragleave = () => dropzone.classList.remove('dragover');
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleUploadedFiles(Array.from(e.dataTransfer.files), showToastCallback, () => renderAccounts(container, showToastCallback));
    }
  };

  fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      e.target.value = '';
      handleUploadedFiles(selectedFiles, showToastCallback, () => renderAccounts(container, showToastCallback));
    }
  };

  // --- View Full Statement History Modal ---
  const viewHistoryBtn = container.querySelector('#view-statement-history-btn');
  if (viewHistoryBtn) {
    viewHistoryBtn.onclick = () => {
      openStatementHistoryModal(statementHistory);
    };
  }

  // --- Reset All Vault Data Button Handler (PIN-Gated) ---
  const resetBtn = container.querySelector('#reset-vault-data-btn');
  if (resetBtn && user) {
    resetBtn.onclick = () => {
      promptPinAuthModal(user, 'permanently reset your full account and purge all data for a fresh start', async () => {
        await resetUserData(userId);
        localStorage.removeItem('sbafa_last_gmail_sync');
        showToastCallback('Full account reset complete. All data cleared — ready for a fresh statement!', 'success');
        renderAccounts(container, showToastCallback);
      });
    };
  }
}

function renderBankCardHtml(acc, isPrivacy) {
  const logoClass = acc.bankCode ? `bank-logo-${acc.bankCode.toLowerCase()}` : 'bank-logo-hdfc';
  const initial = acc.bankName ? acc.bankName.charAt(0) : 'B';
  const displayBal = isPrivacy ? '••••••••' : formatINR(acc.balance);

  return `
    <div class="bank-card" id="card-${acc.id}">
      <div class="bank-card-header">
        <div class="bank-brand">
          <div class="bank-logo-badge ${logoClass}">${initial}</div>
          <div>
            <div class="bank-name">${escapeHtml(acc.bankName)}</div>
            <div class="bank-mask">${escapeHtml(acc.accountNumberMask)} • ${escapeHtml(acc.accountType || 'Savings')}</div>
          </div>
        </div>
        <div class="bank-card-actions">
          <button class="btn-icon btn-sm edit-acc-btn" data-id="${acc.id}" title="Edit Account" aria-label="Edit Account">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon btn-sm delete-acc-btn" data-id="${acc.id}" data-name="${escapeHtml(acc.bankName)}" title="Remove Account" aria-label="Remove Account" style="color: var(--signal-expense);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
      <div class="bank-card-balance">${displayBal}</div>
      <div class="bank-card-footer">
        <span>Available Balance</span>
        <span>Synced: ${escapeHtml(acc.lastSynced || 'Never')}</span>
      </div>
    </div>
  `;
}

/**
 * Handle multiple uploaded files (PDFs and/or CSVs)
 */
async function handleUploadedFiles(files, showToast, refreshCallback) {
  if (!files || files.length === 0) return;

  const curUser = await getCurrentUser();
  if (!curUser || !curUser.id) {
    showToast('Please sign in to import statements into your vault.', 'warning');
    window.location.hash = '#/login';
    return;
  }
  const userId = curUser.id;
  const isAutofill = await BankPDFParser.isAutofillEnabled(userId);

  // Collect candidate autofill passwords
  let candidatePwds = [''];
  if (isAutofill) {
    const primaryBank = await BankPDFParser.getPrimaryBank(userId);
    const savedPrimary = await BankPDFParser.getSavedPassword(primaryBank, userId);
    const savedHdfcPwd = await BankPDFParser.getSavedPassword('HDFC', userId);
    const savedFedPwd = await BankPDFParser.getSavedPassword('FEDERAL', userId);
    candidatePwds = [savedPrimary, savedHdfcPwd, savedFedPwd, ''].filter(Boolean);
    if (!candidatePwds.includes('')) candidatePwds.push('');
  }

  const parsedStatements = [];
  const filesNeedingPassword = [];

  for (const file of files) {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        let decryptedText = null;

        for (const pwd of candidatePwds) {
          try {
            decryptedText = await BankPDFParser.extractPdfText(arrayBuffer, pwd);
            if (decryptedText) break;
          } catch (e) {
            // Try next password
          }
        }

        if (decryptedText) {
          const parsed = BankPDFParser.parseTextToTransactions(decryptedText);
          parsedStatements.push({ file, result: parsed });
        } else {
          filesNeedingPassword.push({ file, arrayBuffer });
        }
      } catch (err) {
        console.error('File read error for:', file.name, err);
        showToast(`Could not read ${file.name}: ${err.message || 'Unknown error'}`, 'warning');
      }
    } else {
      // CSV File
      try {
        const text = await file.text();
        processCsvText(text, null, showToast, refreshCallback);
      } catch (err) {
        showToast(`Could not read ${file.name}: ${err.message}`, 'warning');
      }
    }
  }

  // If some PDFs need a password, prompt for the first one and queue the rest
  if (filesNeedingPassword.length > 0) {
    const firstProtected = filesNeedingPassword[0];
    promptPdfPasswordModal(
      firstProtected.arrayBuffer,
      firstProtected.file.name,
      showToast,
      async (manualDecryptedText) => {
        if (manualDecryptedText) {
          const parsed = BankPDFParser.parseTextToTransactions(manualDecryptedText);
          parsedStatements.push({ file: firstProtected.file, result: parsed });
        }
        if (parsedStatements.length > 0) {
          await ingestMultipleStatements(parsedStatements, userId, showToast, refreshCallback);
        }
      }
    );
    // If we also had some already-decrypted statements, ingest them right away
    if (parsedStatements.length > 0) {
      await ingestMultipleStatements(parsedStatements, userId, showToast, refreshCallback);
    }
    return;
  }

  if (parsedStatements.length > 0) {
    await ingestMultipleStatements(parsedStatements, userId, showToast, refreshCallback);
  }
}

/**
 * Handle a single uploaded file (backwards compatibility wrapper)
 */
async function handleUploadedFile(file, showToast, refreshCallback) {
  return handleUploadedFiles([file], showToast, refreshCallback);
}

function promptPdfPasswordModal(arrayBuffer, fileName, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="pdf-pwd-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <div style="font-size: 1.5rem;">🔒</div>
          <span style="font-size: var(--text-base); font-weight: 700;">Password-Protected Bank PDF</span>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 14px;">
          File: <strong>${escapeHtml(fileName)}</strong> is encrypted by your bank.
        </p>

        <!-- Custom In-App Error Banner -->
        <div id="pdf-modal-error" style="display: none; color: var(--signal-expense); font-size: 11.5px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 12px; text-align: center;"></div>

        <!-- Bank Password Guide -->
        <div style="background: var(--bg-deep); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
          Please enter the bank-provided password required to view and decrypt your protected bank statement PDF.
        </div>

        <div class="form-group">
          <label class="form-label">Enter PDF Password</label>
          <input type="password" id="pdf-pwd-input" class="form-input" placeholder="Password for viewing your protected Pdfs and access the statements (read only)" />
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 18px;">
          <input type="checkbox" id="pdf-remember-chk" checked style="width: 16px; height: 16px; accent-color: var(--accent-emerald);" />
          <label for="pdf-remember-chk" style="font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer;">
            Remember password on this device for future statements
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
          <button id="pdf-pwd-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button id="pdf-pwd-submit-btn" class="btn btn-primary">Decrypt &amp; Import →</button>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('pdf-pwd-input');
  const cancelBtn = document.getElementById('pdf-pwd-cancel-btn');
  const submitBtn = document.getElementById('pdf-pwd-submit-btn');
  const errDiv = document.getElementById('pdf-modal-error');

  cancelBtn.onclick = () => { modalContainer.innerHTML = ''; };

  submitBtn.onclick = async () => {
    const pwd = input.value.trim();
    if (!pwd) {
      if (errDiv) {
        errDiv.innerText = 'Please enter the statement password';
        errDiv.style.display = 'block';
      }
      showToast('Please enter the statement password', 'info');
      input.focus();
      return;
    }

    if (errDiv) errDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Decrypting...';

    try {
      const text = await BankPDFParser.extractPdfText(arrayBuffer, pwd);
      
      // Save password if checked, or update autofill preference
      const remember = document.getElementById('pdf-remember-chk').checked;
      const curUser = await getCurrentUser();
      const userId = curUser ? curUser.id : null;
      if (remember) {
        const primary = await BankPDFParser.getPrimaryBank(userId);
        await BankPDFParser.savePassword(primary, pwd, userId, true);
        await BankPDFParser.savePassword('HDFC', pwd, userId, true);
        await BankPDFParser.savePassword('FEDERAL', pwd, userId, true);
      } else {
        await BankPDFParser.setAutofillEnabled(false, userId);
      }

      modalContainer.innerHTML = '';
      if (typeof refreshCallback === 'function' && refreshCallback.length === 1) {
        refreshCallback(text);
      } else {
        await parseAndIngestPdfText(text, showToast, refreshCallback);
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Decrypt & Import →';
      if (errDiv) {
        errDiv.innerText = 'Incorrect password or unreadable PDF. Please try again.';
        errDiv.style.display = 'block';
      }
      showToast('Incorrect password or unreadable PDF. Please try again.', 'info');
      input.focus();
    }
  };
}

/**
 * Ingest multiple parsed statements and for each bank account,
 * always take the available balance from the statement with the LATEST date.
 */
async function ingestMultipleStatements(statementList, userId, showToast, refreshCallback) {
  try {
    if (!statementList || statementList.length === 0) return;

    const userAccounts = await db.accounts.where('userId').equals(userId).toArray();

    // Group statements by bank code AND account last 4 digits (so multiple accounts of the same bank stay segregated)
    const bankGroups = {};
    for (const item of statementList) {
      const res = item.result;
      if (!res.transactions || res.transactions.length === 0) continue;
      const bankCode = (res.bankCode || res.detectedBank || 'OTHER').toUpperCase();
      const last4 = res.accountNumberLast4 || (res.accountNumberMask ? res.accountNumberMask.replace(/\D/g, '').slice(-4) : 'DEFAULT');
      const groupKey = `${bankCode}_${last4}`;
      if (!bankGroups[groupKey]) bankGroups[groupKey] = [];
      bankGroups[groupKey].push(item);
    }

    let totalImportedTxns = 0;
    const summaryReports = [];

    for (const [groupKey, items] of Object.entries(bankGroups)) {
      const firstResult = items[0].result;
      const bankCode = (firstResult.bankCode || firstResult.detectedBank || 'OTHER').toUpperCase();
      const targetLast4 = firstResult.accountNumberLast4;

      // Find or create account matching BOTH bank and last 4 digits
      let matchedAccount = userAccounts.find(a => {
        const sameBank = (a.bankCode && a.bankCode.toUpperCase() === bankCode) ||
                         (a.bankName && firstResult.detectedBank && a.bankName.toLowerCase().includes(firstResult.detectedBank.toLowerCase()));
        if (!sameBank) return false;
        if (targetLast4) {
          const accLast4 = a.accountNumberLast4 || (a.accountNumberMask ? a.accountNumberMask.replace(/\D/g, '').slice(-4) : '');
          return accLast4 === targetLast4;
        }
        return true;
      });

      // Sort items by statement date ascending so the last one is the latest
      items.sort((a, b) => {
        const dateA = a.result.statementDate || '';
        const dateB = b.result.statementDate || '';
        return dateA.localeCompare(dateB);
      });

      // The statement with the latest date
      const latestStatementItem = items[items.length - 1];
      const latestResult = latestStatementItem.result;
      const latestDate = latestResult.statementDate || '';
      const latestBalance = latestResult.availableBalance;
      const assignedMask = latestResult.accountNumberMask || (targetLast4 ? `•••• ${targetLast4}` : '•••• ' + Math.floor(1000 + Math.random() * 9000));

      // Calculate total net change if balance was null
      let netChange = 0;
      const allTxnsForBank = [];
      for (const it of items) {
        for (const t of it.result.transactions) {
          allTxnsForBank.push(t);
          netChange += (t.type === 'income' ? t.amount : -t.amount);
        }
      }

      if (!matchedAccount) {
        const newAccId = `acc-${userId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        matchedAccount = {
          id: newAccId,
          userId,
          bankName: latestResult.detectedBank || 'Bank Account',
          accountNumberMask: assignedMask,
          accountNumberLast4: targetLast4 || null,
          accountType: 'Savings Account',
          balance: latestBalance != null ? latestBalance : Math.max(0, netChange),
          bankCode: latestResult.bankCode || 'OTHER',
          lastStatementDate: latestDate,
          lastSynced: 'Just now'
        };
        await db.accounts.add(matchedAccount);
        userAccounts.push(matchedAccount);
      } else {
        // Compare with existing account's lastStatementDate
        const existingDate = matchedAccount.lastStatementDate || '';
        let targetBalance = matchedAccount.balance;

        if (latestBalance != null) {
          // If this batch has a date >= existing date, or existing had no date, use latestBalance
          if (!existingDate || latestDate >= existingDate) {
            targetBalance = latestBalance;
          }
        } else if (targetBalance == null) {
          targetBalance = Math.max(0, netChange);
        }

        const newLatestDate = (!existingDate || latestDate > existingDate) ? (latestDate || existingDate) : existingDate;

        await db.accounts.update(matchedAccount.id, {
          balance: targetBalance,
          lastStatementDate: newLatestDate,
          lastSynced: 'Just now'
        });
        matchedAccount.balance = targetBalance;
        matchedAccount.lastStatementDate = newLatestDate;
      }

      // Add all transactions to ledger (avoid exact duplicates for this account)
      const existingTxns = await db.transactions
        .where('account_id')
        .equals(matchedAccount.id)
        .toArray();

      const existingSet = new Set(existingTxns.map(t => `${t.date}_${t.amount}_${t.type}_${(t.merchant || '').toLowerCase()}`));

      const newTxnsToInsert = [];
      for (const t of allTxnsForBank) {
        const sig = `${t.date}_${t.amount}_${t.type}_${(t.merchant || '').toLowerCase()}`;
        if (!existingSet.has(sig)) {
          existingSet.add(sig);
          newTxnsToInsert.push({
            ...t,
            account_id: matchedAccount.id,
            userId
          });
        }
      }

      if (newTxnsToInsert.length > 0) {
        await db.transactions.bulkAdd(newTxnsToInsert);
      }
      totalImportedTxns += newTxnsToInsert.length;

      const balLabel = matchedAccount.balance != null ? ` • Balance: ₹${matchedAccount.balance.toFixed(2)}` : '';
      const dateLabel = matchedAccount.lastStatementDate ? ` (Latest: ${matchedAccount.lastStatementDate})` : '';
      summaryReports.push(`${matchedAccount.bankName}${balLabel}${dateLabel}`);
    }

    // Record uploaded statements to history
    const historyEntries = statementList.map(item => {
      const fn = (item.file && item.file.name) || item.fileName || 'Bank_Statement.pdf';
      const res = item.result || {};
      return {
        id: 'stmt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        fileName: fn,
        date: res.statementDate || new Date().toISOString().slice(0, 10),
        uploadedAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        bank: res.detectedBank || 'Bank Statement',
        txnCount: res.totalParsed || (res.transactions ? res.transactions.length : 0),
        balance: res.availableBalance != null ? res.availableBalance : null,
        status: 'Processed'
      };
    });
    await addStatementUploadHistory(userId, historyEntries);

    // Create In-App Notification and check spending caps
    await addNotification(userId, {
      title: `Statement Ingested (${statementList.length} files)`,
      message: `Processed ${statementList.length} statement(s), added ${totalImportedTxns} new transactions. ${summaryReports.join(' | ')}`,
      type: 'sync',
      actionUrl: '#/transactions',
      actionLabel: 'View Ledger'
    });
    await checkSpendingCaps(userId);

    showToast(
      `Ingested ${totalImportedTxns} transactions from ${statementList.length} statement(s)! ${summaryReports.join('; ')}`,
      'success'
    );

    if (refreshCallback) refreshCallback();
  } catch (err) {
    console.error('Ingest multiple statements error:', err);
    showToast('Failed to ingest statements: ' + (err.message || 'Unknown error'), 'warning');
  }
}

async function parseAndIngestPdfText(pdfText, showToast, refreshCallback) {
  const curUser = await getCurrentUser();
  if (!curUser || !curUser.id) {
    showToast('Please sign in to import statements into your vault.', 'warning');
    window.location.hash = '#/login';
    return;
  }
  const parsed = BankPDFParser.parseTextToTransactions(pdfText);
  if (parsed.transactions.length === 0) {
    showToast('Decrypted PDF, but found no transaction rows to extract.', 'info');
    return;
  }
  await ingestMultipleStatements([{ file: { name: 'statement.pdf' }, result: parsed }], curUser.id, showToast, refreshCallback);
}

async function processCsvText(csvText, targetAccId, showToast, refreshCallback) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      showToast('Please sign in to import statements into your vault.', 'warning');
      window.location.hash = '#/login';
      return;
    }
    const userId = user.id;
    const parseResult = BankStatementParser.parse(csvText, targetAccId);
    if (parseResult.transactions.length === 0) {
      showToast('No valid transactions found in statement', 'info');
      return;
    }

    // Retrieve or auto-create matching account
    const userAccounts = await db.accounts.where('userId').equals(userId).toArray();
    let matchedAccount = null;
    if (targetAccId) {
      matchedAccount = userAccounts.find(a => a.id === targetAccId);
    }
    if (!matchedAccount) {
      matchedAccount = userAccounts.find(a => 
        (a.bankCode && parseResult.bankCode && a.bankCode.toLowerCase() === parseResult.bankCode.toLowerCase()) ||
        (a.bankName && parseResult.detectedBank && a.bankName.toLowerCase().includes(parseResult.detectedBank.toLowerCase()))
      );
    }

    let netChange = 0;
    for (const t of parseResult.transactions) {
      netChange += (t.type === 'income' ? t.amount : -t.amount);
    }

    if (!matchedAccount) {
      const newAccId = `acc-${userId}-${Date.now().toString(36)}`;
      matchedAccount = {
        id: newAccId,
        userId,
        bankName: parseResult.detectedBank || 'Bank Account',
        accountNumberMask: '•••• ' + Math.floor(1000 + Math.random() * 9000),
        accountType: 'Savings Account',
        balance: Math.max(0, netChange),
        bankCode: parseResult.bankCode || 'OTHER',
        lastSynced: 'Just now'
      };
      await db.accounts.add(matchedAccount);
    } else {
      const updatedBalance = Math.max(0, (matchedAccount.balance || 0) + netChange);
      await db.accounts.update(matchedAccount.id, {
        balance: updatedBalance,
        lastSynced: 'Just now'
      });
    }

    // Ingest into database tagged with active user and matched account
    const tagged = parseResult.transactions.map(t => ({
      ...t,
      account_id: matchedAccount.id,
      userId
    }));
    await db.transactions.bulkAdd(tagged);

    // Create In-App Notification and check spending caps
    await addNotification(userId, {
      title: `CSV Statement Ingested: ${matchedAccount.bankName}`,
      message: `Ingested ${parseResult.totalParsed} transactions into ${matchedAccount.bankName}.`,
      type: 'sync',
      actionUrl: '#/transactions',
      actionLabel: 'View Ledger'
    });
    await checkSpendingCaps(userId);

    showToast(
      `Successfully ingested ${parseResult.totalParsed} transactions (${parseResult.formatDetected}) into ${matchedAccount.bankName}!`,
      'success'
    );

    if (refreshCallback) refreshCallback();
  } catch (err) {
    console.error('Parsing error:', err);
    showToast(`Parsing failed: ${err.message}`, 'info');
  }
}

/**
 * Custom In-App 6-Digit PIN Security Verification Modal
 * Uses design system tokens and inline custom error display (no native browser alert).
 */
export function promptPinAuthModal(user, actionTitle, onSuccess) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  const hasPin = Boolean(user.pin && String(user.pin).trim().length === 6);

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="pin-auth-backdrop">
      <div class="modal-sheet" style="max-width: 390px; text-align: center;">
        <div class="sheet-handle"></div>
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🔐</div>
        <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Security PIN Verification</h3>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px; margin-bottom: 16px; line-height: 1.4;">
          ${hasPin ? `Enter your 6-digit PIN to ${actionTitle}.` : `Set your 6-digit security PIN to authorize this sensitive action.`}
        </p>

        <!-- Custom In-App Error Banner -->
        <div id="pin-modal-error" style="display: none; color: var(--signal-expense); font-size: 11.5px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 14px; text-align: center;">
        </div>

        <form id="pin-auth-form">
          <div class="form-group" style="margin-bottom: 18px;">
            <input type="password" id="pin-auth-input" class="form-input" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="••••••" style="letter-spacing: 8px; font-size: 1.4rem; text-align: center; font-weight: 700;" required autofocus />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
            <button type="button" id="pin-auth-cancel-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" id="pin-auth-submit-btn" class="btn btn-primary">Authorize Action →</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const input = document.getElementById('pin-auth-input');
  const errorDiv = document.getElementById('pin-modal-error');
  const cancelBtn = document.getElementById('pin-auth-cancel-btn');
  const form = document.getElementById('pin-auth-form');

  cancelBtn.onclick = () => {
    modalContainer.innerHTML = '';
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const entered = input.value.trim();

    if (!/^\d{6}$/.test(entered)) {
      errorDiv.innerText = 'PIN must be exactly 6 digits.';
      errorDiv.style.display = 'block';
      return;
    }

    if (!hasPin) {
      // First time PIN setup on account
      user.pin = entered;
      await db.users.update(user.id, { pin: entered });
      modalContainer.innerHTML = '';
      if (onSuccess) onSuccess();
      return;
    }

    if (String(user.pin).trim() === entered) {
      modalContainer.innerHTML = '';
      if (onSuccess) onSuccess();
    } else {
      // In-app error display matching design (no browser alert)
      errorDiv.innerText = 'Incorrect 6-digit security PIN. Please try again.';
      errorDiv.style.display = 'block';
      input.value = '';
      input.focus();
    }
  };
}

/**
 * Interactive Gmail Statement Auto-Pull & Sync Modal Flow
 */
function openGmailSyncModal(userId, userBank, savedPasskey, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  const bankName = userBank || 'Federal Bank';

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="gmail-modal-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #EA4335, #C5221F); display: flex; align-items: center; justify-content: center; font-size: 16px; color: white;">
              📬
            </div>
            <div>
              <span style="font-size: var(--text-base); font-weight: 700;">Gmail Statement Auto-Pull</span>
              <div style="font-size: 11px; color: var(--text-muted);">Direct personal email sync • Zero AA regulations</div>
            </div>
          </div>
          <button id="gmail-close-btn" class="btn-icon btn-ghost btn-sm">✕</button>
        </div>

        <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 6px; margin-bottom: 14px; line-height: 1.4;">
          SBAFA will search your inbox for weekly statements sent from <strong>${escapeHtml(bankName)}</strong> with keyword <code>STATEMENT</code> and extract new transactions.
        </p>

        <!-- Custom In-App Error / Status Banner -->
        <div id="gmail-modal-error" style="display: none; color: var(--signal-expense); font-size: 11.5px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 14px;">
        </div>

        <div class="form-group">
          <label class="form-label">Target Bank</label>
          <input type="text" id="gmail-bank-input" class="form-input" value="${escapeHtml(bankName)}" readonly style="opacity: 0.85; background: var(--bg-deep);" />
        </div>

        <div class="form-group">
          <label class="form-label">PDF Passkey for Decryption</label>
          <input type="password" id="gmail-pwd-input" class="form-input" value="${escapeHtml(savedPasskey || '')}" placeholder="Password for viewing your protected Pdfs and access the statements (read only)" />
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            ${savedPasskey ? '✓ Pre-filled from your saved statement passkey' : 'Enter the password to decrypt the statement PDF'}
          </div>
        </div>

        <div id="gmail-progress-box" style="display: none; background: var(--bg-deep); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; text-align: center;">
          <div style="font-size: 1.4rem; margin-bottom: 6px; animation: spin 1s infinite linear;">🔄</div>
          <div id="gmail-progress-text" style="font-size: var(--text-xs); font-weight: 600; color: var(--accent-blue);">Connecting to Gmail...</div>
        </div>

        <button id="gmail-sync-start-btn" class="btn btn-accent-blue btn-block" style="padding: 12px;">
          Fetch &amp; Sync Statement →
        </button>
      </div>
    </div>
  `;

  document.getElementById('gmail-close-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('gmail-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'gmail-modal-backdrop') modalContainer.innerHTML = '';
  };

  const syncBtn = document.getElementById('gmail-sync-start-btn');
  const errorDiv = document.getElementById('gmail-modal-error');
  const progressBox = document.getElementById('gmail-progress-box');
  const progressText = document.getElementById('gmail-progress-text');
  const pwdInput = document.getElementById('gmail-pwd-input');

  syncBtn.onclick = async () => {
    errorDiv.style.display = 'none';
    syncBtn.disabled = true;
    progressBox.style.display = 'block';

    const passkey = pwdInput.value.trim();

    try {
      const result = await GmailStatementSyncService.syncStatementsFromGmail(
        bankName,
        passkey,
        showToast,
        (status) => {
          if (progressText) progressText.innerText = status;
        }
      );

      if (result.count === 0) {
        progressBox.style.display = 'none';
        syncBtn.disabled = false;
        errorDiv.innerText = result.message;
        errorDiv.style.display = 'block';
        return;
      }

      // Ingest the fetched transactions with account segregation
      const userAccounts = await db.accounts.where('userId').equals(userId).toArray();
      const targetLast4 = result.accountNumberLast4;
      let matchedAccount = userAccounts.find(a => {
        const sameBank = (a.bankCode && result.bankCode && a.bankCode.toLowerCase() === result.bankCode.toLowerCase()) ||
                         (a.bankName && result.detectedBank && a.bankName.toLowerCase().includes(result.detectedBank.toLowerCase()));
        if (!sameBank) return false;
        if (targetLast4) {
          const accLast4 = a.accountNumberLast4 || (a.accountNumberMask ? a.accountNumberMask.replace(/\D/g, '').slice(-4) : '');
          return accLast4 === targetLast4;
        }
        return true;
      });

      const assignedMask = result.accountNumberMask || (targetLast4 ? `•••• ${targetLast4}` : '•••• ' + Math.floor(1000 + Math.random() * 9000));

      if (!matchedAccount) {
        const newAccId = `acc-${userId}-${Date.now().toString(36)}`;
        matchedAccount = {
          id: newAccId,
          userId,
          bankName: result.detectedBank || bankName,
          accountNumberMask: assignedMask,
          accountNumberLast4: targetLast4 || null,
          accountType: 'Savings Account',
          balance: result.availableBalance != null ? result.availableBalance : 0,
          bankCode: result.bankCode || 'FEDERAL',
          lastSynced: 'Just now (Gmail)'
        };
        await db.accounts.add(matchedAccount);
      } else {
        const updatedBal = result.availableBalance != null ? result.availableBalance : matchedAccount.balance;
        await db.accounts.update(matchedAccount.id, {
          balance: updatedBal,
          lastSynced: 'Just now (Gmail)'
        });
      }

      const tagged = result.transactions.map(t => ({
        ...t,
        account_id: matchedAccount.id,
        userId,
        source: 'GMAIL_AUTO_PULL'
      }));
      await db.transactions.bulkAdd(tagged);

      // Record Gmail fetched statement PDF to statement upload history
      const emailFileName = result.fileName || `${result.detectedBank || bankName}_eStatement_Email.pdf`;
      await addStatementUploadHistory(userId, [{
        id: 'stmt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        fileName: emailFileName,
        date: result.statementDate || new Date().toISOString().slice(0, 10),
        uploadedAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' (Gmail)',
        bank: result.detectedBank || bankName,
        txnCount: result.count || (result.transactions ? result.transactions.length : 0),
        balance: result.availableBalance != null ? result.availableBalance : null,
        status: 'Processed'
      }]);

      modalContainer.innerHTML = '';
      const balMsg = result.availableBalance != null ? ` • Balance: ₹${result.availableBalance.toFixed(2)}` : '';
      showToast(`Ingested ${result.count} transactions from ${matchedAccount.bankName} statement email${balMsg}!`, 'success');
      if (refreshCallback) refreshCallback();
    } catch (err) {
      progressBox.style.display = 'none';
      syncBtn.disabled = false;
      const msg = err.message || 'Failed to sync from Gmail.';
      if (msg.includes('403') || msg.includes('not enabled') || msg.includes('permission denied')) {
        errorDiv.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span> Gmail API Permission / Activation Needed (403)
          </div>
          <div style="margin-bottom: 8px; line-height: 1.4; color: var(--text-secondary);">
            ${escapeHtml(msg)}
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
            <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=sbafa-ft" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline; font-weight: 600;">
              🔗 Step 1: Enable Gmail API in Google Cloud Console →
            </a>
            <a href="https://console.cloud.google.com/apis/credentials/consent?project=sbafa-ft" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline; font-weight: 600;">
              🔗 Step 2: Add your email to "Test users" in OAuth Consent Screen →
            </a>
          </div>
        `;
      } else {
        errorDiv.innerText = msg;
      }
      errorDiv.style.display = 'block';
    }
  };
}

/**
 * Add New Bank Account Modal
 */
function openAddAccountModal(userId, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="add-acc-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, var(--accent-emerald), #059669); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3z"/></svg>
            </div>
            <span style="font-size: var(--text-base); font-weight: 700;">Add Bank Account</span>
          </div>
          <button id="add-acc-close-btn" class="btn-icon btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 18px;">
          Add a bank or wallet to your private financial tracker.
        </p>

        <form id="add-bank-form">
          <div class="form-group">
            <label class="form-label">Bank or Institution</label>
            <select id="acc-bank-select" class="form-select" required>
              <option value="HDFC">HDFC Bank</option>
              <option value="FEDERAL">Federal Bank</option>
              <option value="ICICI">ICICI Bank</option>
              <option value="SBI">State Bank of India (SBI)</option>
              <option value="AXIS">Axis Bank</option>
              <option value="KOTAK">Kotak Mahindra Bank</option>
              <option value="CASH">Cash Wallet</option>
              <option value="OTHER">Other Bank / FinTech</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Account Label / Custom Name</label>
            <input type="text" id="acc-name-input" class="form-input" placeholder="e.g. Salary Account, Savings..." required />
          </div>

          <div class="form-group">
            <label class="form-label">Account Number (Last 4 digits)</label>
            <input type="text" id="acc-mask-input" class="form-input" placeholder="e.g. 4819" maxlength="4" required />
          </div>

          <div class="form-group">
            <label class="form-label">Account Type</label>
            <select id="acc-type-select" class="form-select">
              <option value="Savings Account">Savings Account</option>
              <option value="Current Account">Current Account</option>
              <option value="Salary Account">Salary Account</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Physical Cash">Physical Wallet</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Current Balance (₹)</label>
            <input type="number" id="acc-bal-input" class="form-input" placeholder="0.00" step="any" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
            <button type="button" id="add-acc-cancel-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Account →</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Auto-update account name when bank is changed
  const bankSelect = document.getElementById('acc-bank-select');
  const nameInput = document.getElementById('acc-name-input');
  bankSelect.onchange = () => {
    nameInput.value = bankSelect.options[bankSelect.selectedIndex].text;
  };

  document.getElementById('add-acc-cancel-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('add-acc-close-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('add-acc-backdrop').onclick = (e) => {
    if (e.target.id === 'add-acc-backdrop') modalContainer.innerHTML = '';
  };

  document.getElementById('add-bank-form').onsubmit = async (e) => {
    e.preventDefault();
    const bankCode = bankSelect.value;
    const bankName = nameInput.value.trim() || bankCode;
    const maskDigits = document.getElementById('acc-mask-input').value.trim();
    const accountType = document.getElementById('acc-type-select').value;
    const balance = parseFloat(document.getElementById('acc-bal-input').value) || 0;

    const newAccId = `acc-${userId}-${Date.now().toString(36)}`;
    await db.accounts.add({
      id: newAccId,
      userId,
      bankName,
      accountNumberMask: `•••• ${maskDigits}`,
      accountType,
      balance,
      bankCode,
      lastSynced: 'Just now'
    });

    modalContainer.innerHTML = '';
    showToast(`Added ${bankName} to your vault!`, 'success');
    if (refreshCallback) refreshCallback();
  };
}

/**
 * Edit Existing Bank Account Modal
 */
function openEditAccountModal(acc, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  const currentMask = acc.accountNumberMask ? acc.accountNumberMask.replace(/\D/g, '') : '';

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="edit-acc-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--accent-blue), #2563eb); display: flex; align-items: center; justify-content: center; font-size: 15px; color: white;">✏️</div>
            <span style="font-size: var(--text-base); font-weight: 700;">Edit Bank Account</span>
          </div>
          <button id="edit-acc-close-btn" class="btn-icon btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 18px;">
          Update your bank details, balance, or remove this account completely.
        </p>

        <form id="edit-bank-form">
          <div class="form-group">
            <label class="form-label">Bank or Institution</label>
            <select id="edit-acc-bank-select" class="form-select" required>
              <option value="HDFC" ${acc.bankCode === 'HDFC' ? 'selected' : ''}>HDFC Bank</option>
              <option value="FEDERAL" ${acc.bankCode === 'FEDERAL' ? 'selected' : ''}>Federal Bank</option>
              <option value="ICICI" ${acc.bankCode === 'ICICI' ? 'selected' : ''}>ICICI Bank</option>
              <option value="SBI" ${acc.bankCode === 'SBI' ? 'selected' : ''}>State Bank of India (SBI)</option>
              <option value="AXIS" ${acc.bankCode === 'AXIS' ? 'selected' : ''}>Axis Bank</option>
              <option value="KOTAK" ${acc.bankCode === 'KOTAK' ? 'selected' : ''}>Kotak Mahindra Bank</option>
              <option value="CASH" ${acc.bankCode === 'CASH' ? 'selected' : ''}>Cash Wallet</option>
              <option value="OTHER" ${acc.bankCode === 'OTHER' || !acc.bankCode ? 'selected' : ''}>Other Bank / FinTech</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Account Label / Custom Name</label>
            <input type="text" id="edit-acc-name-input" class="form-input" value="${escapeHtml(acc.bankName || '')}" placeholder="e.g. Salary Account, Savings..." required />
          </div>

          <div class="form-group">
            <label class="form-label">Account Number (Last 4 digits)</label>
            <input type="text" id="edit-acc-mask-input" class="form-input" value="${escapeHtml(currentMask)}" placeholder="e.g. 4819" maxlength="4" required />
          </div>

          <div class="form-group">
            <label class="form-label">Account Type</label>
            <select id="edit-acc-type-select" class="form-select">
              <option value="Savings Account" ${acc.accountType === 'Savings Account' ? 'selected' : ''}>Savings Account</option>
              <option value="Current Account" ${acc.accountType === 'Current Account' ? 'selected' : ''}>Current Account</option>
              <option value="Salary Account" ${acc.accountType === 'Salary Account' ? 'selected' : ''}>Salary Account</option>
              <option value="Credit Card" ${acc.accountType === 'Credit Card' ? 'selected' : ''}>Credit Card</option>
              <option value="Physical Cash" ${acc.accountType === 'Physical Cash' ? 'selected' : ''}>Physical Wallet</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Current Balance (₹)</label>
            <input type="number" id="edit-acc-bal-input" class="form-input" value="${Number(acc.balance || 0)}" placeholder="0.00" step="any" required />
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px;">
            <button type="button" id="edit-acc-delete-btn" class="btn btn-danger btn-sm" style="display: flex; align-items: center; gap: 4px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Remove Account
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" id="edit-acc-cancel-btn" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('edit-acc-cancel-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('edit-acc-close-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('edit-acc-backdrop').onclick = (e) => {
    if (e.target.id === 'edit-acc-backdrop') modalContainer.innerHTML = '';
  };

  // Jump to delete confirmation
  document.getElementById('edit-acc-delete-btn').onclick = () => {
    confirmDeleteAccountModal(acc, showToast, refreshCallback);
  };

  document.getElementById('edit-bank-form').onsubmit = async (e) => {
    e.preventDefault();
    const bankCode = document.getElementById('edit-acc-bank-select').value;
    const bankName = document.getElementById('edit-acc-name-input').value.trim() || bankCode;
    const maskDigits = document.getElementById('edit-acc-mask-input').value.trim();
    const accountType = document.getElementById('edit-acc-type-select').value;
    const balance = parseFloat(document.getElementById('edit-acc-bal-input').value) || 0;

    await db.accounts.update(acc.id, {
      bankCode,
      bankName,
      accountNumberMask: `•••• ${maskDigits}`,
      accountType,
      balance,
      lastSynced: 'Edited just now'
    });

    modalContainer.innerHTML = '';
    showToast(`Updated ${bankName} successfully!`, 'success');
    if (refreshCallback) refreshCallback();
  };
}

/**
 * Confirm and Remove Bank Account Modal (Offers Keep vs Purge options)
 */
function confirmDeleteAccountModal(acc, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="del-acc-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--signal-expense-subtle); color: var(--signal-expense); display: flex; align-items: center; justify-content: center; font-size: 16px;">🗑️</div>
          <span style="font-size: var(--text-base); font-weight: 700; color: var(--signal-expense);">Remove Bank Account</span>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-primary); margin-bottom: 8px;">
          Are you sure you want to remove <strong>${escapeHtml(acc.bankName)}</strong> (${escapeHtml(acc.accountNumberMask)})?
        </p>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 18px; line-height: 1.5;">
          Choose how you want to handle past transactions logged for this account:
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          <button id="del-acc-keep-txns-btn" class="btn btn-outline" style="text-align: left; padding: 12px; display: block; width: 100%;">
            <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
              📁 Remove Account &amp; Keep Transactions
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">
              Deletes this bank account from your list, but preserves your past transaction logs in your ledger and analytics (unlinked).
            </div>
          </button>

          <button id="del-acc-purge-all-btn" class="btn btn-danger" style="text-align: left; padding: 12px; display: block; width: 100%;">
            <div style="font-size: var(--text-xs); font-weight: 700; margin-bottom: 2px;">
              💥 Delete Account &amp; Purge All Transactions
            </div>
            <div style="font-size: 11px; opacity: 0.9;">
              Permanently wipes this account AND deletes all transactions associated with this account from your database.
            </div>
          </button>
        </div>

        <button id="del-acc-cancel-btn" class="btn btn-secondary btn-block">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('del-acc-cancel-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('del-acc-backdrop').onclick = (e) => {
    if (e.target.id === 'del-acc-backdrop') modalContainer.innerHTML = '';
  };

  // Option 1: Remove account & keep transactions
  document.getElementById('del-acc-keep-txns-btn').onclick = async () => {
    try {
      await db.transactions.where('account_id').equals(acc.id).modify({ account_id: null });
      await db.accounts.delete(acc.id);
      modalContainer.innerHTML = '';
      showToast(`Removed ${acc.bankName}. Transaction history was preserved.`, 'success');
      if (refreshCallback) refreshCallback();
    } catch (err) {
      showToast('Failed to remove account: ' + err.message, 'info');
    }
  };

  // Option 2: Delete account & purge all transactions
  document.getElementById('del-acc-purge-all-btn').onclick = async () => {
    try {
      const deletedCount = await db.transactions.where('account_id').equals(acc.id).delete();
      await db.accounts.delete(acc.id);
      modalContainer.innerHTML = '';
      showToast(`Permanently deleted ${acc.bankName} and purged ${deletedCount} transaction(s).`, 'success');
      if (refreshCallback) refreshCallback();
    } catch (err) {
      showToast('Failed to delete account: ' + err.message, 'info');
    }
  };
}

/**
 * Edit or Save Statement Passkey Modal
 */
function openEditPasskeyModal(userId, currentBank, currentPasskey, isAutofill, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="passkey-modal-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--accent-emerald), #059669); display: flex; align-items: center; justify-content: center; font-size: 16px; color: white;">🔑</div>
            <span style="font-size: var(--text-base); font-weight: 700;">${currentPasskey ? 'Edit Statement Passkey' : 'Save Statement Passkey'}</span>
          </div>
          <button id="passkey-close-btn" class="btn-icon btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 16px;">
          Configure the bank-provided password required to view and decrypt your protected statement PDFs.
        </p>

        <form id="passkey-form">
          <div class="form-group">
            <label class="form-label">Primary Bank or Institution</label>
            <select id="passkey-bank-select" class="form-select">
              <option value="HDFC" ${currentBank === 'HDFC' ? 'selected' : ''}>HDFC Bank</option>
              <option value="FEDERAL" ${currentBank === 'FEDERAL' ? 'selected' : ''}>Federal Bank</option>
              <option value="ICICI" ${currentBank === 'ICICI' ? 'selected' : ''}>ICICI Bank</option>
              <option value="SBI" ${currentBank === 'SBI' ? 'selected' : ''}>State Bank of India (SBI)</option>
              <option value="AXIS" ${currentBank === 'AXIS' ? 'selected' : ''}>Axis Bank</option>
              <option value="KOTAK" ${currentBank === 'KOTAK' ? 'selected' : ''}>Kotak Mahindra Bank</option>
              <option value="OTHER" ${currentBank === 'OTHER' ? 'selected' : ''}>Other Bank / Generic</option>
            </select>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label class="form-label">Statement Password / Passkey</label>
              <button type="button" id="passkey-modal-reveal-btn" style="background: none; border: none; font-size: 11px; color: var(--accent-blue); cursor: pointer; padding: 0;">Show Password</button>
            </div>
            <input type="password" id="passkey-input" class="form-input" value="${escapeHtml(currentPasskey || '')}" placeholder="Enter statement password" required />
          </div>

          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
            <input type="checkbox" id="passkey-autofill-chk" ${isAutofill !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--accent-emerald);" />
            <label for="passkey-autofill-chk" style="font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer;">
              Enable automatic decryption when uploading bank statements
            </label>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            ${currentPasskey ? `
              <button type="button" id="passkey-modal-remove-btn" class="btn btn-danger btn-sm" style="display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Remove
              </button>
            ` : '<div></div>'}
            <div style="display: flex; gap: 8px;">
              <button type="button" id="passkey-cancel-btn" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Passkey</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  const input = document.getElementById('passkey-input');
  const revealBtn = document.getElementById('passkey-modal-reveal-btn');
  let isRevealed = false;
  revealBtn.onclick = () => {
    isRevealed = !isRevealed;
    input.type = isRevealed ? 'text' : 'password';
    revealBtn.innerText = isRevealed ? 'Hide Password' : 'Show Password';
  };

  document.getElementById('passkey-cancel-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('passkey-close-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('passkey-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'passkey-modal-backdrop') modalContainer.innerHTML = '';
  };

  const modalRemoveBtn = document.getElementById('passkey-modal-remove-btn');
  if (modalRemoveBtn) {
    modalRemoveBtn.onclick = () => {
      confirmRemovePasskeyModal(userId, currentBank, showToast, refreshCallback);
    };
  }

  document.getElementById('passkey-form').onsubmit = async (e) => {
    e.preventDefault();
    const bankCode = document.getElementById('passkey-bank-select').value;
    const newPassword = input.value.trim();
    const enableAutofill = document.getElementById('passkey-autofill-chk').checked;

    if (!newPassword) {
      showToast('Please enter a statement password.', 'info');
      input.focus();
      return;
    }

    await BankPDFParser.savePassword(bankCode, newPassword, userId, enableAutofill);
    modalContainer.innerHTML = '';
    showToast(`Statement passkey saved for ${bankCode}!`, 'success');
    if (refreshCallback) refreshCallback();
  };
}

/**
 * Confirm and Remove Statement Passkey Modal
 */
function confirmRemovePasskeyModal(userId, currentBank, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="del-passkey-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--signal-expense-subtle); color: var(--signal-expense); display: flex; align-items: center; justify-content: center; font-size: 16px;">🗑️</div>
          <span style="font-size: var(--text-base); font-weight: 700; color: var(--signal-expense);">Remove Statement Passkey?</span>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-primary); margin-bottom: 10px;">
          Are you sure you want to completely remove your saved PDF statement passkey?
        </p>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 20px; line-height: 1.5;">
          • All saved statement decryption passkeys will be erased from local storage.<br/>
          • Statement PDF Autofill will be disabled.<br/>
          • You will simply be prompted to type your password whenever importing protected statements.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
          <button id="del-passkey-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button id="del-passkey-confirm-btn" class="btn btn-danger">Remove Passkey Completely</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('del-passkey-cancel-btn').onclick = () => { modalContainer.innerHTML = ''; };
  document.getElementById('del-passkey-backdrop').onclick = (e) => {
    if (e.target.id === 'del-passkey-backdrop') modalContainer.innerHTML = '';
  };

  document.getElementById('del-passkey-confirm-btn').onclick = async () => {
    try {
      await BankPDFParser.deletePassword(currentBank, userId);
      modalContainer.innerHTML = '';
      showToast('Statement passkey removed completely.', 'success');
      if (refreshCallback) refreshCallback();
    } catch (err) {
      showToast('Failed to remove passkey: ' + err.message, 'info');
    }
  };
}

/**
 * Statement Upload History Modal (Popup Window)
 */
export function openStatementHistoryModal(historyList = []) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="stmt-history-backdrop">
      <div class="modal-sheet" style="max-width: 580px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-medium);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.4rem;">📁</span>
            <div>
              <div style="font-size: var(--text-base); font-weight: 800; color: var(--text-primary);">Statement Upload History</div>
              <div style="font-size: 11px; color: var(--text-muted);">All bank statement PDFs uploaded to your private vault on this device</div>
            </div>
          </div>
          <button id="close-stmt-history-btn" class="btn-icon btn-sm" aria-label="Close" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-full); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ✕
          </button>
        </div>

        <div style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; margin-bottom: 16px;">
          ${historyList.length === 0 ? `
            <div style="text-align: center; color: var(--text-muted); padding: 32px 16px; font-size: var(--text-xs);">
              No past statement PDFs uploaded yet.
            </div>
          ` : historyList.map((item, i) => `
            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span style="font-size: 1.1rem;">📄</span>
                  <span style="font-weight: 700; color: var(--text-primary); font-family: monospace; font-size: 12px;" title="${escapeHtml(item.fileName)}">
                    ${escapeHtml(item.fileName)}
                  </span>
                </div>
                <span style="background: rgba(46, 125, 91, 0.12); color: var(--signal-income); padding: 2px 8px; border-radius: var(--radius-full); font-weight: 700; font-size: 10.5px; border: 1px solid rgba(46, 125, 91, 0.25); white-space: nowrap;">
                  ✓ ${escapeHtml(item.status || 'Processed')}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-secondary); flex-wrap: wrap; gap: 6px; padding-top: 4px; border-top: 1px dashed var(--border-subtle);">
                <div>
                  <span>Bank: <strong>${escapeHtml(item.bank || 'Bank Account')}</strong></span>
                  ${item.txnCount != null ? ` • <span>${item.txnCount} txns</span>` : ''}
                  ${item.balance != null ? ` • <span>Balance: ₹${Number(item.balance).toFixed(2)}</span>` : ''}
                </div>
                <div style="color: var(--text-muted); font-size: 10.5px;">
                  Uploaded: ${escapeHtml(item.uploadedAt || item.date || 'Recent')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button id="close-stmt-history-footer-btn" class="btn btn-secondary btn-sm" style="padding: 7px 18px;">
            Close
          </button>
        </div>
      </div>
    </div>
  `;

  const closeBtn = document.getElementById('close-stmt-history-btn');
  const footerCloseBtn = document.getElementById('close-stmt-history-footer-btn');
  const backdrop = document.getElementById('stmt-history-backdrop');

  const close = () => { modalContainer.innerHTML = ''; };
  if (closeBtn) closeBtn.onclick = close;
  if (footerCloseBtn) footerCloseBtn.onclick = close;
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

if (typeof window !== 'undefined') {
  window.promptPinAuthModal = promptPinAuthModal;
  window.openStatementHistoryModal = openStatementHistoryModal;
}
