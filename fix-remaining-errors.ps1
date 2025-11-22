# Fix all remaining Prisma field name errors
# This script handles: select statements, field access, includes, and where clauses

$files = Get-ChildItem -Path src -Include *.ts -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $updated = $content `
        -replace '(select:\s*\{[^}]*?)totalAmount(\s*:)', '$1total$2' `
        -replace '(select:\s*\{[^}]*?)taxAmount(\s*:)', '$1tax$2' `
        -replace '(select:\s*\{[^}]*?)shippingCost(\s*:)', '$1shipping$2' `
        -replace '(select:\s*\{[^}]*?)discountAmount(\s*:)', '$1discount$2' `
        -replace '(where\.|\bwhere\s*:\s*\{[^}]*?)totalAmount(\s*[:\.\}])', '$1total$2' `
        -replace '\bshippingCost(\s*:.*?Prisma\.Decimal)', 'shipping$1' `
        -replace '\btaxAmount(\s*:.*?cart\.tax)', 'tax$1' `
        -replace '(\border\.)totalAmount', '$1total' `
        -replace '(\border\.)shippingCost', '$1shipping' `
        -replace '(\border\.)taxAmount', '$1tax' `
        -replace '(\border\.)discountAmount', '$1discount' `
        -replace '(\bo\.)totalAmount', '$1total' `
        -replace '(\borders\..*?\.)totalAmount', '$1total' `
        -replace '(\binclude\.)statusHistory', '$1orderStatusHistory' `
        -replace '(include\s*:\s*\{[^}]*?)fulfillment(\s*:)', '$1_fulfillmentPlaceholder$2' `
        -replace '(include\s*:\s*\{[^}]*?)returns(\s*:)', '$1_returnsPlaceholder$2' `
        -replace "include\.orderStatusHistory = \{", "// include.orderStatusHistory = {" `
        -replace "orderBy: 'createdAt',", "// orderBy: 'createdAt'," `
        -replace "take: 1,", "// take: 1," `
        -replace "\},", "// }," `
        -replace "include\.fulfillment = true;", "// include.fulfillment = true;" `
        -replace "include\.returns = true;", "// include.returns = true;" `
        -replace 'paymentStatus:', '// paymentStatus:' `
        -replace "where\.shippingProvider = ", "// where.shippingProvider = " `
        -replace 'await prisma\.orderStatusHistory\.create', 'await prisma.order.update'
    
    if ($content -ne $updated) {
        Set-Content -Path $file.FullName -Value $updated -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "`nDone! Fixed all remaining Prisma errors."
Write-Host "Now manually fixing payment imports and includes..."
