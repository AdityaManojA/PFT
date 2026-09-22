/**
 * Quick-Edit Transaction Category & Type Modal
 * Allows one-tap editing of category, emoji, transaction type (Expense/Income),
 * and clean merchant name from Ledger and Overview recent transactions.
 */

import { db, formatINR } from '../db.js';
import { CATEGORY_DEFINITIONS, ALL_CATEGORIES } from '../parsers/categorizer.js';

export function openEditTransactionModal(transaction, onUpdated) {
  if (!transaction || !transaction.id) return;

  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  let currentCategory = transaction.category || 'Other';
  let currentType = transaction.type || 'expense';
  let currentMerchant = transaction.merchant || transaction.narration || 'Transaction';

  const catMeta = CATEGORY_DEFINITIONS[currentCategory] || CATEGORY_DEFINITIONS.Other;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="edit-txn-backdrop">
      <div class="modal-sheet" style="max-width: 480px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="sheet-handle"></div>

        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border-medium);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="modal-cat-preview-icon" style="width: 36px; height: 36px; border-radius: var(--radius-md); background: ${catMeta.bg}; color: ${catMeta.color}; display: flex; align-items: center; justify-content: center; font-size: 18px;">
              ${catMeta.icon}
            </div>
            <div>
              <div style="font-size: var(--text-base); font-weight: 800; color: var(--text-primary);">Change Transaction</div>
              <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(transaction.date || 'Today')} • ${formatINR(transaction.amount || 0)}</div>
            </div>
          </div>
          <button id="close-edit-txn-btn" class="btn-icon btn-sm" aria-label="Close" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-full); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ✕
          </button>
        </div>

        <div style="overflow-y: auto; flex: 1; padding-right: 4px; display: flex; flex-direction: column; gap: 16px;">
          <!-- Merchant Name Field -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted);">
              Merchant / Counterparty Name
            </label>
            <input type="text" id="edit-txn-merchant-input" class="form-input" value="${escapeHtml(currentMerchant)}" style="font-size: 13px; font-weight: 600;" placeholder="e.g. Swiggy, DMart, Friend" />
          </div>

          <!-- Transaction Type Toggle (Expense vs Income) -->
          <div>
            <label class="form-label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
              Transaction Type
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button type="button" class="btn ${currentType === 'expense' ? 'btn-primary' : 'btn-secondary'} btn-sm type-toggle-btn" data-type="expense" style="font-size: 12px; font-weight: 700; padding: 8px; justify-content: center; border-radius: var(--radius-sm);">
                💸 Expense (Debit)
              </button>
              <button type="button" class="btn ${currentType === 'income' ? 'btn-primary' : 'btn-secondary'} btn-sm type-toggle-btn" data-type="income" style="font-size: 12px; font-weight: 700; padding: 8px; justify-content: center; border-radius: var(--radius-sm);">
                💰 Income (Credit)
              </button>
            </div>
          </div>

          <!-- Categories Grid (All 11 Categories with Emojis) -->
          <div>
            <label class="form-label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
              Select Category
            </label>
            <div class="category-select-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 8px;">
              ${ALL_CATEGORIES.map(c => {
                const isSelected = c.name === currentCategory;
                return `
                  <button type="button" class="cat-pill-btn ${isSelected ? 'selected' : ''}" data-category="${escapeHtml(c.name)}" style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 10px;
                    border-radius: var(--radius-sm);
                    border: 1.5px solid ${isSelected ? c.color : 'var(--border-subtle)'};
                    background: ${isSelected ? c.bg : 'var(--bg-surface-elevated)'};
                    color: ${isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'};
                    cursor: pointer;
                    font-size: 11.5px;
                    font-weight: 600;
                    text-align: left;
                    transition: all 0.15s ease;
                  ">
                    <span style="font-size: 15px;">${c.icon}</span>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.name)}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
          <button type="button" id="edit-txn-delete-btn" class="btn btn-secondary btn-sm" style="color: var(--accent-primary); border-color: rgba(232, 96, 52, 0.3); font-size: 12px; padding: 6px 12px;">
            🗑️ Delete
          </button>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="edit-txn-cancel-btn" class="btn btn-secondary btn-sm" style="font-size: 12px; padding: 6px 14px;">Cancel</button>
            <button type="button" id="edit-txn-save-btn" class="btn btn-primary btn-sm" style="font-weight: 700; font-size: 12px; padding: 6px 16px;">Save Changes ✓</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const backdrop = document.getElementById('edit-txn-backdrop');
  const closeBtn = document.getElementById('close-edit-txn-btn');
  const cancelBtn = document.getElementById('edit-txn-cancel-btn');
  const deleteBtn = document.getElementById('edit-txn-delete-btn');
  const saveBtn = document.getElementById('edit-txn-save-btn');
  const merchantInput = document.getElementById('edit-txn-merchant-input');
  const previewIcon = document.getElementById('modal-cat-preview-icon');

  const close = () => { modalContainer.innerHTML = ''; };
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  if (deleteBtn) {
    let deleteConfirmPending = false;
    deleteBtn.onclick = async () => {
      if (!deleteConfirmPending) {
        deleteConfirmPending = true;
        deleteBtn.textContent = '⚠️ Confirm Delete?';
        deleteBtn.style.background = 'var(--accent-primary)';
        deleteBtn.style.color = '#ffffff';
        setTimeout(() => {
          deleteConfirmPending = false;
          deleteBtn.textContent = '🗑️ Delete';
          deleteBtn.style.background = '';
          deleteBtn.style.color = 'var(--accent-primary)';
        }, 3500);
        return;
      }
      await db.transactions.delete(transaction.id);
      close();
      if (onUpdated) onUpdated();
    };
  }
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };
  }

  // Type Toggle
  modalContainer.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      currentType = btn.dataset.type;
      modalContainer.querySelectorAll('.type-toggle-btn').forEach(b => {
        if (b.dataset.type === currentType) {
          b.className = 'btn btn-primary btn-sm type-toggle-btn';
        } else {
          b.className = 'btn btn-secondary btn-sm type-toggle-btn';
        }
      });
    };
  });

  // Category Selection
  modalContainer.querySelectorAll('.cat-pill-btn').forEach(btn => {
    btn.onclick = () => {
      currentCategory = btn.dataset.category;
      const meta = CATEGORY_DEFINITIONS[currentCategory] || CATEGORY_DEFINITIONS.Other;

      // Update preview icon
      if (previewIcon) {
        previewIcon.textContent = meta.icon;
        previewIcon.style.background = meta.bg;
        previewIcon.style.color = meta.color;
      }

      // Update pill styles
      modalContainer.querySelectorAll('.cat-pill-btn').forEach(b => {
        const isThis = b.dataset.category === currentCategory;
        const bMeta = CATEGORY_DEFINITIONS[b.dataset.category] || CATEGORY_DEFINITIONS.Other;
        b.style.borderColor = isThis ? bMeta.color : 'var(--border-subtle)';
        b.style.background = isThis ? bMeta.bg : 'var(--bg-surface-elevated)';
        b.style.color = isThis ? 'var(--text-primary)' : 'var(--text-secondary)';
      });
    };
  });

  // Save Changes
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const newMerchant = merchantInput.value.trim() || currentMerchant;
    const finalMeta = CATEGORY_DEFINITIONS[currentCategory] || CATEGORY_DEFINITIONS.Other;

    try {
      await db.transactions.update(transaction.id, {
        category: currentCategory,
        icon: finalMeta.icon,
        type: currentType,
        merchant: newMerchant
      });

      // Also update account balance if transaction type was changed
      if (currentType !== transaction.type && transaction.account_id) {
        const acc = await db.accounts.get(transaction.account_id);
        if (acc) {
          const diff = currentType === 'income' ? (transaction.amount * 2) : -(transaction.amount * 2);
          await db.accounts.update(transaction.account_id, {
            balance: (acc.balance || 0) + diff
          });
        }
      }

      close();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error updating transaction:', err);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes ✓';
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
