import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ──────────────────────────────────────────────
// Users & Workspaces
// ──────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    role: text('role').notNull(), // 'owner' | 'admin' | 'member'
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  }),
);

// ──────────────────────────────────────────────
// Projects & Branching
// ──────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  visibility: text('visibility').default('private'),
  forkLicense: text('fork_license').default('no_forks'),
  parentProjectId: uuid('parent_project_id'),
  forkedFromCommitId: uuid('forked_from_commit_id'),
});

export const commits = pgTable('commits', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  parentCommitId: uuid('parent_commit_id'),
  message: text('message'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  snapshot: jsonb('snapshot').notNull(),
});

export const projectHeads = pgTable('project_heads', {
  projectId: uuid('project_id')
    .references(() => projects.id)
    .primaryKey(),
  headCommitId: uuid('head_commit_id')
    .references(() => commits.id)
    .notNull(),
});

// ──────────────────────────────────────────────
// Assets
// ──────────────────────────────────────────────

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id)
    .notNull(),
  type: text('type').notNull(), // 'image' | 'video' | 'audio' | 'render'
  mimeType: text('mime_type'),
  storageUrl: text('storage_url').notNull(),
  bytes: integer('bytes'),
  durationMs: integer('duration_ms'),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  mintReceiptSig: text('mint_receipt_sig').notNull(),
  provenance: jsonb('provenance').notNull(),
  safetyFlags: jsonb('safety_flags'),
  upstreamAssetIds: text('upstream_asset_ids').array(),
});

// ──────────────────────────────────────────────
// Jobs
// ──────────────────────────────────────────────

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  type: text('type').notNull(), // 'gen_image' | 'gen_video' | 'gen_audio' | 'render'
  status: text('status').default('queued').notNull(), // 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked'
  request: jsonb('request').notNull(),
  result: jsonb('result'),
  error: jsonb('error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  idempotencyKey: text('idempotency_key').notNull(),
}, (table) => ({
  workspaceIdempotencyIdx: uniqueIndex('jobs_workspace_idempotency_key').on(table.workspaceId, table.idempotencyKey),
}));

// ──────────────────────────────────────────────
// Credits
// ──────────────────────────────────────────────

export const creditAccounts = pgTable('credit_accounts', {
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id)
    .primaryKey(),
  balance: integer('balance').notNull().default(0),
});

export const creditLedger = pgTable('credit_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  projectId: uuid('project_id').references(() => projects.id),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ──────────────────────────────────────────────
// Safety
// ──────────────────────────────────────────────

export const safetyEvents = pgTable('safety_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  category: text('category').notNull(),
  entity: text('entity'),
  action: text('action').notNull(), // 'blocked' | 'warned'
  createdAt: timestamp('created_at').defaultNow(),
  details: jsonb('details'),
});
