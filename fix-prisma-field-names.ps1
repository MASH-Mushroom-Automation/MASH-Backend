# Fix all Prisma field name mismatches to use schema field names
Write-Host "Fixing Prisma field names to match schema..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse -File

$replacements = @{
    # SELECT statements
    'total: true,' = 'totalAmount: true,'
    'tax: true,' = 'taxAmount: true,'
    'shipping: true,' = 'shippingCost: true,'
    'discount: true,' = 'discountAmount: true,'
    
    # AGGREGATE statements
    '{ total: true }' = '{ totalAmount: true }'
    '{ tax: true }' = '{ taxAmount: true }'
    '{ shipping: true }' = '{ shippingCost: true }'
    '{ discount: true }' = '{ discountAmount: true }'
    
    # Field access patterns (careful with these)
    'order.total' = 'order.totalAmount'
    'o.total' = 'o.totalAmount'
    '\.total\?' = '.totalAmount?'
    '_sum.total' = '_sum.totalAmount'
    '_avg.total' = '_avg.totalAmount'
    
    # CREATE/UPDATE field names
    'total: pricing.total' = 'totalAmount: pricing.total'
    'tax: pricing.taxAmount' = 'taxAmount: pricing.taxAmount'
    'tax: pricing.tax' = 'taxAmount: pricing.tax'
    'shipping: pricing.shippingCost' = 'shippingCost: pricing.shippingCost'
    'shipping: pricing.shipping' = 'shippingCost: pricing.shipping'
    'discount: pricing.discountAmount' = 'discountAmount: pricing.discountAmount'
    'discount: pricing.discount' = 'discountAmount: pricing.discount'
    
    # Cart conversion
    'tax: cart.tax' = 'taxAmount: cart.tax'
    'shipping: new Prisma.Decimal' = 'shippingCost: new Prisma.Decimal'
    'discount: cart.discount' = 'discountAmount: cart.discount'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        $content = $content -replace [regex]::Escape($pattern), $replacement
    }
    
    if ($content -ne $originalContent) {
        Set-Content $file.FullName $content -Encoding UTF8 -NoNewline
        Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "`nDone! Now run: npm run build" -ForegroundColor Cyan
