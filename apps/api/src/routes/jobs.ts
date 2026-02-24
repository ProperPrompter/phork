import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { jobs, creditAccounts, creditLedger, workspaceMembers } from '@phork/db';
import { generationQueue, renderQueue } from '../lib/queue';
import { nanoid } from 'nanoid';

// Cost table (stub pricing for Phase 1)
const JOB_COSTS: Record<string, number> = {
  gen_image: 10,
  gen_video: 25,
  gen_audio: 5,
  render: 15,
};

const genVideoSchema = z.object({
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  duration: z.number().int().min(1000).max(10000).optional().default(4000),
  aspectRatio: z.string().optional().default('16:9'),
  idempotencyKey: z.string().optional(),
});

const genAudioSchema = z.object({
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  text: z.string().min(1).max(5000),
  voice: z.string().optional().default('default'),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  idempotencyKey: z.string().optional(),
});

const renderSchema = z.object({
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  commitId: z.string().uuid(),
  idempotencyKey: z.string().optional(),
});

export async function jobRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // Helper: check credits and create job
  async function createJob(
    db: any,
    userId: string,
    workspaceId: string,
    projectId: string | null,
    type: string,
    requestData: any,
    idempotencyKey: string,
  ) {
    // 0. Verify workspace membership — prevent cross-tenant job submission
    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      throw { statusCode: 403, message: 'Not a member of this workspace' };
    }

    // 1. Check idempotency FIRST — before any credit operations
    const [existing] = await db.select().from(jobs).where(
      and(eq(jobs.workspaceId, workspaceId), eq(jobs.idempotencyKey, idempotencyKey))
    ).limit(1);
    if (existing) {
      return { job: existing, duplicate: true };
    }

    // 2. Atomic block: check + debit credits, create job, write ledger entry
    let job: any;
    const cost = JOB_COSTS[type] || 10;
    await db.transaction(async (tx: any) => {
      // Atomic conditional debit — prevents race conditions
      // Uses RETURNING to confirm the row was actually updated
      // If balance < cost, no row is returned → insufficient credits
      const debitRows = await tx.execute(
        sql`UPDATE credit_accounts SET balance = balance - ${cost} WHERE workspace_id = ${workspaceId} AND balance >= ${cost} RETURNING workspace_id, balance`
      );

      // If no rows returned, the WHERE balance >= cost failed
      // postgres.js returns array with .count property for affected rows
      if (!debitRows || (debitRows as any).count === 0) {
        throw { statusCode: 402, message: 'Insufficient credits' };
      }

      // Create job
      const [insertedJob] = await tx.insert(jobs).values({
        workspaceId,
        userId,
        projectId,
        type,
        status: 'queued',
        request: requestData,
        idempotencyKey,
      }).returning();
      job = insertedJob;

      // Create ledger entry
      await tx.insert(creditLedger).values({
        workspaceId,
        userId,
        jobId: job.id,
        projectId,
        delta: -cost,
        reason: `${type} job`,
      });
    });

    return { job, duplicate: false, cost };
  }

  // Generate video
  app.post('/gen-video', async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const body = genVideoSchema.parse(request.body);
    const idempotencyKey = body.idempotencyKey || `gen-video-${nanoid()}`;

    try {
      const { job, duplicate } = await createJob(db, userId, body.workspaceId, body.projectId, 'gen_video', {
        prompt: body.prompt,
        duration: body.duration,
        aspectRatio: body.aspectRatio,
      }, idempotencyKey);

      if (!duplicate) {
        await generationQueue.add('gen_video', { jobId: job.id });
      }

      return reply.status(duplicate ? 200 : 201).send(job);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, statusCode: err.statusCode });
      throw err;
    }
  });

  // Generate audio
  app.post('/gen-audio', async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const body = genAudioSchema.parse(request.body);
    const idempotencyKey = body.idempotencyKey || `gen-audio-${nanoid()}`;

    try {
      const { job, duplicate } = await createJob(db, userId, body.workspaceId, body.projectId, 'gen_audio', {
        text: body.text,
        voice: body.voice,
        speed: body.speed,
      }, idempotencyKey);

      if (!duplicate) {
        await generationQueue.add('gen_audio', { jobId: job.id });
      }

      return reply.status(duplicate ? 200 : 201).send(job);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, statusCode: err.statusCode });
      throw err;
    }
  });

  // Render
  app.post('/render', async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const body = renderSchema.parse(request.body);
    const idempotencyKey = body.idempotencyKey || `render-${nanoid()}`;

    try {
      const { job, duplicate } = await createJob(db, userId, body.workspaceId, body.projectId, 'render', {
        commitId: body.commitId,
      }, idempotencyKey);

      if (!duplicate) {
        await renderQueue.add('render', { jobId: job.id });
      }

      return reply.status(duplicate ? 200 : 201).send(job);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, statusCode: err.statusCode });
      throw err;
    }
  });

  // Get job status
  app.get('/:id', async (request: any, reply) => {
    const db = (app as any).db;
    const jobId = request.params.id;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) {
      return reply.status(404).send({ error: 'Not Found', message: 'Job not found', statusCode: 404 });
    }

    return job;
  });

  // List jobs for project
  app.get('/', async (request: any) => {
    const db = (app as any).db;
    const projectId = (request.query as any).projectId;

    if (projectId) {
      const result = await db.select().from(jobs)
        .where(eq(jobs.projectId, projectId))
        .orderBy(desc(jobs.createdAt));
      return { data: result };
    }

    return { data: [] };
  });
}
