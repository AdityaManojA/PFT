Add-Type -AssemblyName System.Drawing

$iconsDir = "d:\Projects\PFT\icons"
if (!(Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

function Create-AppIcon {
    param(
        [int]$Size,
        [string]$FilePath,
        [bool]$IsAdd = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#0F172A"))
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)

    # Rounded inner card
    $margin = [int]($Size * 0.08)
    $innerSize = $Size - ($margin * 2)
    $rect = New-Object System.Drawing.Rectangle($margin, $margin, $innerSize, $innerSize)
    
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.ColorTranslator]::FromHtml("#10B981"),
        [System.Drawing.ColorTranslator]::FromHtml("#3B82F6"),
        45.0
    )

    $radius = [int]($Size * 0.22)
    $gPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $arcRect = New-Object System.Drawing.Rectangle($rect.X, $rect.Y, $diameter, $diameter)
    $gPath.AddArc($arcRect, 180, 90)
    $arcRect.X = $rect.Right - $diameter
    $gPath.AddArc($arcRect, 270, 90)
    $arcRect.Y = $rect.Bottom - $diameter
    $gPath.AddArc($arcRect, 0, 90)
    $arcRect.X = $rect.X
    $gPath.AddArc($arcRect, 90, 90)
    $gPath.CloseFigure()

    $g.FillPath($gradBrush, $gPath)

    # Symbol text or Plus
    $symbol = if ($IsAdd) { "+" } else { [char]0x20B9 }
    $fontSize = [int]($Size * 0.44)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString($symbol, $font, $textBrush, [System.Drawing.RectangleF]::new(0, 0, $Size, $Size), $format)

    $bmp.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Created: $FilePath"
}

Create-AppIcon -Size 192 -FilePath "$iconsDir\icon-192.png"
Create-AppIcon -Size 512 -FilePath "$iconsDir\icon-512.png"
Create-AppIcon -Size 180 -FilePath "$iconsDir\apple-touch-icon.png"
Create-AppIcon -Size 192 -FilePath "$iconsDir\add-icon.png" -IsAdd $true
