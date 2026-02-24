import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createDb } from '@phork/db';
import { config } from '../config';
import { processGenerationJob } from './generation';
import { processRenderJob } from './render';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
const db = createDb(config.databaseUrl);

// Generation worker
const generationWorker = new Worker(
  'generation',
  async (job) => {
    console.log(`[generation] Processing job ${job.id}, type: ${job.name}`);
    await processGenerationJob(db, job.data.jobId, job.name);
  },
  { connection, concurrency: 3 }
);

generationWorker.on('completed', (job) => {
  console.log(`[generation] Job ${job.id} completed`);
});

generationWorker.on('failed', (job, err) => {
  console.error(`[generation] Job ${job?.id} failed:`, err.message);
});

// Render worker
const renderWorker = new Worker(
  'render',
  async (job) => {
    console.log(`[render] Processing job ${job.id}`);
    await processRenderJob(db, job.data.jobId);
  },
  { connection, concurrency: 1 }
);

renderWorker.on('completed', (job) => {
  console.log(`[render] Job ${job.id} completed`);
});

renderWorker.on('failed', (job, err) => {
  console.error(`[render] Job ${job?.id} failed:`, err.message);
});

console.log('Phork workers started. Waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await generationWorker.close();
  await renderWorker.close();
  process.exit(0);
});
