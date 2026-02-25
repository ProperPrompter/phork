import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { projects, commits, projectHeads, workspaceMembers, assets, sourceReleases, sourceReleaseAssets, analyticsEvents } from '@phork/db';
import type { TimelineSnapshot, ShotSnapshot } from '@phork/shared';
import { TEMPLATES, getTemplate } from '../lib/templates';

const createProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string().optional(),
});

const createCommitSchema = z.object({
  parentCommitId: z.string().uuid().nullable().optional(),
  message: z.string().min(1),
  snapshot: z.object({
    timeline: z.array(z.object({
      shot_id: z.string(),
      visual_asset_id: z.string().nullable(),
      audio_asset_id: z.string().nullable(),
      duration_ms: z.number().int().positive(),
      trim_in_ms: z.number().int().min(0),
      trim_out_ms: z.number().int().min(0),
      subtitle: z.string().nullable(),
    })),
  }),
});

const forkProjectSchema = z.object({
  fromCommitId: z.string().uuid(),
  name: z.string().min(1),
  truncateAtShotIndex: z.number().int().min(0).optional(),
  sourceReleaseId: z.string().uuid().optional(),
});

export async function projectRoutes(app: FastifyInstance) {
  // All project routes require auth (except templates)
  app.addHook('preHandler', (app as any).authenticate);

  // GET /projects/templates — list available templates (no sensitive data)
  app.get('/templates', async () => {
    return { data: TEMPLATES };
  });

  // Create project
  app.post('/', async (request: any, reply) => {
    const body = createProjectSchema.parse(request.body);
    const db = (app as any).db;
    const userId = request.user.userId;

    // Verify workspace membership
    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, body.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace', statusCode: 403 });
    }

    const [project] = await db.insert(projects).values({
      workspaceId: body.workspaceId,
      name: body.name,
      description: body.description || null,
      createdBy: userId,
    }).returning();

    // Create initial commit — use template if provided, otherwise empty
    let initialSnapshot: TimelineSnapshot = { timeline: [] };
    let commitMessage = 'Initial commit';

    if (body.templateId) {
      const template = getTemplate(body.templateId);
      if (!template) {
        return reply.status(400).send({ error: 'Bad Request', message: `Unknown template: ${body.templateId}`, statusCode: 400 });
      }
      initialSnapshot = {
        timeline: template.shots.map((s) => ({
          shot_id: s.shot_id,
          visual_asset_id: null,
          audio_asset_id: null,
          duration_ms: s.duration_ms,
          trim_in_ms: 0,
          trim_out_ms: s.duration_ms,
          subtitle: s.subtitle,
        })),
      };
      commitMessage = `Initial commit from template: ${template.name}`;
    }

    const [commit] = await db.insert(commits).values({
      projectId: project.id,
      parentCommitId: null,
      message: commitMessage,
      createdBy: userId,
      snapshot: initialSnapshot,
    }).returning();

    // Set project head
    await db.insert(projectHeads).values({
      projectId: project.id,
      headCommitId: commit.id,
    });

    return reply.status(201).send({ project, headCommit: commit });
  });

  // Get project
  app.get('/:id', async (request: any, reply) => {
    const db = (app as any).db;
    const projectId = request.params.id;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [head] = await db.select().from(projectHeads).where(eq(projectHeads.projectId, projectId)).limit(1);
    let headCommit = null;
    if (head) {
      [headCommit] = await db.select().from(commits).where(eq(commits.id, head.headCommitId)).limit(1);
    }

    return { project, headCommit };
  });

  // List projects in workspace
  app.get('/', async (request: any) => {
    const db = (app as any).db;
    const workspaceId = (request.query as any).workspaceId;
    if (!workspaceId) {
      return { data: [] };
    }

    const result = await db.select().from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.createdAt));

    return { data: result };
  });

  // Create commit
  app.post('/:id/commits', async (request: any, reply) => {
    const db = (app as any).db;
    const projectId = request.params.id;
    const userId = request.user.userId;
    const body = createCommitSchema.parse(request.body);

    // Validate project exists
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const projectWorkspaceId = project.workspaceId;

    // Validate all referenced asset IDs have valid mint receipts
    const snapshot = body.snapshot as TimelineSnapshot;
    for (const shot of snapshot.timeline) {
      if (shot.visual_asset_id) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, shot.visual_asset_id)).limit(1);
        if (!asset || !asset.mintReceiptSig) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Asset ${shot.visual_asset_id} not found or missing mint receipt. Only platform-generated assets are allowed.`,
            statusCode: 400,
          });
        }
        if (asset.workspaceId !== projectWorkspaceId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Asset belongs to a different workspace',
            statusCode: 403,
          });
        }
      }
      if (shot.audio_asset_id) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, shot.audio_asset_id)).limit(1);
        if (!asset || !asset.mintReceiptSig) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Asset ${shot.audio_asset_id} not found or missing mint receipt. Only platform-generated assets are allowed.`,
            statusCode: 400,
          });
        }
        if (asset.workspaceId !== projectWorkspaceId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Asset belongs to a different workspace',
            statusCode: 403,
          });
        }
      }
    }

    // Determine parent commit
    let parentCommitId = body.parentCommitId || null;
    if (!parentCommitId) {
      const [head] = await db.select().from(projectHeads).where(eq(projectHeads.projectId, projectId)).limit(1);
      parentCommitId = head?.headCommitId || null;
    }

    const [commit] = await db.insert(commits).values({
      projectId,
      parentCommitId,
      message: body.message,
      createdBy: userId,
      snapshot: body.snapshot,
    }).returning();

    // Update head
    await db.update(projectHeads)
      .set({ headCommitId: commit.id })
      .where(eq(projectHeads.projectId, projectId));

    return reply.status(201).send(commit);
  });

  // Get commit
  app.get('/:id/commits/:commitId', async (request: any, reply) => {
    const db = (app as any).db;
    const commitId = request.params.commitId;

    const [commit] = await db.select().from(commits).where(eq(commits.id, commitId)).limit(1);
    if (!commit) {
      return reply.status(404).send({ error: 'Not Found', message: 'Commit not found', statusCode: 404 });
    }

    return commit;
  });

  // List commits for project
  app.get('/:id/commits', async (request: any) => {
    const db = (app as any).db;
    const projectId = request.params.id;

    const result = await db.select().from(commits)
      .where(eq(commits.projectId, projectId))
      .orderBy(desc(commits.createdAt));

    return { data: result };
  });

  // Fork project
  app.post('/:id/fork', async (request: any, reply) => {
    const db = (app as any).db;
    const sourceProjectId = request.params.id;
    const userId = request.user.userId;
    const body = forkProjectSchema.parse(request.body);

    // Get source project
    const [sourceProject] = await db.select().from(projects).where(eq(projects.id, sourceProjectId)).limit(1);
    if (!sourceProject) {
      return reply.status(404).send({ error: 'Not Found', message: 'Source project not found', statusCode: 404 });
    }

    // Get the fork point commit
    const [forkCommit] = await db.select().from(commits).where(eq(commits.id, body.fromCommitId)).limit(1);
    if (!forkCommit || forkCommit.projectId !== sourceProjectId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid fork commit', statusCode: 400 });
    }

    // Create new project with fork references
    const [newProject] = await db.insert(projects).values({
      workspaceId: sourceProject.workspaceId,
      name: body.name,
      description: `Forked from ${sourceProject.name}`,
      createdBy: userId,
      parentProjectId: sourceProjectId,
      forkedFromCommitId: body.fromCommitId,
    }).returning();

    // Copy commit history up to fork point
    // Walk backwards from fork commit to root
    const commitChain: typeof forkCommit[] = [];
    let current: typeof forkCommit | null = forkCommit;
    while (current) {
      commitChain.unshift(current);
      if (current.parentCommitId) {
        const [parent] = await db.select().from(commits).where(eq(commits.id, current.parentCommitId)).limit(1);
        current = parent || null;
      } else {
        current = null;
      }
    }

    // Re-create commits in new project with new IDs, preserving parent chain
    const idMap = new Map<string, string>();
    let lastNewCommitId: string | null = null;

    for (const oldCommit of commitChain) {
      const newParentId = oldCommit.parentCommitId ? idMap.get(oldCommit.parentCommitId) || null : null;
      const [newCommit] = await db.insert(commits).values({
        projectId: newProject.id,
        parentCommitId: newParentId,
        message: oldCommit.message,
        createdBy: oldCommit.createdBy,
        snapshot: oldCommit.snapshot,
      }).returning();
      idMap.set(oldCommit.id, newCommit.id);
      lastNewCommitId = newCommit.id;
    }

    // If truncateAtShotIndex is specified, truncate the final commit's timeline
    if (body.truncateAtShotIndex !== undefined && lastNewCommitId) {
      const [lastCommit] = await db.select().from(commits).where(eq(commits.id, lastNewCommitId)).limit(1);
      if (lastCommit) {
        const snap = lastCommit.snapshot as TimelineSnapshot;
        if (snap.timeline && body.truncateAtShotIndex < snap.timeline.length) {
          const truncatedSnapshot: TimelineSnapshot = {
            timeline: snap.timeline.slice(0, body.truncateAtShotIndex + 1),
          };
          await db.update(commits)
            .set({ snapshot: truncatedSnapshot })
            .where(eq(commits.id, lastNewCommitId));
        }
      }
    }

    // Set head to the last copied commit
    if (lastNewCommitId) {
      await db.insert(projectHeads).values({
        projectId: newProject.id,
        headCommitId: lastNewCommitId,
      });
    }

    // Handle source release: copy release reference for the forked project
    let releaseUsed = null;
    if (body.sourceReleaseId) {
      const [release] = await db.select().from(sourceReleases)
        .where(and(eq(sourceReleases.id, body.sourceReleaseId), eq(sourceReleases.projectId, sourceProjectId)))
        .limit(1);
      if (release) {
        releaseUsed = { releaseId: release.id, releaseName: release.name };

        // Record analytics
        await db.insert(analyticsEvents).values({
          workspaceId: sourceProject.workspaceId,
          userId,
          projectId: sourceProjectId,
          event: 'release_used',
          metadata: { releaseId: release.id, forkProjectId: newProject.id },
        });
      }
    }

    // Record fork_created analytics
    await db.insert(analyticsEvents).values({
      workspaceId: sourceProject.workspaceId,
      userId,
      projectId: sourceProjectId,
      event: 'fork_created',
      metadata: { forkProjectId: newProject.id, fromCommitId: body.fromCommitId },
    });

    return reply.status(201).send({
      project: newProject,
      headCommitId: lastNewCommitId,
      forkedFrom: { projectId: sourceProjectId, commitId: body.fromCommitId },
      releaseUsed,
    });
  });
}
