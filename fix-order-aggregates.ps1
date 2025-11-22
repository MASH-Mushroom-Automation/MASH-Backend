# Fix Order aggregate patterns - only Order uses totalAmount, not Cart or OrderItem
$rootDir = "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\src"
$filesModified = 0
$totalChanges = 0

$orderAggregatePatterns = @(
    # Fix Order aggregate patterns (_sum and _avg)
    @{ Old = 'this\.prisma\.order\.aggregate\(\{[^}]*_sum: \{ total: true \}'; New = { $_.Value -replace '_sum: \{ total: true \}', '_sum: { totalAmount: true }' } },
    @{ Old = 'this\.prisma\.order\.aggregate\(\{[^}]*_avg: \{ total: true \}'; New = { $_.Value -replace '_avg: \{ total: true \}', '_avg: { totalAmount: true }' } },
    
    # Fix Order aggregate access patterns
    @{ Old = '([a-zA-Z]+)\._sum\.total(?!Amount)'; New = '$1._sum.totalAmount' },
    @{ Old = '([a-zA-Z]+)\._avg\.total(?!Amount)'; New = '$1._avg.totalAmount' },
    @{ Old = '([a-zA-Z]+)\._sum\?\.total(?!Amount)'; New = '$1._sum?.totalAmount' },
    @{ Old = '([a-zA-Z]+)\._avg\?\.total(?!Amount)'; New = '$1._avg?.totalAmount' }
)

Write-Host "Starting Order aggregate field name fixes..." -ForegroundColor Cyan
Write-Host ""

Get-ChildItem -Path $rootDir -Filter *.ts -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileChanges = 0
    
    foreach ($pattern in $orderAggregatePatterns) {
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
Write-Host "Fix Summary:" -ForegroundColor Yellow
Write-Host "Files Modified: $filesModified" -ForegroundColor Cyan
Write-Host "Total Changes: $totalChanges" -ForegroundColor Cyan
Write-Host ""
Write-Host "Order aggregate fixes complete!" -ForegroundColor Green
