import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { creditAccounts, creditLedger } from '@phork/db';

export async function creditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (app as any).authenticate);

  // Get balance
  app.get('/balance', async (request: any) => {
    const db = (app as any).db;
    const workspaceId = (request.query as any).workspaceId;
    if (!workspaceId) {
      return { balance: 0 };
    }

    const [account] = await db.select().from(creditAccounts).where(eq(creditAccounts.workspaceId, workspaceId)).limit(1);
    return { balance: account?.balance || 0 };
  });

  // Get ledger
  app.get('/ledger', async (request: any) => {
    const db = (app as any).db;
    const workspaceId = (request.query as any).workspaceId;
    const projectId = (request.query as any).projectId;

    if (!workspaceId) return { data: [] };

    let query = db.select().from(creditLedger).where(eq(creditLedger.workspaceId, workspaceId));

    if (projectId) {
      query = db.select().from(creditLedger).where(eq(creditLedger.projectId, projectId));
    }

    const result = await query.orderBy(desc(creditLedger.createdAt));
    return { data: result };
  });
}
