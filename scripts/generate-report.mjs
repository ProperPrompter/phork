/**
 * Phork MVP Progress Report Generator
 * Generates a comprehensive PDF report with screenshots.
 *
 * Usage: node scripts/generate-report.mjs
 * Requires: Preview server running on localhost:3000
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const OUTPUT_DIR = resolve('reports');
const SCREENSHOTS_DIR = join(OUTPUT_DIR, 'screenshots');

// Ensure output directories exist
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Count files in the project
function countFiles(dir, exclude = ['node_modules', '.git', '.turbo', '.next', 'pnpm-lock.yaml']) {
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFiles(fullPath, exclude);
      } else {
        count++;
      }
    }
  } catch { }
  return count;
}

async function main() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Screenshot 1: Login page
  console.log('Capturing login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '01-login.png'), fullPage: false });

  // Screenshot 2: Register view
  console.log('Capturing register page...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const regBtn = btns.find(b => b.textContent === 'Register');
    if (regBtn) regBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '02-register.png'), fullPage: false });

  // Screenshot 3: Studio project list (with mock auth)
  console.log('Capturing studio project list...');
  await page.evaluate(() => {
    localStorage.setItem('phork_token', 'mock-token-for-report');
    localStorage.setItem('phork_user', JSON.stringify({ id: 'test-id', email: 'test@phork.ai', displayName: 'Test User' }));
    localStorage.setItem('phork_workspace', 'test-workspace-id');
  });
  await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '03-studio-projects.png'), fullPage: false });

  // Screenshot 4: New project dialog
  console.log('Capturing new project dialog...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const newBtn = btns.find(b => b.textContent?.includes('New Project'));
    if (newBtn) newBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '04-new-project.png'), fullPage: false });

  // Screenshot 5: Project editor - empty
  console.log('Capturing project editor (empty)...');
  await page.goto(`${BASE_URL}/studio/demo-project`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '05-editor-empty.png'), fullPage: false });

  // Screenshot 6: Project editor with shots
  console.log('Capturing project editor (with shots)...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="Add shot"]');
    if (btn) { btn.click(); btn.click(); btn.click(); }
  });
  await new Promise(r => setTimeout(r, 1000));
  // Select shot 1
  await page.evaluate(() => {
    const shotBtns = document.querySelectorAll('.mb-1.flex.w-full');
    if (shotBtns[0]) shotBtns[0].click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: join(SCREENSHOTS_DIR, '06-editor-shots.png'), fullPage: false });

  await browser.close();
  console.log('Screenshots captured.');

  // Count project stats
  const totalFiles = countFiles(resolve('.'));

  // Generate HTML report
  console.log('Generating PDF report...');

  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 40px 50px; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11px; }

  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%); color: white; margin: -40px -50px; padding: 50px; }
  .cover h1 { font-size: 48px; font-weight: 800; margin-bottom: 8px; }
  .cover h1 span { color: #7c3aed; }
  .cover .subtitle { font-size: 20px; color: #a0a0a0; margin-bottom: 40px; }
  .cover .report-title { font-size: 28px; font-weight: 600; margin-bottom: 8px; color: #e0e0e0; }
  .cover .report-meta { font-size: 14px; color: #888; }
  .cover .badge { display: inline-block; background: #7c3aed; color: white; padding: 6px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 30px; }

  h2 { font-size: 20px; color: #7c3aed; margin: 24px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #7c3aed; }
  h3 { font-size: 14px; color: #1a1a2e; margin: 16px 0 8px 0; }
  h4 { font-size: 12px; color: #444; margin: 12px 0 6px 0; }
  p { margin: 6px 0; font-size: 11px; }

  .section { page-break-inside: avoid; margin-bottom: 16px; }
  .page-break { page-break-before: always; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  th { background: #7c3aed; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f8fc; }

  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .metric { background: #f4f0ff; border: 1px solid #e0d5ff; border-radius: 8px; padding: 12px; text-align: center; }
  .metric .value { font-size: 24px; font-weight: 800; color: #7c3aed; }
  .metric .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

  .screenshot { margin: 12px 0; text-align: center; page-break-inside: avoid; }
  .screenshot img { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .screenshot .caption { font-size: 9px; color: #666; margin-top: 6px; font-style: italic; }

  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .status-complete { background: #dcfce7; color: #166534; }
  .status-partial { background: #fef3c7; color: #92400e; }
  .status-pending { background: #f3f4f6; color: #4b5563; }

  .check { color: #16a34a; font-weight: bold; }
  .cross { color: #dc2626; font-weight: bold; }

  ul { margin: 6px 0 6px 20px; font-size: 11px; }
  li { margin: 3px 0; }

  .code { font-family: 'Consolas', 'Courier New', monospace; background: #f4f4f8; padding: 1px 5px; border-radius: 3px; font-size: 10px; }

  pre { background: #1a1a2e; color: #e0e0e0; padding: 12px; border-radius: 6px; font-size: 9px; overflow-x: auto; margin: 8px 0; font-family: 'Consolas', monospace; }
  pre .cmd { color: #7c3aed; }
  pre .comment { color: #666; }

  .arch-box { background: #f8f8fc; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; margin: 10px 0; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .footnote { font-size: 9px; color: #888; border-top: 1px solid #e0e0e0; padding-top: 8px; margin-top: 20px; }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <h1><span>Phork</span> Studio</h1>
  <div class="subtitle">AI Production Studio &mdash; Create, Fork, Remix</div>
  <div class="report-title">Phase 1 MVP Engineering Report</div>
  <div class="report-meta">${reportDate}</div>
  <div class="badge">INTERNAL ALPHA &mdash; MILESTONE M0&ndash;M7 COMPLETE</div>
</div>

<!-- EXECUTIVE SUMMARY -->
<h2>1. Executive Summary</h2>
<div class="section">
  <p>This report documents the completion of the <strong>Phase 1 MVP</strong> for Phork, a closed-loop AI production studio. The MVP implements all core systems required by the engineering handoff specification, including the studio UI, backend API, job processing pipeline, asset provenance system, credit ledger, and project forking.</p>

  <div class="metric-grid">
    <div class="metric">
      <div class="value">${totalFiles}</div>
      <div class="label">Source Files</div>
    </div>
    <div class="metric">
      <div class="value">4</div>
      <div class="label">Packages</div>
    </div>
    <div class="metric">
      <div class="value">11</div>
      <div class="label">DB Tables</div>
    </div>
    <div class="metric">
      <div class="value">7</div>
      <div class="label">Milestones Done</div>
    </div>
  </div>

  <h3>Key Decisions Made</h3>
  <table>
    <tr><th>Decision</th><th>Choice</th><th>Rationale</th></tr>
    <tr><td>Backend Language</td><td>TypeScript (Node.js)</td><td>Unified stack with frontend; strong typing across packages</td></tr>
    <tr><td>API Framework</td><td>Fastify 5</td><td>High performance, plugin system, built-in validation</td></tr>
    <tr><td>Frontend</td><td>Next.js 15 + React 19</td><td>App Router, server components, built-in routing</td></tr>
    <tr><td>Database</td><td>PostgreSQL + Drizzle ORM</td><td>Relational fits DAG/ledger; Drizzle is type-safe and lightweight</td></tr>
    <tr><td>Queue</td><td>BullMQ (Redis)</td><td>Mature, supports job retry/dedup, good Node.js integration</td></tr>
    <tr><td>Monorepo</td><td>pnpm + Turborepo</td><td>Efficient workspace management, parallel builds, caching</td></tr>
    <tr><td>Snapshot Strategy</td><td>JSON per commit</td><td>Simple, self-contained; recommended by spec for Phase 1</td></tr>
    <tr><td>Fork Model</td><td>New project + parent ref</td><td>Clean separation; as recommended by spec</td></tr>
    <tr><td>Generation Providers</td><td>Stub (FFmpeg-based)</td><td>Architecturally ready for real APIs; no external dependency for alpha</td></tr>
  </table>
</div>

<!-- ARCHITECTURE -->
<h2 class="page-break">2. Architecture Overview</h2>
<div class="section">
  <div class="arch-box">
    <h3>Monorepo Structure</h3>
    <pre>
phork/
├── apps/
│   ├── web/          <span class="comment"># Next.js 15 frontend (port 3000)</span>
│   └── api/          <span class="comment"># Fastify 5 API + BullMQ workers (port 3001)</span>
├── packages/
│   ├── db/           <span class="comment"># Drizzle ORM schema + migrations (PostgreSQL)</span>
│   └── shared/       <span class="comment"># TypeScript types, enums, interfaces</span>
├── docker-compose.yml <span class="comment"># PostgreSQL 16 + Redis 7</span>
├── turbo.json        <span class="comment"># Turborepo task pipeline</span>
└── pnpm-workspace.yaml
    </pre>
  </div>

  <h3>System Architecture</h3>
  <div class="arch-box">
    <pre>
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js Web   │────▶│   Fastify API    │────▶│   PostgreSQL    │
│   (React 19)    │     │   (REST + JWT)   │     │   (11 tables)   │
│   Port 3000     │     │   Port 3001      │     │   Port 5432     │
└─────────────────┘     └───────┬──────────┘     └─────────────────┘
                                │
                                │ BullMQ
                                ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   Job Workers    │────▶│     Redis       │
                        │  gen_video/audio │     │   Port 6379     │
                        │  render (ffmpeg) │     └─────────────────┘
                        └───────┬──────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Local Storage   │
                        │  (S3-ready)      │
                        └──────────────────┘
    </pre>
  </div>
</div>

<!-- DATABASE SCHEMA -->
<h2>3. Database Schema</h2>
<div class="section">
  <p>11 PostgreSQL tables organized across 6 domains. Full schema managed via Drizzle ORM with generated migrations.</p>

  <div class="two-col">
    <div>
      <h4>Users &amp; Workspaces</h4>
      <table>
        <tr><th>Table</th><th>Key Columns</th></tr>
        <tr><td><span class="code">users</span></td><td>id, email (unique), password_hash, display_name</td></tr>
        <tr><td><span class="code">workspaces</span></td><td>id, name, created_by</td></tr>
        <tr><td><span class="code">workspace_members</span></td><td>workspace_id, user_id, role</td></tr>
      </table>

      <h4>Credits</h4>
      <table>
        <tr><th>Table</th><th>Key Columns</th></tr>
        <tr><td><span class="code">credit_accounts</span></td><td>workspace_id (PK), balance</td></tr>
        <tr><td><span class="code">credit_ledger</span></td><td>id, workspace_id, job_id, delta, reason</td></tr>
      </table>
    </div>
    <div>
      <h4>Projects &amp; Branching (DAG)</h4>
      <table>
        <tr><th>Table</th><th>Key Columns</th></tr>
        <tr><td><span class="code">projects</span></td><td>id, workspace_id, name, parent_project_id, forked_from_commit_id</td></tr>
        <tr><td><span class="code">commits</span></td><td>id, project_id, parent_commit_id, snapshot (JSONB)</td></tr>
        <tr><td><span class="code">project_heads</span></td><td>project_id (PK), head_commit_id</td></tr>
      </table>

      <h4>Assets &amp; Safety</h4>
      <table>
        <tr><th>Table</th><th>Key Columns</th></tr>
        <tr><td><span class="code">assets</span></td><td>id, type, storage_url, mint_receipt_sig, provenance (JSONB)</td></tr>
        <tr><td><span class="code">jobs</span></td><td>id, type, status, idempotency_key (unique)</td></tr>
        <tr><td><span class="code">safety_events</span></td><td>id, job_id, category, action</td></tr>
      </table>
    </div>
  </div>
</div>

<!-- API SURFACE -->
<h2 class="page-break">4. API Surface</h2>
<div class="section">
  <p>RESTful API with JWT authentication. All endpoints except auth require a valid Bearer token.</p>

  <table>
    <tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Auth</th></tr>
    <tr><td>POST</td><td><span class="code">/auth/register</span></td><td>Register + create workspace + 1000 credits</td><td>No</td></tr>
    <tr><td>POST</td><td><span class="code">/auth/login</span></td><td>Login, returns JWT</td><td>No</td></tr>
    <tr><td>GET</td><td><span class="code">/auth/me</span></td><td>Current user + workspaces</td><td>Yes</td></tr>
    <tr><td>POST</td><td><span class="code">/projects</span></td><td>Create project + initial commit</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/projects/:id</span></td><td>Project + head commit</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/projects?workspaceId=</span></td><td>List workspace projects</td><td>Yes</td></tr>
    <tr><td>POST</td><td><span class="code">/projects/:id/commits</span></td><td>Create commit (validates mint receipts)</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/projects/:id/commits</span></td><td>List commits</td><td>Yes</td></tr>
    <tr><td>POST</td><td><span class="code">/projects/:id/fork</span></td><td>Fork project from commit</td><td>Yes</td></tr>
    <tr><td>POST</td><td><span class="code">/jobs/gen-video</span></td><td>Queue video generation job</td><td>Yes</td></tr>
    <tr><td>POST</td><td><span class="code">/jobs/gen-audio</span></td><td>Queue TTS audio job</td><td>Yes</td></tr>
    <tr><td>POST</td><td><span class="code">/jobs/render</span></td><td>Queue render job (commit &rarr; mp4)</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/jobs/:id</span></td><td>Job status + result</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/credits/balance</span></td><td>Workspace credit balance</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/credits/ledger</span></td><td>Immutable ledger entries</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/assets/:id</span></td><td>Asset metadata + provenance</td><td>Yes</td></tr>
    <tr><td>GET</td><td><span class="code">/assets/:id/file</span></td><td>Stream asset binary</td><td>No*</td></tr>
  </table>
  <p style="font-size:9px; color:#888;">* Asset file streaming is unauthenticated so the HTML video player can fetch directly.</p>
</div>

<!-- JOB PIPELINE -->
<h2>5. Job Pipeline &amp; Generation</h2>
<div class="section">
  <h3>Job Execution Flow</h3>
  <div class="arch-box">
    <pre>
Client POST /jobs/gen-video
  │
  ▼
API: Validate credits ──▶ Debit credits ──▶ Write ledger entry
  │
  ▼
API: Create job (status: queued, idempotency_key: unique)
  │
  ▼
BullMQ: Enqueue to "generation" queue
  │
  ▼
Worker: Claim job (status: running)
  │
  ├── Safety Check (keyword policy) ──▶ If blocked: safety_event + status: blocked
  │
  ├── Call Provider (stub: FFmpeg generates placeholder)
  │
  ├── Save asset to storage
  │
  ├── Sign mint receipt (HMAC-SHA256)
  │
  ├── Write asset row with provenance JSON
  │
  └── Update job (status: succeeded, result: { assetId })
    </pre>
  </div>

  <h3>Job Types &amp; Costs</h3>
  <table>
    <tr><th>Job Type</th><th>Credits</th><th>Phase 1 Provider</th><th>Output</th></tr>
    <tr><td>gen_video</td><td>25</td><td>Stub (FFmpeg color + text overlay)</td><td>MP4 1280x720</td></tr>
    <tr><td>gen_audio</td><td>5</td><td>Stub (FFmpeg silent MP3)</td><td>MP3</td></tr>
    <tr><td>gen_image</td><td>10</td><td>Stub (FFmpeg color PNG)</td><td>PNG 1280x720</td></tr>
    <tr><td>render</td><td>15</td><td>FFmpeg concat pipeline</td><td>MP4 (assembled)</td></tr>
  </table>

  <h3>Safety System</h3>
  <p>Phase 1 implements keyword-based content policy checking:</p>
  <ul>
    <li><strong>Blocked categories:</strong> Deepfake/face-swap attempts, extreme violence, CSAM</li>
    <li><strong>Warning categories:</strong> Weapon references, violence references (logged, not blocked)</li>
    <li>Safety events are stored in <span class="code">safety_events</span> table with category, entity, and action</li>
    <li>Architecture supports future ML-based classification upgrade</li>
  </ul>

  <h3>Idempotency</h3>
  <p>Every job requires a unique <span class="code">idempotency_key</span>. If a duplicate key is submitted, the API returns the existing job without creating a new one or debiting credits again. This prevents double-charging on retries.</p>
</div>

<!-- CLOSED ECOSYSTEM -->
<h2 class="page-break">6. Closed Ecosystem Enforcement</h2>
<div class="section">
  <p>The platform enforces that <strong>no external assets can be used in projects</strong>. This is the foundational constraint of Phork.</p>

  <h3>Enforcement Mechanisms</h3>
  <table>
    <tr><th>Layer</th><th>Mechanism</th><th>Implementation</th></tr>
    <tr><td>Asset Creation</td><td>Mint Receipt Signing</td><td>HMAC-SHA256 signature generated server-side when an asset is created by a job. Signature = HMAC(assetId:jobId, secret).</td></tr>
    <tr><td>Commit Validation</td><td>Asset Reference Check</td><td>When creating a commit, the API validates every asset ID in the timeline snapshot exists in the DB and has a valid <span class="code">mint_receipt_sig</span>.</td></tr>
    <tr><td>No Upload API</td><td>No upload endpoint</td><td>There is no API endpoint for uploading external files. Assets can only be created by job workers.</td></tr>
  </table>

  <p>Attempting to reference a non-existent or un-minted asset ID in a commit returns HTTP 400 with the message: <em>"Asset [id] not found or missing mint receipt. Only platform-generated assets are allowed."</em></p>
</div>

<!-- FORKING -->
<h2>7. Project Forking (DAG)</h2>
<div class="section">
  <p>Forking creates a new project that preserves the full commit history up to the fork point.</p>

  <h3>Fork Mechanics</h3>
  <div class="arch-box">
    <pre>
Original Project                 Forked Project
───────────────                  ──────────────
Commit A (init)       ──copy──▶  Commit A' (init)
    │                                │
Commit B (3 shots)    ──copy──▶  Commit B' (3 shots)
    │                                │
Commit C (5 shots)               Commit C' (fork, change shot 2)
    │                                │
Commit D (render)                Commit D' (new render)
    </pre>
  </div>

  <ul>
    <li>Fork creates a <strong>new project</strong> with <span class="code">parent_project_id</span> and <span class="code">forked_from_commit_id</span></li>
    <li>Commit chain is walked backwards from fork point and re-created with new IDs</li>
    <li>Asset references are preserved (shared, not duplicated)</li>
    <li>New commits can diverge independently</li>
  </ul>
</div>

<!-- UI PAGES -->
<h2 class="page-break">8. Studio UI</h2>
<div class="section">
  <h3>8.1 Login / Registration</h3>
  <p>Email/password auth with toggle between sign-in and registration. Registration auto-creates a workspace and grants 1000 starter credits.</p>
  <div class="screenshot">
    <img src="screenshots/01-login.png" alt="Login Page">
    <div class="caption">Figure 1: Login page with dark theme and purple accent branding</div>
  </div>
  <div class="screenshot">
    <img src="screenshots/02-register.png" alt="Register Page">
    <div class="caption">Figure 2: Registration form with Display Name, Email, and Password fields</div>
  </div>
</div>

<div class="section">
  <h3>8.2 Project Dashboard</h3>
  <p>Lists all projects in the workspace. Shows project name, description, fork badge, and creation date. "+ New Project" button opens inline creation form.</p>
  <div class="screenshot">
    <img src="screenshots/03-studio-projects.png" alt="Studio Project List">
    <div class="caption">Figure 3: Studio dashboard with project grid (empty state shown)</div>
  </div>
  <div class="screenshot">
    <img src="screenshots/04-new-project.png" alt="New Project Dialog">
    <div class="caption">Figure 4: New Project inline creation form</div>
  </div>
</div>

<div class="section page-break">
  <h3>8.3 Project Editor (3-Panel Layout)</h3>
  <p>The core studio interface with three panels:</p>
  <ul>
    <li><strong>Left:</strong> Shot list with status indicators, add/remove/reorder</li>
    <li><strong>Center:</strong> Preview player (video playback after render, or shot count placeholder)</li>
    <li><strong>Right:</strong> Shot editor with visual prompt, audio TTS text, duration, subtitle</li>
  </ul>
  <p>Top bar includes: back navigation, project name, credits counter, Provenance, Fork, Save, and Render buttons.</p>
  <div class="screenshot">
    <img src="screenshots/05-editor-empty.png" alt="Editor Empty State">
    <div class="caption">Figure 5: Project editor empty state &mdash; "Add shots to your timeline to get started"</div>
  </div>
  <div class="screenshot">
    <img src="screenshots/06-editor-shots.png" alt="Editor With Shots">
    <div class="caption">Figure 6: Project editor with 3 shots added, showing shot list, preview summary, and shot editor panel</div>
  </div>
</div>

<!-- ACCEPTANCE CRITERIA -->
<h2 class="page-break">9. Acceptance Criteria Status</h2>
<div class="section">
  <table>
    <tr><th>#</th><th>Criterion</th><th>Status</th><th>Evidence</th></tr>
    <tr>
      <td>1</td>
      <td><strong>Closed ecosystem enforced</strong><br>Cannot attach external files. Unknown asset IDs rejected.</td>
      <td><span class="status-badge status-complete">COMPLETE</span></td>
      <td>Mint receipt validation on commit creation. No upload endpoint exists. Integration test verifies rejection of fake asset IDs.</td>
    </tr>
    <tr>
      <td>2</td>
      <td><strong>Creation works</strong><br>User can generate 3+ shots + audio and render 30&ndash;120s mp4.</td>
      <td><span class="status-badge status-complete">COMPLETE</span></td>
      <td>Full pipeline: gen_video + gen_audio workers &rarr; asset storage &rarr; FFmpeg render &rarr; mp4 output. UI supports generate/render flow.</td>
    </tr>
    <tr>
      <td>3</td>
      <td><strong>Forking works</strong><br>Forked project preserves history. Fork can diverge and render.</td>
      <td><span class="status-badge status-complete">COMPLETE</span></td>
      <td>Fork API copies commit chain, sets parent_project_id. Integration test verifies fork + divergent commits.</td>
    </tr>
    <tr>
      <td>4</td>
      <td><strong>Provenance is complete</strong><br>Every asset has provenance_json. Render references commit + shot assets.</td>
      <td><span class="status-badge status-complete">COMPLETE</span></td>
      <td>ProvenanceManifest written on every asset creation. Render provenance includes upstream asset IDs. UI provenance panel displays metadata.</td>
    </tr>
    <tr>
      <td>5</td>
      <td><strong>Costs/credits tracked</strong><br>Immutable ledger. Project burn computable.</td>
      <td><span class="status-badge status-complete">COMPLETE</span></td>
      <td>credit_accounts + credit_ledger tables. Every job debits with ledger entry. Balance + ledger API endpoints.</td>
    </tr>
    <tr>
      <td>6</td>
      <td><strong>Jobs are reliable</strong><br>Retries don't double-charge. Idempotency enforced.</td>
      <td><span class="status-badge status-complete">COMPLETE</span></td>
      <td>idempotency_key (unique constraint) on jobs table. Duplicate submission returns existing job. Integration test verifies single debit.</td>
    </tr>
  </table>
  <p style="margin-top: 10px;"><strong>All 6 acceptance criteria are met.</strong></p>
</div>

<!-- MILESTONE STATUS -->
<h2>10. Milestone Completion</h2>
<div class="section">
  <table>
    <tr><th>Milestone</th><th>Scope</th><th>Status</th></tr>
    <tr><td><strong>M0</strong></td><td>Repo scaffolding, DB migrations, storage utils, queue setup</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M1</strong></td><td>Auth, workspaces, projects, commits, credit accounts + ledger</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M2</strong></td><td>Asset table, storage writes, mint receipt signing, provenance</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M3</strong></td><td>Job table, queue processing, idempotency, charging logic</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M4</strong></td><td>gen_video, gen_audio, gen_image stubs + safety checks</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M5</strong></td><td>FFmpeg render pipeline (concat shots &rarr; mp4)</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M6</strong></td><td>Studio UI: login, project list, timeline editor, fork dialog, provenance panel</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
    <tr><td><strong>M7</strong></td><td>Seed script + 8-test integration suite</td><td><span class="status-badge status-complete">COMPLETE</span></td></tr>
  </table>
</div>

<!-- QA -->
<h2 class="page-break">11. QA Harness</h2>
<div class="section">
  <h3>Seed Script</h3>
  <p><span class="code">apps/api/src/scripts/seed.ts</span> &mdash; Creates test data for manual QA:</p>
  <ul>
    <li>Test user: <span class="code">test@phork.ai</span> / <span class="code">testpass123</span></li>
    <li>Workspace with 5000 credits</li>
    <li>"Demo: Space Adventure" project with 3 video assets + 2 commits</li>
    <li>Proper mint receipts, provenance records, and ledger entries</li>
  </ul>

  <h3>Integration Test Suite</h3>
  <p><span class="code">apps/api/src/scripts/test-flows.ts</span> &mdash; 8 automated tests covering:</p>
  <table>
    <tr><th>#</th><th>Test</th><th>What It Verifies</th></tr>
    <tr><td>1</td><td>Health Check</td><td>/health returns 200 with status: ok</td></tr>
    <tr><td>2</td><td>Registration &amp; Auth</td><td>Register, login, /auth/me all work correctly</td></tr>
    <tr><td>3</td><td>Closed Ecosystem</td><td>Commit with fake asset ID is rejected (400)</td></tr>
    <tr><td>4</td><td>Project &amp; Commits</td><td>Create project, create commits, list commits</td></tr>
    <tr><td>5</td><td>Credits System</td><td>Balance starts at 1000, ledger endpoint works</td></tr>
    <tr><td>6</td><td>Job Idempotency</td><td>Duplicate job returns same ID, credits debited once</td></tr>
    <tr><td>7</td><td>Forking</td><td>Fork preserves history, divergent commits work</td></tr>
    <tr><td>8</td><td>Job List &amp; Status</td><td>List jobs by project, get individual job</td></tr>
  </table>
</div>

<!-- HOW TO RUN -->
<h2>12. How to Run</h2>
<div class="section">
  <h3>Prerequisites</h3>
  <ul>
    <li>Node.js 20+ (tested with v24.12.0)</li>
    <li>pnpm (installed globally)</li>
    <li>Docker (for PostgreSQL + Redis)</li>
    <li>FFmpeg (on PATH, for generation stubs and rendering)</li>
  </ul>

  <h3>Startup Commands</h3>
  <pre>
<span class="comment"># 1. Install dependencies</span>
<span class="cmd">pnpm install</span>

<span class="comment"># 2. Start infrastructure</span>
<span class="cmd">docker-compose up -d</span>          <span class="comment"># PostgreSQL 16 + Redis 7</span>

<span class="comment"># 3. Push database schema</span>
<span class="cmd">pnpm db:push</span>

<span class="comment"># 4. (Optional) Seed test data</span>
<span class="cmd">cd apps/api && npx tsx src/scripts/seed.ts</span>

<span class="comment"># 5. Start API server (Terminal 1)</span>
<span class="cmd">pnpm --filter @phork/api dev</span>

<span class="comment"># 6. Start job workers (Terminal 2)</span>
<span class="cmd">pnpm --filter @phork/api dev:worker</span>

<span class="comment"># 7. Start frontend (Terminal 3)</span>
<span class="cmd">pnpm --filter @phork/web dev</span>

<span class="comment"># 8. Run integration tests</span>
<span class="cmd">cd apps/api && npx tsx src/scripts/test-flows.ts</span>
  </pre>
</div>

<!-- NEXT STEPS -->
<h2>13. Next Steps (Post-Phase 1)</h2>
<div class="section">
  <p>The following are explicitly <strong>out of scope for Phase 1</strong> but the data model and architecture have been designed to support them:</p>
  <table>
    <tr><th>Feature</th><th>Design Readiness</th></tr>
    <tr><td>Real AI providers (Replicate, ElevenLabs, OpenAI)</td><td>Swap stub functions in <span class="code">workers/generation.ts</span>; provenance schema already supports provider/model/version</td></tr>
    <tr><td>Public publishing on phorked.ai</td><td><span class="code">visibility</span> field exists on projects (currently only 'private')</td></tr>
    <tr><td>Fork licensing enforcement</td><td><span class="code">fork_license</span> field stored (no_forks, forks_nc, forks_revshare, sharealike)</td></tr>
    <tr><td>HLS streaming</td><td>Render pipeline produces mp4; HLS packaging is an additional post-process step</td></tr>
    <tr><td>C2PA/Content Credentials</td><td>Provenance JSON captures all required source data; C2PA signing is additive</td></tr>
    <tr><td>Payment processing &amp; payouts</td><td>Credit system is in place; payment integration would extend credit_accounts</td></tr>
    <tr><td>Frame-accurate fork from timestamp</td><td>Current: fork at shot boundary. Frame-level requires timeline format extension</td></tr>
  </table>
</div>

<div class="footnote">
  <p><strong>Phork Phase 1 MVP Engineering Report</strong> &mdash; Generated ${reportDate} &mdash; Confidential / Internal Use Only</p>
</div>

</body>
</html>`;

  writeFileSync(join(OUTPUT_DIR, 'report.html'), htmlContent);
  console.log('HTML report written.');

  // Generate PDF from HTML
  const browser2 = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page2 = await browser2.newPage();
  const htmlPath = resolve(OUTPUT_DIR, 'report.html').replace(/\\/g, '/');
  await page2.goto(`file:///${htmlPath}`, { waitUntil: 'networkidle0' });

  const pdfPath = join(OUTPUT_DIR, 'Phork_Phase1_MVP_Report.pdf');
  await page2.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '40px', bottom: '40px', left: '50px', right: '50px' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%; text-align:center; font-size:8px; color:#aaa; padding: 5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });

  await browser2.close();
  console.log(`\nPDF report generated: ${pdfPath}`);
}

main().catch(err => {
  console.error('Report generation failed:', err);
  process.exit(1);
});
