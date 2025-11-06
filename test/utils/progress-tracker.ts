import * as fs from 'fs';
import * as path from 'path';
import { ErrorDiagnosis } from './error-analyzer';

export interface TestProgress {
  module: string;
  totalEndpoints: number;
  testedEndpoints: number;
  passedEndpoints: number;
  failedEndpoints: number;
  skippedEndpoints: number;
  coverage: number;
  lastRunDate: Date;
  averageResponseTime: number;
  failures: ErrorDiagnosis[];
  successfulTests: SuccessfulTest[];
}

export interface SuccessfulTest {
  endpointId: string;
  testCase: string;
  responseTime: number;
  timestamp: Date;
}

export class ProgressTracker {
  private progress: TestProgress;
  private reportPath: string;

  constructor(module: string) {
    this.progress = {
      module,
      totalEndpoints: this.getTotalEndpoints(module),
      testedEndpoints: 0,
      passedEndpoints: 0,
      failedEndpoints: 0,
      skippedEndpoints: 0,
      coverage: 0,
      lastRunDate: new Date(),
      averageResponseTime: 0,
      failures: [],
      successfulTests: [],
    };

    this.reportPath = path.join(process.cwd(), 'test', 'reports', `${module}-progress.html`);
    this.ensureReportDirectory();
  }

  private getTotalEndpoints(module: string): number {
    const endpoints: Record<string, number> = {
      auth: 18,
      users: 15,
      products: 20,
      orders: 18,
      sellers: 12,
      buyers: 10,
      categories: 8,
      notifications: 8,
    };
    return endpoints[module] || 0;
  }

