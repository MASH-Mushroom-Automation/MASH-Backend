# PowerShell script to fix Logger compatibility issues in test files
# This script adds ConsoleLogger import and setLogger() call to all test files

$testFiles = @(
    "src\app.controller.spec.ts",
    "src\common\filters\__tests__\http-exception.filter.spec.ts",
    "src\common\filters\__tests__\prisma-exception.filter.spec.ts",
    "src\common\interceptors\__tests__\logging.interceptor.spec.ts",
    "src\common\interceptors\__tests__\transform.interceptor.spec.ts",
    "src\health\health.controller.spec.ts",
    "src\modules\admin\admin.controller.spec.ts",
    "src\modules\admin\admin.service.spec.ts",
    "src\modules\analytics\services\batch-processor.service.spec.ts",
    "src\modules\analytics\services\cache-warmer.service.spec.ts",
    "src\modules\analytics\services\drilldown.service.spec.ts",
    "src\modules\analytics\services\realtime-analytics.service.spec.ts",
    "src\modules\analytics\services\scheduled-reports.service.spec.ts",
    "src\modules\auth\auth.controller.spec.ts",
    "src\modules\auth\auth.service.spec.ts",
    "src\modules\orders\orders.controller.spec.ts",
    "src\modules\orders\orders.service.spec.ts",
    "src\modules\products\products.controller.spec.ts",
    "src\modules\products\products.service.spec.ts",
    "src\modules\sensors\sensors.controller.spec.ts",
    "src\modules\sensors\sensors.service.spec.ts"
)

foreach ($file in $testFiles) {
    Write-Host "Processing $file..."
    
    $content = Get-Content $file -Raw
    
    # Step 1: Add ConsoleLogger import if not already present
    if ($content -notmatch "ConsoleLogger") {
        # Find the first @nestjs import line and add ConsoleLogger to it or after it
        if ($content -match "import \{[^}]*\} from '@nestjs/testing';") {
            $content = $content -replace "(import \{[^}]*)\} from '@nestjs/testing';", "`$1} from '@nestjs/testing';`nimport { ConsoleLogger } from '@nestjs/common';"
        } elseif ($content -match "import \{[^}]*\} from '@nestjs/common';") {
            $content = $content -replace "(import \{)([^}]*)\} from '@nestjs/common';", "import { ConsoleLogger, `$2} from '@nestjs/common';"
        }
    }
    
    # Step 2: Add .setLogger(new ConsoleLogger()) before .compile()
    $content = $content -replace "(\s+)\}\)\.compile\(\);", "`$1})`n`$1  .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility`n`$1  .compile();"
    
    # Write back the modified content
    Set-Content -Path $file -Value $content -NoNewline
    
    Write-Host "Fixed $file"
}

Write-Host "`nAll test files have been fixed!"
Write-Host "Run 'npm run test' to verify the fixes."
