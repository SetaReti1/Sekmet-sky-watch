import React, { useEffect, useMemo, useRef, useState } from '@fuser/vendor/react';
import { CONTINENTS } from './worldGeo';

// ==========================================
// NASA/JPL SENTRY IMPACT-RISK DATA
// Fetched server-side (in the parent App) from ssd-api.jpl.nasa.gov/sentry.api
// via /app-api/sentry, then passed into this component as controlled props so
// the same catalogue can also be categorized in the DATA FEED panel.
// ==========================================
export interface SentryObject {
  des: string;
  fullname: string;
  diameter: number; // km
  ip: number; // cumulative impact probability
  ps_cum: number; // Palermo scale, cumulative
  ps_max: number; // Palermo scale, max single event
  v_inf: number; // impact velocity km/s
  n_imp: number; // potential impact count
  range: string; // year range, e.g. "2056-2113"
  last_obs: string;
}

// Small static seed so the panel is never empty if the live upstream is briefly unreachable.
// Values are plausible placeholders in the same shape as real Sentry rows, not a fabricated
// "live" claim — the fetch always attempts the real API first.
export const FALLBACK_SENTRY: SentryObject[] = [
{ des: '2022 KK2', fullname: '(2022 KK2)', diameter: 0.0069, ip: 0.00012, ps_cum: -5.58, ps_max: -5.78, v_inf: 15.57, n_imp: 33, range: '2060-2122', last_obs: '2022-05-23' },
{ des: '2000 SG344', fullname: '(2000 SG344)', diameter: 0.037, ip: 0.00274, ps_cum: -2.77, ps_max: -3.11, v_inf: 1.36, n_imp: 300, range: '2069-2122', last_obs: '2000-10-03' },
{ des: '2019 GP21', fullname: '(2019 GP21)', diameter: 0.0038, ip: 0.0000396, ps_cum: -6.77, ps_max: -7.32, v_inf: 10.82, n_imp: 74, range: '2039-2122', last_obs: '2019-04-04' },
{ des: '2012 VS76', fullname: '(2012 VS76)', diameter: 0.014, ip: 0.0000194, ps_cum: -5.74, ps_max: -6.05, v_inf: 11.46, n_imp: 15, range: '2081-2120', last_obs: '2012-11-16' },
{ des: '2012 BA102', fullname: '(2012 BA102)', diameter: 0.017, ip: 0.0000123, ps_cum: -6.03, ps_max: -6.27, v_inf: 7.21, n_imp: 20, range: '2103-2122', last_obs: '2012-02-21' },
{ des: '1979 XB', fullname: '(1979 XB)', diameter: 0.66, ip: 0.00000085, ps_cum: -2.69, ps_max: -2.99, v_inf: 23.76, n_imp: 4, range: '2056-2113', last_obs: '1979-12-15' },
{ des: '2021 NM3', fullname: '(2021 NM3)', diameter: 0.016, ip: 0.00000533, ps_cum: -6.41, ps_max: -6.48, v_inf: 8.21, n_imp: 8, range: '2111-2120', last_obs: '2021-07-13' },
{ des: '2018 WA1', fullname: '(2018 WA1)', diameter: 0.02, ip: 0.0000617, ps_cum: -7.08, ps_max: -7.08, v_inf: 12.0, n_imp: 6, range: '2085-2121', last_obs: '2018-11-19' },
{ des: '2024 YR4', fullname: '(2024 YR4)', diameter: 0.06, ip: 0.011, ps_cum: -1.64, ps_max: -1.64, v_inf: 17.16, n_imp: 1, range: '2032-2032', last_obs: '2025-02-20' },
{ des: '99942 Apophis', fullname: '99942 Apophis (2004 MN4)', diameter: 0.34, ip: 0.0000000012, ps_cum: -4.13, ps_max: -4.32, v_inf: 7.42, n_imp: 3, range: '2068-2116', last_obs: '2021-03-08' },
{ des: '2010 RF12', fullname: '(2010 RF12)', diameter: 0.007, ip: 0.05, ps_cum: -2.19, ps_max: -2.19, v_inf: 5.09, n_imp: 47, range: '2029-2117', last_obs: '2022-09-05' },
{ des: '2007 FT3', fullname: '(2007 FT3)', diameter: 0.34, ip: 0.0000023, ps_cum: -3.35, ps_max: -3.55, v_inf: 15.79, n_imp: 9, range: '2024-2119', last_obs: '2007-03-24' },
{ des: '2001 CA21', fullname: '(2001 CA21)', diameter: 0.089, ip: 0.0000013, ps_cum: -4.68, ps_max: -4.9, v_inf: 12.35, n_imp: 27, range: '2043-2120', last_obs: '2013-02-08' },
{ des: '2008 JL3', fullname: '(2008 JL3)', diameter: 0.021, ip: 0.0000041, ps_cum: -5.9, ps_max: -6.02, v_inf: 6.63, n_imp: 47, range: '2027-2122', last_obs: '2008-05-08' },
{ des: '2013 YB', fullname: '(2013 YB)', diameter: 0.011, ip: 0.0000501, ps_cum: -4.44, ps_max: -4.72, v_inf: 10.61, n_imp: 84, range: '2033-2117', last_obs: '2013-12-19' },
{ des: '2015 KQ120', fullname: '(2015 KQ120)', diameter: 0.058, ip: 0.0000006, ps_cum: -5.5, ps_max: -5.68, v_inf: 20.4, n_imp: 10, range: '2069-2117', last_obs: '2015-05-31' },
{ des: '2005 ED224', fullname: '(2005 ED224)', diameter: 0.048, ip: 0.0000004, ps_cum: -6.14, ps_max: -6.31, v_inf: 22.4, n_imp: 12, range: '2101-2115', last_obs: '2005-03-11' },
{ des: '2000 SG344 II', fullname: '(2011 UB63)', diameter: 0.021, ip: 0.000075, ps_cum: -4.05, ps_max: -4.31, v_inf: 8.99, n_imp: 63, range: '2044-2116', last_obs: '2011-10-31' },
{ des: '2017 SX17', fullname: '(2017 SX17)', diameter: 0.049, ip: 0.0000009, ps_cum: -5.98, ps_max: -6.11, v_inf: 15.66, n_imp: 15, range: '2038-2114', last_obs: '2017-09-25' },
{ des: '2009 JF1', fullname: '(2009 JF1)', diameter: 0.013, ip: 0.00023, ps_cum: -3.9, ps_max: -3.94, v_inf: 14.36, n_imp: 2, range: '2022-2113', last_obs: '2009-05-01' },
{ des: '2023 DW', fullname: '(2023 DW)', diameter: 0.049, ip: 0.0000001, ps_cum: -6.9, ps_max: -6.95, v_inf: 15.55, n_imp: 46, range: '2046-2105', last_obs: '2023-03-15' },
{ des: '2014 KP4', fullname: '(2014 KP4)', diameter: 0.083, ip: 0.0000032, ps_cum: -4.9, ps_max: -5.02, v_inf: 24.6, n_imp: 6, range: '2078-2113', last_obs: '2014-05-26' },
{ des: '2011 AG5', fullname: '(2011 AG5)', diameter: 0.14, ip: 0.0000000009, ps_cum: -7.9, ps_max: -8.06, v_inf: 12.86, n_imp: 3, range: '2040-2047', last_obs: '2012-01-27' },
{ des: '2016 JA', fullname: '(2016 JA)', diameter: 0.019, ip: 0.0000101, ps_cum: -5.31, ps_max: -5.44, v_inf: 8.94, n_imp: 21, range: '2054-2119', last_obs: '2016-05-14' },
{ des: '2019 UY11', fullname: '(2019 UY11)', diameter: 0.033, ip: 0.0000002, ps_cum: -6.55, ps_max: -6.7, v_inf: 18.3, n_imp: 9, range: '2065-2107', last_obs: '2019-10-27' },
{ des: '2022 AE1', fullname: '(2022 AE1)', diameter: 0.084, ip: 0.0000004, ps_cum: -5.03, ps_max: -5.18, v_inf: 13.72, n_imp: 5, range: '2023-2089', last_obs: '2022-01-06' },
{ des: '2006 QV89', fullname: '(2006 QV89)', diameter: 0.04, ip: 0.0000000004, ps_cum: -9.0, ps_max: -9.2, v_inf: 9.32, n_imp: 4, range: '2019-2053', last_obs: '2019-09-09' }];


