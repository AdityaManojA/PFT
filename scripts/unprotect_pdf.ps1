param(
    [string]$FilePath,
    [string]$Password,
    [string]$Bank = "HDFC"
)

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " Bank Statement PDF Decryptor Tool" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan

if (-not $FilePath) {
    Write-Host "Usage: .\scripts\unprotect_pdf.ps1 -FilePath <path_to_pdf> -Password <your_password>" -ForegroundColor Yellow
    Write-Host "Example: .\scripts\unprotect_pdf.ps1 -FilePath .\sample_statement.pdf -Password '12345678'"
    Write-Host ""
    Write-Host "Remember: You can also upload protected PDFs directly into the PWA web app at http://localhost:8080/ - it has automatic password memory!" -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

# Check if qpdf is installed
$hasQpdf = Get-Command qpdf -ErrorAction SilentlyContinue

if ($hasQpdf) {
    $outPath = [System.IO.Path]::ChangeExtension($FilePath, ".unlocked.pdf")
    & qpdf --password=$Password --decrypt $FilePath $outPath
    Write-Host "[OK] Unlocked PDF saved to: $outPath" -ForegroundColor Green
} else {
    Write-Host "Tip: Install qpdf ('winget install qpdf') for fast CLI batch decryption," -ForegroundColor Yellow
    Write-Host "or simply drop the protected PDF into the Finance Tracker PWA dropzone in your browser!" -ForegroundColor Green
}
