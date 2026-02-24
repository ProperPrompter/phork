/**
 * Seed script for Phase 1 QA
 * Creates a test user, workspace, project with shots, and generates stub assets.
 *
 * Usage: npx tsx src/scripts/seed.ts
 * Requires: DATABASE_URL environment variable or defaults to local Postgres
 */
import { createDb } from '@phork/db';
import {
  users, workspaces, workspaceMembers, creditAccounts,
  projects, commits, projectHeads, assets, jobs, creditLedger,
} from '@phork/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID, createHmac } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://phork:phork@localhost:5432/phork';
const MINT_SECRET = process.env.MINT_RECEIPT_SECRET || 'dev-mint-secret';

function signMint(assetId: string, jobId: string): string {
  const hmac = createHmac('sha256', MINT_SECRET);
  hmac.update(`${assetId}:${jobId}`);
  return hmac.digest('hex');
}

async function seed() {
  console.log('Seeding Phork database...');
  const db = createDb(DATABASE_URL);

  // Clean existing seed data (if re-running)
  console.log('  Cleaning existing seed data...');

  // Create test user
  const passwordHash = await bcrypt.hash('testpass123', 10);
  let [user] = await db.select().from(users).where(eq(users.email, 'test@phork.ai')).limit(1);

  if (!user) {
    [user] = await db.insert(users).values({
      email: 'test@phork.ai',
      passwordHash,
      displayName: 'Test User',
    }).returning();
    console.log('  Created test user:', user.email);
  } else {
    console.log('  Test user already exists:', user.email);
  }

  // Create workspace
  let workspace: any;
  const existingMembers = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
  if (existingMembers.length > 0) {
    [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, existingMembers[0].workspaceId)).limit(1);
    console.log('  Workspace already exists:', workspace.name);
  } else {
    [workspace] = await db.insert(workspaces).values({
      name: "Test User's Workspace",
      createdBy: user.id,
    }).returning();

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    });

    await db.insert(creditAccounts).values({
      workspaceId: workspace.id,
      balance: 5000,
    });
    console.log('  Created workspace with 5000 credits');
  }

  // Create a sample project
  const [project] = await db.insert(projects).values({
    workspaceId: workspace.id,
    name: 'Demo: Space Adventure',
    description: 'A short demo video about a space adventure',
    createdBy: user.id,
  }).returning();
  console.log('  Created project:', project.name);

  // Create 3 stub assets (simulating generated content)
  const assetIds: string[] = [];
  const shotPrompts = [
    'A rocket launching from Earth into a starry sky, cinematic wide angle',
    'An astronaut floating in space with Earth in the background, golden hour lighting',
    'A spaceship approaching a distant planet with rings, sci-fi atmosphere',
  ];

  for (let i = 0; i < 3; i++) {
    const assetId = randomUUID();
    const jobId = randomUUID();
    const mintSig = signMint(assetId, jobId);

    // Create a stub job record
    await db.insert(jobs).values({
      id: jobId,
      workspaceId: workspace.id,
      userId: user.id,
      projectId: project.id,
      type: 'gen_video',
      status: 'succeeded',
      request: { prompt: shotPrompts[i], duration: 4000 },
      result: { assetId },
      idempotencyKey: `seed-video-${project.id}-${i}`,
    });

    // Create asset record
    await db.insert(assets).values({
      id: assetId,
      workspaceId: workspace.id,
      type: 'video',
      mimeType: 'video/mp4',
      storageUrl: `./storage/seed/${assetId}.mp4`, // Placeholder path
      bytes: 50000,
      durationMs: 4000,
      width: 1280,
      height: 720,
      createdBy: user.id,
      mintReceiptSig: mintSig,
      provenance: {
        job_id: jobId,
        provider: 'phork-stub',
        model: 'stub-gen_video',
        model_version: '0.1.0',
        input: { prompt: shotPrompts[i], params: { duration: 4000 } },
        safety: { blocked: false },
        cost: { provider_cost_usd_est: 0, credits_charged: 25 },
        timestamps: {
          queued_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        },
      },
    });

    // Ledger entry
    await db.insert(creditLedger).values({
      workspaceId: workspace.id,
      userId: user.id,
      jobId,
      projectId: project.id,
      delta: -25,
      reason: 'gen_video job (seed)',
    });

    assetIds.push(assetId);
    console.log(`  Created seed asset ${i + 1}/3`);
  }

  // Create initial commit with empty timeline
  const [initCommit] = await db.insert(commits).values({
    projectId: project.id,
    parentCommitId: null,
    message: 'Initial commit',
    createdBy: user.id,
    snapshot: { timeline: [] },
  }).returning();

  // Create second commit with the 3 shots
  const [shotCommit] = await db.insert(commits).values({
    projectId: project.id,
    parentCommitId: initCommit.id,
    message: 'Add 3 shots for space adventure',
    createdBy: user.id,
    snapshot: {
      timeline: assetIds.map((assetId, i) => ({
        shot_id: randomUUID(),
        visual_asset_id: assetId,
        audio_asset_id: null,
        duration_ms: 4000,
        trim_in_ms: 0,
        trim_out_ms: 4000,
        subtitle: shotPrompts[i].substring(0, 50),
      })),
    },
  }).returning();

  // Set project head
  await db.insert(projectHeads).values({
    projectId: project.id,
    headCommitId: shotCommit.id,
  });

  console.log('  Created commits with 3-shot timeline');

  // Update credit balance
  await db.update(creditAccounts)
    .set({ balance: 4925 }) // 5000 - 3*25
    .where(eq(creditAccounts.workspaceId, workspace.id));

  console.log('\nSeed complete!');
  console.log('  Login: test@phork.ai / testpass123');
  console.log(`  Workspace: ${workspace.id}`);
  console.log(`  Project: ${project.id}`);
  console.log(`  Head Commit: ${shotCommit.id} (3 shots)`);
  console.log(`  Credits remaining: 4925`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
