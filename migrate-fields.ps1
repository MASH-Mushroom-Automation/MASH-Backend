# Field Name Migration Script - ASCII only
# Migrates old Order model field names to new names

Write-Host "Starting field name migration..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse -File

$replacements = @{
    "_sum: \{ total: true \}" = "_sum: { totalAmount: true }"
    "_sum\.\s*total" = "_sum.totalAmount"
    "_sum\?\.\s*total" = "_sum?.totalAmount"
    "_avg: \{ total: true \}" = "_avg: { totalAmount: true }"
    "_avg\.\s*total" = "_avg.totalAmount"
    "_avg\?\.\s*total" = "_avg?.totalAmount"
    "order\.tax(?!Amount)" = "order.taxAmount"
    "order\.shipping(?!Cost|Provider|Address)" = "order.shippingCost"
    "order\.discount(?!Amount)" = "order.discountAmount"
    "order\.total(?!Amount)" = "order.totalAmount"
    "\.tax\.toNumber\(\)" = ".taxAmount.toNumber()"
    "\.shipping\.toNumber\(\)" = ".shippingCost.toNumber()"
    "\.discount\.toNumber\(\)" = ".discountAmount.toNumber()"
    "\.total\.toNumber\(\)" = ".totalAmount.toNumber()"
    "cart\.tax" = "cart.taxAmount"
    "cart\.shipping" = "cart.shippingCost"
    "cart\.discount" = "cart.discountAmount"
    "cart\.total" = "cart.totalAmount"
    "total:\s*true," = "totalAmount: true,"
    "tax:\s*true," = "taxAmount: true,"
    "shipping:\s*true," = "shippingCost: true,"
    "discount:\s*true," = "discountAmount: true,"
}

$totalChanges = 0
$filesModified = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $fileChanges = 0
    
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        $matches = [regex]::Matches($content, $pattern)
        
        if ($matches.Count -gt 0) {
            $content = $content -replace $pattern, $replacement
            $fileChanges += $matches.Count
        }
    }
    
    if ($fileChanges -gt 0) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Modified $($file.Name): $fileChanges changes" -ForegroundColor Green
        $totalChanges += $fileChanges
        $filesModified++
    }
}

Write-Host ""
Write-Host "Migration Summary:" -ForegroundColor Cyan
Write-Host "Files Modified: $filesModified" -ForegroundColor Yellow
Write-Host "Total Changes: $totalChanges" -ForegroundColor Yellow
Write-Host ""
Write-Host "Field name migration complete!" -ForegroundColor Green
