# Fix double-replacement issue - remove totalAmountAmount and similar
Write-Host "Fixing double-replacement errors..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse -File

$fixes = @{
    'totalAmountAmount' = 'totalAmount'
    'taxAmountAmount' = 'taxAmount'
    'shippingCostCost' = 'shippingCost'
    'discountAmountAmount' = 'discountAmount'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    foreach ($pattern in $fixes.Keys) {
        $replacement = $fixes[$pattern]
        $content = $content -replace [regex]::Escape($pattern), $replacement
    }
    
    if ($content -ne $originalContent) {
        Set-Content $file.FullName $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "`nFixed double replacements. Run: npm run build" -ForegroundColor Cyan
