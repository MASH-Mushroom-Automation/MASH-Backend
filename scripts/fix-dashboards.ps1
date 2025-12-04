$dashboardsPath = "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\grafana\dashboards"

Get-ChildItem "$dashboardsPath\*.json" | ForEach-Object {
    $filePath = $_.FullName
    Write-Host "Processing: $($_.Name)"
    
    $content = Get-Content $filePath -Raw | ConvertFrom-Json
    
    if ($content.dashboard) {
        Write-Host "  -> Extracting dashboard object"
        $content.dashboard | ConvertTo-Json -Depth 100 | Set-Content $filePath -Encoding UTF8
        Write-Host "  -> Fixed!"
    } else {
        Write-Host "  -> Already in correct format"
    }
}

Write-Host "`nDone! All dashboards processed."
