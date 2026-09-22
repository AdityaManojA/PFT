"""
Bank Email Statement Streamliner & Auto-Decryptor
-------------------------------------------------
Automates fetching monthly password-protected bank statement PDFs from email
(HDFC, Federal Bank, ICICI, SBI), decrypts them using bank credentials,
and outputs clean CSV ready for the Finance Tracker PWA.

Dependencies:
    pip install pypdf imapclient
"""

import os
import re
import csv
from pypdf import PdfReader, PdfWriter

# Bank Password Rule Profiles
BANK_CONFIGS = {
    "HDFC": {
        "email_sender": "alerts@hdfcbank.net",
        # Default HDFC rule: 8-digit Customer ID or PAN in UPPERCASE
        "password": "YOUR_HDFC_CUSTOMER_ID_OR_PAN"
    },
    "FEDERAL": {
        "email_sender": "fednet@federalbank.co.in",
        # Federal Bank rule: First 4 letters of name in UPPERCASE + Date of Birth (DDMMYYYY or DDMM)
        # e.g., "ADIT15081995" or "ADIT1508"
        "password": "YOUR_FIRST4_CAPS_PLUS_DOB"
    },
    "ICICI": {
        "email_sender": "estatement@icicibank.com",
        # First 4 letters of name in lowercase + DDMM of birth
        "password": "YOUR_ICICI_PASSWORD"
    },
    "SBI": {
        "email_sender": "statements@sbi.co.in",
        # Last 5 digits of mobile + DOB (DDMMYY) or 11-digit A/c
        "password": "YOUR_SBI_PASSWORD"
    }
}

def decrypt_pdf(input_pdf_path, output_pdf_path, password):
    """Decrypt a password-protected bank PDF statement."""
    reader = PdfReader(input_pdf_path)
    if reader.is_encrypted:
        success = reader.decrypt(password)
        if not success:
            raise ValueError(f"Failed to decrypt {input_pdf_path} with provided password.")
    
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    with open(output_pdf_path, "wb") as f:
        writer.write(f)
    
    print(f"[OK] Decrypted statement saved to: {output_pdf_path}")

def batch_decrypt_directory(input_dir, output_dir, bank_code="HDFC"):
    """Batch decrypt all protected PDFs in a download folder."""
    os.makedirs(output_dir, exist_ok=True)
    cfg = BANK_CONFIGS.get(bank_code.upper())
    if not cfg:
        print(f"Unknown bank code: {bank_code}")
        return

    password = cfg["password"]
    for fname in os.listdir(input_dir):
        if fname.lower().endswith(".pdf"):
            in_path = os.path.join(input_dir, fname)
            out_path = os.path.join(output_dir, f"unlocked_{fname}")
            try:
                decrypt_pdf(in_path, out_path, password)
            except Exception as e:
                print(f"[Error] {fname}: {e}")

if __name__ == "__main__":
    print("Bank Email PDF Streamliner Ready.")
    print("Tip: You can also drop your password-protected bank PDFs directly into the Finance Tracker PWA!")
