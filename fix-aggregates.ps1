# Fix aggregate field names to match Prisma generated types
$files = Get-ChildItem -Path src -Include *.ts -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if (!$content) { continue }
    
    $updated = $content `
        -replace '(_sum:\s*{\s*)totalAmount(\s*:)', '$1total$2' `
        -replace '(_avg:\s*{\s*)totalAmount(\s*:)', '$1total$2' `
        -replace '(\._sum[\.\?]+)totalAmount', '$1total' `
        -replace '(\._avg[\.\?]+)totalAmount', '$1total'
    
    if ($content -ne $updated) {
        Set-Content -Path $file.FullName -Value $updated -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Done! Fixed aggregate field names."
