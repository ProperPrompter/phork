/**
 * Regression test for Fix #3: Cross-workspace asset rejection on commits
 *
 * Proves that commit creation rejects REAL minted assets from a different workspace.
 * - Workspace A generates a real asset (gen_video → succeeded → has mint receipt)
 * - Workspace B creates a project
 * - Workspace B tries to commit referencing workspace A's asset ID
 * - Assert rejection (403) and no commit created
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

async function pollJob(jobId: string, token: string, maxWait = 30000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const { body } = await api(`/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (body.status === 'succeeded' || body.status === 'failed' || body.status === 'blocked') return body;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Job ${jobId} did not complete within ${maxWait}ms`);
}

async function main() {
  console.log('=== Cross-Workspace Asset Rejection Test ===\n');

  const ts = Date.now();

  // Step 1: Register User A
  console.log('--- Step 1: Register User A ---');
  const regA = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `asset-test-a-${ts}@phork.ai`, password: 'testpass123', displayName: 'User A' }),
  });
  const tokenA = regA.body.token;
  const workspaceA = regA.body.workspace.id;
  console.log(`  [ok] User A registered, workspaceA: ${workspaceA}`);

  // Step 2: Register User B
  console.log('\n--- Step 2: Register User B ---');
  const regB = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `asset-test-b-${ts}@phork.ai`, password: 'testpass123', displayName: 'User B' }),
  });
  const tokenB = regB.body.token;
  const workspaceB = regB.body.workspace.id;
  console.log(`  [ok] User B registered, workspaceB: ${workspaceB}`);

  // Step 3: User A creates project and generates a real asset
  console.log('\n--- Step 3: User A generates a real asset ---');
  const projA = await api('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ workspaceId: workspaceA, name: 'Asset Source Project' }),
  });
  const projectIdA = projA.body.project.id;

  const jobA = await api('/jobs/gen-video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      workspaceId: workspaceA,
      projectId: projectIdA,
      prompt: 'Test video for cross-workspace asset test',
      idempotencyKey: `xw-asset-${ts}`,
    }),
  });
  if (jobA.status !== 201) throw new Error(`Job creation failed: ${jobA.status}`);
  const jobIdA = jobA.body.id;
  console.log(`  Job submitted: ${jobIdA}`);

  // Poll for completion
  const completedJob = await pollJob(jobIdA, tokenA);
  if (completedJob.status !== 'succeeded') throw new Error(`Job failed: ${completedJob.status}`);
  const assetIdA = completedJob.result.assetId;
  console.log(`  [ok] Asset generated: ${assetIdA} (belongs to workspace A)`);

  // Step 4: Verify the asset exists and has a mint receipt
  console.log('\n--- Step 4: Verify asset has mint receipt ---');
  const assetInfo = await api(`/assets/${assetIdA}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (assetInfo.status !== 200) throw new Error(`Asset lookup failed: ${assetInfo.status}`);
  console.log(`  [ok] Asset exists, workspace_id: ${assetInfo.body.workspaceId}`);
  console.log(`  [ok] Has mint receipt: ${!!assetInfo.body.mintReceiptSig}`);

  // Step 5: User B creates their own project
  console.log('\n--- Step 5: User B creates project in workspace B ---');
  const projB = await api('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ workspaceId: workspaceB, name: 'Asset Thief Project' }),
  });
  if (projB.status !== 201) throw new Error(`Project B creation failed: ${projB.status}`);
  const projectIdB = projB.body.project.id;
  const initCommitB = projB.body.headCommit.id;
  console.log(`  [ok] Project B created: ${projectIdB}`);

  // Step 6: User B tries to commit referencing User A's asset
  console.log('\n--- Step 6: User B commits with workspace A\'s asset ---');
  const attackCommit = await api(`/projects/${projectIdB}/commits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      parentCommitId: initCommitB,
      message: 'Stealing asset from workspace A',
      snapshot: {
        timeline: [{
          shot_id: 'stolen-shot-1',
          visual_asset_id: assetIdA,  // <-- Asset from workspace A!
          audio_asset_id: null,
          duration_ms: 4000,
          trim_in_ms: 0,
          trim_out_ms: 4000,
          subtitle: 'This should be rejected',
        }],
      },
    }),
  });

  console.log(`  Response status: ${attackCommit.status}`);
  console.log(`  Response body: ${JSON.stringify(attackCommit.body)}`);

  if (attackCommit.status !== 403) {
    console.error(`  [FAIL] Expected 403, got ${attackCommit.status}`);
    process.exit(1);
  }
  console.log('  [ok] HTTP 403 returned — cross-workspace asset reference blocked');
  if (attackCommit.body?.message?.includes('different workspace')) {
    console.log(`  [ok] Error message: "${attackCommit.body.message}"`);
  }

  // Step 7: Verify no commit was created beyond the initial
  console.log('\n--- Step 7: Verify no extra commit created ---');
  const commitsB = await api(`/projects/${projectIdB}/commits`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const commitCount = commitsB.body.data.length;
  console.log(`  Commits in project B: ${commitCount}`);
  if (commitCount !== 1) {
    console.error(`  [FAIL] Expected 1 commit (initial only), got ${commitCount}`);
    process.exit(1);
  }
  console.log('  [ok] Only initial commit exists — no stolen-asset commit created');

  // Step 8: Verify User B CAN commit with their own assets
  console.log('\n--- Step 8: User B generates own asset and commits ---');
  const jobB = await api('/jobs/gen-video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      workspaceId: workspaceB,
      projectId: projectIdB,
      prompt: 'Legitimate video in my own workspace',
      idempotencyKey: `legit-b-${ts}`,
    }),
  });
  if (jobB.status !== 201) throw new Error(`Job B creation failed: ${jobB.status}`);
  const completedJobB = await pollJob(jobB.body.id, tokenB);
  if (completedJobB.status !== 'succeeded') throw new Error(`Job B failed: ${completedJobB.status}`);
  const assetIdB = completedJobB.result.assetId;
  console.log(`  [ok] User B generated own asset: ${assetIdB}`);

  const legitimateCommit = await api(`/projects/${projectIdB}/commits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      parentCommitId: initCommitB,
      message: 'Legitimate commit with own asset',
      snapshot: {
        timeline: [{
          shot_id: 'my-shot-1',
          visual_asset_id: assetIdB,
          audio_asset_id: null,
          duration_ms: 4000,
          trim_in_ms: 0,
          trim_out_ms: 4000,
          subtitle: 'My own asset',
        }],
      },
    }),
  });
  if (legitimateCommit.status !== 201) {
    console.error(`  [FAIL] Legitimate commit returned ${legitimateCommit.status}`);
    process.exit(1);
  }
  console.log('  [ok] Legitimate commit with own asset succeeded (201)');

  console.log('\n=== CROSS-WORKSPACE ASSET REJECTION TEST PASSED ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
