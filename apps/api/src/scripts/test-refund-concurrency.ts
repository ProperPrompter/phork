/**
 * Regression test for Fix #5: Concurrent refund idempotency
 *
 * Proves that calling refundJob() from two parallel invocations
 * still results in exactly one refund entry, thanks to the
 * partial unique index on credit_ledger(job_id) WHERE delta > 0.
 *
 * This test calls the refund function directly (not via HTTP)
 * to simulate the concurrent BullMQ worker retry scenario.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, gt, sql as rawSql } from 'drizzle-orm';
import * as schema from '@phork/db';
import { refundJob } from '../lib/refund';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://phork:phork@localhost:5432/phork';

async function main() {
  console.log('=== Concurrent Refund Idempotency Test ===\n');

  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema }) as any;

  try {
    // Step 1: Create test user, workspace, credit account, and job
    console.log('--- Step 1: Create test data ---');
    const [user] = await db.insert(schema.users).values({
      email: `refund-conc-${Date.now()}@phork.ai`,
      passwordHash: 'test',
      displayName: 'Refund Concurrency Test',
    }).returning();

    const [workspace] = await db.insert(schema.workspaces).values({
      name: 'Refund Concurrency WS',
      createdBy: user.id,
    }).returning();

    await db.insert(schema.workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    });

    await db.insert(schema.creditAccounts).values({
      workspaceId: workspace.id,
      balance: 1000,
    });

    // Create a job and manually debit
    const [job] = await db.insert(schema.jobs).values({
      workspaceId: workspace.id,
      userId: user.id,
      projectId: null,
      type: 'gen_video',
      status: 'failed',
      request: { prompt: 'test' },
      idempotencyKey: `refund-conc-${Date.now()}`,
    }).returning();

    // Debit 25 credits
    await db.execute(
      rawSql`UPDATE credit_accounts SET balance = balance - 25 WHERE workspace_id = ${workspace.id}`
    );
    await db.insert(schema.creditLedger).values({
      workspaceId: workspace.id,
      userId: user.id,
      jobId: job.id,
      delta: -25,
      reason: 'gen_video job',
    });

    const [acctBefore] = await db.select().from(schema.creditAccounts)
      .where(eq(schema.creditAccounts.workspaceId, workspace.id));
    console.log(`  userId: ${user.id}`);
    console.log(`  workspaceId: ${workspace.id}`);
    console.log(`  jobId: ${job.id}`);
    console.log(`  balance after debit: ${acctBefore.balance}`);

    // Step 2: Fire N concurrent refundJob() calls
    const CONCURRENCY = 10;
    console.log(`\n--- Step 2: Fire ${CONCURRENCY} concurrent refundJob() calls ---`);

    const jobData = {
      id: job.id,
      workspaceId: workspace.id,
      userId: user.id,
      projectId: null,
      type: 'gen_video',
    };

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        refundJob(db, jobData, `concurrent refund attempt ${i}`)
      )
    );

    let refundedCount = 0;
    let alreadyRefundedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        if (r.value.refunded) refundedCount++;
        if (r.value.alreadyRefunded) alreadyRefundedCount++;
        console.log(`  Call ${i + 1}: refunded=${r.value.refunded}, alreadyRefunded=${r.value.alreadyRefunded}`);
      } else {
        errorCount++;
        console.log(`  Call ${i + 1}: ERROR — ${r.reason}`);
      }
    }

    console.log(`\n  Summary: ${refundedCount} refunded, ${alreadyRefundedCount} already-refunded, ${errorCount} errors`);

    // Step 3: Verify results
    console.log('\n--- Step 3: Verify results ---');

    // Exactly one refund should have succeeded
    if (refundedCount !== 1) {
      console.error(`  [FAIL] Expected exactly 1 refund, got ${refundedCount}`);
      process.exit(1);
    }
    console.log(`  [ok] Exactly 1 refund issued out of ${CONCURRENCY} concurrent calls`);

    if (alreadyRefundedCount !== CONCURRENCY - 1) {
      console.error(`  [FAIL] Expected ${CONCURRENCY - 1} already-refunded, got ${alreadyRefundedCount}`);
      process.exit(1);
    }
    console.log(`  [ok] ${alreadyRefundedCount} calls correctly detected existing refund`);

    if (errorCount !== 0) {
      console.error(`  [FAIL] Expected 0 errors, got ${errorCount}`);
      process.exit(1);
    }
    console.log('  [ok] No errors');

    // Verify final balance
    const [acctAfter] = await db.select().from(schema.creditAccounts)
      .where(eq(schema.creditAccounts.workspaceId, workspace.id));
    console.log(`  Final balance: ${acctAfter.balance}`);
    if (acctAfter.balance !== 1000) {
      console.error(`  [FAIL] Expected balance 1000, got ${acctAfter.balance}`);
      process.exit(1);
    }
    console.log('  [ok] Balance restored to exactly 1000');

    // Verify exactly one positive ledger entry
    const refundEntries = await db.select().from(schema.creditLedger)
      .where(and(eq(schema.creditLedger.jobId, job.id), gt(schema.creditLedger.delta, 0)));
    console.log(`  Refund ledger entries: ${refundEntries.length}`);
    if (refundEntries.length !== 1) {
      console.error(`  [FAIL] Expected 1 refund ledger entry, got ${refundEntries.length}`);
      process.exit(1);
    }
    console.log(`  [ok] Exactly ONE refund ledger entry (delta: ${refundEntries[0].delta})`);

    // Verify the partial unique index exists
    console.log('\n--- Step 4: Verify DB constraint ---');
    const indexCheck = await db.execute(
      rawSql`SELECT indexname FROM pg_indexes WHERE tablename = 'credit_ledger' AND indexname = 'credit_ledger_one_refund_per_job'`
    );
    if ((indexCheck as any).length > 0 || (indexCheck as any).count > 0) {
      console.log('  [ok] Partial unique index credit_ledger_one_refund_per_job exists');
    } else {
      console.error('  [FAIL] Partial unique index not found');
      process.exit(1);
    }

    console.log('\n=== CONCURRENT REFUND IDEMPOTENCY TEST PASSED ===');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
