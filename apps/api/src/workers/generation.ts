import { eq } from 'drizzle-orm';
import { jobs, assets, safetyEvents } from '@phork/db';
import type { Database } from '@phork/db';
import type { ProvenanceManifest } from '@phork/shared';
import { signMintReceipt } from '../lib/mint';
import { saveAsset } from '../lib/storage';
import { refundJob } from '../lib/refund';
import { checkSafety } from './safety';

// Stub providers - replace with real API calls later
async function stubGenerateVideo(prompt: string, durationMs: number): Promise<{ data: Buffer; width: number; height: number }> {
  // Simulate processing time
  await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));

  // Create a minimal valid mp4 placeholder
  // In production, this would call Replicate, Runway, Stability, etc.
  const { execSync } = await import('child_process');
  const { mkdtempSync, readFileSync } = await import('fs');
  const { join } = await import('path');
  const os = await import('os');

  const tmpDir = mkdtempSync(join(os.tmpdir(), 'phork-gen-'));
  const outPath = join(tmpDir, 'out.mp4');
  const durationSec = (durationMs / 1000).toFixed(2);

  // Generate a simple color video with text overlay using ffmpeg
  // Normalize paths to forward slashes for FFmpeg compatibility on Windows
  const normalizedOutPath = outPath.replace(/\\/g, '/');
  try {
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=#7c3aed:s=1280x720:d=${durationSec}" -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${durationSec} -vf "drawtext=text='${prompt.substring(0, 40).replace(/'/g, "'")}':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -c:v libx264 -preset ultrafast -c:a aac -shortest "${normalizedOutPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
  } catch {
    // Fallback: even simpler video if drawtext filter isn't available
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=#7c3aed:s=1280x720:d=${durationSec}" -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${durationSec} -c:v libx264 -preset ultrafast -c:a aac -shortest "${normalizedOutPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
  }

  const data = readFileSync(outPath);
  return { data, width: 1280, height: 720 };
}

async function stubGenerateAudio(text: string, voice: string, speed: number): Promise<{ data: Buffer; durationMs: number }> {
  // Simulate processing time
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

  // Create a simple audio file (silence with duration based on text length)
  const { execSync } = await import('child_process');
  const { mkdtempSync, readFileSync } = await import('fs');
  const { join } = await import('path');
  const os = await import('os');

  const tmpDir = mkdtempSync(join(os.tmpdir(), 'phork-tts-'));
  const outPath = join(tmpDir, 'out.mp3');
  const durationSec = Math.max(1, Math.min(30, text.length * 0.06 / speed));

  // Generate silence as placeholder audio
  // In production, this would call ElevenLabs, OpenAI TTS, etc.
  // Normalize paths to forward slashes for FFmpeg compatibility on Windows
  const normalizedOutPath = outPath.replace(/\\/g, '/');
  execSync(
    `ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=mono" -t ${durationSec.toFixed(2)} -c:a libmp3lame -q:a 2 "${normalizedOutPath}"`,
    { stdio: 'pipe', timeout: 15000 }
  );

  const data = readFileSync(outPath);
  return { data, durationMs: Math.round(durationSec * 1000) };
}

async function stubGenerateImage(prompt: string): Promise<{ data: Buffer; width: number; height: number }> {
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));

  const { execSync } = await import('child_process');
  const { mkdtempSync, readFileSync } = await import('fs');
  const { join } = await import('path');
  const os = await import('os');

  const tmpDir = mkdtempSync(join(os.tmpdir(), 'phork-img-'));
  const outPath = join(tmpDir, 'out.png');

  // Normalize paths to forward slashes for FFmpeg compatibility on Windows
  const normalizedOutPath = outPath.replace(/\\/g, '/');
  try {
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=#7c3aed:s=1280x720" -frames:v 1 -vf "drawtext=text='${prompt.substring(0, 40).replace(/'/g, "'")}':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" "${normalizedOutPath}"`,
      { stdio: 'pipe', timeout: 10000 }
    );
  } catch {
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=#7c3aed:s=1280x720" -frames:v 1 "${normalizedOutPath}"`,
      { stdio: 'pipe', timeout: 10000 }
    );
  }

  const data = readFileSync(outPath);
  return { data, width: 1280, height: 720 };
}

