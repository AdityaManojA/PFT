Add-Type -AssemblyName System.Drawing
function Make-Icon([int], [string]) {
     = New-Object System.Drawing.Bitmap , 
     = [System.Drawing.Graphics]::FromImage()
    .SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    .Clear([System.Drawing.Color]::FromArgb(26, 28, 33))

    # Center glow
     = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 232, 96, 52))
    .FillEllipse(, [float](*0.1), [float](*0.1), [float](*0.8), [float](*0.8))

    # Center terracotta diamond/star
     = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 96, 52))
     =  / 2.0
     =  / 2.0
     =  * 0.32

     = New-Object System.Drawing.Drawing2D.GraphicsPath
     = @(
        [System.Drawing.PointF]::new(,  - ),
        [System.Drawing.PointF]::new( + *0.35,  - *0.35),
        [System.Drawing.PointF]::new( + , ),
        [System.Drawing.PointF]::new( + *0.35,  + *0.35),
        [System.Drawing.PointF]::new(,  + ),
        [System.Drawing.PointF]::new( - *0.35,  + *0.35),
        [System.Drawing.PointF]::new( - , ),
        [System.Drawing.PointF]::new( - *0.35,  - *0.35)
    )
    .AddLines()
    .FillPath(, )

    # Core inner spark
     = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255))
    .FillEllipse(, [float]( - *0.06), [float]( - *0.06), [float](*0.12), [float](*0.12))

    .Dispose()
    .Save(, [System.Drawing.Imaging.ImageFormat]::Png)
    .Dispose()
    Write-Host " Created \
}
Make-Icon 192 'icons/icon-192.png'
Make-Icon 512 'icons/icon-512.png'