  private ensureReportDirectory(): void {
    const dir = path.dirname(this.reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  recordSuccess(endpointId: string, responseTime: number = 0, testCase: string = ''): void {
    this.progress.testedEndpoints++;
    this.progress.passedEndpoints++;
    this.progress.coverage = (this.progress.passedEndpoints / this.progress.totalEndpoints) * 100;
    this.progress.lastRunDate = new Date();

    this.progress.successfulTests.push({
      endpointId,
      testCase,
      responseTime,
      timestamp: new Date(),
    });

    // Update average response time
    const totalResponseTime = this.progress.successfulTests.reduce((sum, test) => sum + test.responseTime, 0);
    this.progress.averageResponseTime = totalResponseTime / this.progress.successfulTests.length;

    this.updateDashboard();
    console.log(`✅ ${endpointId} ${testCase ? `(${testCase})` : ''} - PASSED (${responseTime}ms)`);
  }

  recordFailure(endpointId: string, diagnosis: ErrorDiagnosis): void {
    this.progress.testedEndpoints++;
    this.progress.failedEndpoints++;
    this.progress.failures.push(diagnosis);
    this.progress.lastRunDate = new Date();

    this.updateDashboard();
    console.error(`❌ ${endpointId} - FAILED (${diagnosis.errorType})`);
  }

  private updateDashboard(): void {
    const html = this.generateDashboardHTML();
    fs.writeFileSync(this.reportPath, html);
  }

  async generateReport(): Promise<void> {
    const html = this.generateDashboardHTML();
    fs.writeFileSync(this.reportPath, html);
    
    // Also generate JSON report
    const jsonPath = this.reportPath.replace('.html', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.progress, null, 2));
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 AUTOMATED API TESTING - PROGRESS REPORT`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Module: ${this.progress.module.toUpperCase()}`);
    console.log(`Coverage: ${this.progress.coverage.toFixed(1)}%`);
    console.log(`✅ Passed: ${this.progress.passedEndpoints}/${this.progress.totalEndpoints}`);
    console.log(`❌ Failed: ${this.progress.failedEndpoints}`);
    console.log(`⏱️  Avg Response Time: ${this.progress.averageResponseTime.toFixed(0)}ms`);
    console.log(`📄 HTML Report: ${this.reportPath}`);
    console.log(`📄 JSON Report: ${jsonPath}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  private generateDashboardHTML(): string {
    const { module, totalEndpoints, passedEndpoints, failedEndpoints, coverage, averageResponseTime, failures } = this.progress;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MASH API Testing - ${module.toUpperCase()} Module</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { 
      background: white; 
      color: #333; 
      padding: 30px; 
      border-radius: 10px; 
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header .subtitle { opacity: 0.7; font-size: 16px; }
    .stats-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
      gap: 20px; 
      margin-bottom: 30px; 
    }
    .stat-card { 
      background: white; 
      padding: 25px; 
      border-radius: 10px; 
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      transition: transform 0.3s ease;
    }
    .stat-card:hover { transform: translateY(-5px); }
    .stat-card .label { 
      color: #666; 
      font-size: 14px; 
      text-transform: uppercase; 
      letter-spacing: 1px; 
      margin-bottom: 10px; 
      font-weight: 600;
    }
    .stat-card .value { font-size: 48px; font-weight: bold; color: #333; }
    .stat-card.success .value { color: #10b981; }
    .stat-card.danger .value { color: #ef4444; }
    .stat-card.info .value { color: #3b82f6; }
    .stat-card.warning .value { color: #f59e0b; }
    .progress-section { 
      background: white; 
      padding: 30px; 
      border-radius: 10px; 
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .progress-section h2 { color: #333; margin-bottom: 20px; font-size: 24px; }
    .progress-bar { 
      background: #e5e7eb; 
      height: 40px; 
      border-radius: 20px; 
      overflow: hidden; 
      margin: 20px 0;
      position: relative;
    }
    .progress-fill { 
      height: 100%; 
      background: linear-gradient(90deg, #10b981 0%, #059669 100%); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: white; 
      font-weight: bold; 
      transition: width 0.5s ease;
      font-size: 16px;
    }
    .failures-section { 
      background: white; 
      padding: 30px; 
      border-radius: 10px; 
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .failures-section h2 { color: #333; margin-bottom: 20px; font-size: 24px; }
    .failure-item { 
      background: #fef2f2; 
      border-left: 4px solid #ef4444; 
      padding: 20px; 
      margin-bottom: 15px; 
      border-radius: 5px;
    }
    .failure-item .error-type { 
      color: #dc2626; 
      font-weight: bold; 
      font-size: 18px; 
      margin-bottom: 10px; 
    }
    .failure-item .error-details { 
      color: #666; 
      font-size: 14px; 
      line-height: 1.6; 
    }
    .fix-suggestions { 
      background: #fffbeb; 
      border: 1px solid #fcd34d; 
      padding: 15px; 
      border-radius: 5px; 
      margin-top: 10px; 
    }
    .fix-suggestions .title { 
      color: #d97706; 
      font-weight: bold; 
      margin-bottom: 10px; 
    }
    .fix-suggestions ol { 
      margin-left: 20px; 
      color: #666; 
      font-size: 14px; 
    }
    .timestamp { 
      color: white; 
      font-size: 14px; 
      margin-top: 20px; 
      text-align: center;
      opacity: 0.9;
    }
    .badge { 
      display: inline-block; 
      padding: 5px 12px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: bold; 
      margin-left: 10px;
    }
    .badge.critical { background: #fee2e2; color: #991b1b; }
    .badge.high { background: #fef3c7; color: #92400e; }
    .badge.medium { background: #dbeafe; color: #1e40af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 MASH API Testing Dashboard</h1>
      <p class="subtitle">Automated endpoint testing with intelligent error detection - ${module.toUpperCase()} Module</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card success">
        <div class="label">✅ Passed Tests</div>
        <div class="value">${passedEndpoints}</div>
      </div>
      <div class="stat-card danger">
        <div class="label">❌ Failed Tests</div>
        <div class="value">${failedEndpoints}</div>
      </div>
      <div class="stat-card info">
        <div class="label">📊 Coverage</div>
        <div class="value">${coverage.toFixed(1)}%</div>
      </div>
      <div class="stat-card warning">
        <div class="label">⏱️ Avg Response</div>
        <div class="value">${averageResponseTime.toFixed(0)}<span style="font-size: 20px;">ms</span></div>
      </div>
    </div>
    
    <div class="progress-section">
      <h2>📈 Testing Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${coverage}%">
          ${passedEndpoints} / ${totalEndpoints} endpoints tested
        </div>
      </div>
      <p style="color: #666; text-align: center; margin-top: 10px;">
        ${totalEndpoints - passedEndpoints - failedEndpoints} endpoints remaining
      </p>
    </div>
    
    ${failures.length > 0 ? `
    <div class="failures-section">
      <h2>❌ Failed Tests (${failures.length})</h2>
      ${failures.map(failure => `
        <div class="failure-item">
          <div class="error-type">
            ${failure.errorType}
            <span class="badge ${failure.severity.toLowerCase()}">${failure.severity}</span>
          </div>
          <div class="error-details">
            <strong>Endpoint:</strong> ${failure.method} ${failure.endpoint}<br>
            <strong>Status Code:</strong> ${failure.statusCode}<br>
            <strong>Root Cause:</strong> ${failure.rootCause}<br>
            <strong>Affected Components:</strong> ${failure.affectedComponents.join(', ')}
          </div>
          <div class="fix-suggestions">
            <div class="title">💡 Fix Suggestions:</div>
            <ol>
              ${failure.fixSuggestions.map(fix => `
                <li>${fix.description}${fix.file ? ` (${fix.file}${fix.line ? `:${fix.line}` : ''})` : ''}</li>
              `).join('')}
            </ol>
          </div>
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="progress-section">
      <h2>🎉 All Tests Passed!</h2>
      <p style="color: #10b981; font-size: 18px; text-align: center; margin-top: 20px;">
        No failures detected. All ${passedEndpoints} tests are passing successfully!
      </p>
    </div>
    `}
    
    <p class="timestamp">
      Last updated: ${new Date().toLocaleString()} | 
      Generated by MASH Automated Testing System v2.0.0
    </p>
  </div>
</body>
</html>`;
  }
}
