import {
  parseDecision,
  type Decision,
  type Revision,
  type SavedDecision,
} from './domain';
import { canonical, digest, revisionDigest } from './proof';
export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
type Row = {
  decision_id: string;
  revision: number;
  parent_digest: string;
  digest: string;
  snapshot: string;
  created_at: string;
  note: string;
};
function revision(row: Row): Revision {
  return {
    decisionId: row.decision_id,
    revision: row.revision,
    parentDigest: row.parent_digest,
    digest: row.digest,
    snapshot: parseDecision(JSON.parse(row.snapshot)),
    createdAt: row.created_at,
    note: row.note,
  };
}
export class RepositoryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class DecisionRepository {
  constructor(private db: Database) {}
  async list(owner: string): Promise<SavedDecision[]> {
    const { results } = await this.db
      .prepare(
        'SELECT d.id,r.title,r.revision,r.digest,r.created_at AS updatedAt FROM decisions d JOIN revisions r ON r.decision_id=d.id WHERE d.owner=? AND r.revision=(SELECT MAX(revision) FROM revisions WHERE decision_id=d.id) ORDER BY r.created_at DESC LIMIT 100',
      )
      .bind(owner)
      .all<SavedDecision>();
    return results;
  }
  async history(owner: string, id: string): Promise<Revision[]> {
    const { results } = await this.db
      .prepare(
        'SELECT r.* FROM revisions r JOIN decisions d ON d.id=r.decision_id WHERE d.owner=? AND d.id=? ORDER BY r.revision ASC LIMIT 100',
      )
      .bind(owner, id)
      .all<Row>();
    if (!results.length) throw new RepositoryError(404, 'Decision not found.');
    return results.map(revision);
  }
  async save(
    owner: string,
    id: string,
    expected: number,
    input: Decision,
    note: string,
    requestId: string,
  ): Promise<Revision> {
    const snapshot = parseDecision(input);
    const fingerprint = await digest({ expected, snapshot, note });
    const existing = await this.db
      .prepare('SELECT owner FROM decisions WHERE id=?')
      .bind(id)
      .first<{ owner: string }>();
    if (existing && existing.owner !== owner)
      throw new RepositoryError(404, 'Decision not found.');
    if (!existing && expected !== 0)
      throw new RepositoryError(
        409,
        'This decision no longer matches the saved revision.',
      );
    if (existing) {
      const replay = await this.db
        .prepare('SELECT * FROM revisions WHERE decision_id=? AND request_id=?')
        .bind(id, requestId)
        .first<Row & { fingerprint: string }>();
      if (replay) {
        if (replay.fingerprint !== fingerprint)
          throw new RepositoryError(
            409,
            'An idempotency key cannot be reused for different content.',
          );
        return revision(replay);
      }
    }
    const previous = existing
      ? await this.db
          .prepare(
            'SELECT revision,digest FROM revisions WHERE decision_id=? ORDER BY revision DESC LIMIT 1',
          )
          .bind(id)
          .first<{ revision: number; digest: string }>()
      : null;
    if ((previous?.revision ?? 0) !== expected)
      throw new RepositoryError(
        409,
        'A newer revision exists. Reload it before saving; your draft has not been overwritten.',
      );
    if (expected >= 100)
      throw new RepositoryError(
        422,
        'This decision has reached 100 revisions. Export it and start a new decision.',
      );
    const createdAt = new Date().toISOString();
    const payload = {
      decisionId: id,
      revision: expected + 1,
      parentDigest: previous?.digest ?? 'genesis',
      snapshot,
      createdAt,
      note,
    };
    const proof = await revisionDigest(payload);
    if (!existing)
      await this.db
        .prepare(
          'INSERT INTO decisions (id,owner,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM decisions WHERE owner=?) < 100 ON CONFLICT(id) DO NOTHING',
        )
        .bind(id, owner, createdAt, owner)
        .run();
    // A single conditional append is the compare-and-swap. Concurrent writers cannot both win.
    const inserted = await this.db
      .prepare(
        'INSERT INTO revisions (decision_id,revision,parent_digest,digest,snapshot,title,created_at,note,request_id,fingerprint) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM decisions WHERE id=? AND owner=?) AND COALESCE((SELECT MAX(revision) FROM revisions WHERE decision_id=?),0)=? ON CONFLICT DO NOTHING RETURNING *',
      )
      .bind(
        id,
        expected + 1,
        payload.parentDigest,
        proof,
        canonical(snapshot),
        snapshot.title,
        createdAt,
        note,
        requestId,
        fingerprint,
        id,
        owner,
        id,
        expected,
      )
      .first<Row>();
    if (!inserted) {
      const replay = await this.db
        .prepare(
          'SELECT r.* FROM revisions r JOIN decisions d ON d.id=r.decision_id WHERE d.owner=? AND r.decision_id=? AND r.request_id=? AND r.fingerprint=?',
        )
        .bind(owner, id, requestId, fingerprint)
        .first<Row>();
      if (replay) return revision(replay);
      throw new RepositoryError(
        409,
        'Save conflict or workspace limit reached. Reload saved history; your draft is preserved.',
      );
    }
    return revision(inserted);
  }
  async reserveInference(owner: string, now = Date.now()): Promise<boolean> {
    const bucket = Math.floor(now / 3600000);
    const result = await this.db
      .prepare(
        'INSERT INTO quotas (owner,bucket,count) VALUES (?,?,1) ON CONFLICT(owner,bucket) DO UPDATE SET count=count+1 WHERE count<10 RETURNING count',
      )
      .bind(owner, bucket)
      .first<{ count: number }>();
    return result !== null;
  }
}
