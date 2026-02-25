import { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { createReadStream, existsSync } from 'fs';
import { assets, workspaceMembers, projectHeads, commits } from '@phork/db';
import { generateSignedUrl, validateSignedUrl } from '../lib/storage';
import type { TimelineSnapshot } from '@phork/shared';

export async function assetRoutes(app: FastifyInstance) {
  // List assets with optional classification (requires auth + workspace membership)
  app.get('/', { preHandler: [(app as any).authenticate] }, async (request: any, reply) => {
    const db = (app as any).db;
    const userId = request.user.userId;
    const workspaceId = (request.query as any).workspaceId;
    const projectId = (request.query as any).projectId;
    const classification = (request.query as any).classification || 'all';

    if (!workspaceId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'workspaceId required', statusCode: 400 });
    }

    const [membership] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace', statusCode: 403 });
    }

    const allAssets = await db.select().from(assets)
      .where(eq(assets.workspaceId, workspaceId))
      .orderBy(desc(assets.createdAt));

    // Determine used set from project head if projectId provided
    const usedAssetIds = new Set<string>();
    if (projectId) {
      const [head] = await db.select().from(projectHeads).where(eq(projectHeads.projectId, projectId)).limit(1);
      if (head) {
        const [headCommit] = await db.select().from(commits).where(eq(commits.id, head.headCommitId)).limit(1);
        const snapshot = headCommit?.snapshot as TimelineSnapshot | undefined;
        if (snapshot?.timeline) {
          for (const shot of snapshot.timeline) {
            if (shot.visual_asset_id) usedAssetIds.add(shot.visual_asset_id);
            if (shot.audio_asset_id) usedAssetIds.add(shot.audio_asset_id);
          }
        }
      }
    }

    let filtered;
    if (classification === 'used' && projectId) {
      filtered = allAssets.filter((a: any) => usedAssetIds.has(a.id));
    } else if (classification === 'vault' && projectId) {
      filtered = allAssets.filter((a: any) => !usedAssetIds.has(a.id) && a.type !== 'render');
    } else {
      filtered = allAssets;
    }

    const usedCount = allAssets.filter((a: any) => usedAssetIds.has(a.id)).length;
    const vaultCount = allAssets.filter((a: any) => !usedAssetIds.has(a.id) && a.type !== 'render').length;

    return { data: filtered, usedCount, vaultCount };
  });

  // Get asset metadata + signed download URL (requires auth + workspace membership)
  app.get('/:id', { preHandler: [(app as any).authenticate] }, async (request: any, reply) => {
    const db = (app as any).db;
    const assetId = request.params.id;
    const userId = request.user.userId;

    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!asset) {
      return reply.status(404).send({ error: 'Not Found', message: 'Asset not found', statusCode: 404 });
    }

    // Workspace membership check
    const [membership] = await db.select().from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, asset.workspaceId),
        eq(workspaceMembers.userId, userId)
      ))
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this asset\'s workspace', statusCode: 403 });
    }

    // Generate signed download URL
    const protocol = request.protocol || 'http';
    const host = request.hostname || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;
    const downloadUrl = generateSignedUrl(assetId, baseUrl);

    return { ...asset, downloadUrl };
  });

  // Stream asset file — protected by signed URL token (no JWT needed, but time-limited + tamper-proof)
  app.get('/:id/file', async (request: any, reply) => {
    const db = (app as any).db;
    const assetId = request.params.id;
    const token = (request.query as any).token;
    const expires = (request.query as any).expires;

    // Validate signed URL
    if (!token || !expires) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Missing signed URL parameters. Obtain a download URL from GET /assets/:id', statusCode: 401 });
    }

    if (!validateSignedUrl(assetId, token, expires)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Invalid or expired download URL', statusCode: 403 });
    }

    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!asset) {
      return reply.status(404).send({ error: 'Not Found', message: 'Asset not found', statusCode: 404 });
    }

    if (!existsSync(asset.storageUrl)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Asset file not found on disk', statusCode: 404 });
    }

    const stream = createReadStream(asset.storageUrl);
    return reply
      .type(asset.mimeType || 'application/octet-stream')
      .header('Content-Length', asset.bytes || undefined)
      .header('Cache-Control', 'private, max-age=900')
      .send(stream);
  });
}
