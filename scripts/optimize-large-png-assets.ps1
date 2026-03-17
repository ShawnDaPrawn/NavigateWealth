param(
  [string]$AssetDir = "src/assets",
  [int64]$MinBytes = 5MB,
  [int]$MaxDimension = 2200,
  [int]$Quality = 82
)

Add-Type -AssemblyName System.Drawing

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

if (-not $jpegCodec) {
  throw "JPEG encoder not available on this machine."
}

$qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($qualityEncoder, [int64]$Quality)

function New-OptimizedJpeg {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$TargetMaxDimension,
    [System.Drawing.Imaging.ImageCodecInfo]$Codec,
    [System.Drawing.Imaging.EncoderParameters]$Params
  )

  $source = [System.Drawing.Image]::FromFile((Resolve-Path $SourcePath))

  try {
    $longEdge = [Math]::Max($source.Width, $source.Height)
    $scale = [Math]::Min(1.0, $TargetMaxDimension / [double]$longEdge)

    $targetWidth = [Math]::Max(1, [int][Math]::Round($source.Width * $scale))
    $targetHeight = [Math]::Max(1, [int][Math]::Round($source.Height * $scale))

    $bitmap = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
    $bitmap.SetResolution($source.HorizontalResolution, $source.VerticalResolution)

    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.DrawImage($source, 0, 0, $targetWidth, $targetHeight)

      $bitmap.Save($DestinationPath, $Codec, $Params)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$targets = Get-ChildItem -Path $AssetDir -Filter *.png -File |
  Where-Object { $_.Length -ge $MinBytes } |
  Sort-Object Length -Descending

$results = foreach ($file in $targets) {
  $destinationPath = Join-Path $file.DirectoryName ($file.BaseName + ".jpg")

  New-OptimizedJpeg `
    -SourcePath $file.FullName `
    -DestinationPath $destinationPath `
    -TargetMaxDimension $MaxDimension `
    -Codec $jpegCodec `
    -Params $encoderParams

  $optimizedFile = Get-Item $destinationPath

  if ($optimizedFile.Length -ge $file.Length) {
    Remove-Item $destinationPath -Force

    [PSCustomObject]@{
      Asset = $file.Name
      SourceMB = [math]::Round($file.Length / 1MB, 2)
      OptimizedMB = "-"
      Reduction = "Skipped"
    }

    continue
  }

  [PSCustomObject]@{
    Asset = $file.Name
    SourceMB = [math]::Round($file.Length / 1MB, 2)
    OptimizedMB = [math]::Round($optimizedFile.Length / 1MB, 2)
    Reduction = "{0:P0}" -f (1 - ($optimizedFile.Length / [double]$file.Length))
  }
}

$results | Format-Table -AutoSize
