# Reproduce the geometric SVG mark as PNGs without third-party dependencies.
Add-Type -AssemblyName System.Drawing
$iconDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../icons'))
foreach ($iconSize in @(180, 192, 512)) {
  $bitmap = [Drawing.Bitmap]::new($iconSize, $iconSize)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $sand = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#e6a15c'))
  $cream = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#f7f3eb'))
  $line = [Drawing.Pen]::new($sand, 14)
  try {
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#142b3d'))
    $graphics.ScaleTransform($iconSize / 512.0, $iconSize / 512.0)
    $graphics.FillEllipse($sand, 274, 142, 96, 96)
    $graphics.FillPolygon($cream, [Drawing.PointF[]]@(
      [Drawing.PointF]::new(102,326), [Drawing.PointF]::new(203,170),
      [Drawing.PointF]::new(269,273), [Drawing.PointF]::new(307,223), [Drawing.PointF]::new(410,326)))
    $graphics.FillPolygon($sand, [Drawing.PointF[]]@(
      [Drawing.PointF]::new(203,170), [Drawing.PointF]::new(171,220),
      [Drawing.PointF]::new(203,208), [Drawing.PointF]::new(235,220)))
    $line.StartCap = $line.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($line, 119, 359, 393, 359)
    $filename = if ($iconSize -eq 180) { 'apple-touch-icon.png' } else { "icon-$iconSize.png" }
    $bitmap.Save((Join-Path $iconDirectory $filename), [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $line.Dispose(); $cream.Dispose(); $sand.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
  }
}
