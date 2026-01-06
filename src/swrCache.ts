/**
 * Goal:
 * - All caches are created ONLY via CacheFactory.
 * - Every cache created is registered.
 * - SwrCache and SwrKeyedCache are related: SwrCache is a thin wrapper around SwrKeyedCache.
 *
 * Pattern:
 * - Keep SwrKeyedCache as the "engine".
 * - Make SwrCache wrap a SwrKeyedCache<Map<UUID, T>> with a single internal key.
 * - Caches can only be constructed with a factory. Only one factory exists.
 */

import { UUID } from "./types";

type Identified = { id: UUID };

interface CacheHandle {
  invalidateAll(): void;
  clearAll(): void;
}

interface CacheState<V> {
  value: V | null;
  lastFetchedMs: number | null;
  inFlight: Promise<V> | null;
}

export class SwrKeyedCache<V> implements CacheHandle {
  private store = new Map<string, CacheState<V>>();

  constructor(private readonly ttlMs: number) {}

  private nowMs(): number {
    return Date.now();
  }

  private isFresh(entry: { lastFetchedMs: number | null }): boolean {
    return (
      entry.lastFetchedMs !== null &&
      this.nowMs() - entry.lastFetchedMs < this.ttlMs
    );
  }

  private entry(key: string): CacheState<V> {
    const existing = this.store.get(key);
    if (existing) return existing;
    const e: CacheState<V> = {
      value: null,
      lastFetchedMs: null,
      inFlight: null,
    };
    this.store.set(key, e);
    return e;
  }

  peek(key: string): V | null {
    return this.store.get(key)?.value ?? null;
  }

  async fetch(key: string, fetcher: () => Promise<V>): Promise<V> {
    const e = this.entry(key);

    if (e.value !== null) {
      if (!this.isFresh(e)) {
        void this.refresh(key, fetcher).catch((err) => {
          console.error(`SWR refresh failed for key=${key}`, err);
        });
      }
      return e.value;
    }

    return await this.refresh(key, fetcher);
  }

  async refresh(key: string, fetcher: () => Promise<V>): Promise<V> {
    const e = this.entry(key);
    if (e.inFlight) return e.inFlight;

    e.inFlight = (async () => {
      const v = await fetcher();
      e.value = v;
      e.lastFetchedMs = this.nowMs();
      return v;
    })().finally(() => {
      e.inFlight = null;
    });

    return e.inFlight;
  }

  set(key: string, value: V): void {
    const e = this.entry(key);
    e.value = value;
  }

  invalidate(key: string): void {
    const e = this.entry(key);
    e.lastFetchedMs = null;
  }

  invalidateWhere(predicate: (key: string) => boolean): void {
    for (const key of this.store.keys()) {
      if (predicate(key)) this.invalidate(key);
    }
  }

  invalidateAll(): void {
    for (const e of this.store.values()) e.lastFetchedMs = null;
  }

  clearAll(): void {
    this.store.clear();
  }

  getInnerMap(): Map<string, V> {
    return new Map(
      Array.from(this.store.entries())
        .map(([k, s]) => [k, s.value] as [string, V | null])
        .filter(([, v]) => v !== null),
    ) as Map<string, V>;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }
}

export class SwrIdCache<T extends Identified> implements CacheHandle {
  private static readonly KEY = "__all__";
  private readonly inner: SwrKeyedCache<Map<UUID, T>>;

  constructor(private readonly ttlMs: number) {
    this.inner = new SwrKeyedCache<Map<UUID, T>>(ttlMs);
  }

  private async buildMap(fetchCall: () => Promise<T[]>): Promise<Map<UUID, T>> {
    const rows = await fetchCall();
    const map = new Map<UUID, T>();
    for (const r of rows) map.set(r.id, r);
    return map;
  }

  async fetch(fetchCall: () => Promise<T[]>): Promise<Map<UUID, T>> {
    return this.inner.fetch(SwrIdCache.KEY, () => this.buildMap(fetchCall));
  }

  async refresh(fetchCall: () => Promise<T[]>): Promise<Map<UUID, T>> {
    return this.inner.refresh(SwrIdCache.KEY, () => this.buildMap(fetchCall));
  }

  upsert(row: T): void {
    const current = this.inner.peek(SwrIdCache.KEY);
    if (current) {
      current.set(row.id, row);
      return;
    }
    const map = new Map<UUID, T>();
    map.set(row.id, row);
    this.inner.set(SwrIdCache.KEY, map);
  }

  delete(id: UUID): void {
    this.inner.peek(SwrIdCache.KEY)?.delete(id);
  }

  invalidate(): void {
    this.inner.invalidate(SwrIdCache.KEY);
  }

  peek(): Map<UUID, T> | null {
    return this.inner.peek(SwrIdCache.KEY);
  }

  invalidateAll(): void {
    this.inner.invalidateAll();
  }

  clearAll(): void {
    this.inner.clearAll();
  }

  getInnerMap() {
    return this.inner.peek(SwrIdCache.KEY)!;
  }
}

type CacheCtor<T extends CacheHandle> = abstract new (...args: any[]) => T;

class CacheFactory implements CacheHandle {
  private readonly registry = new Map<string, CacheHandle>();

  private getOrCreate<T extends CacheHandle>(
    name: string,
    ctor: CacheCtor<T>,
    create: () => T,
  ): T {
    const existing = this.registry.get(name);

    if (existing) {
      if (!(existing instanceof ctor)) {
        throw new Error(
          `CacheFactory: cache "${name}" exists but has wrong type. ` +
            `Expected ${ctor.name}, got ${existing.constructor?.name ?? "unknown"}`,
        );
      }
      return existing;
    }

    const cache = create();
    if (!(cache instanceof ctor)) {
      throw new Error(
        `CacheFactory: create() for "${name}" returned wrong type. ` +
          `Expected ${ctor.name}, got ${cache.constructor?.name ?? "unknown"}`,
      );
    }

    this.registry.set(name, cache);
    return cache;
  }

  getOrCreateSwrIdCache<T extends Identified>(
    name: string,
    ttlMs: number,
  ): SwrIdCache<T> {
    // NOTE: pass the *class* SwrIdCache (no generics at runtime)
    return this.getOrCreate(
      name,
      SwrIdCache<T>,
      () => new SwrIdCache<T>(ttlMs),
    );
  }

  getOrCreateSwrKeyedCache<V>(name: string, ttlMs: number): SwrKeyedCache<V> {
    // NOTE: pass the *class* SwrKeyedCache (no generics at runtime)
    return this.getOrCreate(
      name,
      SwrKeyedCache<V>,
      () => new SwrKeyedCache<V>(ttlMs),
    );
  }

  invalidateAll(): void {
    for (const c of this.registry.values()) c.invalidateAll();
  }

  clearAll(): void {
    for (const c of this.registry.values()) c.clearAll();
  }

  invalidate(name: string): void {
    this.registry.get(name)?.invalidateAll();
  }

  clear(name: string): void {
    this.registry.get(name)?.clearAll();
  }

  listNames(): string[] {
    return Array.from(this.registry.keys());
  }
}

export const CACHE_FACTORY = new CacheFactory();
