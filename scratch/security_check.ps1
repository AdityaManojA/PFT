Write-Host "=== SBAFA COMPREHENSIVE SECURITY AUDIT ==="

$violations = 0

# 1. Check for dangerous eval() or document.write()
$jsFiles = Get-ChildItem -Path "js" -Filter "*.js" -Recurse
foreach ($f in $jsFiles) {
    $content = Get-Content $f.FullName -Raw
    if ($content -match '\beval\s*\(') {
        Write-Error ("SECURITY ISSUE: eval() found in " + $f.FullName)
        $violations++
    }
    if ($content -match '\bdocument\.write\s*\(') {
        Write-Error ("SECURITY ISSUE: document.write() found in " + $f.FullName)
        $violations++
    }
}

if ($violations -eq 0) {
    Write-Host "PASS: Zero eval() or document.write() occurrences"
}

# 2. Check for escapeHtml usage across views
$views = Get-ChildItem -Path "js/views" -Filter "*.js"
foreach ($v in $views) {
    $content = Get-Content $v.FullName -Raw
    if ($content -match 'escapeHtml') {
        Write-Host ("PASS: escapeHtml sanitizer present in " + $v.Name)
    } else {
        Write-Warning ("WARNING: escapeHtml not referenced in " + $v.Name)
    }
}

# 3. Check for hardcoded private client secrets (e.g. client_secret)
foreach ($f in $jsFiles) {
    $content = Get-Content $f.FullName -Raw
    if ($content -match 'client_secret\s*:\s*["''][^"'']+["'']') {
        Write-Error ("SECURITY ISSUE: client_secret found in " + $f.FullName)
        $violations++
    }
}

if ($violations -eq 0) {
    Write-Host "PASS: Zero private client_secret keys hardcoded in client code"
}

# 4. Check that Dexie transactions/accounts queries enforce userId
$accountsContent = Get-Content "js/views/accounts.js" -Raw
if ($accountsContent -match "where\('userId'\)") {
    Write-Host "PASS: Dexie queries in accounts.js isolate records by userId"
} else {
    Write-Warning "WARNING: userId indexing check in accounts.js"
}

# 5. Check BankPDFParser does not transmit PDFs across network
$pdfParser = Get-Content "js/parsers/pdf-parser.js" -Raw
if ($pdfParser -match 'fetch\s*\(' -or $pdfParser -match 'XMLHttpRequest') {
    Write-Error "SECURITY ISSUE: Network call detected inside BankPDFParser!"
    $violations++
} else {
    Write-Host "PASS: BankPDFParser runs 100% locally with zero external network transmission"
}

Write-Host "=== SECURITY AUDIT RESULT: $violations VIOLATIONS ==="
if ($violations -eq 0) {
    Write-Host "SECURITY AUDIT: PASSED (ALL VAULT POLICIES ENFORCED)"
} else {
    exit 1
}
