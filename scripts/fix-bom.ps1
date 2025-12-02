$dashboardsPath = "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\grafana\dashboards"

# Create UTF8 encoding without BOM
$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $False

Get-ChildItem "$dashboardsPath\*.json" | ForEach-Object {
    $filePath = $_.FullName
    Write-Host "Processing: $($_.Name)"
    
    $content = Get-Content $filePath -Raw
    
    # Remove BOM if present (first 3 bytes: EF BB BF)
    if ($content.Length -gt 0 -and [byte][char]$content[0] -eq 0xEF) {
        $content = $content.Substring(1)
    }
    if ($content.Length -gt 0 -and $content[0] -eq [char]0xFEFF) {
        $content = $content.Substring(1)
    }
    
    # Write back without BOM
    [System.IO.File]::WriteAllText($filePath, $content.TrimStart(), $Utf8NoBomEncoding)
    Write-Host "  -> Saved without BOM"
}

Write-Host "`nDone! All dashboards fixed."
