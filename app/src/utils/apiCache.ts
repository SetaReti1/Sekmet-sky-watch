// ==========================================
// SHARED API SNAPSHOT CACHE
//
// Every upstream this app talks to (JPL Sentry, JPL SBDB Close-Approach,
// Natural Earth coastlines) is public and rate-sensitive. Instead of hitting
// each one on every panel mount/refresh, every /app-api/* route reads a
// single combined snapshot from the connected SAT_CACHE resource first, and
// only re-fetches the upstream once that dataset's slice has expired. Fresh
// results are written back so the next request (this viewer or another one)
// is served from cache.
//
// REFRESH CADENCE:
// - Normal conditions: CAD + Sentry slices refresh every hour (NORMAL_TTL_MS).
// - Real event detected (a Sentry object crosses into ELEVATED/SEVERE Palermo
//   territory, or a CAD object closes to inside 5 lunar distances): refresh
//   cadence tightens to every 30 minutes (EVENT_TTL_MS) so the dashboard
//   tracks a live encounter more closely.
// - Tightened cadence auto-expires after 3 hours (EVENT_MAX_DURATION_MS): if
//   an event has been active that long, refresh cadence automatically
//   reverts to the normal hourly rate even if the same event condition is
//   still technically present — a fresh future event starts its own 3h
//   window.
// - Coastline geometry (worldmap) is practically static and keeps its own
//   long TTL regardless of event state.
// - The entire cache is wiped and rebuilt from scratch every 7 days
//   (CACHE_MAX_AGE_MS) so stale/orphaned slices never linger indefinitely.
// ==========================================

export type CachePayload = {
  cad?: { objects: any[]; count: number; fetchedAt: number };
  sentry?: { objects: any[]; count: number; fetchedAt: number };
  worldmap?: { polygons: any[]; count: number; fetchedAt: number };
  epoch?: number; // when this cache generation was started — drives the 7-day full wipe
  eventDetectedAt?: number; // when the currently-active event condition was first observed
};

// Normal-conditions refresh cadence for the two volatile NASA/JPL feeds.
export const NORMAL_TTL_MS = 60 * 60 * 1000; // 1 hour
// Tightened refresh cadence once a real event is detected in the cached data.
export const EVENT_TTL_MS = 30 * 60 * 1000; // 30 minutes
// Max time the tightened (event) cadence stays active before auto-reverting
// to normal, even if the same event condition is still present.
export const EVENT_MAX_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

// Kept for any external references — both slices now share the same
// event-aware cadence computed by ttlForPayload() below.
export const CAD_TTL_MS = NORMAL_TTL_MS;
export const SENTRY_TTL_MS = NORMAL_TTL_MS;
export const WORLDMAP_TTL_MS = 30 * 24 * 60 * 60 * 1000; // coastline geometry — practically static, 30d

// Full cache reset interval — after this long, the whole snapshot (every
// slice) is discarded and rebuilt from the live upstreams on next request.
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// A Sentry object counts as a "real event" once its cumulative Palermo scale
// crosses into ELEVATED territory (matches the ImpactRiskGlobe's own tier
// thresholds) — i.e. no longer just background/minimal risk noise.
const EVENT_SENTRY_PS_THRESHOLD = -3;
// A CAD close-approach object counts as a "real event" once it closes to
// within 5 lunar distances of Earth — a genuinely close pass worth tracking
// more tightly than the routine hourly cadence.
const EVENT_CAD_LD_THRESHOLD = 5;

/** Raw check: does the cached data itself show a real, actively-unfolding event? Ignores the 3h cap. */
function rawEventCondition(payload: CachePayload): boolean {
  const sentryHit = (payload.sentry?.objects ?? []).some(
    (o: any) => typeof o?.ps_cum === 'number' && o.ps_cum > EVENT_SENTRY_PS_THRESHOLD
  );
  if (sentryHit) return true;
  const cadHit = (payload.cad?.objects ?? []).some(
    (o: any) => typeof o?.ld === 'number' && o.ld > 0 && o.ld < EVENT_CAD_LD_THRESHOLD
  );
  return cadHit;
}

/**
 * Resolves the *effective* event state: whether tightened cadence should
 * apply right now, accounting for the persisted `eventDetectedAt` timestamp
 * and the 3-hour auto-revert-to-normal cap. Also returns the
 * `eventDetectedAt` that should be persisted going forward — undefined once
 * the raw condition clears, so a future event starts a fresh 3h window.
 */
export function resolveEventState(payload: CachePayload): { active: boolean; eventDetectedAt?: number } {
  const raw = rawEventCondition(payload);
  if (!raw) return { active: false, eventDetectedAt: undefined };
  const now = Date.now();
  const detectedAt = payload.eventDetectedAt ?? now;
  const withinWindow = now - detectedAt < EVENT_MAX_DURATION_MS;
  return { active: withinWindow, eventDetectedAt: detectedAt };
}

/** Is tightened (30min) refresh cadence currently active for this snapshot? */
export function hasActiveEvent(payload: CachePayload): boolean {
  return resolveEventState(payload).active;
}

/** Event-aware TTL for the two volatile NASA/JPL slices (cad + sentry). */
export function ttlForPayload(payload: CachePayload): number {
  return hasActiveEvent(payload) ? EVENT_TTL_MS : NORMAL_TTL_MS;
}

type ResourceBinding = { fetch(req: Request): Promise<Response> };

export async function readCachePayload(cache: ResourceBinding): Promise<CachePayload> {
  try {
    const res = await cache.fetch(new Request('https://r/snapshot'));
    if (!res.ok) return { epoch: Date.now() };
    const json: any = await res.json();
    const payload: CachePayload = (json?.snapshot?.payload as CachePayload) ?? {};

    // 7-day full cache wipe: if this snapshot generation is older than
    // CACHE_MAX_AGE_MS, drop every slice and start a fresh epoch so nothing
    // stale (or orphaned by a schema change) lingers indefinitely.
    const epoch = payload.epoch ?? 0;
    if (!epoch || Date.now() - epoch > CACHE_MAX_AGE_MS) {
      return { epoch: Date.now() };
    }
    return payload;
  } catch {
    return { epoch: Date.now() };
  }
}

export async function writeCachePayload(cache: ResourceBinding, payload: CachePayload): Promise<void> {
  try {
    // Re-evaluate event state against the data actually being persisted so
    // eventDetectedAt is set the moment a real event first appears, and
    // cleared the moment the underlying condition clears — the 3h cap is
    // then enforced purely by resolveEventState()/hasActiveEvent() at read time.
    const { eventDetectedAt } = resolveEventState(payload);
    const withEpoch: CachePayload = { epoch: payload.epoch ?? Date.now(), ...payload, eventDetectedAt };
    await cache.fetch(
      new Request('https://r/snapshot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload: withEpoch }),
      })
    );
  } catch {
    // best-effort — a failed cache write just means the next request re-fetches upstream
  }
}
