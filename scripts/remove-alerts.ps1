$dashboardsPath = "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\grafana\dashboards"

# Create UTF8 encoding without BOM
$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $False

Get-ChildItem "$dashboardsPath\*.json" | ForEach-Object {
    $filePath = $_.FullName
    Write-Host "Processing: $($_.Name)"
    
    $json = Get-Content $filePath -Raw | ConvertFrom-Json
    
    $modified = $false
    
    # Check if there are panels with alert property
    if ($json.panels) {
        foreach ($panel in $json.panels) {
            if ($panel.alert) {
                Write-Host "  -> Removing alert from panel: $($panel.title)"
                $panel.PSObject.Properties.Remove("alert")
                $modified = $true
            }
        }
    }
    
    if ($modified) {
        $json | ConvertTo-Json -Depth 100 | ForEach-Object {
            [System.IO.File]::WriteAllText($filePath, $_, $Utf8NoBomEncoding)
        }
        Write-Host "  -> Saved!"
    } else {
        Write-Host "  -> No alerts to remove"
    }
}

Write-Host "`nDone! All dashboards cleaned."