// Deterministic pseudo-random hash from a designation string, used to place each
// object at a stable lat/lon on the globe (Sentry rows don't carry real ground-track
// coordinates — impacts are theoretical future events, not current positions) and to
// derive a stable position along the monitoring-window timeline below.
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Deterministic modeled ground-track coordinates for a Sentry object's ranked
// impact-risk marker. Space-Track.org and the JPL Sentry API itself do not
// publish an actual predicted impact latitude/longitude — a future NEO impact
// point isn't knowable until the object is much closer to Earth — so this
// derives a stable, repeatable lat/lon per object designation (same formula
// the globe render loop already used inline) and exposes it in real degrees
// for the properties panel and DATA FEED to display alongside the marker.
export function impactLatLon(des: string): {lat: number;lon: number;} {
  const h = strHash(des);
  const latRad = (h % 1000 / 1000 - 0.5) * Math.PI * 0.8;
  const lonRad = h % 6283 / 1000 - Math.PI;
  return { lat: latRad * 180 / Math.PI, lon: lonRad * 180 / Math.PI };
}

export function riskTier(ps: number): {label: string;color: string;level: number;} {
  if (ps > -2) return { label: 'SEVERE', color: '#ef4444', level: 5 };
  if (ps > -3.5) return { label: 'ELEVATED', color: '#ff5522', level: 4 };
  if (ps > -5) return { label: 'GUARDED', color: '#facc15', level: 3 };
  if (ps > -6.5) return { label: 'LOW', color: '#5eead4', level: 2 };
  return { label: 'MINIMAL', color: '#10f3a5', level: 1 };
}

// Ordered risk-tier legend (highest first) — shared with the client's
// IMPACT RISK STREAM category filter chips so the tier vocabulary and
// colors stay identical between the globe markers and the data feed.
export const RISK_TIER_LEVELS: {key: string;color: string;level: number;}[] = [
{ key: 'SEVERE', color: '#ef4444', level: 5 },
{ key: 'ELEVATED', color: '#ff5522', level: 4 },
{ key: 'GUARDED', color: '#facc15', level: 3 },
{ key: 'LOW', color: '#5eead4', level: 2 },
{ key: 'MINIMAL', color: '#10f3a5', level: 1 }];

// ==========================================
// MONITORING-WINDOW TIMELINE HELPERS
// ==========================================
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Monitoring window now spans ±2 years (1460 days total) around today.
const WINDOW_HALF_DAYS = 730;
const WINDOW_TOTAL_DAYS = WINDOW_HALF_DAYS * 2;

export function deriveWindowOffsetDays(des: string): number {
  // Deterministic pseudo-position within a ±2 year window around today, used to
  // spread tracked objects across the monitoring timeline below with a stable,
  // repeatable layout (Sentry's real impact windows are decades out, so this
  // represents modeled monitoring cadence, not a literal predicted date).
  return strHash(des) % WINDOW_TOTAL_DAYS - WINDOW_HALF_DAYS;
}

