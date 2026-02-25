/**
 * Test: Templates — project scaffolding from templates
 * Usage: npx tsx apps/api/src/scripts/test-templates.ts
 */

const API = process.env.API_URL || 'http://localhost:3001';
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

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
  console.log('\n=== Test: Templates ===\n');

  // 1. Register user
  const email = `tmpl-${Date.now()}@test.phork.ai`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'testpass123', displayName: 'Template Tester' }),
  });
  assert(reg.status === 201, 'Register user');
  const token = reg.body.token;
  const workspaceId = reg.body.workspace.id;
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // 2. Fetch templates
  console.log('\n--- Step 1: Fetch templates ---');
  const tpl = await api('/projects/templates', { ...auth });
  assert(tpl.status === 200, `GET /projects/templates returns 200`);
  assert(tpl.body.data.length === 2, `Two templates available`);
  const forkableShort = tpl.body.data.find((t: any) => t.id === 'forkable-short');
  const episodeStarter = tpl.body.data.find((t: any) => t.id === 'episode-starter');
  assert(!!forkableShort, 'Forkable Short template exists');
  assert(!!episodeStarter, 'Episode Starter template exists');
  assert(forkableShort.shots.length === 3, 'Forkable Short has 3 shots');
  assert(episodeStarter.shots.length === 8, 'Episode Starter has 8 shots');

  // 3. Create from Forkable Short
  console.log('\n--- Step 2: Create from Forkable Short ---');
  const p1 = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, name: 'My Forkable Short', templateId: 'forkable-short' }),
    ...auth,
  });
  assert(p1.status === 201, 'Create project from forkable-short template');
  const snap1 = p1.body.headCommit?.snapshot;
  assert(snap1?.timeline?.length === 3, `Initial commit has 3 shots (got ${snap1?.timeline?.length})`);
  assert(snap1?.timeline?.[0]?.duration_ms === 3000, 'Shot 1 duration is 3000ms');
  assert(snap1?.timeline?.[1]?.duration_ms === 5000, 'Shot 2 duration is 5000ms');
  assert(snap1?.timeline?.[2]?.duration_ms === 2000, 'Shot 3 duration is 2000ms');
  assert(snap1?.timeline?.[0]?.visual_asset_id === null, 'Shot 1 visual is null (placeholder)');

  // 4. Create from Episode Starter
  console.log('\n--- Step 3: Create from Episode Starter ---');
  const p2 = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, name: 'My Episode', templateId: 'episode-starter' }),
    ...auth,
  });
  assert(p2.status === 201, 'Create project from episode-starter template');
  const snap2 = p2.body.headCommit?.snapshot;
  assert(snap2?.timeline?.length === 8, `Initial commit has 8 shots (got ${snap2?.timeline?.length})`);
  assert(snap2?.timeline?.[0]?.duration_ms === 4000, 'Cold Open is 4000ms');
  assert(snap2?.timeline?.[5]?.duration_ms === 6000, 'Climax is 6000ms');
  assert(snap2?.timeline?.[7]?.shot_id === 'shot-008', 'Last shot ID is shot-008');

  // 5. Create blank project (no template)
  console.log('\n--- Step 4: Blank project (no template) ---');
  const p3 = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, name: 'Blank' }),
    ...auth,
  });
  assert(p3.status === 201, 'Create blank project');
  const snap3 = p3.body.headCommit?.snapshot;
  assert(snap3?.timeline?.length === 0, 'Blank project has empty timeline');

  // 6. Invalid template
  console.log('\n--- Step 5: Invalid template ---');
  const p4 = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, name: 'Bad', templateId: 'nonexistent' }),
    ...auth,
  });
  assert(p4.status === 400, 'Invalid template returns 400');

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Templates test: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
