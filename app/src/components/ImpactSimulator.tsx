import React, { useEffect, useMemo, useRef, useState } from '@fuser/vendor/react';
import type { Asteroid } from '../data/types';
import { CONTINENTS } from './worldGeo';
import { ThreatWaveform } from './ThreatWaveform';
import { drawArrowhead } from '../utils/canvasDraw';
import {
  COMPOSITIONS,
  computeImpactEffects,
  formatKm,
  formatMt,
  type Composition,
  type ImpactResult } from
'../utils/impactPhysics';

// ==========================================
// IMPACT SIMULATOR — "what if it hit here?"
// Earth rendered in PROFILE — a slowly-rotating orthographic globe close-up
// so the planet's circumference, curvature, and layered atmosphere shells
// are all visible at once (per reference: curved limb, concentric
// atmosphere rings, incoming trajectory, and a debris/particle field that
// expands outward after the strike). Click anywhere on the globe disc to
// drop the impact point; diameter/velocity default from the selected
// tracked NEO (overridable), composition and impact angle are tunable. The
// console reads out crater size, airburst altitude, thermal + blast damage
// radii, and estimated seismic magnitude — computed live from
// Collins/Melosh/Marcus (2005) crater scaling and standard nuclear-effects
// overpressure scaling (see docs/API_CATALOG.md) — presented through a
// MAGI/psychographic-display-inspired verdict console: a top WARNING banner
// that escalates with yield, a three-node threat triad (CRATER / THERMAL /
// SEISMIC), and a live oscilloscope-style overpressure waveform.
// ==========================================

interface Props {
  selectedAsteroid: Asteroid;
  isMini?: boolean;
  paused?: boolean;
  onLog?: (msg: string) => void;
  onResult?: (r: ImpactResult, impactPoint: {lat: number;lon: number;}, isWater: boolean) => void;
}

interface Pt {
  lat: number;
  lon: number;
}

interface Particle {
  x: number; // offset from impact screen point, px
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: 'hot' | 'ember' | 'dust';
}

// Earth's real axial tilt — used for the globe's fixed viewing elevation so
// the "profile" pitch matches the planet's actual obliquity rather than an
// arbitrary angle.
const EARTH_TILT_RAD = 23.44 * Math.PI / 180;

// Satellite/space-station orbit paths drawn around the globe — each is a
// simple tilted ellipse (inclination-style rotation) with an animated
// satellite glyph riding along it, echoing the reference's orbital trace
// rings. Not physically propagated — purely a HUD decoration layer.
interface OrbitSpec {
  key: string;
  label: string;
  incDeg: number; // ellipse rotation, 0 = equatorial (horizontal), 90 = polar (vertical)
  scale: number; // multiple of globe R
  flatten: number; // ry/rx ratio, foreshortening
  speed: number; // radians/frame
  color: string;
}

const ORBIT_SPECS: OrbitSpec[] = [
{ key: 'iss', label: 'ISS TRACK', incDeg: 52, scale: 1.09, flatten: 0.3, speed: 0.021, color: 'rgba(16,243,165,0.85)' },
{ key: 'relay', label: 'RELAY-1', incDeg: 8, scale: 1.22, flatten: 0.22, speed: 0.009, color: 'rgba(250,204,21,0.8)' }];

