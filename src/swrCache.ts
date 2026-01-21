import { UUID } from "./types";

type CacheEvent =
  | { type: "write"; cacheName: string; key?: string }
  | { type: "delete"; cacheName: string; key?: string }
  | { type: "clearAll"; cacheName: string; key?: never };

type NotifyEvent =
  | { type: "write"; key?: string }
  | { type: "delete"; key?: string }
  | { type: "clearAll"; key?: never };

type CacheListener = (e: CacheEvent) => void;

type Identified = { id: UUID };

interface CacheHandle {
  invalidateAll(): void;
  clearAll(): void;
}

interface CacheState<V> {
  value: V | null;
  lastFetchedMs: number | null;
  inFlight: Promise<V> | null;
  version: number;
}

export class SwrKeyedCache<V> implements CacheHandle {
  private store = new Map<string, CacheState<V>>();

  /**
   * Creates a new keyed cache.
   * @param ttlMs An entries TTL before refreshing. If null, entries live forever.
   */
  constructor(
    private readonly name: string,
    private readonly ttlMs: number | null,
    private readonly notify?: (e: NotifyEvent) => void,
  ) {}

  private nowMs(): number {
    return Date.now();
  }

  private isFresh(entry: { lastFetchedMs: number | null }): boolean {
    if (this.ttlMs === null) {
      return true;
    }
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
      version: 0,
    };
    this.store.set(key, e);
    return e;
  }

  peek(key: string): V | null {
    return this.store.get(key)?.value ?? null;
  }

  async fetch(key: string, fetcher: () => Promise<V>, beforeNotify?: () => void): Promise<V> {
    const e = this.entry(key);

    if (e.value !== null) {
      if (!this.isFresh(e)) {
        void this.refresh(key, fetcher, beforeNotify).catch((err) => {
          console.error(`SWR refresh failed for key=${key}`, err);
        });
      }
      return e.value;
    }
    console.debug(`'${key}' had complete cache miss in cache '${this.name}'. Fetching from database`);
    return await this.refresh(key, fetcher, beforeNotify);
  }

  async refresh(key: string, fetcher: () => Promise<V>, beforeNotify?: () => void): Promise<V> {
    const e = this.entry(key);
    if (e.inFlight) return e.inFlight;
    console.debug(`Refreshing '${key}' in cache '${this.name}'`);

    const startVersion = e.version;

    e.inFlight = (async () => {
      const v = await fetcher();
      // If someone called set() (or otherwise bumped version) while we were fetching,
      // do NOT overwrite the newer value.
      let committed = false;
      if (e.version === startVersion) {
        e.value = v;
        e.lastFetchedMs = this.nowMs();
        committed = true;
      }

      return { v, committed };
    })().finally(() => {
      e.inFlight = null;
    })
    .then(({ v, committed }) => {
      if (committed) {
        if (beforeNotify) {
          beforeNotify();
        }
        this.notify?.({ type: "write", key });
      }
      return v;
    });;

    return e.inFlight;
  }


  set(key: string, value: V, beforeNotify?: () => void): void {
    const e = this.entry(key);
    e.value = value;
    e.lastFetchedMs = this.nowMs();
    e.version += 1;
    if (beforeNotify) {
      beforeNotify();
    }
    this.notify?.({ type: "write", key });
  }

  setAll(keysToValues: Map<string, V>, beforeNotify?: () => void): void {
    for (const [key, value] of keysToValues) {
      const e = this.entry(key);
      e.value = value;
      e.lastFetchedMs = this.nowMs();
      e.version += 1;
    }
    if (beforeNotify) {
      beforeNotify();
    }
    this.notify?.({ type: "write" });
  }

  /**
   * This methods sets entry.lastFetchedMs = null at key.
   * WARNING: If this.ttl = null (a forever cache), this method has NO effect.
   */
  invalidate(key: string): void {
    const e = this.entry(key);
    e.lastFetchedMs = null;
  }

  /**
   * This methods sets entry.lastFetchedMs = null at keys matching the predicate.
   * WARNING: If this.ttl = null (a forever cache), this method has NO effect.
   */
  invalidateWhere(predicate: (key: string) => boolean): void {
    for (const key of this.store.keys()) {
      if (predicate(key)) this.invalidate(key);
    }
  }

  /**
   * This methods sets entry.lastFetchedMs = null for every key.
   * WARNING: If this.ttl = null (a forever cache), this method has NO effect.
   */
  invalidateAll(): void {
    for (const e of this.store.values()) e.lastFetchedMs = null;
  }

  clearAll(beforeNotify?: () => void): void {
    this.store.clear();
    if (beforeNotify) {
      beforeNotify();
    }
    this.notify?.({ type: "clearAll" });
  }

  getInnerMap(): Map<string, V> {
    return new Map(
      Array.from(this.store.entries())
        .map(([k, s]) => [k, s.value] as [string, V | null])
        .filter(([, v]) => v !== null),
    ) as Map<string, V>;
  }

  delete(key: string, beforeNotify?: () => void): boolean {
    const ok = this.store.delete(key);
    if (ok) {
      if (beforeNotify) {
        beforeNotify();
      }
      this.notify?.({ type: "delete", key });
    }
    return ok;
  }
}

