/**
 * Cross-Workspace Idempotency Test
 *
 * Proves that idempotency keys are scoped per-workspace:
 * - Workspace A creates a job with key "shared-key"
 * - Workspace B creates a job with the SAME key "shared-key"
 * - Both succeed independently (different job IDs)
 * - Neither workspace receives the other's job
 *
 * Usage: npx tsx src/scripts/test-cross-workspace-idempotency.ts
 * Requires: API server running on localhost:3001
 */

const API = process.env.API_URL || 'http://localhost:3001';

async function api(method: string, path: string, body?: any, authToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  [ok] ${msg}`);
}

async function main() {
  console.log('=== Cross-Workspace Idempotency Test ===\n');

  const sharedIdempotencyKey = `shared-key-${Date.now()}`;

  // ── Register User A (creates workspace A) ──
  console.log('--- Step 1: Register User A ---');
  const { data: userA } = await api('POST', '/auth/register', {
    email: `ws-a-${Date.now()}@phork.ai`,
    password: 'TestPass123!',
    displayName: 'User A',
  });
  assert(!!userA.token, 'User A registered');
  const tokenA = userA.token;
  const workspaceA = userA.workspace.id;
  console.log(`  workspaceA: ${workspaceA}`);

  // ── Register User B (creates workspace B) ──
  console.log('\n--- Step 2: Register User B ---');
  const { data: userB } = await api('POST', '/auth/register', {
    email: `ws-b-${Date.now()}@phork.ai`,
    password: 'TestPass123!',
    displayName: 'User B',
  });
  assert(!!userB.token, 'User B registered');
  const tokenB = userB.token;
  const workspaceB = userB.workspace.id;
  console.log(`  workspaceB: ${workspaceB}`);

  assert(workspaceA !== workspaceB, 'Workspaces are different');

  // ── Create projects in each workspace ──
  console.log('\n--- Step 3: Create projects ---');
  const { data: projA } = await api('POST', '/projects', {
    workspaceId: workspaceA,
    name: 'Workspace A Project',
  }, tokenA);
  assert(!!projA.project?.id, 'Project A created');

  const { data: projB } = await api('POST', '/projects', {
    workspaceId: workspaceB,
    name: 'Workspace B Project',
  }, tokenB);
  assert(!!projB.project?.id, 'Project B created');

  // ── Workspace A creates a job with the shared key ──
  console.log('\n--- Step 4: Workspace A creates job with shared key ---');
  const { status: statusA, data: jobA } = await api('POST', '/jobs/gen-video', {
    projectId: projA.project.id,
    workspaceId: workspaceA,
    prompt: 'Workspace A video prompt',
    duration: 4000,
    idempotencyKey: sharedIdempotencyKey,
  }, tokenA);
  assert(statusA === 201, `Workspace A job created (status ${statusA})`);
  console.log(`  jobA.id: ${jobA.id}`);
  console.log(`  jobA.workspaceId: ${jobA.workspaceId}`);

  // ── Workspace B creates a job with the SAME key ──
  console.log('\n--- Step 5: Workspace B creates job with SAME key ---');
  const { status: statusB, data: jobB } = await api('POST', '/jobs/gen-video', {
    projectId: projB.project.id,
    workspaceId: workspaceB,
    prompt: 'Workspace B video prompt',
    duration: 4000,
    idempotencyKey: sharedIdempotencyKey,
  }, tokenB);
  assert(statusB === 201, `Workspace B job also created (status ${statusB}, NOT 200)`);
  console.log(`  jobB.id: ${jobB.id}`);
  console.log(`  jobB.workspaceId: ${jobB.workspaceId}`);

  // ── Verify independence ──
  console.log('\n--- Step 6: Verify independence ---');
  assert(jobA.id !== jobB.id, 'Job IDs are different (no cross-tenant leak)');
  assert(jobA.workspaceId === workspaceA, 'Job A belongs to workspace A');
  assert(jobB.workspaceId === workspaceB, 'Job B belongs to workspace B');

  // ── Verify retry within same workspace still works ──
  console.log('\n--- Step 7: Verify intra-workspace idempotency still works ---');
  const { status: retryStatus, data: retryData } = await api('POST', '/jobs/gen-video', {
    projectId: projA.project.id,
    workspaceId: workspaceA,
    prompt: 'Workspace A video prompt',
    duration: 4000,
    idempotencyKey: sharedIdempotencyKey,
  }, tokenA);
  assert(retryStatus === 200, `Workspace A retry returns 200 (idempotent)`);
  assert(retryData.id === jobA.id, 'Workspace A retry returns same job ID');

  // ── Check credits ──
  console.log('\n--- Step 8: Verify credits ---');
  const { data: balA } = await api('GET', `/credits/balance?workspaceId=${workspaceA}`, undefined, tokenA);
  const { data: balB } = await api('GET', `/credits/balance?workspaceId=${workspaceB}`, undefined, tokenB);
  assert(balA.balance === 975, `Workspace A debited once (balance: ${balA.balance})`);
  assert(balB.balance === 975, `Workspace B debited once (balance: ${balB.balance})`);

  console.log('\n=== CROSS-WORKSPACE IDEMPOTENCY TEST PASSED ===');
}

main().catch(err => {
  console.error('\n!!! TEST FAILED !!!');
  console.error(err.message);
  process.exit(1);
});
