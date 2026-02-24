import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { createDb } from '@phork/db';
import { config } from './config';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { jobRoutes } from './routes/jobs';
import { creditRoutes } from './routes/credits';
import { assetRoutes } from './routes/assets';

const app = Fastify({ logger: true });

async function start() {
  // Plugins
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });

  // Database
  const db = createDb(config.databaseUrl);
  app.decorate('db', db);

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
