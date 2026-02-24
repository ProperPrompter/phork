/**
 * Credit Refund Policy (Phase 1)
 *
 * RULE: Credits are charged at job creation time (optimistic debit).
 * If the job fails or is blocked, a FULL REFUND is issued as a
 * reversal ledger entry. This keeps the ledger immutable (append-only)
 * while restoring the balance.
 *
 * - Blocked by safety policy: Full refund
 * - Failed mid-execution:     Full refund
 * - Succeeded:                No refund (charge stands)
 *
 * The refund is a positive delta ledger entry with reason prefix "refund:".
 *
 * IDEMPOTENCY: refundJob() checks the ledger for an existing refund
 * for the same job_id before issuing. At most ONE refund per job.
 */
import { eq, and, gt } from 'drizzle-orm';
import { creditAccounts, creditLedger } from '@phork/db';
import type { Database } from '@phork/db';
import { sql } from 'drizzle-orm';

// Cost table — must match jobs.ts
const JOB_COSTS: Record<string, number> = {
  gen_image: 10,
  gen_video: 25,
  gen_audio: 5,
  render: 15,
};

export async function refundJob(
  db: Database,
  job: {
    id: string;
    workspaceId: string;
    userId: string;
    projectId: string | null;
    type: string;
  },
  reason: string
): Promise<{ refunded: boolean; alreadyRefunded: boolean }> {
  const cost = JOB_COSTS[job.type] || 0;
  if (cost === 0) return { refunded: false, alreadyRefunded: false };

  // ── Idempotency guard: check if a refund already exists for this job ──
  const [existingRefund] = await db.select().from(creditLedger)
    .where(
      and(
        eq(creditLedger.jobId, job.id),
        gt(creditLedger.delta, 0)  // Positive delta = refund
      )
    )
    .limit(1);

  if (existingRefund) {
    console.warn(`refundJob: refund already exists for job ${job.id}, skipping (idempotent)`);
    return { refunded: false, alreadyRefunded: true };
  }

  // ── Atomic refund: credit balance + write ledger entry ──
  await db.transaction(async (tx: any) => {
    // Atomic balance credit (no read-then-write race)
    await tx.execute(
      sql`UPDATE credit_accounts SET balance = balance + ${cost} WHERE workspace_id = ${job.workspaceId}`
    );

    // Write reversal ledger entry (positive delta)
    await tx.insert(creditLedger).values({
      workspaceId: job.workspaceId,
      userId: job.userId,
      jobId: job.id,
      projectId: job.projectId,
      delta: +cost, // Positive = credit returned
      reason: `refund: ${reason}`,
    });
  });

  return { refunded: true, alreadyRefunded: false };
}
