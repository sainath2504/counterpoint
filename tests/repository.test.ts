import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  DecisionRepository,
  type Database,
  type Statement,
} from '../lib/repository';
import { infrastructure } from '../lib/fixtures';
import { verifyHistory, digest, canonical } from '../lib/proof';
class SqliteStatement implements Statement {
  private values: (string | number | null)[] = [];
  constructor(
    private db: DatabaseSync,
    private query: string,
  ) {}
  bind(...values: (string | number | null)[]) {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (
      (this.db.prepare(this.query).get(...this.values) as T | undefined) ?? null
    );
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.query).all(...this.values) as T[] };
  }
  async run() {
    return this.db.prepare(this.query).run(...this.values);
  }
}
// The adapter is confined to tests; real SQL executes against SQLite, not a mocked repository.
let db: DatabaseSync;
let repo: DecisionRepository;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    db.exec(
      readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'),
    );
  const adapter: Database = {
    prepare: (q) => new SqliteStatement(db, q),
    batch: async (statements) => {
      db.exec('BEGIN');
      try {
        const result = await Promise.all(statements.map((s) => s.run()));
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  repo = new DecisionRepository(adapter);
});
afterEach(() => db.close());
describe('persistent revision journal', () => {
  it('saves and loads a complete decision', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    expect((await repo.history('alice', 'decision1'))[0].snapshot).toEqual(
      infrastructure,
    );
    expect(await repo.list('alice')).toHaveLength(1);
  });
  it('isolates owners on list and read', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    expect(await repo.list('bob')).toEqual([]);
    await expect(repo.history('bob', 'decision1')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('rejects cross-owner writes', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    await expect(
      repo.save('bob', 'decision1', 1, infrastructure, 'Attack', 'request_2'),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects stale revision writes', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    await expect(
      repo.save('alice', 'decision1', 0, infrastructure, 'Stale', 'request_2'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('retries idempotently without duplicating a revision', async () => {
    const first = await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    const retry = await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    expect(retry).toEqual(first);
    expect(await repo.history('alice', 'decision1')).toHaveLength(1);
  });
  it('rejects an idempotency key reused with new content', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    await expect(
      repo.save(
        'alice',
        'decision1',
        0,
        { ...infrastructure, title: 'Changed' },
        'Initial',
        'request_1',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('allows exactly one winner in a concurrent append race', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    const results = await Promise.allSettled([
      repo.save('alice', 'decision1', 1, infrastructure, 'A', 'request_2'),
      repo.save('alice', 'decision1', 1, infrastructure, 'B', 'request_3'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await repo.history('alice', 'decision1')).toHaveLength(2);
  });
  it('links and verifies successive snapshots', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    await repo.save(
      'alice',
      'decision1',
      1,
      { ...infrastructure, title: 'Revised' },
      'Changed title',
      'request_2',
    );
    expect(await verifyHistory(await repo.history('alice', 'decision1'))).toBe(
      true,
    );
  });
  it('detects modified snapshot text', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    const history = await repo.history('alice', 'decision1');
    history[0].snapshot.title = 'Tampered';
    expect(await verifyHistory(history)).toBe(false);
  });
  it('detects a missing first revision', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      infrastructure,
      'Initial',
      'request_1',
    );
    await repo.save(
      'alice',
      'decision1',
      1,
      infrastructure,
      'Second',
      'request_2',
    );
    expect(
      await verifyHistory((await repo.history('alice', 'decision1')).slice(1)),
    ).toBe(false);
  });
  it('treats SQL-looking titles as data', async () => {
    await repo.save(
      'alice',
      'decision1',
      0,
      { ...infrastructure, title: "'); DROP TABLE decisions; --" },
      'Initial',
      'request_1',
    );
    expect(await repo.list('alice')).toHaveLength(1);
  });
  it('enforces an atomic inference quota and resets by hour', async () => {
    for (let i = 0; i < 10; i++)
      expect(await repo.reserveInference('alice', 0)).toBe(true);
    expect(await repo.reserveInference('alice', 0)).toBe(false);
    expect(await repo.reserveInference('bob', 0)).toBe(true);
    expect(await repo.reserveInference('alice', 3600000)).toBe(true);
  });
  it('canonicalizes object keys but preserves array order', async () => {
    expect(await digest({ b: 2, a: 1 })).toBe(await digest({ a: 1, b: 2 }));
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]));
  });
  it('rejects non-JSON hash inputs', () =>
    expect(() => canonical({ bad: undefined })).toThrow());
});
