Write-Host "=== CODE-LEVEL CHECKS (POWERSHELL) ==="

# 1. Check BankPDFParser.getSavedPassword exists in pdf-parser.js
$pdfParser = Get-Content "js/parsers/pdf-parser.js" -Raw
if ($pdfParser -match "static\s+async\s+getSavedPassword\s*\(") {
    Write-Host "PASS: getSavedPassword method defined on BankPDFParser"
} else {
    Write-Error "FAIL: getSavedPassword missing on BankPDFParser"
    exit 1
}

# 2. Check for zero alert() and zero confirm() across js/
$jsFiles = Get-ChildItem -Path "js" -Filter "*.js" -Recurse
$hasAlert = $false
foreach ($f in $jsFiles) {
    $content = Get-Content $f.FullName -Raw
    if ($content -match "\balert\s*\(") {
        Write-Error ("FAIL: alert() found in " + $f.FullName)
        $hasAlert = $true
    }
    if ($content -match "\bconfirm\s*\(") {
        Write-Error ("FAIL: confirm() found in " + $f.FullName)
        $hasAlert = $true
    }
}
if (-not $hasAlert) {
    Write-Host "PASS: Zero raw alert() or confirm() in all JS files"
} else {
    exit 1
}

# 3. Check auth-divider and unclosed div fix in login.js
$loginContent = Get-Content "js/views/login.js" -Raw
if ($loginContent -match "auth-divider") {
    Write-Host "PASS: auth-divider class used in login.js"
} else {
    Write-Error "FAIL: auth-divider not found in login.js"
    exit 1
}

# 4. Check that gmail-sync.js does NOT contain the invalid client_id
$gmailSync = Get-Content "js/services/gmail-sync.js" -Raw
if ($gmailSync -match "440632363531") {
    Write-Error "FAIL: Found old invalid client_id in gmail-sync.js"
    exit 1
} else {
    Write-Host "PASS: Invalid client_id removed from gmail-sync.js"
}

# 5. Check sw.js cache version
$sw = Get-Content "sw.js" -Raw
if ($sw -match "sbafa-v[2-9]\.[0-9]+(\.[0-9]+)?") {
    Write-Host "PASS: sw.js cache is valid and updated"
} else {
    Write-Error "FAIL: sw.js cache not bumped"
    exit 1
}

Write-Host "=== ALL CODE-LEVEL CHECKS PASSED ==="
