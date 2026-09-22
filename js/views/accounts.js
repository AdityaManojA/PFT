/**
 * Accounts & Bank Synchronization View
 * Handles connected Indian banks (Edit/Remove accounts), Setu AA Sandbox consent,
 * CSV statement uploads, and Password-Protected PDF statement decryption / Passkey management.
 */

import { db, formatINR, getCurrentUser, getUserAccounts } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { BankStatementParser } from '../parsers/bank-parser.js';
import { BankPDFParser } from '../parsers/pdf-parser.js';
import { SetuAccountAggregatorService } from '../services/setu-aa.js';

export async function renderAccounts(container, showToastCallback) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : null;
  const accounts = userId ? await getUserAccounts(userId) : [];
  const isAutofill = userId ? await BankPDFParser.isAutofillEnabled(userId) : false;
  const userBank = userId ? await BankPDFParser.getPrimaryBank(userId) : 'HDFC';
  const savedPasskey = userId ? await BankPDFParser.getSavedPasswordRaw(userBank, userId) : '';

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
          ${!user ? 'Sign In' : '+ Add Bank Account'}
        </button>
      </div>
    `;
  } else {
    bankCardsHtml = accounts.map(a => renderBankCardHtml(a, isPrivacy)).join('');
  }

  container.innerHTML = `
    <!-- Account Aggregator Banner / Action Card -->
    <div class="glass-card glass-card-glow-blue" style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
        <div>
          <span class="badge badge-blue" style="margin-bottom: 6px;">RBI Compliant</span>
          <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">
            Account Aggregator (AA) Live Sync
          </h3>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
            Connect your Indian bank accounts securely via Setu AA Sandbox for automated, end-to-end encrypted transaction syncing. Eliminates protected PDFs entirely!
          </p>
        </div>
      </div>
      <button id="start-aa-sync-btn" class="btn btn-accent-blue btn-block">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Sync via Setu AA Sandbox
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

    <!-- Bank Statement Upload Section (PDF & CSV) -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="section-header">
        <div>
          <h3 class="section-title">Upload Statement (PDF / CSV)</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">
            Supports password-protected PDFs &amp; CSV exports from HDFC, Federal, ICICI, SBI, Axis, Kotak.
          </p>
        </div>
      </div>

      <!-- Dropzone -->
      <div class="upload-dropzone" id="statement-dropzone">
        <div class="dropzone-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        </div>
        <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
          Choose Protected Bank PDF or CSV Statement
        </div>
        <div style="font-size: var(--text-xs); color: var(--text-muted);">
          Decrypted and parsed 100% locally on your device
        </div>
        <input type="file" id="statement-file-input" accept=".csv,text/csv,application/pdf,.pdf" style="display: none;" />
      </div>
    </div>
  `;

  // --- Passkey Reveal / Hide Toggle ---
  let passkeyVisible = false;
  const revealPasskeyBtn = container.querySelector('#toggle-passkey-reveal-btn');
  const passkeyDisplay = container.querySelector('#passkey-masked-display');
  const eyeIcon = container.querySelector('#passkey-eye-icon');
  const revealText = container.querySelector('#passkey-reveal-text');
  if (revealPasskeyBtn && passkeyDisplay) {
    revealPasskeyBtn.onclick = () => {
      passkeyVisible = !passkeyVisible;
      if (passkeyVisible) {
        passkeyDisplay.textContent = savedPasskey;
        passkeyDisplay.style.letterSpacing = 'normal';
        if (eyeIcon) eyeIcon.textContent = '🙈';
        if (revealText) revealText.textContent = 'Hide';
      } else {
        passkeyDisplay.textContent = '••••••••';
        passkeyDisplay.style.letterSpacing = '2px';
        if (eyeIcon) eyeIcon.textContent = '👁️';
        if (revealText) revealText.textContent = 'Show';
      }
    };
  }

  // --- Edit Passkey modal trigger ---
  const editPasskeyBtn = container.querySelector('#edit-passkey-btn');
  if (editPasskeyBtn) {
    editPasskeyBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      openEditPasskeyModal(userId, userBank, savedPasskey, isAutofill, showToastCallback, () => renderAccounts(container, showToastCallback));
    };
  }

  // --- Add Passkey modal trigger (when none saved) ---
  const addPasskeyBtn = container.querySelector('#add-passkey-btn');
  if (addPasskeyBtn) {
    addPasskeyBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      openEditPasskeyModal(userId, userBank, '', true, showToastCallback, () => renderAccounts(container, showToastCallback));
    };
  }

  // --- Remove Passkey Completely trigger ---
  const removePasskeyBtn = container.querySelector('#remove-passkey-btn');
  if (removePasskeyBtn) {
    removePasskeyBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      confirmRemovePasskeyModal(userId, userBank, showToastCallback, () => renderAccounts(container, showToastCallback));
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

  // --- Setu AA Sync trigger ---
  const aaSyncBtn = container.querySelector('#start-aa-sync-btn');
  if (aaSyncBtn) {
    aaSyncBtn.onclick = () => {
      if (!user) {
        showToastCallback('Please sign in to sync accounts via Setu AA.', 'warning');
        window.location.hash = '#/login';
        return;
      }
      openSetuAAModal(showToastCallback, () => renderAccounts(container, showToastCallback));
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
      handleUploadedFile(e.dataTransfer.files[0], showToastCallback, () => renderAccounts(container, showToastCallback));
    }
  };

  fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
      handleUploadedFile(e.target.files[0], showToastCallback, () => renderAccounts(container, showToastCallback));
    }
  };
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
 * Handle either PDF or CSV upload
 */
async function handleUploadedFile(file, showToast, refreshCallback) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    handlePdfFile(file, showToast, refreshCallback);
  } else {
    // CSV file
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      processCsvText(text, null, showToast, refreshCallback);
    };
    reader.readAsText(file);
  }
}

/**
 * Handle Bank Statement PDF with automatic password decryption
 */
async function handlePdfFile(file, showToast, refreshCallback) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result;
    const curUser = await getCurrentUser();
    const userId = curUser ? curUser.id : null;
    const isAutofill = await BankPDFParser.isAutofillEnabled(userId);

    let decryptedText = null;

    // Check if autofill is enabled and try candidate passwords
    if (isAutofill) {
      const primaryBank = await BankPDFParser.getPrimaryBank(userId);
      const savedPrimary = await BankPDFParser.getSavedPassword(primaryBank, userId);
      const savedHdfcPwd = await BankPDFParser.getSavedPassword('HDFC', userId);
      const savedFedPwd = await BankPDFParser.getSavedPassword('FEDERAL', userId);
      const candidates = [savedPrimary, savedHdfcPwd, savedFedPwd, ''].filter(Boolean);

      for (const pwd of candidates) {
        try {
          decryptedText = await BankPDFParser.extractPdfText(arrayBuffer, pwd);
          if (decryptedText) break;
        } catch (err) {
          // Continue to next password
        }
      }
    }

    if (decryptedText) {
      // Successfully decrypted with saved password
      parseAndIngestPdfText(decryptedText, showToast, refreshCallback);
    } else {
      // Prompt user for password
      promptPdfPasswordModal(arrayBuffer, file.name, showToast, refreshCallback);
    }
  };
  reader.readAsArrayBuffer(file);
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

        <!-- Bank Password Guide -->
        <div style="background: var(--bg-deep); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
          Please enter the bank-provided password required to view and decrypt your protected bank statement PDF.
        </div>

        <div class="form-group">
          <label class="form-label">Enter PDF Password</label>
          <input type="password" id="pdf-pwd-input" class="form-input" placeholder="Enter bank-provided statement password" autofocus />
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

  cancelBtn.onclick = () => { modalContainer.innerHTML = ''; };

  submitBtn.onclick = async () => {
    const pwd = input.value.trim();
    if (!pwd) {
      showToast('Please enter the statement password', 'info');
      input.focus();
      return;
    }

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
      parseAndIngestPdfText(text, showToast, refreshCallback);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Decrypt & Import →';
      showToast('Incorrect password or unreadable PDF. Please try again.', 'info');
      input.focus();
    }
  };
}

async function parseAndIngestPdfText(pdfText, showToast, refreshCallback) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      showToast('Please sign in to import statements into your vault.', 'warning');
      window.location.hash = '#/login';
      return;
    }
    const userId = user.id;
    const result = BankPDFParser.parseTextToTransactions(pdfText);
    if (result.transactions.length === 0) {
      showToast('Decrypted PDF, but found no transaction rows to extract.', 'info');
      return;
    }

    // Retrieve user accounts and find or auto-create matched account
    const userAccounts = await db.accounts.where('userId').equals(userId).toArray();
    let matchedAccount = userAccounts.find(a => 
      (a.bankCode && result.bankCode && a.bankCode.toLowerCase() === result.bankCode.toLowerCase()) ||
      (a.bankName && result.detectedBank && a.bankName.toLowerCase().includes(result.detectedBank.toLowerCase()))
    );

    let netChange = 0;
    for (const t of result.transactions) {
      netChange += (t.type === 'income' ? t.amount : -t.amount);
    }

    if (!matchedAccount) {
      const newAccId = `acc-${userId}-${Date.now().toString(36)}`;
      matchedAccount = {
        id: newAccId,
        userId,
        bankName: result.detectedBank || 'Bank Account',
        accountNumberMask: '•••• ' + Math.floor(1000 + Math.random() * 9000),
        accountType: 'Savings Account',
        balance: Math.max(0, netChange),
        bankCode: result.bankCode || 'OTHER',
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

    const tagged = result.transactions.map(t => ({
      ...t,
      account_id: matchedAccount.id,
      userId
    }));
    await db.transactions.bulkAdd(tagged);
    showToast(
      `Successfully ingested ${result.totalParsed} transactions (${result.formatDetected}) into ${matchedAccount.bankName}!`,
      'success'
    );

    if (refreshCallback) refreshCallback();
  } catch (err) {
    showToast('Failed to parse PDF text: ' + err.message, 'info');
  }
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
 * Interactive RBI Setu Account Aggregator Modal Flow
 */
function openSetuAAModal(showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="aa-modal-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <div style="width: 28px; height: 28px; border-radius: 6px; background: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; color: white;">SETU</div>
          <span style="font-size: var(--text-base); font-weight: 700;">Setu AA Sandbox Gateway</span>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 16px;">
          Secure RBI Account Aggregator Framework. 256-bit encrypted data pipeline.
        </p>

        <!-- Step 1: Mobile & Bank Selection -->
        <div id="aa-step-1">
          <div class="form-group">
            <label class="form-label">Linked Mobile Number</label>
            <input type="tel" id="aa-mobile-input" class="form-input" placeholder="Enter 10-digit mobile number" />
          </div>
          <div style="background: var(--bg-deep); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: var(--text-xs); color: var(--text-secondary);">
            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Eligible AA FIP Financial Institutions:</div>
            <div>• HDFC Bank Ltd (NetBanking / UPI)</div>
            <div>• Federal Bank (FedNet / UPI)</div>
            <div>• ICICI Bank (iMobile / Salary)</div>
            <div>• State Bank of India (YONO / Retail)</div>
          </div>
          <button id="aa-proceed-btn" class="btn btn-accent-blue btn-block">
            Request AA Consent OTP →
          </button>
        </div>

        <!-- Step 2: OTP Verification -->
        <div id="aa-step-2" style="display: none;">
          <div class="form-group">
            <label class="form-label">Enter 6-digit Consent OTP</label>
            <input type="text" id="aa-otp-input" class="form-input" placeholder="123456" maxlength="6" style="letter-spacing: 6px; font-size: 1.3rem; text-align: center;" />
            <span style="font-size: 11px; color: var(--accent-emerald); display: block; margin-top: 4px;">Sandbox testing OTP: 123456</span>
          </div>
          <button id="aa-verify-btn" class="btn btn-primary btn-block">
            Authorize Consent &amp; Sync Live Data
          </button>
        </div>

        <!-- Step 3: Loading -->
        <div id="aa-step-3" style="display: none; text-align: center; padding: 30px 0;">
          <div style="font-size: 2rem; margin-bottom: 12px; animation: spin 1s infinite linear;">🔄</div>
          <div style="font-weight: 700; font-size: var(--text-base);">Fetching Live Bank Data...</div>
          <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;">Contacting RBI Financial Information Provider (FIP) endpoints...</div>
        </div>
      </div>
    </div>
  `;

  const backdrop = document.getElementById('aa-modal-backdrop');
  backdrop.onclick = (e) => {
    if (e.target.id === 'aa-modal-backdrop') modalContainer.innerHTML = '';
  };

  const proceedBtn = document.getElementById('aa-proceed-btn');
  const step1 = document.getElementById('aa-step-1');
  const step2 = document.getElementById('aa-step-2');
  const step3 = document.getElementById('aa-step-3');

  proceedBtn.onclick = async () => {
    const mobile = document.getElementById('aa-mobile-input').value;
    proceedBtn.disabled = true;
    proceedBtn.innerText = 'Requesting Consent...';
    await SetuAccountAggregatorService.createConsentRequest(mobile);
    step1.style.display = 'none';
    step2.style.display = 'block';
  };

  const verifyBtn = document.getElementById('aa-verify-btn');
  verifyBtn.onclick = async () => {
    const otp = document.getElementById('aa-otp-input').value;
    step2.style.display = 'none';
    step3.style.display = 'block';

    try {
      const authResult = await SetuAccountAggregatorService.verifyConsentOtp('mock-handle', otp);
      const syncResult = await SetuAccountAggregatorService.syncLiveFinancialData(authResult.consentId);

      modalContainer.innerHTML = '';
      showToast(`Setu AA Sync Successful! Ingested ${syncResult.syncedCount} real-time transactions.`, 'success');
      if (refreshCallback) refreshCallback();
    } catch (err) {
      step3.style.display = 'none';
      step2.style.display = 'block';
      showToast(err.message, 'info');
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
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--accent-emerald), #059669); display: flex; align-items: center; justify-content: center; font-size: 16px; color: white;">+</div>
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
