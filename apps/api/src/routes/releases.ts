import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, inArray, desc } from 'drizzle-orm';
import {
  sourceReleases, sourceReleaseAssets, projects, commits, projectHeads,
  assets, workspaceMembers,
} from '@phork/db';
import type { TimelineSnapshot } from '@phork/shared';

const createReleaseSchema = z.object({
  name: z.string().min(1),
  includeMode: z.enum(['used_only', 'used_plus_selected']),
  license: z.enum(['no_forks', 'forks_nc', 'forks_revshare', 'sharealike']),
  selectedAssetIds: z.array(z.string().uuid()).optional().default([]),
});

export async function releaseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // POST /projects/:id/releases — create a source release
  app.post('/:id/releases', async (request: any, reply) => {
    const db = (app as any).db;
    const projectId = request.params.id;
    const userId = request.user.userId;
    const body = createReleaseSchema.parse(request.body);

    // Verify project + membership
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

    // Get head commit to determine "used" assets
    const [head] = await db.select().from(projectHeads).where(eq(projectHeads.projectId, projectId)).limit(1);
    if (!head) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Project has no commits', statusCode: 400 });
    }
    const [headCommit] = await db.select().from(commits).where(eq(commits.id, head.headCommitId)).limit(1);
    const snapshot = headCommit?.snapshot as TimelineSnapshot | undefined;

    // Collect used asset IDs from snapshot
    const usedAssetIds = new Set<string>();
    if (snapshot?.timeline) {
      for (const shot of snapshot.timeline) {
        if (shot.visual_asset_id) usedAssetIds.add(shot.visual_asset_id);
        if (shot.audio_asset_id) usedAssetIds.add(shot.audio_asset_id);
      }
    }

    // Determine which assets go into the release
    let releaseAssetIds: string[];
    if (body.includeMode === 'used_only') {
      releaseAssetIds = Array.from(usedAssetIds);
    } else {
      // used + selected
      // Validate selectedAssetIds belong to this workspace
      for (const assetId of body.selectedAssetIds) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
        if (!asset || asset.workspaceId !== project.workspaceId) {
          return reply.status(400).send({ error: 'Bad Request', message: `Asset ${assetId} not found or wrong workspace`, statusCode: 400 });
        }
      }
      releaseAssetIds = [...new Set([...usedAssetIds, ...body.selectedAssetIds])];
    }

    // Create release
    const [release] = await db.insert(sourceReleases).values({
      projectId,
      name: body.name,
      includeMode: body.includeMode,
      license: body.license,
      createdBy: userId,
    }).returning();

    // Insert release-asset mappings
    if (releaseAssetIds.length > 0) {
      await db.insert(sourceReleaseAssets).values(
        releaseAssetIds.map((assetId) => ({ sourceReleaseId: release.id, assetId })),
      );
    }

    return reply.status(201).send({ release, assetCount: releaseAssetIds.length });
  });

  // GET /projects/:id/releases — list releases
  app.get('/:id/releases', async (request: any, reply) => {
    const db = (app as any).db;
    const projectId = request.params.id;

    const releases = await db.select().from(sourceReleases)
      .where(eq(sourceReleases.projectId, projectId))
      .orderBy(desc(sourceReleases.createdAt));

    // Get asset counts for each release
    const result = [];
    for (const release of releases) {
      const relAssets = await db.select().from(sourceReleaseAssets)
        .where(eq(sourceReleaseAssets.sourceReleaseId, release.id));
      result.push({ ...release, assetCount: relAssets.length });
    }

    return { data: result };
  });

  // GET /projects/:id/releases/:releaseId — release detail with assets
  app.get('/:id/releases/:releaseId', async (request: any, reply) => {
    const db = (app as any).db;
    const releaseId = request.params.releaseId;

    const [release] = await db.select().from(sourceReleases).where(eq(sourceReleases.id, releaseId)).limit(1);
    if (!release) {
      return reply.status(404).send({ error: 'Not Found', message: 'Release not found', statusCode: 404 });
    }

    // Fetch included assets
    const relAssets = await db.select().from(sourceReleaseAssets)
      .where(eq(sourceReleaseAssets.sourceReleaseId, releaseId));
    const assetIds = relAssets.map((ra: any) => ra.assetId);

    let assetDetails: any[] = [];
    if (assetIds.length > 0) {
      assetDetails = await db.select({
        id: assets.id,
        type: assets.type,
        mimeType: assets.mimeType,
        bytes: assets.bytes,
        durationMs: assets.durationMs,
        width: assets.width,
        height: assets.height,
      }).from(assets).where(inArray(assets.id, assetIds));
    }

    return { release, assets: assetDetails };
  });

  // DELETE /projects/:id/releases/:releaseId — delete release
  app.delete('/:id/releases/:releaseId', async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const projectId = request.params.id;
    const releaseId = request.params.releaseId;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found', statusCode: 404 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, project.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners/admins can delete releases', statusCode: 403 });
    }

    // Delete join rows first, then release
    await db.delete(sourceReleaseAssets).where(eq(sourceReleaseAssets.sourceReleaseId, releaseId));
    await db.delete(sourceReleases).where(eq(sourceReleases.id, releaseId));

    return reply.status(200).send({ message: 'Release deleted' });
  });
}
