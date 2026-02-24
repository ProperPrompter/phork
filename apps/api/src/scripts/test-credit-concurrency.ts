/**
 * Credit Concurrency Stress Test
 *
 * Fires N concurrent job requests against a single workspace
 * and asserts:
 *   - No negative balances
 *   - No over-spend beyond initial balance
 *   - Total debits match (initialBalance - finalBalance)
 *
 * Usage: npx tsx src/scripts/test-credit-concurrency.ts
 * Requires: API server running on localhost:3001
 */

const API = process.env.API_URL || 'http://localhost:3001';
const CONCURRENT_REQUESTS = 20; // 20 concurrent gen_audio jobs at 5 credits each = 100 credits needed

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
  console.log('=== Credit Concurrency Stress Test ===\n');
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Job type: gen_audio (5 credits each)`);
  console.log(`Max expected spend: ${CONCURRENT_REQUESTS * 5} credits\n`);

  // Register fresh user (1000 starting credits)
  console.log('--- Step 1: Register ---');
  const { data: regData } = await api('POST', '/auth/register', {
    email: `stress-${Date.now()}@phork.ai`,
    password: 'StressTest123!',
    displayName: 'Stress Test User',
  });
  assert(!!regData.token, 'Registered');
  const token = regData.token;
  const workspaceId = regData.workspace.id;
  console.log(`  workspaceId: ${workspaceId}`);
  console.log(`  starting balance: 1000`);

  // Create a project
  const { data: projData } = await api('POST', '/projects', {
    workspaceId,
    name: 'Stress Test Project',
  }, token);
  const projectId = projData.project.id;

  // Fire N concurrent requests
  console.log(`\n--- Step 2: Fire ${CONCURRENT_REQUESTS} concurrent gen_audio requests ---`);
  const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
    api('POST', '/jobs/gen-audio', {
      projectId,
      workspaceId,
      text: `Stress test audio ${i}`,
      voice: 'default',
      speed: 1.0,
      idempotencyKey: `stress-${Date.now()}-${i}`,
    }, token).then(res => ({
      index: i,
      status: res.status,
      jobId: res.data?.id,
      error: res.data?.error,
    }))
  );

  const results = await Promise.all(promises);

  // Tally results
  const created = results.filter(r => r.status === 201);
  const insufficientFunds = results.filter(r => r.status === 402);
  const errors = results.filter(r => r.status !== 201 && r.status !== 402);

  console.log(`  Created (201): ${created.length}`);
  console.log(`  Insufficient funds (402): ${insufficientFunds.length}`);
  console.log(`  Other errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`    [${e.index}] status=${e.status} error=${JSON.stringify(e.error)}`);
    }
  }

  // Check final balance
  console.log('\n--- Step 3: Verify balance ---');
  const { data: balData } = await api('GET', `/credits/balance?workspaceId=${workspaceId}`, undefined, token);
  const finalBalance = balData.balance;
  const totalSpent = created.length * 5;
  const expectedBalance = 1000 - totalSpent;

  console.log(`  Jobs created: ${created.length}`);
  console.log(`  Credits spent: ${totalSpent} (${created.length} x 5)`);
  console.log(`  Expected balance: ${expectedBalance}`);
  console.log(`  Actual balance: ${finalBalance}`);

  // Assertions
  assert(finalBalance >= 0, `Balance is non-negative (${finalBalance})`);
  assert(finalBalance === expectedBalance, `Balance matches expected (${finalBalance} === ${expectedBalance})`);
  assert(created.length + insufficientFunds.length === CONCURRENT_REQUESTS,
    `All requests resolved to either 201 or 402 (${created.length} + ${insufficientFunds.length} = ${CONCURRENT_REQUESTS})`);

  // With 1000 credits and 5 per job, max 200 jobs possible
  // With 20 concurrent requests, all should succeed (100 credits total)
  assert(created.length === CONCURRENT_REQUESTS,
    `All ${CONCURRENT_REQUESTS} jobs created (had sufficient credits for all)`);
  assert(finalBalance === 1000 - (CONCURRENT_REQUESTS * 5),
    `Final balance is exactly 1000 - ${CONCURRENT_REQUESTS * 5} = ${1000 - CONCURRENT_REQUESTS * 5}`);

  // Verify ledger consistency
  console.log('\n--- Step 4: Verify ledger consistency ---');
  const { data: ledgerData } = await api('GET', `/credits/ledger?workspaceId=${workspaceId}`, undefined, token);
  const debits = (ledgerData.data as any[]).filter((e: any) => e.delta < 0);
  const totalDebited = debits.reduce((sum: number, e: any) => sum + Math.abs(e.delta), 0);

  assert(debits.length === created.length, `Ledger has ${debits.length} debit entries = ${created.length} jobs created`);
  assert(totalDebited === totalSpent, `Total debited (${totalDebited}) matches total spent (${totalSpent})`);

  console.log('\n=== CREDIT CONCURRENCY STRESS TEST PASSED ===');
}

main().catch(err => {
  console.error('\n!!! TEST FAILED !!!');
  console.error(err.message);
  process.exit(1);
});
