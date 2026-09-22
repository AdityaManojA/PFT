$port = 8080
$root = "d:\Projects\PFT"
$started = $false

while (-not $started -and $port -lt 8100) {
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        $listener.Start()
        $started = $true
    } catch {
        $port++
    }
}

if (-not $started) {
    Write-Error "Could not find an available port."
    exit 1
}

$url = "http://localhost:$port/"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Personal Finance Tracker PWA Server Running" -ForegroundColor Green
Write-Host " URL: $url" -ForegroundColor Yellow
Write-Host " Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "==================================================" -ForegroundColor Cyan

# Open in default browser automatically
Start-Process $url

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".csv"  = "text/csv; charset=utf-8"
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $writer = New-Object System.IO.BinaryWriter($stream)

        $requestLine = $reader.ReadLine()
        if ($requestLine) {
            $parts = $requestLine.Split(' ')
            if ($parts.Length -ge 2 -and $parts[0] -eq 'GET') {
                $rawPath = $parts[1].Split('?')[0].TrimStart('/')
                if ([string]::IsNullOrWhiteSpace($rawPath)) {
                    $rawPath = "index.html"
                }

                $filePath = Join-Path $root ($rawPath.Replace('/', '\'))
                if (Test-Path $filePath -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

                    $headers = "HTTP/1.1 200 OK`r`n" +
                               "Content-Type: $mime`r`n" +
                               "Content-Length: $($bytes.Length)`r`n" +
                               "Access-Control-Allow-Origin: *`r`n" +
                               "Service-Worker-Allowed: /`r`n" +
                               "Connection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
                    $writer.Write($headerBytes)
                    $writer.Write($bytes)
                } else {
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $headers = "HTTP/1.1 404 Not Found`r`n" +
                               "Content-Type: text/plain`r`n" +
                               "Content-Length: $($msg.Length)`r`n" +
                               "Connection: close`r`n`r`n"
                    $writer.Write([System.Text.Encoding]::ASCII.GetBytes($headers))
                    $writer.Write($msg)
                }
            }
        }
        $writer.Flush()
        $client.Close()
    }
} finally {
    $listener.Stop()
}
