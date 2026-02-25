import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { analyticsEvents, projects, workspaceMembers } from '@phork/db';

const recordEventSchema = z.object({
  event: z.enum(['viewer_open', 'fork_click', 'fork_created', 'fork_rendered', 'release_used']),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // POST /analytics/event — record an event
  app.post('/event', async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const body = recordEventSchema.parse(request.body);

    // Resolve workspace from project if provided
    let workspaceId: string | null = null;
    if (body.projectId) {
      const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId)).limit(1);
      workspaceId = project?.workspaceId || null;
    }

    await db.insert(analyticsEvents).values({
      workspaceId,
      userId,
      projectId: body.projectId || null,
      event: body.event,
      metadata: body.metadata || null,
    });

    return reply.status(201).send({ recorded: true });
  });

  // GET /analytics/counters?projectId=xxx — aggregate counters
  app.get('/counters', async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const projectId = (request.query as any).projectId;

    if (!projectId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'projectId required', statusCode: 400 });
    }

    // Verify membership
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace', statusCode: 403 });
    }

    // Count by event type for this project
    const events = await db.select({
      event: analyticsEvents.event,
      count: sql<number>`count(*)::int`,
    })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.projectId, projectId))
      .groupBy(analyticsEvents.event);

    const counters: Record<string, number> = {
      viewerOpens: 0,
      forkClicks: 0,
      forksCreated: 0,
      forksRendered: 0,
      releaseUsages: 0,
    };

    for (const e of events) {
      if (e.event === 'viewer_open') counters.viewerOpens = e.count;
      else if (e.event === 'fork_click') counters.forkClicks = e.count;
      else if (e.event === 'fork_created') counters.forksCreated = e.count;
      else if (e.event === 'fork_rendered') counters.forksRendered = e.count;
      else if (e.event === 'release_used') counters.releaseUsages = e.count;
    }

    return counters;
  });
}
