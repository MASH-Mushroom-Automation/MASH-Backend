# Revert Cart and OrderItem field names (they were NOT renamed in schema)
# Only Order model was renamed, not Cart or OrderItem

$rootDir = "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\src"
$filesModified = 0
$totalChanges = 0

# Cart revert patterns: taxAmount->tax, shippingCost->shipping, discountAmount->discount, totalAmount->total
# OrderItem revert patterns: totalAmount->total

$cartPatterns = @(
    # Revert Cart aggregate patterns
    @{ Old = '_sum: \{ taxAmount: true \}'; New = '_sum: { tax: true }' },
    @{ Old = '_sum\.taxAmount'; New = '_sum.tax' },
    @{ Old = '_sum\?\.taxAmount'; New = '_sum?.tax' },
    @{ Old = '_avg: \{ taxAmount: true \}'; New = '_avg: { tax: true }' },
    @{ Old = '_avg\.taxAmount'; New = '_avg.tax' },
    @{ Old = '_avg\?\.taxAmount'; New = '_avg?.tax' },
    
    @{ Old = '_sum: \{ shippingCost: true \}'; New = '_sum: { shipping: true }' },
    @{ Old = '_sum\.shippingCost'; New = '_sum.shipping' },
    @{ Old = '_sum\?\.shippingCost'; New = '_sum?.shipping' },
    @{ Old = '_avg: \{ shippingCost: true \}'; New = '_avg: { shipping: true }' },
    @{ Old = '_avg\.shippingCost'; New = '_avg.shipping' },
    @{ Old = '_avg\?\.shippingCost'; New = '_avg?.shipping' },
    
    @{ Old = '_sum: \{ discountAmount: true \}'; New = '_sum: { discount: true }' },
    @{ Old = '_sum\.discountAmount'; New = '_sum.discount' },
    @{ Old = '_sum\?\.discountAmount'; New = '_sum?.discount' },
    @{ Old = '_avg: \{ discountAmount: true \}'; New = '_avg: { discount: true }' },
    @{ Old = '_avg\.discountAmount'; New = '_avg.discount' },
    @{ Old = '_avg\?\.discountAmount'; New = '_avg?.discount' },
    
    @{ Old = '_sum: \{ totalAmount: true \}'; New = '_sum: { total: true }' },
    @{ Old = '_sum\.totalAmount'; New = '_sum.total' },
    @{ Old = '_sum\?\.totalAmount'; New = '_sum?.total' },
    @{ Old = '_avg: \{ totalAmount: true \}'; New = '_avg: { total: true }' },
    @{ Old = '_avg\.totalAmount'; New = '_avg.total' },
    @{ Old = '_avg\?\.totalAmount'; New = '_avg?.total' },
    
    # Revert Cart object access with negative lookahead for Amount/Cost suffixes
    @{ Old = 'cart\.taxAmount(?!Amount|Cost)\b'; New = 'cart.tax' },
    @{ Old = 'cart\.shippingCost(?!Amount|Cost)\b'; New = 'cart.shipping' },
    @{ Old = 'cart\.discountAmount(?!Amount|Cost)\b'; New = 'cart.discount' },
    @{ Old = 'cart\.totalAmount(?!Amount|Cost)\b'; New = 'cart.total' },
    
    # Revert Cart method calls
    @{ Old = '\.taxAmount\.toNumber\(\)'; New = '.tax.toNumber()' },
    @{ Old = '\.shippingCost\.toNumber\(\)'; New = '.shipping.toNumber()' },
    @{ Old = '\.discountAmount\.toNumber\(\)'; New = '.discount.toNumber()' },
    
    # Revert Cart select statements
    @{ Old = 'taxAmount: true,'; New = 'tax: true,' },
    @{ Old = 'shippingCost: true,'; New = 'shipping: true,' },
    @{ Old = 'discountAmount: true,'; New = 'discount: true,' }
)

$orderItemPatterns = @(
    # Revert OrderItem aggregate patterns
    @{ Old = 'OrderItemSumAggregateInputType[^\r\n]*totalAmount: true'; New = '$& <!-- SKIP: Not a Cart field -->' }, # Mark for manual fix
    @{ Old = '_sum: \{ totalAmount: true \}[^\r\n]*// Sum line totals'; New = '_sum: { total: true } // Sum line totals' },
    @{ Old = '_sum\?\.totalAmount[^\r\n]*// Sum line totals'; New = '_sum?.total' },
    
    # Revert OrderItem select
    @{ Old = 'totalAmount: true,[^\r\n]*// OrderItem'; New = 'total: true, // OrderItem' },
    
    # Revert OrderItem object access
    @{ Old = 'item\.totalAmount(?!Amount|Cost)\b'; New = 'item.total' }
)

Write-Host "Starting Cart and OrderItem field name reversion..." -ForegroundColor Cyan
Write-Host ""

Get-ChildItem -Path $rootDir -Filter *.ts -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileChanges = 0
    
    # Apply Cart patterns
    foreach ($pattern in $cartPatterns) {
        $matches = [regex]::Matches($content, $pattern.Old)
        if ($matches.Count -gt 0) {
            $content = $content -replace $pattern.Old, $pattern.New
            $fileChanges += $matches.Count
        }
    }
    
    # Apply OrderItem patterns
    foreach ($pattern in $orderItemPatterns) {
        $matches = [regex]::Matches($content, $pattern.Old)
        if ($matches.Count -gt 0) {
            $content = $content -replace $pattern.Old, $pattern.New
            $fileChanges += $matches.Count
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Modified $($file.Name): $fileChanges changes" -ForegroundColor Green
        $filesModified++
        $totalChanges += $fileChanges
    }
}

Write-Host ""
Write-Host "Reversion Summary:" -ForegroundColor Yellow
Write-Host "Files Modified: $filesModified" -ForegroundColor Cyan
Write-Host "Total Changes: $totalChanges" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cart and OrderItem field name reversion complete!" -ForegroundColor Green
Write-Host "Note: Cart uses tax/shipping/discount/total (NOT renamed)" -ForegroundColor Yellow
Write-Host "Note: OrderItem uses total (NOT totalAmount)" -ForegroundColor Yellow
Write-Host "Note: Order uses taxAmount/shippingCost/discountAmount/totalAmount (WAS renamed)" -ForegroundColor Yellow