function ImpactTimeline({ objects, selectedIdx, onSelect }: {objects: SentryObject[];selectedIdx: number;onSelect: (idx: number) => void;}) {
  const today = useMemo(() => new Date(), []);
  const monthTicks = useMemo(() => {
    const ticks: {label: string;pct: number;}[] = [];
    for (let m = -24; m <= 24; m += 3) {
      const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
      const dayOffset = Math.round((d.getTime() - today.getTime()) / 86400000);
      const pct = (dayOffset + WINDOW_HALF_DAYS) / WINDOW_TOTAL_DAYS * 100;
      if (pct >= -2 && pct <= 102) {
        ticks.push({ label: `${MONTH_ABBR[d.getMonth()]}'${String(d.getFullYear()).slice(2)}`, pct: Math.min(100, Math.max(0, pct)) });
      }
    }
    return ticks;
  }, [today]);

  return (
    <div className="absolute left-2 right-2 bottom-8 z-10 pointer-events-auto bg-space-black/70 border border-space-orange/25 rounded-sm px-2.5 py-2 backdrop-blur-[2px]">
      <div className="flex items-center justify-between text-[8px] text-space-muted font-bold tracking-wider mb-1.5">
        <span data-fuser-slot-id="section-text-timeline-label">MONITORING WINDOW · ±2 YEARS</span>
        <span data-fuser-slot-id="section-text-a5c2de8b" className="text-glow-green flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-glow-green shadow-[0_0_6px_rgba(16,243,165,0.9)] animate-pulse" />
          TODAY {today.getFullYear()}-{MONTH_ABBR[today.getMonth()]}-{String(today.getDate()).padStart(2, '0')}
        </span>
      </div>
      <div className="relative h-5 mb-3">
        <div className="absolute inset-x-0 top-1/2 h-px bg-space-orange/25" />
        <div className="absolute top-0 bottom-0 w-[2px] bg-glow-green shadow-[0_0_8px_rgba(16,243,165,0.9)]" style={{ left: '50%' }} />
        <div data-fuser-slot-id="section-text-e2d9f686" className="absolute -top-3 -translate-x-1/2 text-[7px] font-bold text-glow-green whitespace-nowrap" style={{ left: '50%' }}>TODAY</div>
        {objects.map((obj, idx) => {
          const offset = deriveWindowOffsetDays(obj.des);
          const pct = (offset + WINDOW_HALF_DAYS) / WINDOW_TOTAL_DAYS * 100;
          const tier = riskTier(obj.ps_cum);
          const isSelected = idx === selectedIdx;
          return (
            <button
              key={obj.des}
              onClick={() => onSelect(idx)}
              title={`${obj.des} · ${tier.label} · modeled window ${offset >= 0 ? '+' : ''}${offset}d`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-transform hover:scale-125"
              style={{
                left: `${pct}%`,
                width: isSelected ? 9 : 6,
                height: isSelected ? 9 : 6,
                background: tier.color,
                boxShadow: isSelected ? `0 0 8px ${tier.color}` : `0 0 3px ${tier.color}88`,
                border: isSelected ? '1px solid #fff7cc' : 'none'
              }} />);

        })}
      </div>
      <div className="relative h-3 text-[7px] text-space-muted font-bold">
        {monthTicks.map((t, i) =>
        <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${t.pct}%` }}>{t.label}</span>
        )}
      </div>
    </div>);

}

// ==========================================
// CELESTIAL MECHANICS HELPERS — Sun & Moon geocentric positions
// Real orbital constants: Earth's obliquity (23.44°), the Moon's sidereal
// period (27.32166 days) and orbital inclination to the ecliptic (5.145°),
// and the mean tropical year (365.25 days). Ecliptic coordinates are converted
// to the equatorial-style lat/lon frame this globe already projects markers in.
// ==========================================
const OBLIQUITY_RAD = 23.44 * Math.PI / 180;
const MOON_SIDEREAL_DAYS = 27.32166;
const MOON_INCLINATION_RAD = 5.145 * Math.PI / 180;
const EARTH_YEAR_DAYS = 365.25;
const REF_DAY_OF_YEAR = 176; // 2026-JUN-25, the app's reference "now"

// Converts ecliptic (lambda, beta) in radians to an equatorial-style (dec, ra) pair
function eclipticToEquatorial(lambda: number, beta: number): {dec: number;ra: number;} {
  const sinDec = Math.sin(beta) * Math.cos(OBLIQUITY_RAD) + Math.cos(beta) * Math.sin(OBLIQUITY_RAD) * Math.sin(lambda);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.sin(lambda) * Math.cos(OBLIQUITY_RAD) - Math.tan(beta) * Math.sin(OBLIQUITY_RAD);
  const ra = Math.atan2(y, Math.cos(lambda));
  return { dec, ra };
}

function sunPosition(days: number): {dec: number;ra: number;lambda: number;} {
  const dayOfYear = REF_DAY_OF_YEAR + days;
  const lambda = dayOfYear / EARTH_YEAR_DAYS * Math.PI * 2;
  const { dec, ra } = eclipticToEquatorial(lambda, 0);
  return { dec, ra, lambda };
}

function moonPosition(days: number): {dec: number;ra: number;phase: number;} {
  const phase = days / MOON_SIDEREAL_DAYS * Math.PI * 2;
  const beta = MOON_INCLINATION_RAD * Math.sin(phase);
  const { dec, ra } = eclipticToEquatorial(phase, beta);
  return { dec, ra, phase };
}

interface ImpactRiskGlobeProps {
  isMini?: boolean;
  missionTime: number;
  objects: SentryObject[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  sourceLabel: string;
  paused?: boolean;
}

export function ImpactRiskGlobe({ isMini, missionTime, objects, selectedIdx, onSelect, sourceLabel, paused = false }: ImpactRiskGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Throttles mini-map redraws to ~12fps and fully skips draw work while
  // `paused` (this exact globe is already shown full-fidelity as the main
  // panel) — stops all 4 sidebar canvases from competing at 60fps at once.
  const lastMiniDrawRef = useRef<number>(0);
  // Real-world coastline trace (Natural Earth 110m land polygons, fetched via
  // /app-api/worldmap) — starts from the hand-approximated CONTINENTS shapes so
  // the globe never renders empty, then swaps to genuine traced geography once
  // the upstream responds. Held in a ref so the fetch doesn't restart the
  // render animation loop below.
  const worldPolygonsRef = useRef<[number, number][][]>(
    CONTINENTS.map((shape) => shape.points)
  );
  const [worldmapSourceLabel, setWorldmapSourceLabel] = useState<string>('APPROX TRACE');
  const rotationRef = useRef<number>(0.4);
  // True once this canvas has drawn at least one real frame — lets a canvas
  // that starts out `paused` still render its first frame instead of staying
  // blank forever.
  const hasDrawnOnceRef = useRef<boolean>(false);
  const isDragging = useRef<boolean>(false);
  const dragModeRef = useRef<'rotate' | 'pan'>('rotate');
  const lastX = useRef<number>(0);
  const lastY = useRef<number>(0);
  const dragDistance = useRef<number>(0);
  const zoomRef = useRef<number>(1);
  const panRef = useRef<{x: number;y: number;}>({ x: 0, y: 0 });
  const missionTimeRef = useRef<number>(missionTime);
  missionTimeRef.current = missionTime;

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragModeRef.current = e.shiftKey || e.button === 2 ? 'pan' : 'rotate';
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    dragDistance.current = 0;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastX.current;
    const dy = e.clientY - lastY.current;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);
    if (dragModeRef.current === 'pan') {
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
    } else {
      rotationRef.current += dx * 0.006;
    }
    lastX.current = e.clientX;
    lastY.current = e.clientY;
  };
  const handleMouseUp = () => {
    isDragging.current = false;
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Fetch the real traced world coastline once on mount (server-side proxy of
  // Natural Earth 110m land polygons) and swap it into the render loop via the
  // ref above — independent of the animation-loop effect below so it never
  // tears down/restarts the canvas render.
  useEffect(() => {
    let cancelled = false;
    fetch('/app-api/worldmap').
    then((r) => r.json()).
    then((json) => {
      if (cancelled) return;
      if (json?.ok && Array.isArray(json.polygons) && json.polygons.length > 0) {
        worldPolygonsRef.current = json.polygons;
        setWorldmapSourceLabel(`NATURAL EARTH 110M · ${json.polygons.length} TRACED`);
      } else {
        setWorldmapSourceLabel('APPROX TRACE · UPLINK EMPTY');
      }
    }).
    catch(() => {
      if (!cancelled) setWorldmapSourceLabel('APPROX TRACE · UPLINK OFFLINE');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let autoRotate = 0;

    // ---- camera focus-on-select ----
    // When a Sentry object is selected (from the globe itself or the DATA FEED
    // list), ease the camera's yaw so that object's modeled ground track comes
    // to the front-center of the globe instead of leaving the user to hunt for
    // it manually. Computed once per effect run (the effect already restarts
    // whenever `selectedIdx` changes), then lerped every frame below.
    const focusObj = objects[selectedIdx];
    let focusTargetRot: number | null = null;
    if (focusObj) {
      const gt = impactLatLon(focusObj.des);
      const lonRad = gt.lon * Math.PI / 180;
      let t = -lonRad;
      while (t - rotationRef.current > Math.PI) t -= Math.PI * 2;
      while (t - rotationRef.current < -Math.PI) t += Math.PI * 2;
      focusTargetRot = t;
    }
    const focusZoomTarget = focusObj ? Math.max(zoomRef.current, isMini ? 1.1 : 1.35) : zoomRef.current;

    // deterministic distant starfield: varied sizes/opacity so nearer-looking
    // "bigger" stars read against a field of faint far specks, seeded once per
    // canvas size so it doesn't re-randomize every frame.
    type Star = {x: number;y: number;r: number;a: number;};
    let stars: Star[] = [];
    let starW = 0,starH = 0;
    const STAR_COUNT = isMini ? 70 : 220;
    const buildStars = () => {
      stars = [];
      for (let s = 0; s < STAR_COUNT; s++) {
        const rx = Math.sin(s * 12.9898 + 4.1414) * 43758.5453;
        const ry = Math.sin(s * 78.233 + 1.192) * 24634.6345;
        const rr = Math.sin(s * 39.346 + 2.71) * 15453.123;
        const x = (rx - Math.floor(rx)) * canvas.width;
        const y = (ry - Math.floor(ry)) * canvas.height;
        const depth = rr - Math.floor(rr); // 0 = far/tiny/dim, 1 = "near"/bigger/brighter
        const r = 0.25 + depth * depth * (isMini ? 1.1 : 1.6);
        const a = 0.12 + depth * 0.75;
        stars.push({ x, y, r, a });
      }
      starW = canvas.width;
      starH = canvas.height;
    };

    // wheel-to-zoom camera control (translation handled via shift/right-drag pan above)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = zoomRef.current * (1 - e.deltaY * 0.0012);
      zoomRef.current = Math.max(0.55, Math.min(2.6, next));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    const MINI_FRAME_INTERVAL = 85; // ~12fps for sidebar thumbnails
    const render = () => {
      if (paused && hasDrawnOnceRef.current) {
        raf = requestAnimationFrame(render);
        return;
      }
      if (isMini && !paused) {
        const now = performance.now();
        if (now - lastMiniDrawRef.current < MINI_FRAME_INTERVAL) {
          raf = requestAnimationFrame(render);
          return;
        }
        lastMiniDrawRef.current = now;
      }
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      if (stars.length === 0 || starW !== canvas.width || starH !== canvas.height) buildStars();

      ctx.fillStyle = '#070403';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hasDrawnOnceRef.current = true;

      // distant starfield, varying size/brightness to sell depth
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.a.toFixed(3)})`;
        ctx.fill();
      });

      const bcx = canvas.width / 2;
      const bcy = canvas.height / 2;
      const baseR = Math.max(0, Math.min(bcx, bcy) - (isMini ? 20 : 34));
      const R = baseR * zoomRef.current;
      const cx = bcx + panRef.current.x;
      const cy = bcy + panRef.current.y;
      if (R <= 0) {
        raf = requestAnimationFrame(render);
        return;
      }

      // While a focus target is active and the user isn't actively dragging,
      // ease yaw + zoom toward the selected object instead of free-spinning —
      // camera settles on the object within ~1-2 seconds, then holds.
      if (focusTargetRot !== null && !isDragging.current) {
        rotationRef.current += (focusTargetRot - rotationRef.current) * 0.055;
        zoomRef.current += (focusZoomTarget - zoomRef.current) * 0.05;
      } else if (!isDragging.current || dragModeRef.current !== 'rotate') {
        autoRotate += 0.0009;
      }
      const rot = rotationRef.current + autoRotate;
      const tilt = 0.32;

      // Real-world scale reference: Earth mean radius ~6371km == R px, so
      // altitude shells and impact trajectories share this same scale.
      const EARTH_RADIUS_KM = 6371;
      // Moon: real mean radius 1737.4km -> true ratio to Earth (~0.2727), rendered at
      // that exact ratio of R so its disk is correctly sized relative to Earth's.
      const MOON_RATIO = 1737.4 / EARTH_RADIUS_KM;
      // Sun: real mean radius 696,000km -> true ratio to Earth is ~109x, far too large
      // to paint at true scale on a compact HUD without swallowing the whole globe.
      // Compressed to a fixed display ratio that still reads as "vastly bigger than
      // Earth/Moon" while staying clear of the globe's disc at its (also compressed)
      // orbital distance.
      const SUN_DISPLAY_RATIO = 0.6;
      // project a lat/lon (radians) point at a given altitude shell (radiusFactor,
      // 1.0 = surface) on the sphere to screen space — used for markers/trajectories
      const project = (lat: number, lon: number, radiusFactor = 1) => {
        // NOTE: x uses sin / depth(z) uses cos — this is the standard orthographic-globe
        // convention (matches d3-geo orthographic): at the sub-viewer meridian (lon+rot=0)
        // the point sits centered and fully facing the camera, and increasing longitude
        // (moving east) moves it rightward on screen. The previous cos/sin assignment had
        // these swapped, which mirrored every traced coastline east-west.
        const x0 = Math.cos(lat) * Math.sin(lon + rot);
        const z0 = Math.cos(lat) * Math.cos(lon + rot);
        const y0 = Math.sin(lat);
        const y1 = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
        const z1 = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
        const Rf = R * radiusFactor;
        // Soft visibility: instead of a hard cutoff at the limb (which made markers pop
        // in/out of existence instantaneously as the globe rotated), fade alpha smoothly
        // over a band around the terminator so objects ease away instead of vanishing.
        const alpha = Math.max(0, Math.min(1, (z1 + 0.16) / 0.22));
        return { x: cx + x0 * Rf, y: cy - y1 * Rf, z: z1, visible: z1 > -0.05, alpha };
      };

      // Generic wireframe-sphere "reticule" renderer for the Sun & Moon: draws
      // ONLY latitude parallels (no meridians), each traced as a genuine 3D
      // circle on a sphere — foreshortened into the correct curved arcs by the
      // same orthographic spin+tilt math as the main Earth globe above — instead
      // of the flat straight chords used previously. Far-side arcs render at
      // reduced alpha so the sphere still reads as a see-through wire cage
      // (matching the LCARS reticule references) rather than an opaque disk.
      const drawLatitudeReticule = (
      px: number,
      py: number,
      radius: number,
      spin: number,
      sphereTilt: number,
      lineCount: number,
      baseAlpha: number,
      strokeStyle: string,
      lineWidth: number,
      glowColor: string,
      glowBlur: number) =>
      {
        const segs = 40;
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = glowColor;
        for (let li = 0; li < lineCount; li++) {
          const lat = -Math.PI / 2 + Math.PI * (li + 0.5) / lineCount;
          const cosLat = Math.cos(lat);
          const sinLat = Math.sin(lat);
          const pt = (lon: number) => {
            const x0 = cosLat * Math.sin(lon + spin);
            const z0 = cosLat * Math.cos(lon + spin);
            const y1 = sinLat * Math.cos(sphereTilt) - z0 * Math.sin(sphereTilt);
            const z1 = sinLat * Math.sin(sphereTilt) + z0 * Math.cos(sphereTilt);
            return { x: px + x0 * radius, y: py - y1 * radius, z: z1 };
          };
          for (let s = 0; s < segs; s++) {
            const lon0 = -Math.PI + Math.PI * 2 * s / segs;
            const lon1 = -Math.PI + Math.PI * 2 * (s + 1) / segs;
            const p0 = pt(lon0);
            const p1 = pt(lon1);
            const frontFacing = (p0.z + p1.z) / 2 >= 0;
            ctx.globalAlpha = (frontFacing ? 1 : 0.3) * baseAlpha;
            ctx.shadowBlur = frontFacing ? glowBlur : 0;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      };

      // ---- Earth disk: dark wireframe-globe base, matching the amber/green
      // LCARS-tactical-HUD language used across every other panel (Geocentric,
      // Helio, Size Map) — a near-black sphere with a glowing orange mesh cage,
      // not a photographic ocean/terrain render.
      const earthGrad = ctx.createRadialGradient(
        cx - R * 0.38, cy - R * 0.4, R * 0.05,
        cx, cy, R * 1.05
      );
      // Fill opacity set to 80% (0.8) throughout, per design spec — a slightly
      // translucent globe body rather than a fully opaque disk.
      earthGrad.addColorStop(0, 'rgba(28, 18, 8, 0.8)');
      earthGrad.addColorStop(0.35, 'rgba(14, 9, 4, 0.8)');
      earthGrad.addColorStop(0.7, 'rgba(6, 4, 2, 0.8)');
      earthGrad.addColorStop(1, 'rgba(1, 1, 1, 0.8)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.fill();
      ctx.lineWidth = isMini ? 1 : 1.4;
      ctx.strokeStyle = 'rgba(255, 176, 64, 0.7)';
      ctx.stroke();

      // ---- continent outlines ----
      // Genuine traced world coastlines (Natural Earth 110m land polygons,
      // fetched server-side via /app-api/worldmap — the same public-domain
      // dataset used by most reference web globes/atlases) mapped onto the
      // sphere surface as thin glowing orange OUTLINES only — matching the
      // minimalist vector world-map reference (transparent interior, no fill,
      // clean amber stroke on black). Each shape is clipped to the sphere disk
      // and only drawn while its vertices face the camera — it fades from view
      // as the globe rotates it to the far side.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      worldPolygonsRef.current.forEach((points) => {
        const pts = points.map(([lat, lon]) => project(lat * Math.PI / 180, lon * Math.PI / 180));
        const visibleCount = pts.filter((p) => p.visible).length;
        if (visibleCount < pts.length * 0.6) return; // mostly on the far side — skip this frame
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.lineWidth = isMini ? 0.8 : 1.2;
        ctx.strokeStyle = '#ffb040';
        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = isMini ? 2 : 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      ctx.restore();

      // ---- triangulated geodesic mesh over the sphere surface ----
      // Replaces the plain lat/lon grid with a lat/lon point lattice connected by
      // diagonals — the same "cage of triangles" language as the reference HUDs.
      const latSteps = isMini ? 6 : 9;
      const lonSteps = isMini ? 10 : 16;
      const meshPts: ({x: number;y: number;visible: boolean;} | null)[][] = [];
      for (let i = 0; i <= latSteps; i++) {
        const lat = -Math.PI / 2 + Math.PI * i / latSteps;
        const row: ({x: number;y: number;visible: boolean;} | null)[] = [];
        for (let j = 0; j <= lonSteps; j++) {
          const lon = -Math.PI + Math.PI * 2 * j / lonSteps;
          const p = project(lat, lon);
          row.push(p.visible ? p : null);
        }
        meshPts.push(row);
      }
      ctx.strokeStyle = 'rgba(255, 176, 64, 0.32)';
      ctx.lineWidth = isMini ? 0.5 : 0.7;
      ctx.shadowColor = 'rgba(255, 153, 0, 0.5)';
      ctx.shadowBlur = isMini ? 1 : 2;
      const drawSeg = (a: {x: number;y: number;} | null, b: {x: number;y: number;} | null) => {
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      };
      for (let i = 0; i < latSteps; i++) {
        for (let j = 0; j < lonSteps; j++) {
          const p00 = meshPts[i][j];
          const p01 = meshPts[i][j + 1];
          const p10 = meshPts[i + 1][j];
          const p11 = meshPts[i + 1][j + 1];
          drawSeg(p00, p01); // parallel edge
          drawSeg(p00, p10); // meridian edge
          // alternate diagonal direction per cell for a woven triangle look
          if ((i + j) % 2 === 0) drawSeg(p00, p11);else drawSeg(p01, p10);
        }
      }
      // close the final meridian ring
      for (let i = 0; i < latSteps; i++) {
        drawSeg(meshPts[i][lonSteps], meshPts[i + 1][lonSteps]);
      }
      ctx.shadowBlur = 0;

      // ---- real day/night terminator shading ----
      // Orthographic projection makes the terminator (the sun-normal great circle)
      // project to a straight line through the disk center, oriented along the
      // sub-solar screen direction — so the true Sun position already computed
      // above drives a genuine night-side darkening instead of a fixed vignette.
      {
        const termDays = (missionTimeRef.current - 0.5) * 100;
        const termSun = sunPosition(termDays);
        const sx0 = Math.cos(termSun.dec) * Math.cos(termSun.ra + rot);
        const sz0 = Math.cos(termSun.dec) * Math.sin(termSun.ra + rot);
        const sy0 = Math.sin(termSun.dec);
        const sy1 = sy0 * Math.cos(tilt) - sz0 * Math.sin(tilt);
        const dayLen = Math.hypot(sx0, sy1) || 1;
        const dayDirX = sx0 / dayLen;
        const dayDirY = -sy1 / dayLen;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.clip();
        const nightGrad = ctx.createLinearGradient(
          cx - dayDirX * R * 1.05, cy - dayDirY * R * 1.05,
          cx + dayDirX * R * 1.05, cy + dayDirY * R * 1.05
        );
        nightGrad.addColorStop(0, 'rgba(0,0,0,0)');
        nightGrad.addColorStop(0.42, 'rgba(0,0,0,0)');
        nightGrad.addColorStop(0.58, 'rgba(6,4,2,0.55)');
        nightGrad.addColorStop(0.78, 'rgba(3,2,1,0.85)');
        nightGrad.addColorStop(1, 'rgba(0,0,0,0.94)');
        ctx.fillStyle = nightGrad;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.restore();
      }

      // limb highlight rim — atmosphere tinted green
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.5)';
      ctx.lineWidth = isMini ? 0.8 : 1.2;
      ctx.shadowColor = '#10f3a5';
      ctx.shadowBlur = isMini ? 4 : 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---- atmospheric limb glow (green) ----
      // Thin green fresnel-style haze ring just beyond the surface, matching
      // the glowing-vector-display language of the other panels.
      const atmoGrad = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.18);
      atmoGrad.addColorStop(0, 'rgba(16, 243, 165, 0)');
      atmoGrad.addColorStop(0.5, 'rgba(16, 243, 165, 0.22)');
      atmoGrad.addColorStop(0.8, 'rgba(16, 243, 165, 0.1)');
      atmoGrad.addColorStop(1, 'rgba(16, 243, 165, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
      ctx.fillStyle = atmoGrad;
      ctx.fill();

      // ---- atmosphere layers ----
      // Concentric shells at real 1000km altitude increments off the Earth's
      // 6371km radius, drawn as faint dashed limb rings, plus a vertical altitude
      // ruler with km labels so the layering reads as genuine measurement.
      const ALTITUDE_LAYERS_KM = isMini ? [1000, 3000, 5000] : [1000, 2000, 3000, 4000, 5000, 6000];
      ALTITUDE_LAYERS_KM.forEach((km, li) => {
        const shellFactor = 1 + km / EARTH_RADIUS_KM;
        const fade = 1 - li / (ALTITUDE_LAYERS_KM.length + 1);
        ctx.beginPath();
        ctx.arc(cx, cy, R * shellFactor, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 176, 64, ${(0.22 * fade).toFixed(3)})`;
        ctx.setLineDash([2, isMini ? 3 : 4]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      });
      if (!isMini) {
        const rulerX = cx;
        ctx.strokeStyle = 'rgba(255,176,64,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rulerX, cy - R);
        ctx.lineTo(rulerX, cy - R * (1 + ALTITUDE_LAYERS_KM[ALTITUDE_LAYERS_KM.length - 1] / EARTH_RADIUS_KM) - 6);
        ctx.stroke();
        ALTITUDE_LAYERS_KM.forEach((km) => {
          const shellFactor = 1 + km / EARTH_RADIUS_KM;
          const ty = cy - R * shellFactor;
          ctx.beginPath();
          ctx.moveTo(rulerX - 4, ty);
          ctx.lineTo(rulerX + 4, ty);
          ctx.strokeStyle = 'rgba(255,176,64,0.6)';
          ctx.stroke();
          ctx.font = '8px monospace';
          ctx.fillStyle = 'rgba(255,214,140,0.8)';
          ctx.fillText(`${km.toLocaleString()} KM`, rulerX + 7, ty + 3);
        });
      }

      // ---- Sun & Moon geocentric trajectories ----
      // days elapsed relative to the app's 2026-JUN-25 reference date, scrubbed
      // by the same missionTime slider that drives the other maps (±50 days).
      const days = (missionTimeRef.current - 0.5) * 100;

      // Moon: real sidereal period + orbital inclination to the ecliptic.
      // Draw its dashed orbital path (one full loop) then the current position.
      // Distance kept close enough to stay fully on-canvas at default zoom — the
      // true ~60x-Earth-radius separation would place it far outside the frame.
      const moonRadiusFactor = 1.4;
      ctx.beginPath();
      let moonPathStarted = false;
      for (let s = 0; s <= 72; s++) {
        const ph = s / 72 * Math.PI * 2;
        const beta = MOON_INCLINATION_RAD * Math.sin(ph);
        const { dec, ra } = eclipticToEquatorial(ph, beta);
        const p = project(dec, ra, moonRadiusFactor);
        if (!p.visible) {
          moonPathStarted = false;
          continue;
        }
        if (!moonPathStarted) {
          ctx.moveTo(p.x, p.y);
          moonPathStarted = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = 'rgba(255,214,140,0.28)';
      ctx.setLineDash([1.5, 3]);
      ctx.lineWidth = isMini ? 0.6 : 0.9;
      ctx.stroke();
      ctx.setLineDash([]);

      const moon = moonPosition(days);
      const moonP = project(moon.dec, moon.ra, moonRadiusFactor);
      if (moonP.alpha > 0.02) {
        // Real-scale body radius: Moon's true 0.2727x ratio to Earth's radius,
        // with a small floor so it stays legible at low zoom / mini-panel size.
        const mr = Math.max(isMini ? 2.4 : 3.6, R * MOON_RATIO);
        // Occlusion state: project()'s z-depth tells us which hemisphere of its
        // own orbit the Moon sits on relative to the viewer — positive z is the
        // near side (transiting in front of Earth), negative is the far side
        // (passing behind the globe). Front gets a soft 30%-opacity disc under
        // its outline; behind drops the fill and renders as bare wireframe only.
        const moonIsFront = moonP.z > 0;
        ctx.save();
        ctx.globalAlpha = moonP.alpha;
        if (moonIsFront) {
          const moonGrad = ctx.createRadialGradient(moonP.x - mr * 0.35, moonP.y - mr * 0.35, mr * 0.1, moonP.x, moonP.y, mr);
          moonGrad.addColorStop(0, 'rgba(244,242,236,0.3)');
          moonGrad.addColorStop(1, 'rgba(139,138,134,0.3)');
          ctx.beginPath();
          ctx.arc(moonP.x, moonP.y, mr, 0, Math.PI * 2);
          ctx.fillStyle = moonGrad;
          ctx.fill();
        }
        // Geometry: a true 3D wireframe reticule — 10 latitude parallels traced
        // as genuine curved circles on a spinning sphere (see drawLatitudeReticule
        // above), not flat chords projected onto a flat disk.
        const MOON_LINE_COUNT = 10;
        drawLatitudeReticule(
          moonP.x, moonP.y, mr, autoRotate * 1.4, 0.36, MOON_LINE_COUNT,
          moonIsFront ? 0.9 : 0.42,
          'rgba(226,228,224,1)', isMini ? 0.6 : 0.9,
          '#cfd3d8', moonIsFront ? isMini ? 3 : 5 : 0
        );
        if (!isMini) {
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = 'rgba(210,215,220,0.85)';
          ctx.fillText(`MOON · 384,400 KM${moonIsFront ? '' : ' · OCCULTED'}`, moonP.x + mr + 4, moonP.y + 3);
        }
        ctx.restore();
      }

      // Sun: real obliquity-driven ecliptic path (annual), current position marked.
      // Distance similarly compressed to stay on-canvas; the true ~23,455x-Earth-radius
      // separation is called out in the label instead of attempted at pixel scale.
      const sunRadiusFactor = 1.85;
      ctx.beginPath();
      let sunPathStarted = false;
      for (let s = 0; s <= 72; s++) {
        const lam = s / 72 * Math.PI * 2;
        const { dec, ra } = eclipticToEquatorial(lam, 0);
        const p = project(dec, ra, sunRadiusFactor);
        if (!p.visible) {
          sunPathStarted = false;
          continue;
        }
        if (!sunPathStarted) {
          ctx.moveTo(p.x, p.y);
          sunPathStarted = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = 'rgba(255,180,60,0.22)';
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = isMini ? 0.6 : 0.9;
      ctx.stroke();
      ctx.setLineDash([]);

      const sun = sunPosition(days);
      const sunP = project(sun.dec, sun.ra, sunRadiusFactor);
      if (sunP.alpha > 0.02) {
        // Real-scale-derived body radius: Sun's true ~109x ratio to Earth is
        // compressed to SUN_DISPLAY_RATIO so it still fits the canvas, but it
        // renders far larger than both Earth and the Moon, as it truly is.
        const sr = Math.max(isMini ? 5 : 9, R * SUN_DISPLAY_RATIO);
        // Same near/far hemisphere test as the Moon: corona + 30%-opacity disc
        // fill only render while the Sun is in front of Earth; on the far side
        // it drops to bare wireframe geometry with no fill.
        const sunIsFront = sunP.z > 0;
        ctx.save();
        ctx.globalAlpha = sunP.alpha;
        if (sunIsFront) {
          const coronaGrad = ctx.createRadialGradient(sunP.x, sunP.y, sr * 0.6, sunP.x, sunP.y, sr * 2.4);
          coronaGrad.addColorStop(0, 'rgba(255, 209, 102, 0.35)');
          coronaGrad.addColorStop(1, 'rgba(255, 209, 102, 0)');
          ctx.beginPath();
          ctx.arc(sunP.x, sunP.y, sr * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = coronaGrad;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sunP.x, sunP.y, sr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 209, 102, 0.3)';
          ctx.fill();
        }
        // Geometry: a true 3D wireframe reticule — 22 latitude parallels traced
        // as genuine curved circles on a spinning sphere (see drawLatitudeReticule
        // above), not flat chords projected onto a flat disk.
        const SUN_LINE_COUNT = 22;
        drawLatitudeReticule(
          sunP.x, sunP.y, sr, autoRotate * 0.9, 0.3, SUN_LINE_COUNT,
          sunIsFront ? 0.9 : 0.4,
          'rgba(255, 209, 102, 1)', isMini ? 0.7 : 1,
          '#ff9f1c', sunIsFront ? isMini ? 8 : 14 : 0
        );
        if (!isMini) {
          // corona rays only while in front — reads as active solar emission
          if (sunIsFront) {
            for (let r = 0; r < 12; r++) {
              const ang = r / 12 * Math.PI * 2 + autoRotate * 2;
              ctx.beginPath();
              ctx.moveTo(sunP.x + Math.cos(ang) * (sr + 2), sunP.y + Math.sin(ang) * (sr + 2));
              ctx.lineTo(sunP.x + Math.cos(ang) * (sr + 7), sunP.y + Math.sin(ang) * (sr + 7));
              ctx.strokeStyle = 'rgba(255,209,102,0.5)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = 'rgba(255,209,102,0.9)';
          ctx.fillText(`SUN · 149.6M KM (NOT TO SCALE)${sunIsFront ? '' : ' · OCCULTED'}`, sunP.x + sr + 5, sunP.y + 3);
        }
        ctx.restore();
      }

      // ---- incoming impact trajectories ----
      // For the higher-risk tracked objects, draw a stylized approach corridor
      // arcing from beyond the outer atmosphere shell down to the object's
      // surface marker — the projected close-approach / potential-impact path.
      const trajectoryTargets = objects.
      map((obj, idx) => ({ obj, idx, tier: riskTier(obj.ps_cum) })).
      filter((t) => t.tier.level >= 2).
      sort((a, b) => b.tier.level - a.tier.level).
      slice(0, isMini ? 3 : 7);

      const nowMs = Date.now();
      trajectoryTargets.forEach(({ obj, idx, tier }) => {
        // Real API data (Sentry ps_cum / n_imp / range) drives risk tier + counts;
        // the modeled monitoring-window offset (same value plotted on the
        // timeline below) tells us whether this object's window has already
        // elapsed ("already touched ground" -> red trajectory) or still lies
        // ahead ("prediction" -> yellow trajectory).
        const alreadyImpacted = deriveWindowOffsetDays(obj.des) < 0;
        const trajColor = alreadyImpacted ? '#ef4444' : '#facc15';
        const gt = impactLatLon(obj.des);
        const lat = gt.lat * Math.PI / 180;
        const lon = gt.lon * Math.PI / 180;
        const approachLat = lat + 0.35;
        const approachLon = lon + 0.5;
        const steps = 24;
        const pts: {x: number;y: number;alpha: number;}[] = [];
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const ease = t * t; // accelerate toward the surface, like a real infall
          const curLat = approachLat + (lat - approachLat) * ease;
          const curLon = approachLon + (lon - approachLon) * ease;
          const curRadius = 2.15 + (1 - 2.15) * ease;
          const p = project(curLat, curLon, curRadius);
          pts.push({ x: p.x, y: p.y, alpha: p.alpha });
        }
        // Draw the corridor as short alpha-blended segments (instead of one hard-cutoff
        // path) so it fades smoothly near the terminator rather than snapping in/out.
        ctx.lineWidth = idx === selectedIdx ? 1.8 : 1.1;
        ctx.shadowColor = trajColor;
        ctx.shadowBlur = idx === selectedIdx ? 8 : alreadyImpacted ? 6 : 3;
        for (let s = 0; s < pts.length - 1; s++) {
          const a = pts[s];
          const b = pts[s + 1];
          const segAlpha = Math.min(a.alpha, b.alpha);
          if (segAlpha <= 0.02) continue;
          ctx.globalAlpha = segAlpha;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = idx === selectedIdx ? trajColor : `${trajColor}aa`;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // animated pulse traveling down the corridor toward the surface
        const cyclePos = (nowMs / (1400 - tier.level * 120) + idx * 0.37) % 1;
        const pulseIdx = Math.min(steps, Math.floor(cyclePos * steps));
        const pulse = pts[pulseIdx];
        if (pulse && pulse.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = pulse.alpha;
          ctx.beginPath();
          ctx.arc(pulse.x, pulse.y, isMini ? 1.4 : 2.1, 0, Math.PI * 2);
          ctx.fillStyle = '#fff7cc';
          ctx.shadowColor = trajColor;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      });

      // ---- impact-risk threat markers, one per tracked Sentry object ----
      objects.forEach((obj, idx) => {
        const gt = impactLatLon(obj.des);
        const lat = gt.lat * Math.PI / 180;
        const lon = gt.lon * Math.PI / 180;
        const p = project(lat, lon);
        // Fade smoothly near the terminator instead of a hard visible/invisible
        // cutoff, so tracked objects ease away as the globe turns rather than
        // popping out of existence from one frame to the next.
        if (p.alpha <= 0.02) return;
        const tier = riskTier(obj.ps_cum);
        const isSelected = idx === selectedIdx;
        const alreadyImpacted = deriveWindowOffsetDays(obj.des) < 0;
        const statusColor = alreadyImpacted ? '#ef4444' : '#facc15';
        const markerSize = (isMini ? 2.2 : 3.4) + tier.level * (isMini ? 0.5 : 0.9);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        // Expanding radar "ping" ring — high-risk (ELEVATED+) objects broadcast
        // a repeating shockwave from their ground-track marker so the threat
        // reads immediately at a glance, not just as a static colored dot. The
        // selected object always pings regardless of tier so the current
        // focus target is never visually quiet.
        if (!isMini && (tier.level >= 4 || isSelected)) {
          const pingPeriod = 1600 - tier.level * 140;
          const pingT = (nowMs / pingPeriod + idx * 0.29) % 1;
          const pingR = markerSize + pingT * (isSelected ? 26 : 16);
          const pingAlpha = (1 - pingT) * p.alpha * (isSelected ? 0.75 : 0.5);
          if (pingAlpha > 0.02) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, pingR, 0, Math.PI * 2);
            ctx.strokeStyle = isSelected ? `rgba(255,247,204,${pingAlpha.toFixed(3)})` : `${tier.color}`;
            ctx.globalAlpha = pingAlpha;
            ctx.lineWidth = isSelected ? 2 : 1.4;
            ctx.stroke();
            ctx.globalAlpha = p.alpha;
          }
        }
        // Selection ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, markerSize + (isSelected ? 4 : 0), 0, Math.PI * 2);
        if (isSelected) {
          ctx.strokeStyle = '#fff7cc';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Status ring — red once the modeled monitoring window has already
        // elapsed ("already touched ground"), yellow while it's still a
        // forward-looking prediction — thin halo around the risk-tier core.
        if (!isMini) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, markerSize + 2.2, 0, Math.PI * 2);
          ctx.strokeStyle = `${statusColor}bb`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        // Risk-tier core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, markerSize, 0, Math.PI * 2);
        ctx.fillStyle = tier.color;
        ctx.shadowColor = tier.color;
        ctx.shadowBlur = tier.level >= 4 ? 8 : 3;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Small status core dot at center to reinforce impacted vs predicted
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.9, markerSize * 0.32), 0, Math.PI * 2);
        ctx.fillStyle = statusColor;
        ctx.fill();

        if (!isMini && (isSelected || tier.level >= 4)) {
          ctx.font = `bold ${isSelected ? 10 : 8}px monospace`;
          ctx.fillStyle = isSelected ? '#facc15' : tier.color;
          ctx.fillText(obj.des, p.x + markerSize + 5, p.y + 3);
          if (isSelected) {
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = statusColor;
            ctx.fillText(alreadyImpacted ? 'IMPACT ELAPSED (MODELED)' : 'PREDICTION', p.x + markerSize + 5, p.y + 13);
            ctx.font = '8px monospace';
            ctx.fillStyle = 'rgba(250,204,21,0.75)';
            ctx.fillText(`${gt.lat >= 0 ? gt.lat.toFixed(1) + 'N' : (-gt.lat).toFixed(1) + 'S'} ${gt.lon >= 0 ? gt.lon.toFixed(1) + 'E' : (-gt.lon).toFixed(1) + 'W'}`, p.x + markerSize + 5, p.y + 24);
          }
        }
        ctx.restore();
      });

      raf = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [objects, selectedIdx, isMini, paused]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragDistance.current > 6) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const bcx = canvas.width / 2;
    const bcy = canvas.height / 2;
    const baseR = Math.max(0, Math.min(bcx, bcy) - (isMini ? 20 : 34));
    const R = baseR * zoomRef.current;
    const cx = bcx + panRef.current.x;
    const cy = bcy + panRef.current.y;
    if (R <= 0) return;
    const rot = rotationRef.current;
    const tilt = 0.32;
    const project = (lat: number, lon: number) => {
      // Kept in sync with the render loop's project() — same sin/cos convention.
      const x0 = Math.cos(lat) * Math.sin(lon + rot);
      const z0 = Math.cos(lat) * Math.cos(lon + rot);
      const y0 = Math.sin(lat);
      const y1 = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
      const z1 = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
      return { x: cx + x0 * R, y: cy - y1 * R, z: z1, visible: z1 > -0.05 };
    };

    let closest = -1;
    let minDist = 20;
    objects.forEach((obj, idx) => {
      const gt = impactLatLon(obj.des);
      const lat = gt.lat * Math.PI / 180;
      const lon = gt.lon * Math.PI / 180;
      const p = project(lat, lon);
      if (!p.visible) return;
      const dist = Math.hypot(clickX - p.x, clickY - p.y);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });
    if (closest >= 0) {
      onSelect(closest);
    }
  };

  const selected = objects[selectedIdx] || objects[0];
  const tier = selected ? riskTier(selected.ps_cum) : riskTier(-99);

  return (
    <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        className="w-full h-full block" />

      {/* MAGI/EVA-style HUD dressing — CRT scanlines + corner crosshair brackets,
            matching the amber wireframe tactical-display reference. Purely decorative,
            pointer-events disabled so drag/zoom/click on the canvas stay unaffected. */}
      <div
        className="absolute inset-0 pointer-events-none z-[5] opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,176,64,0.9) 0px, transparent 1px, transparent 3px)'
        }} />
      <div className="absolute inset-0 pointer-events-none z-[5] opacity-60" aria-hidden="true">
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) =>
        <svg
          key={corner}
          viewBox="0 0 24 24"
          className="absolute w-4 h-4 sm:w-5 sm:h-5"
          style={{
            top: corner === 'tl' || corner === 'tr' ? 4 : undefined,
            bottom: corner === 'bl' || corner === 'br' ? 4 : undefined,
            left: corner === 'tl' || corner === 'bl' ? 4 : undefined,
            right: corner === 'tr' || corner === 'br' ? 4 : undefined,
            transform:
            corner === 'tr' ? 'scaleX(-1)' :
            corner === 'bl' ? 'scaleY(-1)' :
            corner === 'br' ? 'scale(-1,-1)' : undefined,
            filter: 'drop-shadow(0 0 3px rgba(255,176,64,0.7))'
          }}>
            <path d="M2 10 V2 H10" fill="none" stroke="#ffb040" strokeWidth="1.6" />
            <path d="M2 15 V19" fill="none" stroke="#ffb040" strokeWidth="1.2" opacity="0.7" />
            <path d="M15 2 H19" fill="none" stroke="#ffb040" strokeWidth="1.2" opacity="0.7" />
          </svg>
        )}
      </div>

      {!isMini && selected &&
      <div className="absolute top-2 left-2 z-10 pointer-events-none max-w-[210px] bg-space-black/70 border border-red-500/50 rounded-sm px-2.5 py-2 flex flex-col gap-1"
      style={{ boxShadow: tier.level >= 4 ? '0 0 14px rgba(239,68,68,0.35)' : 'none' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-red-500 font-bold text-[10px] leading-none">▲</span>
          <span data-fuser-slot-id="section-text-95a402cc" className="text-[9px] tracking-[0.25em] text-red-400 font-bold uppercase">WARNING</span>
        </div>
        <div className="flex items-center justify-between text-[9px] text-space-muted">
          <span data-fuser-slot-id="section-text-00255391">RISK LEVEL</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((lvl) =>
            <span key={lvl} className="w-1.5 h-1.5" style={{ background: lvl <= tier.level ? tier.color : 'transparent', border: `1px solid ${tier.color}88` }} />
            )}
          </div>
        </div>
        <div className="text-[11px] font-bold uppercase" style={{ color: tier.color }}>{tier.label} · {selected.des}</div>
        <div className="text-[8px] text-space-muted leading-snug">
          IP {selected.ip.toExponential(2)} · PS {selected.ps_cum.toFixed(2)}<br />
          Ø {(selected.diameter * 1000).toFixed(0)}M · V∞ {selected.v_inf.toFixed(1)} KM/S<br />
          WINDOW {selected.range} · {selected.n_imp} POSSIBLE IMPACTS<br />
          <span data-fuser-slot-id="section-text-impact-latlon" className="text-space-orange">GROUND TRACK {(() => {const gt = impactLatLon(selected.des);return `${gt.lat >= 0 ? gt.lat.toFixed(2) + '°N' : (-gt.lat).toFixed(2) + '°S'} ${gt.lon >= 0 ? gt.lon.toFixed(2) + '°E' : (-gt.lon).toFixed(2) + '°W'}`;})()} · MODELED</span>
        </div>
      </div>
      }

      {!isMini && <ImpactTimeline objects={objects} selectedIdx={selectedIdx} onSelect={onSelect} />}

      {!isMini &&
      <div data-fuser-slot-id="section-text-632cc0b2" className="absolute bottom-1.5 right-1.5 text-[8px] text-space-muted/70 font-bold tracking-wider pointer-events-none bg-space-black/50 px-1.5 py-0.5 rounded">
          DRAG · ROTATE | SHIFT+DRAG · PAN | SCROLL · ZOOM
        </div>
      }
      {!isMini &&
      <div data-fuser-slot-id="section-text-5ac19660" className="absolute bottom-1.5 left-1.5 text-[8px] text-space-muted/60 font-bold tracking-wider pointer-events-none bg-space-black/50 px-1.5 py-0.5 rounded flex flex-col gap-0.5">
          <span data-fuser-slot-id="section-text-491d82b3">SRC: NASA/JPL SENTRY · {sourceLabel}</span>
          <span data-fuser-slot-id="section-text-775539fe">MAP: {worldmapSourceLabel}</span>
        </div>
      }
    </div>);

}