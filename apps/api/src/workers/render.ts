import { eq } from 'drizzle-orm';
import { jobs, commits, assets, projects, analyticsEvents } from '@phork/db';
import type { Database } from '@phork/db';
import type { TimelineSnapshot, ProvenanceManifest } from '@phork/shared';
import { signMintReceipt } from '../lib/mint';
import { saveAsset } from '../lib/storage';
import { refundJob } from '../lib/refund';
import { execSync, exec } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export async function processRenderJob(db: Database, jobId: string) {
  // Mark job as running
  await db.update(jobs).set({ status: 'running', updatedAt: new Date() }).where(eq(jobs.id, jobId));

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const request = job.request as any;
  const startedAt = new Date().toISOString();

  try {
    // Fetch the commit snapshot
    const [commit] = await db.select().from(commits).where(eq(commits.id, request.commitId)).limit(1);
    if (!commit) throw new Error(`Commit ${request.commitId} not found`);

    const snapshot = commit.snapshot as TimelineSnapshot;
    if (!snapshot.timeline || snapshot.timeline.length === 0) {
      throw new Error('Timeline is empty, nothing to render');
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'phork-render-'));
    const shotAssetIds: string[] = [];

    // Resolve all shot assets and build ffmpeg concat input
    const concatEntries: string[] = [];

    for (let i = 0; i < snapshot.timeline.length; i++) {
      const shot = snapshot.timeline[i];

      if (shot.visual_asset_id) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, shot.visual_asset_id)).limit(1);
        if (!asset) throw new Error(`Visual asset ${shot.visual_asset_id} not found`);

        shotAssetIds.push(asset.id);
        // Copy asset to temp dir for ffmpeg
        const ext = asset.mimeType?.split('/')[1] || 'mp4';
        const tmpPath = join(tmpDir, `shot_${i}.${ext}`);

        if (existsSync(asset.storageUrl)) {
          const data = readFileSync(asset.storageUrl);
          writeFileSync(tmpPath, data);
        } else {
          throw new Error(`Asset file not found at ${asset.storageUrl}`);
        }

        concatEntries.push(`file '${tmpPath.replace(/\\/g, '/')}'`);
      } else {
        // Generate a blank clip for shots without visuals
        const blankPath = join(tmpDir, `shot_${i}_blank.mp4`);
        const durationSec = (shot.duration_ms / 1000).toFixed(2);
        execSync(
          `ffmpeg -y -f lavfi -i "color=c=black:s=1280x720:d=${durationSec}" -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${durationSec} -c:v libx264 -preset ultrafast -c:a aac -shortest "${blankPath}"`,
          { stdio: 'pipe', timeout: 15000 }
        );
        concatEntries.push(`file '${blankPath.replace(/\\/g, '/')}'`);
      }

      // Track audio assets for provenance
      if (shot.audio_asset_id) {
        shotAssetIds.push(shot.audio_asset_id);
      }
    }

    // Write concat file
    const concatPath = join(tmpDir, 'concat.txt');
    writeFileSync(concatPath, concatEntries.join('\n'));

    // Run ffmpeg concat — try stream copy first, fall back to re-encode
    const outputPath = join(tmpDir, 'render.mp4');
    try {
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatPath.replace(/\\/g, '/')}" -c copy "${outputPath.replace(/\\/g, '/')}"`,
        { stdio: 'pipe', timeout: 120000 }
      );
    } catch {
      // Stream copy failed (codec mismatch between shots) — re-encode
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatPath.replace(/\\/g, '/')}" -c:v libx264 -preset fast -c:a aac "${outputPath.replace(/\\/g, '/')}"`,
        { stdio: 'pipe', timeout: 120000 }
      );
    }

    const renderData = readFileSync(outputPath);
    const renderAssetId = randomUUID();
    const storagePath = await saveAsset(renderAssetId, renderData, 'mp4');
    const mintSig = signMintReceipt(renderAssetId, jobId);

    const provenance: ProvenanceManifest = {
      job_id: jobId,
      provider: 'phork-render',
      model: 'ffmpeg-concat',
      model_version: '1.0.0',
      input: {
        prompt: `Render of commit ${request.commitId}`,
        params: {
          commitId: request.commitId,
          shotCount: snapshot.timeline.length,
          shotAssetIds,
        },
      },
      safety: { blocked: false },
      cost: {
        provider_cost_usd_est: 0,
        credits_charged: 15,
      },
      timestamps: {
        queued_at: job.createdAt?.toISOString() || new Date().toISOString(),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      upstream: shotAssetIds.map((id) => ({ asset_id: id, relation: 'render_source' })),
    };

    // Save render asset
    await db.insert(assets).values({
      id: renderAssetId,
      workspaceId: job.workspaceId,
      type: 'render',
      mimeType: 'video/mp4',
      storageUrl: storagePath,
      bytes: renderData.length,
      width: 1280,
      height: 720,
      createdBy: job.userId,
      mintReceiptSig: mintSig,
      provenance,
      upstreamAssetIds: shotAssetIds,
    });

    // Update job
    await db.update(jobs).set({
      status: 'succeeded',
      result: { assetId: renderAssetId, commitId: request.commitId },
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    // Record fork_rendered analytics if this is a forked project
    try {
      if (!job.projectId) throw new Error('No projectId');
      const [proj] = await db.select().from(projects).where(eq(projects.id, job.projectId)).limit(1);
      if (proj?.parentProjectId) {
        await db.insert(analyticsEvents).values({
          workspaceId: job.workspaceId,
          userId: job.userId,
          projectId: proj.parentProjectId, // attribute to the source project
          event: 'fork_rendered',
          metadata: { forkProjectId: proj.id, renderAssetId },
        });
      }
    } catch (e) {
      console.warn('Failed to record fork_rendered analytics:', e);
    }

  } catch (error: any) {
    console.error(`Render job ${jobId} failed:`, error);
    await db.update(jobs).set({
      status: 'failed',
      error: { message: error.message || 'Render failed' },
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    // Full refund for failed render jobs
    await refundJob(db, job, `render failed: ${(error.message || 'Render failed').substring(0, 100)}`);
  }
}
