import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { sql } from 'drizzle-orm';
import { createDb } from '@phork/db';
import { config } from './config';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { jobRoutes } from './routes/jobs';
import { creditRoutes } from './routes/credits';
import { assetRoutes } from './routes/assets';
import { publishRoutes } from './routes/publish';
import { releaseRoutes } from './routes/releases';
import { analyticsRoutes } from './routes/analytics';

const app = Fastify({ logger: true });

/** Ensure required indexes exist — idempotent, runs on every startup */
async function ensureIndexes(db: ReturnType<typeof createDb>) {
  try {
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS published_renders_project_idx ON published_renders (project_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analytics_project_event_idx ON analytics_events (project_id, event)`);
  } catch (err) {
    // Non-fatal: tables may not exist yet (first deploy before db:push)
    console.warn('ensureIndexes: skipped —', (err as Error).message);
  }
}

async function start() {
  // Plugins
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });

  // Database
  const db = createDb(config.databaseUrl);
  app.decorate('db', db);

  // Ensure required indexes exist (idempotent)
  await ensureIndexes(db);

  // Auth decorator
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token', statusCode: 401 });
    }
  });

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(projectRoutes, { prefix: '/projects' });
  await app.register(jobRoutes, { prefix: '/jobs' });
  await app.register(creditRoutes, { prefix: '/credits' });
  await app.register(assetRoutes, { prefix: '/assets' });
  await app.register(publishRoutes, { prefix: '/publish' });
  await app.register(releaseRoutes, { prefix: '/projects' });
  await app.register(analyticsRoutes, { prefix: '/analytics' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Start
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Phork API running on port ${config.port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
