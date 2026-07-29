# One-shot: convert selected e23 plates to web-weight JPEGs for the E-12 site
Add-Type -AssemblyName System.Drawing

$src = "C:\Users\amel.perez\Projects\Personal\e23\concepts\plates"
$dst = "C:\Users\amel.perez\Projects\Personal\e12\img"

$jobs = @(
    @{ in = "terminal-atrium-1.png"; out = "hero-terminal.jpg";    w = 2400 },
    @{ in = "dest-amalfi-1.png";     out = "travel-amalfi.jpg";    w = 1600 },
    @{ in = "wealth-vault-1.png";    out = "wealth-vault.jpg";     w = 1600 },
    @{ in = "cabin-map-1.png";       out = "route-map.jpg";        w = 1600 },
    @{ in = "cabin-boarding-1.png";  out = "step-boarding.jpg";    w = 1400 },
    @{ in = "cabin-window-1.png";    out = "step-inflight.jpg";    w = 1400 },
    @{ in = "cabin-descent-1.png";   out = "step-arrival.jpg";     w = 1400 },
    @{ in = "escape-pool-1.png";     out = "academy-travel.jpg";   w = 1400 },
    @{ in = "terminal-atrium-2.png"; out = "academy-affiliate.jpg";w = 1400 },
    @{ in = "wealth-lounge-1.png";   out = "academy-bitcoin.jpg";  w = 1400 },
    @{ in = "cabin-aisle-1.png";     out = "academy-luxe.jpg";     w = 1400 }
)

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep  = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)

foreach ($j in $jobs) {
    $inPath  = Join-Path $src $j.in
    $outPath = Join-Path $dst $j.out
    $img = [System.Drawing.Image]::FromFile($inPath)
    $scale = [Math]::Min(1.0, $j.w / $img.Width)
    $nw = [int]($img.Width * $scale); $nh = [int]($img.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $bmp.Save($outPath, $enc, $ep)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    $kb = [Math]::Round((Get-Item $outPath).Length / 1KB)
    Write-Output ("{0} -> {1}  {2}x{3}  {4} KB" -f $j.in, $j.out, $nw, $nh, $kb)
}
