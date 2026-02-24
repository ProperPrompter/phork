/**
 * Regression test for Fix #2: Job creation workspace authorization
 *
 * Proves that a user CANNOT submit jobs against a workspace they are not a member of.
 * - User A registers (gets workspace A)
 * - User B registers (gets workspace B)
 * - User A attempts POST /jobs/gen-video with workspaceId = B
 * - Assert HTTP 403 and no ledger entry for workspace B
 */

const API = process.env.API_URL || 'http://localhost:3001';

async function api(path: string, opts: any = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  console.log('=== Job Workspace Authorization Test ===\n');

  // Step 1: Register User A
  console.log('--- Step 1: Register User A ---');
  const tsA = Date.now();
  const regA = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `ws-auth-a-${tsA}@phork.ai`, password: 'testpass123', displayName: 'User A' }),
  });
  const tokenA = regA.body.token;
  const workspaceA = regA.body.workspace.id;
  console.log(`  [ok] User A registered, workspaceA: ${workspaceA}`);

  // Step 2: Register User B
  console.log('\n--- Step 2: Register User B ---');
  const regB = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `ws-auth-b-${tsA}@phork.ai`, password: 'testpass123', displayName: 'User B' }),
  });
  const tokenB = regB.body.token;
  const workspaceB = regB.body.workspace.id;
  console.log(`  [ok] User B registered, workspaceB: ${workspaceB}`);

  // Step 3: User A creates a project in workspace A (for valid projectId)
  console.log('\n--- Step 3: User A creates project in workspace A ---');
  const projA = await api('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ workspaceId: workspaceA, name: 'Auth Test Project A' }),
  });
  if (projA.status !== 201) throw new Error(`Project creation failed: ${projA.status}`);
  const projectIdA = projA.body.project.id;
  console.log(`  [ok] Project A created: ${projectIdA}`);

  // Step 4: User B creates a project in workspace B (for valid projectId)
  console.log('\n--- Step 4: User B creates project in workspace B ---');
  const projB = await api('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ workspaceId: workspaceB, name: 'Auth Test Project B' }),
  });
  if (projB.status !== 201) throw new Error(`Project creation failed: ${projB.status}`);
  const projectIdB = projB.body.project.id;
  console.log(`  [ok] Project B created: ${projectIdB}`);

  // Step 5: Check workspace B starting balance
  console.log('\n--- Step 5: Check workspace B starting balance ---');
  const balBefore = await api(`/credits/balance?workspaceId=${workspaceB}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const balanceBefore = balBefore.body.balance;
  console.log(`  Workspace B balance before: ${balanceBefore}`);

  // Step 6: User A attempts to submit job against workspace B (should fail 403)
  console.log('\n--- Step 6: User A submits job against workspace B ---');
  const attackResult = await api('/jobs/gen-video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      workspaceId: workspaceB,
      projectId: projectIdB,
      prompt: 'This should be blocked',
      idempotencyKey: `attack-${tsA}`,
    }),
  });
  console.log(`  Response status: ${attackResult.status}`);
  console.log(`  Response body: ${JSON.stringify(attackResult.body)}`);

  if (attackResult.status !== 403) {
    console.error(`  [FAIL] Expected 403, got ${attackResult.status}`);
    process.exit(1);
  }
  console.log('  [ok] HTTP 403 returned — cross-workspace job blocked');

  // Step 7: Verify no ledger entry was created for workspace B
  console.log('\n--- Step 7: Verify no ledger entry created ---');
  const ledgerB = await api(`/credits/ledger?workspaceId=${workspaceB}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const attackEntries = ledgerB.body.data.filter((e: any) => e.reason?.includes('gen_video'));
  console.log(`  gen_video ledger entries for workspace B: ${attackEntries.length}`);
  if (attackEntries.length > 0) {
    console.error('  [FAIL] Ledger entries found — workspace B was debited!');
    process.exit(1);
  }
  console.log('  [ok] No ledger entries — workspace B was NOT debited');

  // Step 8: Verify workspace B balance unchanged
  console.log('\n--- Step 8: Verify balance unchanged ---');
  const balAfter = await api(`/credits/balance?workspaceId=${workspaceB}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const balanceAfter = balAfter.body.balance;
  console.log(`  Workspace B balance after: ${balanceAfter}`);
  if (balanceAfter !== balanceBefore) {
    console.error(`  [FAIL] Balance changed from ${balanceBefore} to ${balanceAfter}`);
    process.exit(1);
  }
  console.log('  [ok] Balance unchanged');

  // Step 9: Verify User A can still submit jobs to their OWN workspace
  console.log('\n--- Step 9: Verify User A can submit to own workspace ---');
  const legitimateJob = await api('/jobs/gen-video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      workspaceId: workspaceA,
      projectId: projectIdA,
      prompt: 'This is a legitimate job in my own workspace',
      idempotencyKey: `legit-${tsA}`,
    }),
  });
  if (legitimateJob.status !== 201) {
    console.error(`  [FAIL] Legitimate job returned ${legitimateJob.status}`);
    process.exit(1);
  }
  console.log(`  [ok] Legitimate job created (201), jobId: ${legitimateJob.body.id}`);

  console.log('\n=== JOB WORKSPACE AUTHORIZATION TEST PASSED ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
