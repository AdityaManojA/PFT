/**
 * Accounts & Bank Synchronization View
 * Handles connected Indian banks, Setu AA Sandbox consent, CSV statement uploads,
 * and Password-Protected PDF statement decryption.
 */

import { db, formatINR, getCurrentUser, getUserAccounts } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { BankStatementParser } from '../parsers/bank-parser.js';
import { BankPDFParser } from '../parsers/pdf-parser.js';
import { SetuAccountAggregatorService } from '../services/setu-aa.js';

export async function renderAccounts(container, showToastCallback) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : 'user-aditya';
  const accounts = await getUserAccounts(userId);

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

    <!-- Connected Bank Accounts List -->
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
      ${accounts.length === 0 ? `
        <div style="text-align: center; padding: 28px 16px; background: var(--bg-surface); border: 2px dashed var(--border-medium); border-radius: var(--radius-lg); margin-bottom: 12px;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🏦</div>
          <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No Bank Accounts Linked Yet</div>
          <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 14px; max-width: 280px; margin-left: auto; margin-right: auto;">
            Add your primary savings, current, or cash wallet using the button below.
          </p>
          <button id="empty-add-account-btn" class="btn btn-primary btn-sm">
            + Add Bank Account
          </button>
        </div>
      ` : ''}
      ${accounts.map(acc => renderBankCardHtml(acc, isPrivacy)).join('')}
    </div>

    <!-- Bank Statement Upload Section (PDF & CSV) -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="section-header">
        <div>
          <h3 class="section-title">Upload Statement (PDF / CSV)</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">
            Supports password-protected PDFs & CSV exports from HDFC, Federal, ICICI, SBI.
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

      <!-- Instant Test Sample Buttons -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="test-hdfc-sample-btn" class="btn btn-secondary btn-sm" style="flex: 1;">
          📄 Test Sample HDFC CSV
        </button>
        <button id="test-federal-sample-btn" class="btn btn-secondary btn-sm" style="flex: 1;">
          📄 Test Sample Federal CSV
        </button>
      </div>
    </div>
  `;

  // Attach Add Bank Account launchers
  const addAccountBtn = container.querySelector('#add-bank-account-btn');
  if (addAccountBtn) {
    addAccountBtn.onclick = () => openAddAccountModal(userId, showToastCallback, () => renderAccounts(container, showToastCallback));
  }
  const emptyAddBtn = container.querySelector('#empty-add-account-btn');
  if (emptyAddBtn) {
    emptyAddBtn.onclick = () => openAddAccountModal(userId, showToastCallback, () => renderAccounts(container, showToastCallback));
  }

  // Attach Setu AA Modal launcher
  const aaBtn = container.querySelector('#start-aa-sync-btn');
  if (aaBtn) {
    aaBtn.onclick = () => openSetuAAModal(showToastCallback, () => renderAccounts(container, showToastCallback));
  }

  // Attach File Dropzone & Picker
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

  // Test Sample statement buttons
  const hdfcSampleBtn = container.querySelector('#test-hdfc-sample-btn');
  hdfcSampleBtn.onclick = async () => {
    try {
      const res = await fetch('./sample-data/hdfc_sample_statement.csv');
      const text = await res.text();
      processCsvText(text, 'hdfc-4921', showToastCallback, () => renderAccounts(container, showToastCallback));
    } catch (err) {
      showToastCallback('Could not load sample file: ' + err.message, 'info');
    }
  };

  const federalSampleBtn = container.querySelector('#test-federal-sample-btn');
  federalSampleBtn.onclick = async () => {
    try {
      const res = await fetch('./sample-data/federal_sample_statement.csv');
      const text = await res.text();
      processCsvText(text, 'federal-8812', showToastCallback, () => renderAccounts(container, showToastCallback));
    } catch (err) {
      showToastCallback('Could not load sample file: ' + err.message, 'info');
    }
  };
}

function renderBankCardHtml(acc, isPrivacy) {
  const logoClass = acc.bankCode ? `bank-logo-${acc.bankCode.toLowerCase()}` : 'bank-logo-hdfc';
  const initial = acc.bankName ? acc.bankName.charAt(0) : 'B';
  const displayBal = isPrivacy ? '••••••••' : formatINR(acc.balance);

  return `
    <div class="bank-card">
      <div class="bank-card-header">
        <div class="bank-brand">
          <div class="bank-logo-badge ${logoClass}">${initial}</div>
          <div>
            <div class="bank-name">${escapeHtml(acc.bankName)}</div>
            <div class="bank-mask">${escapeHtml(acc.accountNumberMask)} • ${escapeHtml(acc.accountType || 'Savings')}</div>
          </div>
        </div>
        <span class="badge badge-emerald">Active</span>
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
    
    // Check if we have a saved password for HDFC or Federal
    const savedHdfcPwd = await BankPDFParser.getSavedPassword('HDFC');
    const savedFedPwd = await BankPDFParser.getSavedPassword('FEDERAL');
    const candidates = [savedHdfcPwd, savedFedPwd, ''].filter(Boolean);

    let decryptedText = null;

    // Try saved passwords first
    for (const pwd of candidates) {
      try {
        decryptedText = await BankPDFParser.extractPdfText(arrayBuffer, pwd);
        if (decryptedText) break;
      } catch (err) {
        // Continue to next password
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
          <div style="font-weight: 700; color: var(--accent-emerald); margin-bottom: 4px;">Standard Bank Password Rules:</div>
          <div>• <strong>Federal Bank:</strong> First 4 letters of name in UPPERCASE + Date of Birth (e.g. <code>ADIT15081995</code> or <code>ADIT1508</code>)</div>
          <div>• <strong>HDFC Bank:</strong> Customer ID (8 digits) OR PAN in UPPERCASE</div>
          <div>• <strong>ICICI Bank:</strong> First 4 letters of name (lowercase) + DDMM of birth</div>
          <div>• <strong>SBI:</strong> 11-digit Account Number OR Last 5 digits of mobile + DOB</div>
        </div>

        <div class="form-group">
          <label class="form-label">Enter PDF Password</label>
          <input type="password" id="pdf-pwd-input" class="form-input" placeholder="e.g. Customer ID, PAN, or DOB" autofocus />
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 18px;">
          <input type="checkbox" id="pdf-remember-chk" checked style="width: 16px; height: 16px; accent-color: var(--accent-emerald);" />
          <label for="pdf-remember-chk" style="font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer;">
            Remember password on this device for future statements
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
          <button id="pdf-pwd-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button id="pdf-pwd-submit-btn" class="btn btn-primary">Decrypt & Import →</button>
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
      
      // Save password if checked
      const remember = document.getElementById('pdf-remember-chk').checked;
      if (remember) {
        await BankPDFParser.savePassword('HDFC', pwd);
        await BankPDFParser.savePassword('FEDERAL', pwd);
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
    const userId = user ? user.id : 'user-aditya';
    const result = BankPDFParser.parseTextToTransactions(pdfText);
    if (result.transactions.length === 0) {
      showToast('Decrypted PDF, but found no transaction rows to extract.', 'info');
      return;
    }

    const tagged = result.transactions.map(t => ({ ...t, userId }));
    await db.transactions.bulkAdd(tagged);
    showToast(
      `Successfully decrypted and ingested ${result.totalParsed} transactions from ${result.formatDetected}!`,
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
    const userId = user ? user.id : 'user-aditya';
    const parseResult = BankStatementParser.parse(csvText, targetAccId);
    if (parseResult.transactions.length === 0) {
      showToast('No valid transactions found in statement', 'info');
      return;
    }

    // Ingest into database tagged with active user
    const tagged = parseResult.transactions.map(t => ({ ...t, userId }));
    await db.transactions.bulkAdd(tagged);

    showToast(
      `Successfully ingested ${parseResult.totalParsed} transactions (${parseResult.formatDetected} format)!`,
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
          <div style="width: 28px; height: 28px; border-radius: 6px; background: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px;">SETU</div>
          <span style="font-size: var(--text-base); font-weight: 700;">Setu AA Sandbox Gateway</span>
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 16px;">
          Secure RBI Account Aggregator Framework. 256-bit encrypted data pipeline.
        </p>

        <!-- Step 1: Mobile & Bank Selection -->
        <div id="aa-step-1">
          <div class="form-group">
            <label class="form-label">Linked Mobile Number</label>
            <input type="tel" id="aa-mobile-input" class="form-input" value="9876543210" placeholder="10-digit mobile number" />
          </div>
          <div style="background: var(--bg-deep); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: var(--text-xs); color: var(--text-secondary);">
            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Discovered Accounts:</div>
            <div>• HDFC Bank Ltd (Savings A/c **4921)</div>
            <div>• Federal Bank (FedNet A/c **8812)</div>
            <div>• ICICI Bank (Salary A/c **3104)</div>
          </div>
          <button id="aa-proceed-btn" class="btn btn-accent-blue btn-block">
            Request AA Consent OTP →
          </button>
        </div>

        <!-- Step 2: OTP Verification -->
        <div id="aa-step-2" style="display: none;">
          <div class="form-group">
            <label class="form-label">Enter 6-digit Consent OTP</label>
            <input type="text" id="aa-otp-input" class="form-input" value="123456" maxlength="6" style="letter-spacing: 6px; font-size: 1.3rem; text-align: center;" />
            <span style="font-size: 11px; color: var(--accent-emerald); display: block; margin-top: 4px;">Sandbox OTP auto-filled: 123456</span>
          </div>
          <button id="aa-verify-btn" class="btn btn-primary btn-block">
            Authorize Consent & Sync Live Data
          </button>
        </div>

        <!-- Step 3: Loading -->
        <div id="aa-step-3" style="display: none; text-align: center; padding: 30px 0;">
          <div style="font-size: 2rem; margin-bottom: 12px; animation: spin 1s infinite linear;">🔄</div>
          <div style="font-weight: 700; font-size: var(--text-base);">Fetching Live Bank Data...</div>
          <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;">Contacting HDFC and Federal Bank FIP endpoints...</div>
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

function openAddAccountModal(userId, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="add-acc-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--accent-emerald), #059669); display: flex; align-items: center; justify-content: center; font-size: 16px; color: white;">+</div>
          <span style="font-size: var(--text-base); font-weight: 700;">Add Bank Account</span>
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
            <input type="text" id="acc-name-input" class="form-input" placeholder="e.g. HDFC Salary, Federal Savings..." value="HDFC Bank" required />
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
