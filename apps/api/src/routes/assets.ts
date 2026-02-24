import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createReadStream, existsSync } from 'fs';
import { assets, workspaceMembers } from '@phork/db';
import { generateSignedUrl, validateSignedUrl } from '../lib/storage';

export async function assetRoutes(app: FastifyInstance) {
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
