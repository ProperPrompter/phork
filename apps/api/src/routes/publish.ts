import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import {
  publishedRenders, projects, commits, assets, workspaceMembers,
  users, sourceReleases, sourceReleaseAssets, analyticsEvents,
} from '@phork/db';
import { generateSignedUrl } from '../lib/storage';
import type { TimelineSnapshot } from '@phork/shared';

const publishSchema = z.object({
  projectId: z.string().uuid(),
  renderAssetId: z.string().uuid(),
  commitId: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  enableShareLink: z.boolean().optional().default(false),
});

export async function publishRoutes(app: FastifyInstance) {
  // POST /publish — publish a render
  app.post('/', { preHandler: [(app as any).authenticate] }, async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const body = publishSchema.parse(request.body);

    // Verify project exists and user is workspace member
    const [project] = await db.select().from(projects).where(eq(projects.id, body.projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace', statusCode: 403 });
    }

    // Verify render asset exists
    const [renderAsset] = await db.select().from(assets).where(eq(assets.id, body.renderAssetId)).limit(1);
    if (!renderAsset || renderAsset.type !== 'render') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid render asset', statusCode: 400 });
    }

    // Verify commit exists
    const [commit] = await db.select().from(commits).where(eq(commits.id, body.commitId)).limit(1);
    if (!commit || commit.projectId !== body.projectId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid commit', statusCode: 400 });
    }

    const shareToken = body.enableShareLink ? randomBytes(24).toString('base64url') : null;

    // Upsert (delete existing + insert, since one published render per project)
    await db.delete(publishedRenders).where(eq(publishedRenders.projectId, body.projectId));

    const [pub] = await db.insert(publishedRenders).values({
      projectId: body.projectId,
      renderAssetId: body.renderAssetId,
      commitId: body.commitId,
      title: body.title || project.name,
      description: body.description || project.description,
      shareToken,
      publishedBy: userId,
    }).returning();

    // Generate download URL
    const protocol = request.protocol || 'http';
    const host = request.hostname || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;
    const downloadUrl = generateSignedUrl(body.renderAssetId, baseUrl);

    return reply.status(201).send({ publishedRender: pub, downloadUrl });
  });

  // GET /publish/:projectId — viewer page data
  app.get('/:projectId', async (request: any, reply) => {
    const db = (app as any).db;
    const projectId = request.params.projectId;
    const shareToken = (request.query as any).shareToken;

    // Get published render
    const [pub] = await db.select().from(publishedRenders).where(eq(publishedRenders.projectId, projectId)).limit(1);
    if (!pub) {
      return reply.status(404).send({ error: 'Not Found', message: 'No published render for this project', statusCode: 404 });
    }

    // Auth: workspace member OR valid share token
    let authed = false;
    let viewerUserId: string | null = null;

    if (shareToken && pub.shareToken === shareToken) {
      authed = true;
    }

    if (!authed) {
      try {
        await (request as any).jwtVerify();
        viewerUserId = request.user.userId;
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (project) {
          const [membership] = await db.select().from(workspaceMembers)
            .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, viewerUserId!)))
            .limit(1);
          if (membership) authed = true;
        }
      } catch {
        // Not authenticated
      }
    }

    if (!authed) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Login required or provide a valid share token', statusCode: 401 });
    }

    // Fetch related data
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const [commit] = await db.select().from(commits).where(eq(commits.id, pub.commitId)).limit(1);
    const [creator] = await db.select().from(users).where(eq(users.id, pub.publishedBy)).limit(1);

    const snapshot = commit?.snapshot as TimelineSnapshot | undefined;
    const totalDurationMs = snapshot?.timeline?.reduce((sum, s) => sum + s.duration_ms, 0) || 0;

    // Fetch available source releases
    const releases = await db.select().from(sourceReleases).where(eq(sourceReleases.projectId, projectId));

    // Generate download URL
    const protocol = request.protocol || 'http';
    const host = request.hostname || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;
    const downloadUrl = generateSignedUrl(pub.renderAssetId, baseUrl);

    // Record analytics
    if (viewerUserId) {
      await db.insert(analyticsEvents).values({
        workspaceId: project?.workspaceId,
        userId: viewerUserId,
        projectId,
        event: 'viewer_open',
      });
    }

    return {
      project: project ? { id: project.id, name: project.name, description: project.description, forkLicense: project.forkLicense } : null,
      publishedRender: pub,
      downloadUrl,
      commitSnapshot: snapshot || { timeline: [] },
      creator: creator ? { displayName: creator.displayName || creator.email } : null,
      totalDurationMs,
      shotCount: snapshot?.timeline?.length || 0,
      releases,
    };
  });

  // DELETE /publish/:projectId — unpublish
  app.delete('/:projectId', { preHandler: [(app as any).authenticate] }, async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const projectId = request.params.projectId;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners/admins can unpublish', statusCode: 403 });
    }

    await db.delete(publishedRenders).where(eq(publishedRenders.projectId, projectId));
    return reply.status(200).send({ message: 'Unpublished' });
  });

  // POST /publish/:projectId/share-token — generate share token
  app.post('/:projectId/share-token', { preHandler: [(app as any).authenticate] }, async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const projectId = request.params.projectId;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners/admins can manage share tokens', statusCode: 403 });
    }

    const newToken = randomBytes(24).toString('base64url');
    const result = await db.update(publishedRenders)
      .set({ shareToken: newToken })
      .where(eq(publishedRenders.projectId, projectId))
      .returning();

    if (!result.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'No published render to update', statusCode: 404 });
    }

    return { shareToken: newToken };
  });

  // DELETE /publish/:projectId/share-token — revoke share token
  app.delete('/:projectId/share-token', { preHandler: [(app as any).authenticate] }, async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const projectId = request.params.projectId;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners/admins can manage share tokens', statusCode: 403 });
    }

    await db.update(publishedRenders)
      .set({ shareToken: null })
      .where(eq(publishedRenders.projectId, projectId));

    return reply.status(200).send({ message: 'Share token revoked' });
  });
}