export async function processGenerationJob(db: Database, jobId: string, jobType: string) {
  // Mark job as running
  await db.update(jobs).set({ status: 'running', updatedAt: new Date() }).where(eq(jobs.id, jobId));

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const request = job.request as any;
  const startedAt = new Date().toISOString();

  try {
    // Safety check
    const prompt = request.prompt || request.text || '';
    const safetyResult = await checkSafety(prompt);
    if (safetyResult.blocked) {
      // Record safety event
      await db.insert(safetyEvents).values({
        workspaceId: job.workspaceId,
        userId: job.userId,
        jobId: job.id,
        category: safetyResult.category || 'content_policy',
        entity: safetyResult.entity || null,
        action: 'blocked',
        details: { prompt: prompt.substring(0, 200), reason: safetyResult.reason },
      });

      await db.update(jobs).set({
        status: 'blocked',
        error: { message: `Blocked: ${safetyResult.reason}` },
        updatedAt: new Date(),
      }).where(eq(jobs.id, jobId));

      // Full refund for blocked jobs
      await refundJob(db, job, `${job.type} blocked by safety policy: ${safetyResult.category}`);
      return;
    }

    let assetData: Buffer;
    let assetType: string;
    let mimeType: string;
    let extension: string;
    let width: number | null = null;
    let height: number | null = null;
    let durationMs: number | null = null;

    if (jobType === 'gen_video') {
      const result = await stubGenerateVideo(request.prompt, request.duration || 4000);
      assetData = result.data;
      assetType = 'video';
      mimeType = 'video/mp4';
      extension = 'mp4';
      width = result.width;
      height = result.height;
      durationMs = request.duration || 4000;
    } else if (jobType === 'gen_audio') {
      const result = await stubGenerateAudio(request.text, request.voice || 'default', request.speed || 1.0);
      assetData = result.data;
      assetType = 'audio';
      mimeType = 'audio/mpeg';
      extension = 'mp3';
      durationMs = result.durationMs;
    } else if (jobType === 'gen_image') {
      const result = await stubGenerateImage(request.prompt);
      assetData = result.data;
      assetType = 'image';
      mimeType = 'image/png';
      extension = 'png';
      width = result.width;
      height = result.height;
    } else {
      throw new Error(`Unknown job type: ${jobType}`);
    }

    // Generate asset ID and save to storage
    const { randomUUID } = await import('crypto');
    const assetId = randomUUID();
    const storagePath = await saveAsset(assetId, assetData, extension);
    const mintSig = signMintReceipt(assetId, jobId);

    const provenance: ProvenanceManifest = {
      job_id: jobId,
      provider: 'phork-stub',
      model: `stub-${jobType}`,
      model_version: '0.1.0',
      input: {
        prompt: prompt,
        params: request,
      },
      safety: {
        blocked: false,
        events: safetyResult.warnings || [],
      },
      cost: {
        provider_cost_usd_est: 0,
        credits_charged: jobType === 'gen_video' ? 25 : jobType === 'gen_audio' ? 5 : 10,
      },
      timestamps: {
        queued_at: job.createdAt?.toISOString() || new Date().toISOString(),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
    };

    // Save asset to DB
    await db.insert(assets).values({
      id: assetId,
      workspaceId: job.workspaceId,
      type: assetType,
      mimeType,
      storageUrl: storagePath,
      bytes: assetData.length,
      durationMs,
      width,
      height,
      createdBy: job.userId,
      mintReceiptSig: mintSig,
      provenance,
      safetyFlags: safetyResult.warnings?.length ? { warnings: safetyResult.warnings } : null,
    });

    // Update job as succeeded
    await db.update(jobs).set({
      status: 'succeeded',
      result: { assetId, assetType, storagePath },
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);
    await db.update(jobs).set({
      status: 'failed',
      error: { message: error.message || 'Unknown error' },
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    // Full refund for failed jobs
    await refundJob(db, job, `${job.type} failed: ${(error.message || 'Unknown error').substring(0, 100)}`);
  }
}
