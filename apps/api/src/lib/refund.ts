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
 * IDEMPOTENCY: Enforced at the database level via a partial unique index
 * `credit_ledger_one_refund_per_job` on (job_id) WHERE delta > 0.
 * The refund uses INSERT ... ON CONFLICT DO NOTHING so that concurrent
 * callers are serialized by the unique index — at most ONE refund per job,
 * even under concurrent BullMQ retries.
 */
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

  // ── Atomic concurrent-safe refund ──
  // Uses a CTE with INSERT ... ON CONFLICT DO NOTHING (partial unique index
  // on credit_ledger(job_id) WHERE delta > 0). If the insert succeeds, the
  // CTE returns the new row and the UPDATE credits the balance. If the insert
  // conflicts (refund already exists), no row is returned and the UPDATE is
  // a no-op (EXISTS is false → 0 rows updated).
  const result = await db.execute(
    sql`WITH refund_insert AS (
      INSERT INTO credit_ledger (id, workspace_id, user_id, job_id, project_id, delta, reason)
      VALUES (gen_random_uuid(), ${job.workspaceId}, ${job.userId}, ${job.id}, ${job.projectId}, ${cost}, ${'refund: ' + reason})
      ON CONFLICT (job_id) WHERE delta > 0 DO NOTHING
      RETURNING id
    )
    UPDATE credit_accounts
    SET balance = balance + ${cost}
    WHERE workspace_id = ${job.workspaceId}
      AND EXISTS (SELECT 1 FROM refund_insert)
    RETURNING workspace_id`
  );

  // If the UPDATE returned a row, the refund was applied (insert succeeded).
  // If no rows, the insert was a no-op (conflict) — already refunded.
  const wasRefunded = (result as any).count > 0;

  if (!wasRefunded) {
    console.warn(`refundJob: refund already exists for job ${job.id}, skipping (idempotent)`);
  }

  return {
    refunded: wasRefunded,
    alreadyRefunded: !wasRefunded,
  };
}
