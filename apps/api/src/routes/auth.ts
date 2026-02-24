import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { users, workspaces, workspaceMembers, creditAccounts } from '@phork/db';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const db = (app as any).db;

    // Check existing user
    const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Conflict', message: 'Email already registered', statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const [user] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      displayName: body.displayName || body.email.split('@')[0],
    }).returning();

    // Create default workspace
    const [workspace] = await db.insert(workspaces).values({
      name: `${user.displayName}'s Workspace`,
      createdBy: user.id,
    }).returning();

    // Add user as owner
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    });

    // Initialize credits (1000 starter credits)
    await db.insert(creditAccounts).values({
      workspaceId: workspace.id,
      balance: 1000,
    });

    const token = app.jwt.sign({ userId: user.id, email: user.email });

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      workspace: { id: workspace.id, name: workspace.name },
    });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const db = (app as any).db;

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 });
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email });

    // Get user's workspaces
    const memberRows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));

    return { token, user: { id: user.id, email: user.email, displayName: user.displayName }, workspaces: memberRows };
  });

  app.get('/me', { preHandler: [(app as any).authenticate] }, async (request: any) => {
    const db = (app as any).db;
    const [user] = await db.select().from(users).where(eq(users.id, request.user.userId)).limit(1);
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }
    const memberRows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
    return { user: { id: user.id, email: user.email, displayName: user.displayName }, workspaces: memberRows };
  });
}
