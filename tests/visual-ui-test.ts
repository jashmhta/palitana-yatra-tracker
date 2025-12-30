/**
 * Visual UI Testing Script
 * Tests app rendering across multiple mobile screen sizes
 */

import { chromium, devices, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const APP_URL = 'http://localhost:8081';
const SCREENSHOT_DIR = '/home/ubuntu/palitana-yatra-app/test-screenshots';

// Mobile devices to test
const MOBILE_DEVICES = [
  // Small phones
  { name: 'iPhone_SE', ...devices['iPhone SE'] },
  { name: 'iPhone_8', ...devices['iPhone 8'] },
  
  // Medium phones
  { name: 'iPhone_12', ...devices['iPhone 12'] },
  { name: 'iPhone_13', ...devices['iPhone 13'] },
  { name: 'iPhone_14', ...devices['iPhone 14'] },
  { name: 'Pixel_5', ...devices['Pixel 5'] },
  { name: 'Galaxy_S9', ...devices['Galaxy S9+'] },
  
  // Large phones
  { name: 'iPhone_12_Pro_Max', ...devices['iPhone 12 Pro Max'] },
  { name: 'iPhone_14_Pro_Max', ...devices['iPhone 14 Pro Max'] },
  
  // Tablets
  { name: 'iPad_Mini', ...devices['iPad Mini'] },
];

// Pages to test
const PAGES_TO_TEST = [
  { path: '/', name: 'home' },
  { path: '/participants', name: 'participants' },
  { path: '/checkpoints', name: 'checkpoints' },
  { path: '/settings', name: 'settings' },
];

interface TestResult {
  device: string;
  page: string;
  viewport: { width: number; height: number };
  screenshot: string;
  status: 'pass' | 'fail';
  errors: string[];
  loadTime: number;
}

async function runVisualTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Create screenshot directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
  });
  
  for (const device of MOBILE_DEVICES) {
    console.log(`\nTesting on ${device.name}...`);
    
    const context = await browser.newContext({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });
    
    const page = await context.newPage();
    
    for (const testPage of PAGES_TO_TEST) {
      const errors: string[] = [];
      const startTime = Date.now();
      
      try {
        // Navigate to page
        await page.goto(`${APP_URL}${testPage.path}`, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        const loadTime = Date.now() - startTime;
        
        // Wait for content to render
        await page.waitForTimeout(1000);
        
        // Take screenshot
        const screenshotPath = path.join(
          SCREENSHOT_DIR, 
          `${device.name}_${testPage.name}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // Check for console errors
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          }
        });
        
        // Check for visible content
        const bodyContent = await page.textContent('body');
        if (!bodyContent || bodyContent.trim().length < 10) {
          errors.push('Page appears to be empty or not rendered');
        }
        
        // Check for broken images
        const images = await page.$$('img');
        for (const img of images) {
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          if (naturalWidth === 0) {
            const src = await img.getAttribute('src');
            errors.push(`Broken image: ${src}`);
          }
        }
        
        results.push({
          device: device.name,
          page: testPage.name,
          viewport: device.viewport,
          screenshot: screenshotPath,
          status: errors.length === 0 ? 'pass' : 'fail',
          errors,
          loadTime,
        });
        
        console.log(`  ✓ ${testPage.name} (${loadTime}ms)`);
        
      } catch (error) {
        const loadTime = Date.now() - startTime;
        errors.push(`Navigation error: ${error}`);
        
        results.push({
          device: device.name,
          page: testPage.name,
          viewport: device.viewport,
          screenshot: '',
          status: 'fail',
          errors,
          loadTime,
        });
        
        console.log(`  ✗ ${testPage.name} - ${error}`);
      }
    }
    
    await context.close();
  }
  
  await browser.close();
  return results;
}

async function generateReport(results: TestResult[]): Promise<string> {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  
  let report = `# Visual UI Test Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Tests | ${totalTests} |\n`;
  report += `| Passed | ${passedTests} |\n`;
  report += `| Failed | ${failedTests} |\n`;
  report += `| Pass Rate | ${((passedTests / totalTests) * 100).toFixed(1)}% |\n\n`;
  
  // Group by device
  const deviceGroups = new Map<string, TestResult[]>();
  for (const result of results) {
    if (!deviceGroups.has(result.device)) {
      deviceGroups.set(result.device, []);
    }
    deviceGroups.get(result.device)!.push(result);
  }
  
  report += `## Results by Device\n\n`;
  
  for (const [device, deviceResults] of deviceGroups) {
    const viewport = deviceResults[0].viewport;
    const devicePassed = deviceResults.filter(r => r.status === 'pass').length;
    const avgLoadTime = Math.round(
      deviceResults.reduce((sum, r) => sum + r.loadTime, 0) / deviceResults.length
    );
    
    report += `### ${device.replace(/_/g, ' ')} (${viewport.width}x${viewport.height})\n\n`;
    report += `- **Status:** ${devicePassed === deviceResults.length ? '✅ All Passed' : '⚠️ Some Failed'}\n`;
    report += `- **Avg Load Time:** ${avgLoadTime}ms\n\n`;
    
    report += `| Page | Status | Load Time | Errors |\n`;
    report += `|------|--------|-----------|--------|\n`;
    
    for (const result of deviceResults) {
      const statusIcon = result.status === 'pass' ? '✅' : '❌';
      const errorCount = result.errors.length > 0 ? result.errors.length : '-';
      report += `| ${result.page} | ${statusIcon} | ${result.loadTime}ms | ${errorCount} |\n`;
    }
    
    report += `\n`;
  }
  
  // List all errors
  const allErrors = results.filter(r => r.errors.length > 0);
  if (allErrors.length > 0) {
    report += `## Errors Found\n\n`;
    for (const result of allErrors) {
      report += `### ${result.device} - ${result.page}\n\n`;
      for (const error of result.errors) {
        report += `- ${error}\n`;
      }
      report += `\n`;
    }
  }
  
  return report;
}

// Main execution
async function main() {
  console.log('Starting Visual UI Tests...\n');
  console.log('Testing across', MOBILE_DEVICES.length, 'devices');
  console.log('Testing', PAGES_TO_TEST.length, 'pages per device');
  console.log('Total tests:', MOBILE_DEVICES.length * PAGES_TO_TEST.length);
  
  const results = await runVisualTests();
  const report = await generateReport(results);
  
  // Save report
  const reportPath = path.join(SCREENSHOT_DIR, 'visual-test-report.md');
  fs.writeFileSync(reportPath, report);
  
  console.log('\n' + '='.repeat(50));
  console.log('Visual UI Tests Complete!');
  console.log('='.repeat(50));
  console.log(`Report saved to: ${reportPath}`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  
  const passed = results.filter(r => r.status === 'pass').length;
  const total = results.length;
  console.log(`\nResults: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  
  // Return results as JSON for further processing
  const jsonPath = path.join(SCREENSHOT_DIR, 'visual-test-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
}

main().catch(console.error);
