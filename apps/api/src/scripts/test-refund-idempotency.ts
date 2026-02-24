/**
 * Refund Idempotency Test
 *
 * Proves that calling refundJob() multiple times for the same job
 * results in exactly ONE refund ledger entry and ONE balance credit.
 *
 * This test uses direct DB access (not API) to simulate the scenario
 * where a worker retries and calls refundJob() multiple times.
 *
 * Usage: npx tsx src/scripts/test-refund-idempotency.ts
 * Requires: PostgreSQL + Redis running (docker-compose up -d), schema pushed
 */

import { eq, and, gt } from 'drizzle-orm';

async function main() {
  // Dynamic imports to handle module resolution
  const { createDb } = await import('@phork/db');
  const { creditAccounts, creditLedger, users, workspaces, workspaceMembers, projects, jobs } = await import('@phork/db');
  const { refundJob } = await import('../lib/refund');

  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://phork:phork@localhost:5432/phork';
  const db = createDb(DATABASE_URL);

  console.log('=== Refund Idempotency Test ===\n');

  try {
    // ── Setup: create test user, workspace, project, job ──
    console.log('--- Step 1: Create test data ---');

    const [user] = await db.insert(users).values({
      email: `refund-test-${Date.now()}@phork.ai`,
      passwordHash: 'test-hash',
      displayName: 'Refund Test User',
    }).returning();
    console.log(`  userId: ${user.id}`);

    const [workspace] = await db.insert(workspaces).values({
      name: 'Refund Test Workspace',
      createdBy: user.id,
    }).returning();
    console.log(`  workspaceId: ${workspace.id}`);

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    });

    await db.insert(creditAccounts).values({
      workspaceId: workspace.id,
      balance: 1000,
    });

    const [project] = await db.insert(projects).values({
      workspaceId: workspace.id,
      name: 'Refund Test Project',
      createdBy: user.id,
    }).returning();

    // Create a job that we'll refund
    const [job] = await db.insert(jobs).values({
      workspaceId: workspace.id,
      userId: user.id,
      projectId: project.id,
      type: 'gen_video', // 25 credits
      status: 'failed',
      request: { prompt: 'test' },
      idempotencyKey: `refund-test-${Date.now()}`,
    }).returning();
    console.log(`  jobId: ${job.id}`);
    console.log(`  job type: gen_video (25 credits)`);

    // Simulate the initial debit (as if createJob had run)
    await db.insert(creditLedger).values({
      workspaceId: workspace.id,
      userId: user.id,
      jobId: job.id,
      projectId: project.id,
      delta: -25,
      reason: 'gen_video job',
    });

    // Update balance to simulate debit
    const [acct] = await db.select().from(creditAccounts)
      .where(eq(creditAccounts.workspaceId, workspace.id)).limit(1);
    await db.update(creditAccounts)
      .set({ balance: acct.balance - 25 })
      .where(eq(creditAccounts.workspaceId, workspace.id));

    console.log(`  balance after debit: 975`);

    // ── Test: call refundJob() THREE times ──
    console.log('\n--- Step 2: Call refundJob() 3 times ---');

    const jobArg = {
      id: job.id,
      workspaceId: workspace.id,
      userId: user.id,
      projectId: project.id,
      type: 'gen_video',
    };

    const result1 = await refundJob(db as any, jobArg, 'test failure attempt 1');
    console.log(`  Call 1: refunded=${result1.refunded}, alreadyRefunded=${result1.alreadyRefunded}`);

    const result2 = await refundJob(db as any, jobArg, 'test failure attempt 2');
    console.log(`  Call 2: refunded=${result2.refunded}, alreadyRefunded=${result2.alreadyRefunded}`);

    const result3 = await refundJob(db as any, jobArg, 'test failure attempt 3');
    console.log(`  Call 3: refunded=${result3.refunded}, alreadyRefunded=${result3.alreadyRefunded}`);

    // ── Verify: exactly one refund ──
    console.log('\n--- Step 3: Verify results ---');

    // Check balance
    const [finalAccount] = await db.select().from(creditAccounts)
      .where(eq(creditAccounts.workspaceId, workspace.id)).limit(1);
    console.log(`  Final balance: ${finalAccount.balance}`);

    const assert = (cond: boolean, msg: string) => {
      if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
      console.log(`  [ok] ${msg}`);
    };

    assert(result1.refunded === true, 'First call issued refund');
    assert(result1.alreadyRefunded === false, 'First call was not a duplicate');
    assert(result2.refunded === false, 'Second call did NOT issue refund');
    assert(result2.alreadyRefunded === true, 'Second call detected existing refund');
    assert(result3.refunded === false, 'Third call did NOT issue refund');
    assert(result3.alreadyRefunded === true, 'Third call detected existing refund');

    assert(finalAccount.balance === 1000, `Balance restored to exactly 1000 (got ${finalAccount.balance})`);

    // Count refund entries in ledger
    const refundEntries = await db.select().from(creditLedger)
      .where(and(eq(creditLedger.jobId, job.id), gt(creditLedger.delta, 0)));
    console.log(`  Refund ledger entries: ${refundEntries.length}`);
    assert(refundEntries.length === 1, 'Exactly ONE refund ledger entry exists');
    assert(refundEntries[0].delta === 25, `Refund amount is 25 (got ${refundEntries[0].delta})`);

    console.log('\n=== REFUND IDEMPOTENCY TEST PASSED ===');
  } catch (err: any) {
    console.error('\n!!! TEST FAILED !!!');
    console.error(err.message || err);
    process.exit(1);
  }

  process.exit(0);
}

main();