// ---- true geodesic icosphere mesh (real icosahedron, subdivided) ----
// Generates the actual triangular facet pattern of a geodesic dome — not an
// approximated lat/lon quad grid with diagonals — matching the reference's
// icosahedron-tessellated globe. Computed once at module load; the render
// loop only re-projects the fixed vertex set every frame.
type Vec3 = [number, number, number];
function normalizeVec(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function vecToLatLon(v: Vec3): [number, number] {
  const lat = Math.asin(Math.max(-1, Math.min(1, v[1]))) * 180 / Math.PI;
  const lon = Math.atan2(v[0], v[2]) * 180 / Math.PI;
  return [lat, lon];
}
function generateIcosphereEdges(level: number): [[number, number], [number, number]][] {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: Vec3[] = [
  [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
  [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
  [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].
  map(normalizeVec);
  let faces: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

  const midCache = new Map<string, number>();
  const getMid = (a: number, b: number): number => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const cached = midCache.get(key);
    if (cached !== undefined) return cached;
    const va = verts[a],vb = verts[b];
    const mid = normalizeVec([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]);
    verts.push(mid);
    const idx = verts.length - 1;
    midCache.set(key, idx);
    return idx;
  };
  for (let l = 0; l < level; l++) {
    const next: [number, number, number][] = [];
    faces.forEach(([a, b, c]) => {
      const ab = getMid(a, b),bc = getMid(b, c),ca = getMid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    });
    faces = next;
  }
  const edgeSet = new Map<string, [number, number]>();
  faces.forEach(([a, b, c]) => {
    ([[a, b], [b, c], [c, a]] as [number, number][]).forEach(([x, y]) => {
      const key = x < y ? `${x}_${y}` : `${y}_${x}`;
      if (!edgeSet.has(key)) edgeSet.set(key, [x, y]);
    });
  });
  const latLon = verts.map(vecToLatLon);
  return Array.from(edgeSet.values()).map(([a, b]) => [latLon[a], latLon[b]]);
}
// Level 3 (~1280 faces) for the full panel reads as a dense, sharply-defined
// geodesic dome — matching the reference's fine triangular icosphere mesh;
// level 1 (~80 faces) keeps the sidebar thumbnail legible at small size.
const ICOSPHERE_EDGES_FULL = generateIcosphereEdges(3);
const ICOSPHERE_EDGES_MINI = generateIcosphereEdges(1);


// Small satellite glyph — a squat body with two solar-panel wings, rotated
// to face its direction of travel along the orbit ellipse.
function drawSatelliteIcon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = color;
  ctx.shadowBlur = scale * 1.6;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.7, scale * 0.14);
  // solar panels
  ctx.strokeRect(-scale * 1.7, -scale * 0.45, scale * 1.15, scale * 0.9);
  ctx.strokeRect(scale * 0.55, -scale * 0.45, scale * 1.15, scale * 0.9);
  // center strut
  ctx.beginPath();
  ctx.moveTo(-scale * 0.55, 0);
  ctx.lineTo(scale * 0.55, 0);
  ctx.stroke();
  // body
  ctx.fillRect(-scale * 0.4, -scale * 0.4, scale * 0.8, scale * 0.8);
  ctx.restore();
}

function parseDiameter(size: string): number {
  const n = parseFloat(size);
  return Number.isFinite(n) ? Math.max(1, n) : 50;
}

// Ray-casting point-in-polygon over [lat,lon] rings (approximate — land
// masses only, good enough to classify land vs. ocean for target density).
function pointInPolygon(pt: Pt, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [latI, lonI] = poly[i];
    const [latJ, lonJ] = poly[j];
    const intersect =
    latI > pt.lat !== latJ > pt.lat &&
    pt.lon < (lonJ - lonI) * (pt.lat - latI) / (latJ - latI) + lonI;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Verdict severity 0..1 derived from energy yield — drives the warning
// banner tier, triad node glow, waveform chaos, and particle burst size.
function severityFromMt(mt: number): number {
  const s = Math.log10(Math.max(0.0001, mt) + 0.0001) / Math.log10(1e6); // ~0 at 1kt-ish, 1 at ~1M MT
  return Math.max(0, Math.min(1, s * 1.15 + 0.32));
}

export function ImpactSimulator({ selectedAsteroid, isMini = false, paused = false, onLog, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonsRef = useRef<[number, number][][]>(CONTINENTS.map((s) => s.points));
  const [mapSource, setMapSource] = useState('APPROX TRACE');

  const [impactPoint, setImpactPoint] = useState<Pt>({ lat: 21.4, lon: -89.5 }); // Yucatán — Chicxulub, default drop point
  const [diameterM, setDiameterM] = useState<number>(() => parseDiameter(selectedAsteroid.size));
  const [velocityKmS, setVelocityKmS] = useState<number>(() => selectedAsteroid.kms || 20);
  const [angleDeg, setAngleDeg] = useState<number>(45);
  const [composition, setComposition] = useState<Composition>('rocky');

  // Sync sliders to the currently selected tracked NEO whenever selection changes.
  useEffect(() => {
    setDiameterM(parseDiameter(selectedAsteroid.size));
    setVelocityKmS(selectedAsteroid.kms || 20);
  }, [selectedAsteroid.id]);

  useEffect(() => {
    let cancelled = false;
    fetch('/app-api/worldmap').
    then((r) => r.json()).
    then((json) => {
      if (cancelled) return;
      if (json?.ok && Array.isArray(json.polygons) && json.polygons.length > 0) {
        polygonsRef.current = json.polygons;
        setMapSource('NATURAL EARTH 110M');
        onLog?.('IMPACT SIM · WORLD COASTLINE UPLINK OK');
      }
    }).
    catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isWater = useMemo(
    () => !polygonsRef.current.some((poly) => pointInPolygon(impactPoint, poly)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [impactPoint, mapSource]
  );

  const result = useMemo(
    () => computeImpactEffects({ diameterM, velocityKmS, angleDeg, composition, targetIsWater: isWater }),
    [diameterM, velocityKmS, angleDeg, composition, isWater]
  );

  const severity = useMemo(() => severityFromMt(result.energyMt), [result.energyMt]);
  const verdict =
  severity > 0.78 ? { label: 'EXTINCTION-LEVEL', color: '#ef4444', pips: 5 } :
  severity > 0.6 ? { label: 'SEVERE', color: '#ef4444', pips: 4 } :
  severity > 0.42 ? { label: 'REGIONAL', color: '#f59e0b', pips: 3 } :
  severity > 0.26 ? { label: 'GUARDED', color: '#facc15', pips: 2 } :
  { label: 'LOCALIZED', color: '#10f3a5', pips: 1 };

  useEffect(() => {
    onResult?.(result, impactPoint, isWater);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, impactPoint, isWater]);

  // ---- mutable refs so the render loop / click handler always read fresh
  // values without tearing down the canvas + ResizeObserver + listener on
  // every slider tick (previously this whole effect re-ran on every state
  // change, which could drop clicks mid-frame — see useEffect stability note). ----
  const impactPointRef = useRef(impactPoint);
  impactPointRef.current = impactPoint;
  const resultRef = useRef(result);
  resultRef.current = result;
  const severityRef = useRef(severity);
  severityRef.current = severity;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // angleDeg read inside the render-loop closure via a ref (see useEffect
  // stability rule — sliders must not tear down the canvas/rAF loop).
  const angleDegRef = useRef(angleDeg);
  angleDegRef.current = angleDeg;

  // Spawn-burst token: bumped whenever the impact point or computed yield
  // changes, so the render loop knows to fire a fresh particle burst.
  const spawnTokenRef = useRef(0);
  useEffect(() => {
    spawnTokenRef.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.energyMt, impactPoint.lat, impactPoint.lon]);

  // ---- canvas render loop — mounts once ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let scanPhase = 0;
    let orbitPhase = 0;
    let lon0 = -0.35; // slow auto-rotation, radians
    const lat0 = EARTH_TILT_RAD; // fixed elevation tilt — Earth's real axial obliquity
    let handledSpawnToken = spawnTokenRef.current;

    // Globe placed low + centered — only the upper half of the disc sits
    // inside frame, zoomed in close, so the limb reads as a near-horizon
    // profile rather than a full floating sphere.
    const globeGeometry = (w: number, h: number) => ({
      R: Math.min(w, h) * (isMini ? 0.64 : 0.88),
      cx: w * 0.5,
      cy: h * (isMini ? 1.04 : 1.1)
    });
    const particles: Particle[] = [];
    const ambientDust: {ang: number;dist: number;speed: number;size: number;}[] = Array.from(
      { length: isMini ? 30 : 90 },
      () => ({
        ang: Math.random() * Math.PI * 2,
        dist: 1.06 + Math.random() * 0.28,
        speed: (Math.random() - 0.5) * 0.0009,
        size: Math.random() * 1.4 + 0.4
      })
    );

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, rect.width * dpr);
      canvas.height = Math.max(2, rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Orthographic projection centered on (lat0, lon0). With this tilt the
    // globe's full circumference stays visible while the curvature reads
    // clearly — matching the reference's angled limb view.
    const proj = (latDeg: number, lonDeg: number, cx: number, cy: number, R: number) => {
      const lat = latDeg * Math.PI / 180;
      const lon = lonDeg * Math.PI / 180 - lon0;
      const cosc = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(lon);
      const x = R * Math.cos(lat) * Math.sin(lon);
      const y = R * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(lon));
      return { x: cx + x, y: cy - y, visible: cosc >= -0.04, cosc };
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const impactPt = impactPointRef.current;
      const res = resultRef.current;
      const sev = severityRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#020202';
      ctx.fillRect(0, 0, w, h);

      const { R, cx, cy } = globeGeometry(w, h);

      if (!paused) lon0 -= isMini ? 0.0009 : 0.0013;

      // ---- deep space starfield ----
      if (!isMini) {
        ctx.fillStyle = 'rgba(180,120,60,0.5)';
        for (let i = 0; i < 60; i++) {
          const sx = i * 137.5 % w;
          const sy = (i * 71.3 + i * i * 3) % h;
          ctx.globalAlpha = 0.15 + i % 5 * 0.08;
          ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ---- atmosphere layer shells (troposphere/stratosphere/thermosphere) ----
      const shells = isMini ?
      [{ r: 1.1, color: 'rgba(239,68,68,0.35)' }] :
      [
      { r: 1.06, color: 'rgba(250,204,21,0.4)', label: 'TROPOPAUSE' },
      { r: 1.16, color: 'rgba(245,158,11,0.32)', label: 'STRATOSPHERE' },
      { r: 1.3, color: 'rgba(239,68,68,0.24)', label: 'THERMOSPHERE / KÁRMÁN' }];

      shells.forEach((s) => {
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1, w / 700);
        ctx.setLineDash([w / 140, w / 100]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * s.r, R * s.r * 0.98, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // ambient dust/debris drifting in the atmosphere band, orbiting slowly
      ambientDust.forEach((d) => {
        d.ang += d.speed;
        const rr = R * d.dist;
        const px = cx + Math.cos(d.ang) * rr;
        const py = cy + Math.sin(d.ang) * rr * 0.92;
        ctx.fillStyle = `rgba(229,152,51,${0.25 + 0.35 * Math.sin(d.ang * 3)})`;
        ctx.fillRect(px, py, d.size, d.size);
      });

      // ---- globe disc base ----
      const discGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.05);
      discGrad.addColorStop(0, '#241304');
      discGrad.addColorStop(0.7, '#0e0602');
      discGrad.addColorStop(1, '#020101');
      ctx.fillStyle = discGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // limb rim glow — sells "circumference"
      ctx.save();
      ctx.strokeStyle = '#e59833';
      ctx.lineWidth = Math.max(1, w / 500);
      ctx.shadowColor = 'rgba(229,152,51,0.8)';
      ctx.shadowBlur = isMini ? 2 : 10;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ---- true icosphere mesh — a real subdivided icosahedron projected
      // onto the sphere, so the visible hemisphere reads as an actual
      // geodesic dome of triangular facets (per reference), not an
      // approximated lat/lon quad grid. ----
      const icoEdges = isMini ? ICOSPHERE_EDGES_MINI : ICOSPHERE_EDGES_FULL;
      ctx.save();
      ctx.strokeStyle = isMini ? 'rgba(224,146,48,0.45)' : 'rgba(240,168,68,0.62)';
      ctx.lineWidth = Math.max(isMini ? 0.5 : 0.7, w / (isMini ? 1900 : 1500));
      if (!isMini) {
        ctx.shadowColor = 'rgba(240,168,68,0.35)';
        ctx.shadowBlur = 1.5;
      }
      for (let i = 0; i < icoEdges.length; i++) {
        const [[lat1, lon1], [lat2, lon2]] = icoEdges[i];
        const a = proj(lat1, lon1, cx, cy, R);
        const b = proj(lat2, lon2, cx, cy, R);
        if (a.visible && b.visible) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // ---- rotation axis indicator — a dashed pole-to-pole line extending
      // past the limb, labeled with Earth's real 23.44° obliquity, so the
      // tilt applied to the whole globe view reads as an explicit axial
      // tilt rather than an ambiguous camera angle. ----
      if (!isMini) {
        const poleTop = proj(90, 0, cx, cy, R);
        const poleBottom = proj(-90, 0, cx, cy, R);
        const axisTop = { x: cx + (poleTop.x - cx) * 1.3, y: cy + (poleTop.y - cy) * 1.3 };
        const axisBottom = { x: cx + (poleBottom.x - cx) * 1.12, y: cy + (poleBottom.y - cy) * 1.12 };
        ctx.save();
        ctx.strokeStyle = 'rgba(250,204,21,0.5)';
        ctx.lineWidth = Math.max(0.8, w / 950);
        ctx.setLineDash([w / 300, w / 220]);
        ctx.beginPath();
        ctx.moveTo(axisBottom.x, axisBottom.y);
        ctx.lineTo(axisTop.x, axisTop.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(250,204,21,0.9)';
        ctx.beginPath();
        ctx.arc(axisTop.x, axisTop.y, Math.max(1.4, w / 480), 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `700 ${Math.max(8, w / 150)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(250,204,21,0.8)';
        ctx.fillText('N · 23.44° AXIAL TILT', cx, Math.max(axisTop.y - w / 130, w / 60));
        ctx.restore();
      }

      // coastlines, projected onto the sphere and clipped to the visible hemisphere
      ctx.strokeStyle = '#ffb454';
      ctx.fillStyle = 'rgba(224,140,40,0.3)';
      ctx.lineWidth = Math.max(1.1, w / 800);
      ctx.shadowColor = 'rgba(255,180,84,0.65)';
      ctx.shadowBlur = isMini ? 0 : 5;
      polygonsRef.current.forEach((poly) => {
        if (poly.length < 3) return;
        ctx.beginPath();
        let started = false;
        let anyVisible = false;
        poly.forEach(([lat, lon]) => {
          const p = proj(lat, lon, cx, cy, R);
          if (p.visible) anyVisible = true;
          if (!started) {ctx.moveTo(p.x, p.y);started = true;} else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        if (anyVisible) {
          ctx.fill();
          ctx.stroke();
        }
      });
      ctx.shadowBlur = 0;

      // ---- station orbit trajectories — tilted rings encircling the globe
      // with an animated satellite glyph riding each path ----
      orbitPhase += 1;
      const orbits = isMini ? ORBIT_SPECS.slice(0, 1) : ORBIT_SPECS;
      orbits.forEach((spec) => {
        const rot = spec.incDeg * Math.PI / 180;
        const rx = R * spec.scale;
        const ry = rx * spec.flatten;
        ctx.save();
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = Math.max(0.8, w / 850);
        ctx.setLineDash([w / 220, w / 260]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (!isMini) {
          const t = orbitPhase * spec.speed;
          const cosT = Math.cos(t);
          const sinT = Math.sin(t);
          const sx = cx + rx * cosT * Math.cos(rot) - ry * sinT * Math.sin(rot);
          const sy = cy + rx * cosT * Math.sin(rot) + ry * sinT * Math.cos(rot);
          // only render the marker when it's on the near side of the disc
          const distFromCenter = Math.hypot(sx - cx, (sy - cy) / Math.max(0.35, spec.flatten));
          if (distFromCenter <= R * spec.scale * 1.02) {
            const dx = -rx * sinT * Math.cos(rot) - ry * cosT * Math.sin(rot);
            const dy = -rx * sinT * Math.sin(rot) + ry * cosT * Math.cos(rot);
            const heading = Math.atan2(dy, dx);
            drawSatelliteIcon(ctx, sx, sy, heading, spec.color, Math.max(2.2, w / 260));
            ctx.font = `${Math.max(8, w / 130)}px monospace`;
            ctx.fillStyle = spec.color;
            ctx.textAlign = 'left';
            ctx.fillText(spec.label, sx + w / 55, sy - w / 140);
          }
        }
      });

      // ---- impact point + damage rings, foreshortened to the local surface angle ----
      const ip = proj(impactPt.lat, impactPt.lon, cx, cy, R);
      const foreshorten = Math.max(0.22, ip.cosc);
      const kmToPx = R / 6371; // Earth radius ≈ 6371km, R px = one Earth radius

      const drawRing = (km: number, color: string, dashed = false) => {
        if (!(km > 0.05) || !ip.visible) return;
        const rx = km * kmToPx;
        const ry = rx * foreshorten;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, w / 700);
        if (dashed) ctx.setLineDash([w / 160, w / 220]);
        ctx.beginPath();
        ctx.ellipse(ip.x, ip.y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      if (!isMini) {
        drawRing(res.blastLightKm, 'rgba(250,204,21,0.55)', true);
        drawRing(res.blastModerateKm, 'rgba(245,158,11,0.7)', true);
        drawRing(res.blastSevereKm, 'rgba(239,68,68,0.85)');
        drawRing(res.thermalRadiusKm, 'rgba(255,120,40,0.6)', true);
        if (res.craterType !== 'airburst') {
          drawRing(res.finalCraterM / 1000, '#ffffff');
        }
      } else {
        drawRing(res.blastLightKm, 'rgba(239,68,68,0.6)');
      }

      // ---- incoming trajectory line — from beyond the outer atmosphere shell
      // down to the impact point, angled by angleDeg ----
      if (ip.visible) {
        const steepness = angleDegRef.current / 90; // 0 = grazing, 1 = vertical
        const bearing = -0.9; // fixed approach bearing, upper-right to lower-left
        const reach = R * (isMini ? 0.55 : 0.85);
        const tx = ip.x + Math.cos(bearing) * reach * (1 - steepness * 0.6);
        const ty = ip.y - Math.sin(bearing + Math.PI / 2) * reach * (0.35 + steepness * 0.65) - R * 0.15;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,180,80,0.85)';
        ctx.lineWidth = Math.max(1.2, w / 480);
        ctx.setLineDash([w / 100, w / 180]);
        ctx.shadowColor = 'rgba(255,150,50,0.7)';
        ctx.shadowBlur = isMini ? 0 : 6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(ip.x, ip.y);
        ctx.stroke();
        ctx.restore();
        if (!isMini) {
          const ang = Math.atan2(ip.y - ty, ip.x - tx);
          drawArrowhead(ctx, ip.x, ip.y, ang, w / 90, 'rgba(255,180,80,0.95)');
        }
      }

      // ---- particle burst — debris expanding from the impact point after
      // a fresh strike, decelerating outward then settling with a light
      // "gravity" pull back toward the surface ----
      if (spawnTokenRef.current !== handledSpawnToken && ip.visible) {
        handledSpawnToken = spawnTokenRef.current;
        const count = Math.round((isMini ? 10 : 26) + sev * (isMini ? 30 : 140));
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const speed = (0.6 + Math.random() * 2.6) * (0.5 + sev * 1.6) * (w / 900);
          particles.push({
            x: 0, y: 0,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed * 0.6 - speed * 0.15,
            life: 1,
            maxLife: 40 + Math.random() * 60 + sev * 60,
            size: Math.max(0.8, Math.random() * 2.4 * (w / 900)),
            hue: sev > 0.6 ? 'hot' : sev > 0.35 ? 'ember' : 'dust'
          });
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012 * (w / 900); // settle back down
        p.vx *= 0.985;
        p.vy *= 0.99;
        p.life -= 1 / p.maxLife;
        if (p.life <= 0) {particles.splice(i, 1);continue;}
        const alpha = Math.max(0, p.life);
        const color = p.hue === 'hot' ? `rgba(255,220,140,${alpha})` : p.hue === 'ember' ? `rgba(255,140,60,${alpha})` : `rgba(210,150,90,${alpha * 0.7})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ip.x + p.x, ip.y + p.y, p.size * alpha + p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // impact marker crosshair, pulsing
      scanPhase += 0.05;
      const pulse = 0.55 + 0.45 * Math.sin(scanPhase);
      if (ip.visible) {
        ctx.strokeStyle = `rgba(16,243,165,${0.7 + 0.3 * pulse})`;
        ctx.lineWidth = Math.max(1.2, w / 500);
        const cs = Math.max(6, w / 60);
        ctx.beginPath();
        ctx.moveTo(ip.x - cs, ip.y);ctx.lineTo(ip.x + cs, ip.y);
        ctx.moveTo(ip.x, ip.y - cs);ctx.lineTo(ip.x, ip.y + cs);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ip.x, ip.y, cs * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (!pausedRef.current) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const dpr = canvas.width / rect.width;
      const w = canvas.width;
      const h = canvas.height;
      const { R, cx, cy } = globeGeometry(w, h);
      const lat0Local = EARTH_TILT_RAD;
      const dx = px * dpr - cx;
      const dyMath = -(py * dpr - cy);
      const rho0 = Math.sqrt(dx * dx + dyMath * dyMath);
      if (rho0 > R) return; // clicked off the globe disc
      const rho = Math.min(R, rho0);
      const c = Math.asin(Math.max(-1, Math.min(1, rho / R)));
      let lat: number, lon: number;
      if (rho < 0.001) {
        lat = lat0Local;
        lon = lon0;
      } else {
        const sinLat = Math.cos(c) * Math.sin(lat0Local) + dyMath * Math.sin(c) * Math.cos(lat0Local) / rho;
        lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
        lon = lon0 + Math.atan2(
          dx * Math.sin(c),
          rho * Math.cos(lat0Local) * Math.cos(c) - dyMath * Math.sin(lat0Local) * Math.sin(c)
        );
      }
      const latDeg = lat * 180 / Math.PI;
      const lonDeg = (lon * 180 / Math.PI + 540) % 360 - 180;
      const next = { lat: Math.max(-85, Math.min(85, latDeg)), lon: lonDeg };
      setImpactPoint(next);
      onLog?.(`IMPACT POINT SET · ${next.lat >= 0 ? next.lat.toFixed(1) + 'N' : (-next.lat).toFixed(1) + 'S'} ${next.lon >= 0 ? next.lon.toFixed(1) + 'E' : (-next.lon).toFixed(1) + 'W'}`);
    };
    if (!isMini) canvas.addEventListener('click', handleClick);

    // Resume the animation loop when `paused` flips back to false — the
    // draw loop stops scheduling itself once paused, so a fresh rAF must be
    // kicked off from outside when it un-pauses.
    let resumeRaf = 0;
    if (!paused) {
      resumeRaf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resumeRaf);
      ro.disconnect();
      if (!isMini) canvas.removeEventListener('click', handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMini, paused]);

  if (isMini) {
    return (
      <div ref={containerRef} className="relative w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>);

  }

  return (
    <div className="absolute inset-0 flex flex-col gap-1.5 p-1 overflow-y-auto lg:overflow-hidden">
      {/* WARNING VERDICT BANNER — escalates in color/pips with modeled yield,
                 echoing the boot sequence + MAGI-style alert banners from the
                 inspiration set. Always visible, never blocks the map. */}
      <div
        className="shrink-0 flex items-center gap-2 border-2 rounded-sm px-2.5 py-1.5 transition-colors duration-300"
        style={{
          borderColor: verdict.color,
          background: `${verdict.color}14`,
          boxShadow: `0 0 14px ${verdict.color}55, inset 0 0 10px ${verdict.color}22`
        }}>
        <span className="font-bold text-sm leading-none animate-pulse" style={{ color: verdict.color }}>▲</span>
        <span data-fuser-slot-id="impactsim-warning-label" className="text-[10px] tracking-[0.25em] font-bold uppercase" style={{ color: verdict.color }}>
          {result.craterType === 'airburst' ? 'ATMOSPHERIC AIRBURST' : `${result.craterType} CRATER EVENT`} · THREAT: {verdict.label}
        </span>
        <div className="ml-auto flex gap-1">
          {[1, 2, 3, 4, 5].map((lvl) =>
          <span
            key={lvl}
            className="w-2.5 h-2.5 border"
            style={{
              borderColor: verdict.color,
              background: lvl <= verdict.pips ? verdict.color : 'transparent',
              boxShadow: lvl <= verdict.pips ? `0 0 6px ${verdict.color}` : 'none'
            }} />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2">
        <div ref={containerRef} className="relative flex-1 min-h-[260px] rounded border border-space-orange/20 overflow-hidden cursor-crosshair bg-black">
          <canvas ref={canvasRef} className="w-full h-full block" />
          {/* single non-overlapping top strip — the globe now fills the
                     lower/center frame at close zoom, so every HUD badge lives in
                     one row along the top edge instead of scattered corners. */}
          <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
            <div data-fuser-slot-id="section-text-5faf6fd1" className="text-[8px] text-space-muted font-bold bg-space-black/70 px-1.5 py-0.5 rounded">
              PROFILE VIEW: {mapSource} · CLICK GLOBE TO SET IMPACT POINT
            </div>
            <div className="text-[9px] font-bold bg-space-black/80 px-2 py-0.5 rounded border border-glow-green/40 text-glow-green">
              {impactPoint.lat >= 0 ? impactPoint.lat.toFixed(2) + '°N' : (-impactPoint.lat).toFixed(2) + '°S'}{' '}
              {impactPoint.lon >= 0 ? impactPoint.lon.toFixed(2) + '°E' : (-impactPoint.lon).toFixed(2) + '°W'}{' '}
              · {isWater ? 'OCEAN TARGET' : 'LAND TARGET'}
            </div>
            <div data-fuser-slot-id="section-text-d60e965f" className="text-[8px] text-space-muted font-bold bg-space-black/70 px-1.5 py-0.5 rounded">
              ATMOSPHERE: TROPOPAUSE · STRATOSPHERE · KÁRMÁN LINE · TILT 23.44°
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-2 text-[10px]">
          <div className="border border-space-orange/20 rounded p-2.5 bg-space-black/40 flex flex-col gap-2">
            <div data-fuser-slot-id="section-text-42436431" className="text-space-yellow font-bold text-[11px] border-b border-space-orange/10 pb-1">IMPACTOR PARAMETERS</div>

            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-space-muted"><span data-fuser-slot-id="section-text-1076d156">DIAMETER</span><span data-fuser-slot-id="section-text-80bc3125" className="text-white font-bold">{diameterM.toFixed(0)} M</span></span>
              <input type="range" min={5} max={5000} step={5} value={diameterM}
              onChange={(e) => setDiameterM(Number(e.target.value))}
              className="accent-orange-500 w-full" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-space-muted"><span data-fuser-slot-id="section-text-ee2b1418">VELOCITY</span><span data-fuser-slot-id="section-text-c8217cc6" className="text-white font-bold">{velocityKmS.toFixed(1)} KM/S</span></span>
              <input type="range" min={11} max={72} step={0.5} value={velocityKmS}
              onChange={(e) => setVelocityKmS(Number(e.target.value))}
              className="accent-orange-500 w-full" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-space-muted"><span data-fuser-slot-id="section-text-1ef85b4c">IMPACT ANGLE</span><span className="text-white font-bold">{angleDeg}°</span></span>
              <input type="range" min={10} max={90} step={5} value={angleDeg}
              onChange={(e) => setAngleDeg(Number(e.target.value))}
              className="accent-orange-500 w-full" />
            </label>

            <div className="flex flex-col gap-1">
              <span data-fuser-slot-id="section-text-1a7ae28a" className="text-space-muted">COMPOSITION</span>
              <div className="grid grid-cols-3 gap-1">
                {COMPOSITIONS.map((c) =>
                <button key={c.key} onClick={() => setComposition(c.key)}
                className={`px-1 py-1 rounded border text-[9px] font-bold transition-colors ${
                composition === c.key ? 'border-glow-green text-space-accent bg-space-orange/10' : 'border-space-orange/20 text-space-muted hover:text-white'}`
                }>
                    {c.key.toUpperCase()}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* THREAT TRIAD — three MAGI-style verdict nodes (CRATER / THERMAL /
                     SEISMIC), each lit green/amber/red by its own threshold, linked
                     by connector lines like the BALTHASAR/CASPER/MELCHIOR diagram. */}
          <div className="border border-space-orange/20 rounded p-2.5 bg-space-black/40 flex flex-col gap-1.5">
            <div data-fuser-slot-id="impactsim-triad-title" className="text-space-yellow font-bold text-[11px] border-b border-space-orange/10 pb-1">THREAT TRIAD VERDICT</div>
            <TriadPanel result={result} />
          </div>

          <div className="border border-red-500/30 rounded p-2.5 bg-red-950/10 flex flex-col gap-1.5 flex-1 overflow-y-auto">
            <div className="text-red-400 font-bold text-[11px] border-b border-red-500/20 pb-1">
              {result.craterType === 'airburst' ? '▲ ATMOSPHERIC AIRBURST' : `▲ ${result.craterType.toUpperCase()} CRATER IMPACT`}
            </div>
            <div className="flex justify-between"><span data-fuser-slot-id="section-text-0138dfda" className="text-space-muted">ENERGY YIELD</span><span className="text-white font-bold">{formatMt(result.energyMt)}</span></div>
            {result.craterType === 'airburst' ?
            <div className="flex justify-between"><span data-fuser-slot-id="section-text-f629a33e" className="text-space-muted">BURST ALTITUDE</span><span data-fuser-slot-id="section-text-30a5f65d" className="text-white font-bold">{result.airburstAltitudeKm.toFixed(1)} KM</span></div> :

            <>
                <div className="flex justify-between"><span data-fuser-slot-id="section-text-8f9095c2" className="text-space-muted">CRATER DIAMETER</span><span className="text-white font-bold">{formatKm(result.finalCraterM / 1000)}</span></div>
                <div className="flex justify-between"><span data-fuser-slot-id="section-text-e1f90b25" className="text-space-muted">CRATER DEPTH</span><span className="text-white font-bold">{formatKm(result.craterDepthM / 1000)}</span></div>
              </>
            }
            <div className="flex justify-between"><span data-fuser-slot-id="section-text-9417ea9f" className="text-space-muted">THERMAL / IGNITION RADIUS</span><span className="text-orange-300 font-bold">{formatKm(result.thermalRadiusKm)}</span></div>
            <div className="flex justify-between"><span data-fuser-slot-id="section-text-b488eab2" className="text-space-muted">SEVERE BLAST (20 PSI)</span><span className="text-red-400 font-bold">{formatKm(result.blastSevereKm)}</span></div>
            <div className="flex justify-between"><span data-fuser-slot-id="section-text-dc56fd6d" className="text-space-muted">MODERATE BLAST (5 PSI)</span><span className="text-amber-400 font-bold">{formatKm(result.blastModerateKm)}</span></div>
            <div className="flex justify-between"><span data-fuser-slot-id="section-text-d1a4f83c" className="text-space-muted">WINDOW DAMAGE (1 PSI)</span><span className="text-yellow-300 font-bold">{formatKm(result.blastLightKm)}</span></div>
            <div className="flex justify-between border-t border-red-500/10 pt-1 mt-1"><span data-fuser-slot-id="section-text-c57335d0" className="text-space-muted">EST. SEISMIC MAGNITUDE</span><span data-fuser-slot-id="section-text-10b703a7" className="text-white font-bold">M{result.seismicMagnitude.toFixed(1)}</span></div>

            <div className="pt-1.5 mt-1 border-t border-red-500/10">
              <div data-fuser-slot-id="impactsim-waveform-title" className="text-[8px] text-space-muted font-bold tracking-widest mb-1">OVERPRESSURE WAVEFORM · GROUND RANGE</div>
              <ThreatWaveform severity={severity} labelLeft="GROUND ZERO" labelRight={formatKm(result.blastLightKm)} />
            </div>

            <p data-fuser-slot-id="section-body-ee122d8e" className="text-[8px] text-space-muted/70 leading-relaxed pt-1 border-t border-red-500/10 mt-1">
              Scaling: Collins/Melosh/Marcus (2005) crater equations · nuclear-effects overpressure scaling for blast radii · Schultz-style seismic estimate. Target density {isWater ? '1,000 kg/m³ (ocean)' : '2,500 kg/m³ (crust)'}.
            </p>
          </div>
        </div>
      </div>
    </div>);

}

// ==========================================
// TRIAD PANEL — three small verdict nodes with connector lines, styled after
// the MAGI BALTHASAR/CASPER/MELCHIOR triad from the reference set. Each node
// independently lights up based on its own threat threshold rather than a
// single shared severity, so the triad can visibly disagree (e.g. a strong
// airburst can be thermally severe while seismically negligible).
// ==========================================
function TriadPanel({ result }: {result: ImpactResult;}) {
  const nodes = [
  {
    label: 'CRATER',
    verdict: result.craterType === 'airburst' ? 'N/A' : result.craterType === 'complex' ? 'SEVERE' : 'CONFIRMED',
    color: result.craterType === 'airburst' ? '#4a5568' : result.craterType === 'complex' ? '#ef4444' : '#66ffd3'
  },
  {
    label: 'THERMAL',
    verdict: result.thermalRadiusKm > 50 ? 'SEVERE' : result.thermalRadiusKm > 10 ? 'ELEVATED' : 'CONTAINED',
    color: result.thermalRadiusKm > 50 ? '#ef4444' : result.thermalRadiusKm > 10 ? '#facc15' : '#66ffd3'
  },
  {
    label: 'SEISMIC',
    verdict: result.seismicMagnitude > 7.5 ? 'SEVERE' : result.seismicMagnitude > 5 ? 'ELEVATED' : 'MINOR',
    color: result.seismicMagnitude > 7.5 ? '#ef4444' : result.seismicMagnitude > 5 ? '#facc15' : '#66ffd3'
  }];


  return (
    <div className="relative flex items-start justify-between gap-1 py-1.5">
      {/* connector lines behind the nodes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <line x1="16.5%" y1="30%" x2="50%" y2="70%" stroke="#66ffd344" strokeWidth="1" />
        <line x1="83.5%" y1="30%" x2="50%" y2="70%" stroke="#66ffd344" strokeWidth="1" />
        <line x1="16.5%" y1="30%" x2="83.5%" y2="30%" stroke="#66ffd322" strokeWidth="1" />
      </svg>
      {nodes.map((n, i) =>
      <div key={n.label} className={`relative z-10 flex flex-col items-center gap-1 flex-1 ${i === 1 ? 'mt-6' : ''}`}>
          <div
          className="w-10 h-10 flex items-center justify-center text-[7px] font-bold text-center leading-tight transition-all duration-300"
          style={{
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            background: `${n.color}22`,
            border: `1.5px solid ${n.color}`,
            color: n.color,
            boxShadow: `0 0 10px ${n.color}66`
          }}>
            {n.verdict}
          </div>
          <span data-fuser-slot-id={{ "CRATER": "section-text-ae28c929", "THERMAL": "section-text-65f3e0e7", "SEISMIC": "section-text-b93b5b74" }[n.label]} className="text-[8px] font-bold tracking-wider text-space-muted">{n.label}</span>
        </div>
      )}
    </div>);

}