import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const decisions = sqliteTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_decisions_owner').on(t.owner)],
);
export const revisions = sqliteTable(
  'revisions',
  {
    decisionId: text('decision_id')
      .notNull()
      .references(() => decisions.id),
    revision: integer('revision').notNull(),
    parentDigest: text('parent_digest').notNull(),
    digest: text('digest').notNull(),
    snapshot: text('snapshot').notNull(),
    title: text('title').notNull(),
    createdAt: text('created_at').notNull(),
    note: text('note').notNull(),
    requestId: text('request_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.decisionId, t.revision] }),
    uniqueIndex('idx_revisions_request').on(t.decisionId, t.requestId),
  ],
);
export const quotas = sqliteTable(
  'quotas',
  {
    owner: text('owner').notNull(),
    bucket: integer('bucket').notNull(),
    count: integer('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.bucket] })],
);