export class SwrIdCache<T extends Identified> implements CacheHandle {
  private static readonly KEY = "__all__";
  private readonly inner: SwrKeyedCache<Map<UUID, T>>;

  /**
   * Creates a new id cache wrapping a table.
   * @param ttlMs An entries TTL before refreshing. If null, entries live forever.
   */
  constructor(
    name: string,
    ttlMs: number | null,
    private readonly notify?: (e: NotifyEvent) => void,
  ) {
    this.inner = new SwrKeyedCache<Map<UUID, T>>(name, ttlMs);
  }

  private async buildMap(fetchCall: () => Promise<T[]>): Promise<Map<UUID, T>> {
    const rows = await fetchCall();
    const map = new Map<UUID, T>();
    for (const r of rows) map.set(r.id, r);
    return map;
  }

  async fetch(fetchCall: () => Promise<T[]>, beforeNotify?: () => void): Promise<Map<UUID, T>> {
    return this.inner.fetch(SwrIdCache.KEY, () => this.buildMap(fetchCall), () => {
      if (beforeNotify) {
        beforeNotify();
      }
      this.notify?.({ type: "write" });
    });
  }

  upsert(row: T, beforeNotify?: () => void): void {
    const current = this.inner.peek(SwrIdCache.KEY);
    const next = new Map(current ?? []);
    next.set(row.id, row);
    this.inner.set(SwrIdCache.KEY, next);
    if (beforeNotify) {
      beforeNotify();
    }
    this.notify?.({ type: "write", key: row.id });
  }

  delete(id: UUID, beforeNotify?: () => void): void {
    const current = this.inner.peek(SwrIdCache.KEY);
    if (!current) return;
    const next = new Map(current);
    next.delete(id);
    this.inner.set(SwrIdCache.KEY, next);
    if (beforeNotify) {
      beforeNotify();
    }
    this.notify?.({ type: "delete", key: id });
  }

  /**
   * This methods sets entry.lastFetchedMs = null.
   * WARNING: If this.ttl = null (a forever cache), this method has NO effect.
   */
  invalidate(): void {
    this.inner.invalidate(SwrIdCache.KEY);
  }

  peek(): Map<UUID, T> | null {
    return this.inner.peek(SwrIdCache.KEY);
  }

  /**
   * This methods sets entry.lastFetchedMs = null.
   * WARNING: If this.ttl = null (a forever cache), this method has NO effect.
   */
  invalidateAll(): void {
    this.inner.invalidateAll();
  }

  clearAll(beforeNotify?: () => void): void {
    this.inner.clearAll(beforeNotify);
  }

  getInnerMap() {
    return this.inner.peek(SwrIdCache.KEY)!;
  }
}

type CacheCtor<T extends CacheHandle> = abstract new (...args: any[]) => T;

class CacheFactory implements CacheHandle {
  private readonly registry = new Map<string, CacheHandle>();
  private readonly listeners = new Set<CacheListener>();

  subscribe(listener: CacheListener): () => void {
    this.listeners.add(listener);
    console.debug(`New listener added. Total: ${this.listeners.size} listeners`);
    return () => {
      this.listeners.delete(listener);
      console.debug(`Listener removed. Total: ${this.listeners.size} listeners`);
    };
  }

  emit(e: CacheEvent): void {
    console.debug(`New emission to listeners: ${JSON.stringify(e)}`);
    for (const l of this.listeners) {
      try { l(e); } catch (err) { console.error("cache listener failed", err); }
    }
  }

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
    console.debug(`New cache added '${name}'. Total: ${this.registry.size} caches`);
    return cache;
  }

  getOrCreateSwrIdCache<T extends Identified>(
    name: string,
    ttlMs: number | null,
  ): SwrIdCache<T> {
    // NOTE: pass the *class* SwrIdCache (no generics at runtime)
    return this.getOrCreate(
      name,
      SwrIdCache<T>,
      () =>
        new SwrIdCache<T>(name, ttlMs, (evt) => {
          if (evt.type === "clearAll") this.emit({ type: "clearAll", cacheName: name });
          else this.emit({ ...evt, cacheName: name } as CacheEvent);
        }),
    );
  }

  getOrCreateSwrKeyedCache<V>(name: string, ttlMs: number | null): SwrKeyedCache<V> {
    // NOTE: pass the *class* SwrKeyedCache (no generics at runtime)
    return this.getOrCreate(
      name,
      SwrKeyedCache<V>,
      () =>
        new SwrKeyedCache<V>(name, ttlMs, (evt) =>
          this.emit({ ...evt, cacheName: name } as CacheEvent),
        ),
    );
  }

  invalidateAll(): void {
    console.debug(`Invalidating all caches`);
    for (const c of this.registry.values()) c.invalidateAll();
  }

  clearAll(): void {
    console.debug(`Clearing all caches`);
    for (const c of this.registry.values()) c.clearAll();
  }

  invalidate(name: string): void {
    console.debug(`Invalidating ${name} cache`);
    this.registry.get(name)?.invalidateAll();
  }

  clear(name: string): void {
    console.debug(`Clearing ${name} cache`);
    this.registry.get(name)?.clearAll();
  }

  listNames(): string[] {
    return Array.from(this.registry.keys());
  }
}

export const CACHE_FACTORY = new CacheFactory();
