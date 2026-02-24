/**
 * Phork Phase 1 -- End-to-End Demo Script
 *
 * Exercises every major flow against a LIVE API + worker stack,
 * then connects directly to Postgres to print DB evidence queries.
 *
 * Usage:
 *   npx tsx src/scripts/e2e-demo.ts
 *
 * Prerequisites:
 *   - API server running        (npm run dev)
 *   - Worker running             (npm run dev:worker)
 *   - Postgres + Redis available (docker-compose up -d)
 */

import postgres from 'postgres';

// ── Configuration ──────────────────────────────────────────────────────────

const API_URL = process.env.API_URL || 'http://localhost:3001';
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://phork:phork@localhost:5432/phork';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000; // 2 minutes max per job

// ── Helpers ────────────────────────────────────────────────────────────────

let token = '';
let workspaceId = '';

function ts(): string {
  return new Date().toISOString();
}

function separator(title: string) {
  console.log(`\n--- ${title} ---`);
}

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  console.log(`  [ok] ${msg}`);
}

async function pollJob(
  jobId: string,
  label: string,
): Promise<Record<string, any>> {
  const start = Date.now();
  console.log(`  Polling ${label} (job ${jobId}) ...`);
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const { data } = await api('GET', `/jobs/${jobId}`);
    if (data.status === 'succeeded') {
      console.log(`  [ok] ${label} succeeded (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      return data;
    }
    if (data.status === 'failed' || data.status === 'blocked') {
      throw new Error(
        `${label} ${data.status}: ${JSON.stringify(data.error)}`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${label} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Collected IDs (filled during the run) ──────────────────────────────────

let userId = '';
let originalProjectId = '';
let originalHeadCommitId = '';
let forkedProjectId = '';
let forkedHeadCommitId = '';
const videoAssetIds: string[] = [];
let audioAssetId = '';
let commitWithShotsId = '';
let renderJobId = '';
let renderAssetStoragePath = '';
let forkRenderAssetStoragePath = '';
const allJobIds: string[] = [];

// ── Steps ──────────────────────────────────────────────────────────────────

async function step1_register(): Promise<void> {
  separator('Step 1: Register');
  const email = `e2e-demo-${Date.now()}@phork.ai`;
  const password = 'DemoPass!2024';
  const { status, data } = await api('POST', '/auth/register', {
    email,
    password,
    displayName: 'E2E Demo User',
  });
  assert(status === 201, `Register returned ${status}`);
  assert(!!data.token, 'Got JWT token');
  assert(!!data.workspace?.id, 'Got workspace');

  token = data.token;
  workspaceId = data.workspace.id;
  userId = data.user.id;

  console.log(`  email       : ${email}`);
  console.log(`  userId      : ${userId}`);
  console.log(`  workspaceId : ${workspaceId}`);
}

async function step2_login(): Promise<void> {
  separator('Step 2: Login');
  // Already have token from register; verify /me works
  const { status, data } = await api('GET', '/auth/me');
  assert(status === 200, '/auth/me returns 200');
  assert(data.user.id === userId, 'Token resolves to correct user');
  console.log(`  Authenticated as ${data.user.displayName}`);
}

async function step3_createProject(): Promise<void> {
  separator('Step 3: Create Project "E2E Demo: City at Night"');
  const { status, data } = await api('POST', '/projects', {
    workspaceId,
    name: 'E2E Demo: City at Night',
    description: 'Automated end-to-end demo project',
  });
  assert(status === 201, `Create project returned ${status}`);
  originalProjectId = data.project.id;
  originalHeadCommitId = data.headCommit.id; // initial empty commit
  console.log(`  projectId : ${originalProjectId}`);
  console.log(`  initCommit: ${originalHeadCommitId}`);
}

async function step4_generateVideos(): Promise<void> {
  separator('Step 4: Generate 3 Shot Videos');

  const prompts = [
    'A neon-lit city skyline at midnight with rain reflections on wet streets, cinematic wide angle',
    'A close-up of a jazz musician playing saxophone on a dimly lit street corner, warm lighting',
    'An aerial drone shot flying over a bustling night market with colorful lanterns, smooth motion',
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`  Shot ${i + 1}: submitting gen_video ...`);
    const { status, data } = await api('POST', '/jobs/gen-video', {
      projectId: originalProjectId,
      workspaceId,
      prompt: prompts[i],
      duration: 4000,
    });
    assert(
      status === 201,
      `gen_video shot ${i + 1} returned ${status}`,
    );
    allJobIds.push(data.id);
    console.log(`    jobId: ${data.id}`);
  }

  // Poll all 3 in parallel
  const results = await Promise.all(
    allJobIds.slice(0, 3).map((id, i) => pollJob(id, `Shot ${i + 1} gen_video`)),
  );

  for (const r of results) {
    const result = r.result as any;
    videoAssetIds.push(result.assetId);
    console.log(`    assetId: ${result.assetId}`);
  }
  assert(videoAssetIds.length === 3, 'All 3 video assets produced');
}

async function step5_generateAudio(): Promise<void> {
  separator('Step 5: Generate Audio for Shot 1');
  const { status, data } = await api('POST', '/jobs/gen-audio', {
    projectId: originalProjectId,
    workspaceId,
    text: 'The city never sleeps. Neon lights paint the wet pavement in shimmering colors as music drifts from every corner.',
    voice: 'default',
    speed: 1.0,
  });
  assert(status === 201, `gen_audio returned ${status}`);
  allJobIds.push(data.id);

  const result = await pollJob(data.id, 'Shot 1 gen_audio');
  audioAssetId = (result.result as any).assetId;
  console.log(`  audioAssetId: ${audioAssetId}`);
}

async function step6_createCommit(): Promise<void> {
  separator('Step 6: Create Commit (3 shots, audio on shot 1)');
  const snapshot = {
    timeline: videoAssetIds.map((vid, i) => ({
      shot_id: `shot-${i + 1}`,
      visual_asset_id: vid,
      audio_asset_id: i === 0 ? audioAssetId : null,
      duration_ms: 4000,
      trim_in_ms: 0,
      trim_out_ms: 4000,
      subtitle: i === 0
        ? 'The city never sleeps.'
        : i === 1
          ? 'Jazz fills the air.'
          : 'Lanterns glow overhead.',
    })),
  };

  const { status, data } = await api(
    'POST',
    `/projects/${originalProjectId}/commits`,
    {
      message: 'Add 3 shots with audio on shot 1',
      snapshot,
    },
  );
  assert(status === 201, `Commit returned ${status}`);
  commitWithShotsId = data.id;
  originalHeadCommitId = data.id;
  console.log(`  commitId: ${commitWithShotsId}`);
}

async function step7_render(): Promise<void> {
  separator('Step 7: Render Project');
  const { status, data } = await api('POST', '/jobs/render', {
    projectId: originalProjectId,
    workspaceId,
    commitId: commitWithShotsId,
  });
  assert(status === 201, `Render returned ${status}`);
  renderJobId = data.id;
  allJobIds.push(data.id);

  const result = await pollJob(data.id, 'Render');
  renderAssetStoragePath = (result.result as any).assetId;
  console.log(`  renderAssetId: ${renderAssetStoragePath}`);
}

async function step8_closedEcosystem(): Promise<void> {
  separator('Step 8: Closed Ecosystem Enforcement');
  const fakeAssetId = '00000000-0000-0000-0000-ffffffffffff';
  const { status, data } = await api(
    'POST',
    `/projects/${originalProjectId}/commits`,
    {
      message: 'Should fail -- fake asset',
      snapshot: {
        timeline: [
          {
            shot_id: 'fake-shot',
            visual_asset_id: fakeAssetId,
            audio_asset_id: null,
            duration_ms: 4000,
            trim_in_ms: 0,
            trim_out_ms: 4000,
            subtitle: null,
          },
        ],
      },
    },
  );
  assert(status === 400, `Fake-asset commit rejected with ${status}`);
  assert(
    data.message.includes('not found or missing mint receipt'),
    'Error message mentions mint receipt',
  );
  console.log(`  Correctly rejected: ${data.message}`);
}

async function step9_idempotency(): Promise<void> {
  separator('Step 9: Idempotency');
  const idempotencyKey = `e2e-render-idempotent-${Date.now()}`;

  // First submit
  const { status: s1, data: d1 } = await api('POST', '/jobs/render', {
    projectId: originalProjectId,
    workspaceId,
    commitId: commitWithShotsId,
    idempotencyKey,
  });
  assert(s1 === 201, `First render submit returned ${s1}`);
  const firstJobId = d1.id;
  allJobIds.push(firstJobId);

  // Duplicate submit with same key
  const { status: s2, data: d2 } = await api('POST', '/jobs/render', {
    projectId: originalProjectId,
    workspaceId,
    commitId: commitWithShotsId,
    idempotencyKey,
  });
  assert(s2 === 200, `Duplicate submit returned ${s2} (200, not 201)`);
  assert(d2.id === firstJobId, 'Same job ID returned on duplicate');

  // Verify single debit: count ledger entries for this job
  const { data: ledger } = await api(
    'GET',
    `/credits/ledger?workspaceId=${workspaceId}`,
  );
  const debitsForJob = (ledger.data as any[]).filter(
    (e: any) => e.jobId === firstJobId && e.delta < 0,
  );
  assert(debitsForJob.length === 1, `Single debit for idempotent job (found ${debitsForJob.length})`);
  console.log(`  jobId: ${firstJobId} -- single ledger debit confirmed`);

  // Poll this render too so it completes cleanly
  await pollJob(firstJobId, 'Idempotent render');
}

async function step10_fork(): Promise<void> {
  separator('Step 10: Fork Project from Earlier Commit');

  // Use the initial (empty) commit as fork point -- one commit before the shots
  const { data: commits } = await api(
    'GET',
    `/projects/${originalProjectId}/commits`,
  );
  // commits.data is ordered DESC by created_at; pick the second-to-last (earliest non-root)
  // We want the commit with shots (the latest real commit) to fork from
  const allCommits = (commits.data as any[]).sort(
    (a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  // Fork from the commit that has 3 shots (commitWithShotsId)
  const forkPointCommitId = commitWithShotsId;

  const { status, data } = await api(
    'POST',
    `/projects/${originalProjectId}/fork`,
    {
      fromCommitId: forkPointCommitId,
      name: 'E2E Demo: City at Night (Director\'s Cut)',
    },
  );
  assert(status === 201, `Fork returned ${status}`);
  forkedProjectId = data.project.id;
  forkedHeadCommitId = data.headCommitId;
  console.log(`  forkedProjectId : ${forkedProjectId}`);
  console.log(`  forkedHeadCommit: ${forkedHeadCommitId}`);
  console.log(`  forkedFrom      : project ${originalProjectId}, commit ${forkPointCommitId}`);
}

async function step11_forkDiverge(): Promise<void> {
  separator('Step 11: Diverge Fork (new shot 2, re-render)');

  // Generate a replacement video for shot 2 on the forked project
  const { status: genStatus, data: genData } = await api(
    'POST',
    '/jobs/gen-video',
    {
      projectId: forkedProjectId,
      workspaceId,
      prompt:
        'A close-up of a breakdancer performing under a neon bridge, slow-motion urban energy',
      duration: 4000,
    },
  );
  assert(genStatus === 201, `Fork shot 2 gen_video returned ${genStatus}`);
  allJobIds.push(genData.id);

  const genResult = await pollJob(genData.id, 'Fork shot 2 gen_video');
  const newShot2AssetId = (genResult.result as any).assetId;
  console.log(`  newShot2AssetId: ${newShot2AssetId}`);

  // Create new commit on fork with changed shot 2
  const newSnapshot = {
    timeline: [
      {
        shot_id: 'shot-1',
        visual_asset_id: videoAssetIds[0],
        audio_asset_id: audioAssetId,
        duration_ms: 4000,
        trim_in_ms: 0,
        trim_out_ms: 4000,
        subtitle: 'The city never sleeps.',
      },
      {
        shot_id: 'shot-2-remix',
        visual_asset_id: newShot2AssetId,
        audio_asset_id: null,
        duration_ms: 4000,
        trim_in_ms: 0,
        trim_out_ms: 4000,
        subtitle: 'Breaking under neon lights.',
      },
      {
        shot_id: 'shot-3',
        visual_asset_id: videoAssetIds[2],
        audio_asset_id: null,
        duration_ms: 4000,
        trim_in_ms: 0,
        trim_out_ms: 4000,
        subtitle: 'Lanterns glow overhead.',
      },
    ],
  };

  const { status: cStatus, data: cData } = await api(
    'POST',
    `/projects/${forkedProjectId}/commits`,
    {
      message: 'Replace shot 2 with breakdancer on fork',
      snapshot: newSnapshot,
    },
  );
  assert(cStatus === 201, `Fork commit returned ${cStatus}`);
  forkedHeadCommitId = cData.id;
  console.log(`  forkCommitId: ${forkedHeadCommitId}`);

  // Render forked project
  const { status: rStatus, data: rData } = await api('POST', '/jobs/render', {
    projectId: forkedProjectId,
    workspaceId,
    commitId: forkedHeadCommitId,
  });
  assert(rStatus === 201, `Fork render returned ${rStatus}`);
  allJobIds.push(rData.id);

  const renderResult = await pollJob(rData.id, 'Fork render');
  forkRenderAssetStoragePath = (renderResult.result as any).assetId;
  console.log(`  forkRenderAssetId: ${forkRenderAssetStoragePath}`);
}

async function step12_verifyForkIndependence(): Promise<void> {
  separator('Step 12: Verify Fork Independence');

  // Re-fetch original project head
  const { data: origData } = await api(
    'GET',
    `/projects/${originalProjectId}`,
  );
  const origHead = origData.headCommit;

  assert(
    origHead.id === originalHeadCommitId,
    `Original head unchanged (${origHead.id})`,
  );

  // Verify original snapshot still has the original shot 2
  const origTimeline = (origHead.snapshot as any).timeline;
  assert(origTimeline.length === 3, 'Original still has 3 shots');
  assert(
    origTimeline[1].visual_asset_id === videoAssetIds[1],
    'Original shot 2 asset unchanged',
  );

  // Re-fetch fork head
  const { data: forkData } = await api(
    'GET',
    `/projects/${forkedProjectId}`,
  );
  const forkHead = forkData.headCommit;
  const forkTimeline = (forkHead.snapshot as any).timeline;
  assert(forkTimeline.length === 3, 'Fork has 3 shots');
  assert(
    forkTimeline[1].visual_asset_id !== videoAssetIds[1],
    'Fork shot 2 is different from original',
  );

  console.log('  Original and fork are fully independent.');
}

// ── DB Evidence Queries ────────────────────────────────────────────────────

async function dbEvidence(): Promise<void> {
  console.log('\n\n=== DB EVIDENCE ===');
  const sql = postgres(DATABASE_URL);

  try {
    // --- Assets (mint + provenance) ---
    separator('Assets (mint + provenance)');

    const assetRows = await sql`
      SELECT id, workspace_id, type, storage_url,
             mint_receipt_sig IS NOT NULL AS has_receipt
        FROM assets
       ORDER BY created_at DESC
       LIMIT 10
    `;
    console.table(assetRows);

    const provenanceRows = await sql`
      SELECT id,
             (provenance->>'provider')          AS provider,
             (provenance->>'model')             AS model,
             (provenance->'cost'->>'credits_charged') AS credits
        FROM assets
       ORDER BY created_at DESC
       LIMIT 10
    `;
    console.table(provenanceRows);

    // --- Commits (fork proof) ---
    separator('Commits (fork proof)');

    const commitRows = await sql`
      SELECT id, project_id, parent_commit_id, created_at
        FROM commits
       WHERE project_id IN (${originalProjectId}, ${forkedProjectId})
       ORDER BY created_at
    `;
    console.table(commitRows);

    // --- Credits Ledger ---
    separator('Credits Ledger');

    const ledgerRows = await sql`
      SELECT id, job_id, delta, reason, created_at
        FROM credit_ledger
       WHERE workspace_id = ${workspaceId}
       ORDER BY created_at DESC
       LIMIT 30
    `;
    console.table(ledgerRows);

    // --- Jobs ---
    separator('Jobs');

    const jobRows = await sql`
      SELECT id, type, status, idempotency_key, created_at, updated_at
        FROM jobs
       WHERE project_id IN (${originalProjectId}, ${forkedProjectId})
       ORDER BY created_at
    `;
    console.table(jobRows);

    // ── Summary stats ──

    console.log('\n\n=== SUMMARY ===');

    const [{ count: totalAssets }] = await sql`
      SELECT count(*)::int AS count FROM assets WHERE workspace_id = ${workspaceId}
    `;

    const [{ total_spent }] = await sql`
      SELECT COALESCE(SUM(ABS(delta)), 0)::int AS total_spent
        FROM credit_ledger
       WHERE workspace_id = ${workspaceId}
         AND delta < 0
    `;

    const [{ balance: finalBalance }] = await sql`
      SELECT balance FROM credit_accounts WHERE workspace_id = ${workspaceId}
    `;

    // Get render storage paths
    const renderAssets = await sql`
      SELECT storage_url FROM assets
       WHERE workspace_id = ${workspaceId} AND type = 'render'
       ORDER BY created_at DESC
       LIMIT 5
    `;

    console.log(`  Total assets created     : ${totalAssets}`);
    console.log(`  Total credits spent      : ${total_spent}`);
    console.log(`  Final credit balance     : ${finalBalance}`);
    console.log(`  Original project ID      : ${originalProjectId}`);
    console.log(`  Original head commit     : ${originalHeadCommitId}`);
    console.log(`  Forked project ID        : ${forkedProjectId}`);
    console.log(`  Forked head commit       : ${forkedHeadCommitId}`);
    console.log(`  Rendered MP4 files       :`);
    for (const r of renderAssets) {
      console.log(`    - ${r.storage_url}`);
    }

    // ── JSON dump of created records ──

    separator('JSON Dump of Created Records');

    const allAssets = await sql`
      SELECT * FROM assets WHERE workspace_id = ${workspaceId} ORDER BY created_at
    `;
    const allJobs = await sql`
      SELECT * FROM jobs WHERE project_id IN (${originalProjectId}, ${forkedProjectId}) ORDER BY created_at
    `;
    const allCommits = await sql`
      SELECT * FROM commits WHERE project_id IN (${originalProjectId}, ${forkedProjectId}) ORDER BY created_at
    `;
    const allLedger = await sql`
      SELECT * FROM credit_ledger WHERE workspace_id = ${workspaceId} ORDER BY created_at
    `;

    const dump = {
      assets: allAssets,
      jobs: allJobs,
      commits: allCommits,
      credit_ledger: allLedger,
    };

    console.log(JSON.stringify(dump, null, 2));
  } finally {
    await sql.end();
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== PHORK PHASE 1 E2E DEMO ===');
  console.log(`[${ts()}]`);
  console.log(`API: ${API_URL}`);
  console.log(`DB : ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

  try {
    // Core flow
    await step1_register();
    await step2_login();
    await step3_createProject();
    await step4_generateVideos();
    await step5_generateAudio();
    await step6_createCommit();
    await step7_render();

    // Enforcement & invariants
    await step8_closedEcosystem();
    await step9_idempotency();

    // Fork flow
    await step10_fork();
    await step11_forkDiverge();
    await step12_verifyForkIndependence();

    // DB evidence
    await dbEvidence();

    console.log('\n\n=== E2E DEMO COMPLETE ===');
    console.log(`[${ts()}]`);
  } catch (err: any) {
    console.error('\n\n!!! E2E DEMO FAILED !!!');
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
}

main();
