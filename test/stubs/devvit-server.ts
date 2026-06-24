/**
 * Stand-in for '@devvit/web/server' in unit tests. Provides a small in-memory
 * Redis that implements the subset of operations the server core uses, with the
 * same semantics, so forge/profile/ranking logic can be tested without Devvit.
 */

type ZOpts = { by: 'rank' | 'score' | 'lex'; reverse?: boolean };

const strings = new Map<string, string>();
const hashes = new Map<string, Map<string, string>>();
const zsets = new Map<string, Map<string, number>>();

function hash(key: string): Map<string, string> {
  let h = hashes.get(key);
  if (!h) hashes.set(key, (h = new Map()));
  return h;
}
function zset(key: string): Map<string, number> {
  let z = zsets.get(key);
  if (!z) zsets.set(key, (z = new Map()));
  return z;
}
function sortedAsc(z: Map<string, number>): [string, number][] {
  return [...z.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
}

export const redis = {
  async get(key: string): Promise<string | undefined> {
    return strings.get(key);
  },
  async set(key: string, val: string): Promise<void> {
    strings.set(key, val);
  },
  async incrBy(key: string, n: number): Promise<number> {
    const v = (strings.has(key) ? parseInt(strings.get(key)!, 10) : 0) + n;
    strings.set(key, String(v));
    return v;
  },
  async expire(): Promise<void> {
    /* no-op in tests */
  },
  async hGet(key: string, field: string): Promise<string | undefined> {
    return hash(key).get(field);
  },
  async hSet(key: string, obj: Record<string, string>): Promise<number> {
    const h = hash(key);
    for (const [k, v] of Object.entries(obj)) h.set(k, v);
    return Object.keys(obj).length;
  },
  async hGetAll(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(hash(key));
  },
  async zAdd(key: string, ...members: { member: string; score: number }[]): Promise<number> {
    const z = zset(key);
    for (const m of members) z.set(m.member, m.score);
    return members.length;
  },
  async zIncrBy(key: string, member: string, value: number): Promise<number> {
    const z = zset(key);
    const v = (z.get(member) ?? 0) + value;
    z.set(member, v);
    return v;
  },
  async zScore(key: string, member: string): Promise<number | undefined> {
    return zset(key).get(member);
  },
  async zRank(key: string, member: string): Promise<number | undefined> {
    const idx = sortedAsc(zset(key)).findIndex(([m]) => m === member);
    return idx < 0 ? undefined : idx;
  },
  async zCard(key: string): Promise<number> {
    return zset(key).size;
  },
  async zRem(key: string, members: string[]): Promise<number> {
    const z = zset(key);
    let n = 0;
    for (const m of members) if (z.delete(m)) n++;
    return n;
  },
  async zRange(
    key: string,
    start: number,
    stop: number,
    opts: ZOpts
  ): Promise<{ member: string; score: number }[]> {
    let entries = sortedAsc(zset(key));
    if (opts.by === 'score') {
      entries = entries.filter(([, s]) => s >= start && s <= stop);
      if (opts.reverse) entries.reverse();
      return entries.map(([member, score]) => ({ member, score }));
    }
    if (opts.reverse) entries.reverse();
    const hi = stop < 0 ? entries.length - 1 : stop;
    return entries.slice(start, hi + 1).map(([member, score]) => ({ member, score }));
  },
};

export function __reset(): void {
  strings.clear();
  hashes.clear();
  zsets.clear();
}

export const reddit = {} as Record<string, unknown>;
export const context = {} as Record<string, unknown>;
export const realtime = { send: async () => {} };
export const scheduler = {} as Record<string, unknown>;
export const notifications = {} as Record<string, unknown>;
