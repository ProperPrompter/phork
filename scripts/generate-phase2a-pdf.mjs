/**
 * Generate Phase 2A PDF — Verification Packet
 * Usage: node scripts/generate-phase2a-pdf.mjs
 */
import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HTML_PATH = resolve(ROOT, 'reports', 'pm-response-phase2a.html');
const OUTPUT_PATH = resolve(ROOT, 'reports', 'Phork_Phase2A_Verification_Packet.pdf');

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('Chrome not found.');
    process.exit(1);
  }
  console.log(`Using Chrome: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const fileUrl = `file:///${HTML_PATH.replace(/\\/g, '/')}`;
    console.log(`Loading: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 1000));

    await page.pdf({
      path: OUTPUT_PATH,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 8px; color: #9ca3af; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between;">
          <span>Phork Phase 2A — Verification Packet</span>
          <span>Confidential</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; color: #9ca3af; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between;">
          <span>Engineering Lead — February 2026</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    console.log(`PDF generated: ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('PDF generation failed:', err);
  process.exit(1);
});
