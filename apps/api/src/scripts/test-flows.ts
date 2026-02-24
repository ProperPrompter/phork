/**
 * Integration test script for Phase 1 acceptance criteria.
 * Tests the core flows via API calls.
 *
 * Usage: npx tsx src/scripts/test-flows.ts
 * Requires: API server running on localhost:3001
 */

const API = process.env.API_URL || 'http://localhost:3001';

let token = '';
let workspaceId = '';
let projectId = '';
let commitId = '';

async function request(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  \u2713 ${msg}`);
}

async function testHealthCheck() {
  console.log('\n[1] Health Check');
  const { status, data } = await request('GET', '/health');
  assert(status === 200, 'Health check returns 200');
  assert(data.status === 'ok', 'Status is ok');
}

async function testRegistrationAndAuth() {
  console.log('\n[2] Registration & Authentication');

  // Register
  const email = `test-${Date.now()}@phork.ai`;
  const { status: regStatus, data: regData } = await request('POST', '/auth/register', {
    email,
    password: 'testpass123',
    displayName: 'Flow Test User',
  });
  assert(regStatus === 201, 'Registration returns 201');
  assert(!!regData.token, 'Registration returns JWT token');
  assert(!!regData.workspace.id, 'Registration creates workspace');

  token = regData.token;
  workspaceId = regData.workspace.id;

  // Login
  const { status: loginStatus, data: loginData } = await request('POST', '/auth/login', {
    email,
    password: 'testpass123',
  });
  assert(loginStatus === 200, 'Login returns 200');
  assert(!!loginData.token, 'Login returns JWT token');

  // Me
  const { status: meStatus, data: meData } = await request('GET', '/auth/me');
  assert(meStatus === 200, 'GET /auth/me returns 200');
  assert(meData.user.email === email, 'User email matches');
}

async function testClosedEcosystem() {
  console.log('\n[3] Closed Ecosystem Enforcement');

  // Create project
  const { status: projStatus, data: projData } = await request('POST', '/projects', {
    workspaceId,
    name: 'Ecosystem Test',
  });
  assert(projStatus === 201, 'Create project returns 201');
  projectId = projData.project.id;
  commitId = projData.headCommit.id;

  // Try to commit with a fake asset ID (not minted on-platform)
  const fakeAssetId = '00000000-0000-0000-0000-000000000001';
  const { status: commitStatus, data: commitData } = await request('POST', `/projects/${projectId}/commits`, {
    message: 'Try fake asset',
    snapshot: {
      timeline: [{
        shot_id: 'test-shot-1',
        visual_asset_id: fakeAssetId,
        audio_asset_id: null,
        duration_ms: 4000,
        trim_in_ms: 0,
        trim_out_ms: 4000,
        subtitle: null,
      }],
    },
  });
  assert(commitStatus === 400, 'Commit with fake asset rejected (400)');
  assert(commitData.message.includes('not found or missing mint receipt'), 'Error message mentions mint receipt');
}

async function testProjectCreationAndCommits() {
  console.log('\n[4] Project Creation & Commits');

  // Create a valid commit (empty timeline - should work)
  const { status: emptyCommitStatus } = await request('POST', `/projects/${projectId}/commits`, {
    message: 'Empty timeline commit',
    snapshot: { timeline: [] },
  });
  assert(emptyCommitStatus === 201, 'Commit with empty timeline succeeds');

  // List commits
  const { status: listStatus, data: listData } = await request('GET', `/projects/${projectId}/commits`);
  assert(listStatus === 200, 'List commits returns 200');
  assert(listData.data.length >= 2, 'At least 2 commits exist');
}

async function testCreditsSystem() {
  console.log('\n[5] Credits System');

  // Check balance
  const { status: balStatus, data: balData } = await request('GET', `/credits/balance?workspaceId=${workspaceId}`);
  assert(balStatus === 200, 'Credits balance returns 200');
  assert(typeof balData.balance === 'number', 'Balance is a number');
  assert(balData.balance === 1000, 'Starter balance is 1000');

  // Check ledger
  const { status: ledgerStatus } = await request('GET', `/credits/ledger?workspaceId=${workspaceId}`);
  assert(ledgerStatus === 200, 'Credits ledger returns 200');
}

async function testJobCreation() {
  console.log('\n[6] Job Creation & Idempotency');

  const idempotencyKey = `test-${Date.now()}`;

  // Create gen_video job
  const { status: jobStatus, data: jobData } = await request('POST', '/jobs/gen-video', {
    projectId,
    workspaceId,
    prompt: 'A beautiful sunset over the ocean',
    duration: 4000,
    idempotencyKey,
  });
  assert(jobStatus === 201, 'Create gen_video job returns 201');
  assert(!!jobData.id, 'Job has ID');
  assert(jobData.status === 'queued', 'Job is queued');

  // Test idempotency - same key should return same job
  const { status: dupStatus, data: dupData } = await request('POST', '/jobs/gen-video', {
    projectId,
    workspaceId,
    prompt: 'A beautiful sunset over the ocean',
    duration: 4000,
    idempotencyKey,
  });
  assert(dupStatus === 200, 'Duplicate job returns 200 (not 201)');
  assert(dupData.id === jobData.id, 'Same job ID returned (idempotent)');

  // Check credits were debited exactly once
  const { data: balData } = await request('GET', `/credits/balance?workspaceId=${workspaceId}`);
  assert(balData.balance === 975, 'Credits debited by 25 (gen_video cost), only once despite duplicate');
}

async function testForking() {
  console.log('\n[7] Project Forking');

  // Get current commits
  const { data: commitsData } = await request('GET', `/projects/${projectId}/commits`);
  const latestCommitId = commitsData.data[0].id;

  // Fork the project
  const { status: forkStatus, data: forkData } = await request('POST', `/projects/${projectId}/fork`, {
    fromCommitId: latestCommitId,
    name: 'Forked Project',
  });
  assert(forkStatus === 201, 'Fork returns 201');
  assert(!!forkData.project.id, 'Forked project has ID');
  assert(forkData.project.parentProjectId === projectId, 'Fork references parent project');
  assert(forkData.forkedFrom.commitId === latestCommitId, 'Fork references fork point commit');

  // Verify forked project has commits
  const { data: forkCommits } = await request('GET', `/projects/${forkData.project.id}/commits`);
  assert(forkCommits.data.length >= 1, 'Forked project has copied commits');

  // Verify we can add a new commit to the fork (divergent history)
  const { status: newCommitStatus } = await request('POST', `/projects/${forkData.project.id}/commits`, {
    message: 'Divergent commit on fork',
    snapshot: { timeline: [] },
  });
  assert(newCommitStatus === 201, 'Can create new commits on forked project');
}

async function testJobListAndStatus() {
  console.log('\n[8] Job List & Status');

  const { status: listStatus, data: listData } = await request('GET', `/jobs?projectId=${projectId}`);
  assert(listStatus === 200, 'Job list returns 200');
  assert(listData.data.length >= 1, 'At least 1 job exists');

  const jobId = listData.data[0].id;
  const { status: getStatus, data: getJobData } = await request('GET', `/jobs/${jobId}`);
  assert(getStatus === 200, 'Get job returns 200');
  assert(!!getJobData.idempotencyKey, 'Job has idempotency key');
}

// Run all tests
async function main() {
  console.log('=== Phork Phase 1 Integration Tests ===');
  console.log(`API: ${API}\n`);

  try {
    await testHealthCheck();
    await testRegistrationAndAuth();
    await testClosedEcosystem();
    await testProjectCreationAndCommits();
    await testCreditsSystem();
    await testJobCreation();
    await testForking();
    await testJobListAndStatus();

    console.log('\n=== ALL TESTS PASSED ===\n');
  } catch (err: any) {
    console.error(`\n=== TEST FAILED ===`);
    console.error(err.message);
    process.exit(1);
  }
}

main();
