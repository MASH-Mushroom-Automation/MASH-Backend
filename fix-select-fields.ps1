# Fix Prisma select field names only (more conservative approach)

$files = @(
    "src\modules\analytics\analytics.service.ts",
    "src\modules\analytics\services\comparison.service.ts",
    "src\modules\analytics\services\drilldown.service.ts",
    "src\modules\analytics\services\export.service.ts",
    "src\modules\analytics\services\forecast.service.ts",
    "src\modules\analytics\services\realtime-analytics.service.ts",
    "src\modules\super-admin\super-admin.service.ts"
)

foreach ($file in $files) {
    $fullPath = Join-Path (Get-Location) $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        
        # Only fix select: { totalAmount: true } -> select: { total: true }
        $updated = $content -replace '(\s+)totalAmount:\s*true,', '$1total: true,'
        
        if ($content -ne $updated) {
            Set-Content -Path $fullPath -Value $updated -NoNewline
            Write-Host "Updated: $file"
        }
    }
}

Write-Host "`nPhase 1 complete. Fixed select statements."
