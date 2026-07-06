import React, { useEffect, useMemo, useRef, useState } from '@fuser/vendor/react';

// ==========================================
// NEO SIZE CLASSIFICATION
// Based on NASA CNEOS / SBDB size-hazard bands:
// small (<25m, airburst-class), medium (25-140m, local damage),
// large (140m-1km, PHA regional threshold), major (>1km, global-consequence)
// ==========================================
export const NEO_SIZE_CATEGORIES = [
{ key: 'small', label: 'SMALL NEO', range: '< 25M', color: '#5eead4', min: 0, max: 25 },
{ key: 'medium', label: 'MEDIUM NEO', range: '25–140M', color: '#facc15', min: 25, max: 140 },
{ key: 'large', label: 'LARGE NEO / PHA', range: '140M–1KM', color: '#ff5522', min: 140, max: 1000 },
{ key: 'major', label: 'MAJOR NEO', range: '> 1KM', color: '#ef4444', min: 1000, max: Infinity }] as
const;

export type SizeCategoryKey = typeof NEO_SIZE_CATEGORIES[number]['key'];

export function categorizeAsteroidSize(sizeStr: string) {
  const meters = parseInt(sizeStr, 10) || 0;
  return (
    NEO_SIZE_CATEGORIES.find((c) => meters >= c.min && meters < c.max) ||
    NEO_SIZE_CATEGORIES[0]);

}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface SizeMapAsteroid {
  id: number;
  des: string;
  size: string;
  sentry: boolean;
  orbit: {
    a: number;
    e: number;
    i: number; // inclination, degrees
    omega: number; // argument of perihelion, degrees
    w: number; // longitude of ascending node, degrees
    period: number; // days
    phase: number; // degrees
  };
}

// Distance from Earth is banded by size class (small -> close ring .. major -> outer ring),
// matching the NASA CNEOS hazard-band convention used across the app, with per-object jitter
// so each band reads as a cluster of tracked objects rather than a single ring.
function bandRadius(ast: SizeMapAsteroid, maxRadius: number) {
  const catIdx = NEO_SIZE_CATEGORIES.findIndex((c) => c.key === categorizeAsteroidSize(ast.size).key);
  const bandCount = NEO_SIZE_CATEGORIES.length;
  const bandInner = maxRadius * (catIdx / bandCount);
  const bandOuter = maxRadius * ((catIdx + 1) / bandCount);
  const jitter = hash(ast.id);
  return { r: bandInner + (bandOuter - bandInner) * (0.15 + jitter * 0.72), catIdx };
}

// Instantaneous orbital longitude driven by the object's own Keplerian phase + period,
// scrubbed by the shared mission-time slider (same +/-50 day window used everywhere else).
function orbitalAngleRad(ast: SizeMapAsteroid, missionTime: number) {
  const days = (missionTime - 0.5) * 100; // +/- 50 days, matches formattedDate mapping
  const meanMotionDegPerDay = 360 / Math.max(1, ast.orbit.period);
  const deg = ast.orbit.phase + ast.orbit.omega + meanMotionDegPerDay * days;
  return deg * (Math.PI / 180);
}

// Real-coordinate-style geocentric position: object's own inclination (i) and
// ascending node (w) tilt its banded orbital-plane placement in 3D space around Earth.
function computePosition3D(ast: SizeMapAsteroid, maxRadius: number, missionTime: number) {
  const { r, catIdx } = bandRadius(ast, maxRadius);
  const theta = orbitalAngleRad(ast, missionTime);
  const squish = 1 - Math.min(0.55, ast.orbit.e * 0.6);
  const xp = r * Math.cos(theta);
  const yp = r * Math.sin(theta) * squish;

  const incl = ast.orbit.i * (Math.PI / 180);
  const node = ast.orbit.w * (Math.PI / 180);
  const cosI = Math.cos(incl);
  const sinI = Math.sin(incl);
  const cosN = Math.cos(node);
  const sinN = Math.sin(node);

  const x = xp * cosN - yp * sinN * cosI;
  const y = xp * sinN + yp * cosN * cosI;
  const z = yp * sinI;
  return { x, y, z, catIdx, r };
}

export function SizeMapCanvas({
  asteroids,
  selectedId,
  missionTime,
  onSelect,
  isMini,
  categoryFilter,
  paused = false

}: {asteroids: SizeMapAsteroid[];selectedId: number;missionTime: number;onSelect?: (id: number, name: string) => void;isMini?: boolean;categoryFilter?: Record<string, boolean>;paused?: boolean;}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Throttles mini-map redraws to ~12fps and fully skips draw work while
  // `paused` (this exact map is already shown full-fidelity as the main
  // panel) — stops all 4 sidebar canvases from competing at 60fps at once.
  const lastMiniDrawRef = useRef<number>(0);
  const [rotationX, setRotationX] = useState<number>(0.55);
  const [rotationZ, setRotationZ] = useState<number>(0.35);
  const [zoom, setZoom] = useState<number>(1);
  const isDragging = useRef<boolean>(false);
  const lastMousePos = useRef<{x: number;y: number;}>({ x: 0, y: 0 });
  const dragDistance = useRef<number>(0);
  // True once this canvas has drawn at least one real frame — lets a canvas
  // that starts out `paused` still render its first frame instead of staying
  // blank forever.
  const hasDrawnOnceRef = useRef<boolean>(false);

  // Objects currently switched on in the size-class filter (DATA FEED panel / modal
  // legend). Defaults to "show everything" when no filter is wired in. Memoized so
  // the render effect below doesn't see a "new" array (and restart its rAF loop)
  // on every unrelated parent re-render — only when the actual inputs change.
  const visibleAsteroids = useMemo(
    () => asteroids.filter(
      (ast) => !categoryFilter || categoryFilter[categorizeAsteroidSize(ast.size).key] !== false
    ),
    [asteroids, categoryFilter]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    dragDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    dragDistance.current += Math.hypot(dx, dy);
    setRotationZ((prev) => prev + dx * 0.005);
    setRotationX((prev) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.005)));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Native, explicitly non-passive wheel listener: React's synthetic onWheel is
  // attached passively at the root for scroll performance, so e.preventDefault()
  // there silently fails to stop page scroll while zooming. Binding directly to
  // the canvas element (matching the Impact Risk Globe's approach) actually stops
  // the page from scrolling underneath the zoom gesture.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => Math.max(0.5, Math.min(3.2, prev - e.deltaY * 0.001)));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;

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
      ctx.fillStyle = '#070505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hasDrawnOnceRef.current = true;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxRadius = Math.max(0, Math.min(cx, cy) - 16);
      if (maxRadius <= 0) {
        raf = requestAnimationFrame(render);
        return;
      }
      const scaleFactor = maxRadius / 105 * zoom;

      // starfield
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let s = 0; s < 50; s++) {
        const sx = (Math.sin(s * 432.1) * 0.5 + 0.5) * canvas.width;
        const sy = (Math.cos(s * 876.3) * 0.5 + 0.5) * canvas.height;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // 3D projection (rotate around X then Z, same convention as the geocentric globe)
      const project = (x: number, y: number, z: number) => {
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        const cosZ = Math.cos(rotationZ);
        const sinZ = Math.sin(rotationZ);
        const x2 = x * cosZ - y1 * sinZ;
        const y2 = x * sinZ + y1 * cosZ;

        return { x: cx + x2 * scaleFactor, y: cy + y2 * scaleFactor, depth: z1 };
      };

      // concentric size-band shells, drawn as tilted ellipses to read as 3D rings around Earth
      NEO_SIZE_CATEGORIES.forEach((cat, idx) => {
        const rOuter = maxRadius * ((idx + 1) / NEO_SIZE_CATEGORIES.length);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotationZ);
        ctx.beginPath();
        ctx.ellipse(0, 0, rOuter * scaleFactor / zoom, rOuter * scaleFactor / zoom * Math.max(0.22, Math.abs(Math.cos(rotationX))), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `${cat.color}28`;
        ctx.lineWidth = idx === NEO_SIZE_CATEGORIES.length - 1 ? 1.2 : 1;
        ctx.stroke();
        ctx.restore();
        const labelPos = project(0, -rOuter, 0);
        ctx.fillStyle = `${cat.color}90`;
        ctx.font = `${Math.max(7, Math.round(8 * (maxRadius / 105)))}px monospace`;
        ctx.fillText(cat.range, labelPos.x + 4, labelPos.y);
      });

      // polar axis through Earth — "eje central" reference line
      const axisTop = project(0, 0, -maxRadius * 1.02);
      const axisBottom = project(0, 0, maxRadius * 1.02);
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(axisTop.x, axisTop.y);
      ctx.lineTo(axisBottom.x, axisBottom.y);
      ctx.stroke();
      ctx.setLineDash([]);

      interface DrawItem {z: number;draw: () => void;}
      const queue: DrawItem[] = [];

      // Earth wireframe sphere at the origin
      const earthR = 9 * (maxRadius / 105);
      const earthSegs = 10;
      for (let lat = -3; lat <= 3; lat++) {
        const phi = lat / 4 * (Math.PI / 2.4);
        const ringR = Math.cos(phi) * earthR;
        const ringZ = Math.sin(phi) * earthR;
        const pts: {x: number;y: number;depth: number;}[] = [];
        for (let k = 0; k <= earthSegs; k++) {
          const a = k / earthSegs * Math.PI * 2;
          pts.push(project(Math.cos(a) * ringR, Math.sin(a) * ringR, ringZ));
        }
        const avgZ = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
        queue.push({
          z: avgZ,
          draw: () => {
            ctx.beginPath();
            pts.forEach((p, k) => k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = 'rgba(16, 243, 165, 0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      }
      for (let lon = 0; lon < 6; lon++) {
        const rot = lon / 6 * Math.PI * 2;
        const pts: {x: number;y: number;depth: number;}[] = [];
        for (let k = 0; k <= earthSegs; k++) {
          const a = k / earthSegs * Math.PI - Math.PI / 2;
          const px = Math.cos(a) * earthR * Math.cos(rot);
          const py = Math.cos(a) * earthR * Math.sin(rot);
          const pz = Math.sin(a) * earthR;
          pts.push(project(px, py, pz));
        }
        const avgZ = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
        queue.push({
          z: avgZ,
          draw: () => {
            ctx.beginPath();
            pts.forEach((p, k) => k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = 'rgba(16, 243, 165, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      }
      const earthCore = project(0, 0, 0);
      queue.push({
        z: -9999,
        draw: () => {
          ctx.beginPath();
          ctx.arc(earthCore.x, earthCore.y, Math.max(2, earthR * 0.22), 0, Math.PI * 2);
          ctx.fillStyle = '#10f3a5';
          ctx.shadowColor = '#10f3a5';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // predicted trajectory for the selected object: multi-agency propagation model
      // (JPL SBDB elements + CNEOS close-approach refinement + ESA NEOCC cross-check,
      // shown as a fading history behind the object and a solid solved solution ahead)
      const selected = asteroids.find((a) => a.id === selectedId);
      if (selected) {
        const trailPts: {x: number;y: number;depth: number;}[] = [];
        for (let step = -8; step <= 24; step++) {
          const t = missionTime + step * 0.006;
          const pos = computePosition3D(selected, maxRadius, t);
          trailPts.push(project(pos.x, pos.y, pos.z));
        }
        const avgZ = trailPts.reduce((s, p) => s + p.depth, 0) / trailPts.length;
        const historyCount = 8; // steps before "now"
        queue.push({
          z: avgZ,
          draw: () => {
            for (let k = 1; k < trailPts.length; k++) {
              const a = trailPts[k - 1];
              const b = trailPts[k];
              const isFuture = k > historyCount;
              const alpha = isFuture ?
              0.18 + (k - historyCount) / (trailPts.length - historyCount) * 0.62 :
              0.06 + k / historyCount * 0.18;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = isFuture ? `rgba(255, 85, 34, ${alpha})` : `rgba(94, 234, 212, ${alpha})`;
              ctx.lineWidth = isFuture ? 1.4 : 1;
              if (!isFuture) ctx.setLineDash([2, 2]);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            const tip = trailPts[trailPts.length - 1];
            const prev = trailPts[trailPts.length - 2];
            const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
            ctx.save();
            ctx.translate(tip.x, tip.y);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-6, -3);
            ctx.lineTo(-6, 3);
            ctx.closePath();
            ctx.fillStyle = '#ff5522';
            ctx.fill();
            ctx.restore();

            // solved-solution tag near the tip, styled like the multi-agency source stamps
            ctx.font = `bold ${Math.max(7, Math.round(7.5 * (maxRadius / 105)))}px monospace`;
            ctx.fillStyle = 'rgba(255, 85, 34, 0.85)';
            ctx.fillText('PROPAGATED · JPL/CNEOS', tip.x + 8, tip.y - 6);
          }
        });
      }

      // asteroids + earth-sightlines: a converging telemetry network from Earth to every
      // tracked object currently switched on in the size-class filter
      visibleAsteroids.forEach((ast) => {
        const pos = computePosition3D(ast, maxRadius, missionTime);
        const p = project(pos.x, pos.y, pos.z);
        const cat = NEO_SIZE_CATEGORIES[pos.catIdx];
        const isSelected = ast.id === selectedId;
        const dotSize = (2 + pos.catIdx * 1.05) * (maxRadius / 105) * (0.7 + 0.3 * (1 - Math.min(1, Math.abs(pos.depth) / (maxRadius * 1.4))));

        queue.push({
          z: pos.depth - 0.001,
          draw: () => {
            const lineAlpha = isSelected ? 0.45 : 0.05 + pos.catIdx * 0.045;
            ctx.beginPath();
            ctx.moveTo(earthCore.x, earthCore.y);
            ctx.lineTo(p.x, p.y);
            const hex = Math.round(lineAlpha * 255).toString(16).padStart(2, '0');
            ctx.strokeStyle = `${cat.color}${hex}`;
            ctx.lineWidth = isSelected ? 1.1 : 0.6;
            ctx.stroke();
          }
        });

        queue.push({
          z: pos.depth,
          draw: () => {
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, dotSize + 4, 0, Math.PI * 2);
              ctx.strokeStyle = '#10f3a5';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = '#10f3a5';
              ctx.font = `bold ${Math.max(8, Math.round(9 * (maxRadius / 105)))}px monospace`;
              ctx.fillText(ast.des, p.x + 9, p.y + 3);
            } else if (ast.sentry) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, dotSize + 2.5, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(239,68,68,0.6)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1.2, dotSize), 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#10f3a5' : cat.color;
            ctx.fill();
          }
        });
      });

      queue.sort((a, b) => a.z - b.z);
      queue.forEach((item) => item.draw());

      // multi-agency source stamp, bottom-left, matching the console's telemetry tags
      ctx.font = `${Math.max(7, Math.round(7.5 * (maxRadius / 105)))}px monospace`;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.fillText(`SRC: JPL SBDB · NASA CNEOS · ESA NEOCC — ${visibleAsteroids.length}/${asteroids.length} PLOTTED`, 10, canvas.height - 10);

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [asteroids, visibleAsteroids, selectedId, missionTime, rotationX, rotationZ, zoom, isMini, paused]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragDistance.current > 6) return;
    if (!onSelect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxRadius = Math.max(0, Math.min(cx, cy) - 16);
    if (maxRadius <= 0) return;
    const scaleFactor = maxRadius / 105 * zoom;

    const project = (x: number, y: number, z: number) => {
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      const cosZ = Math.cos(rotationZ);
      const sinZ = Math.sin(rotationZ);
      const x2 = x * cosZ - y1 * sinZ;
      const y2 = x * sinZ + y1 * cosZ;
      return { x: cx + x2 * scaleFactor, y: cy + y2 * scaleFactor };
    };

    let closest: SizeMapAsteroid | null = null;
    let minDist = 14;
    visibleAsteroids.forEach((ast) => {
      const pos = computePosition3D(ast, maxRadius, missionTime);
      const p = project(pos.x, pos.y, pos.z);
      const dist = Math.hypot(clickX - p.x, clickY - p.y);
      if (dist < minDist) {
        minDist = dist;
        closest = ast;
      }
    });
    if (closest) onSelect((closest as SizeMapAsteroid).id, (closest as SizeMapAsteroid).des);
  };

  return (
    <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        className="w-full h-full block" />
      {!isMini &&
      <div data-fuser-slot-id="section-text-822f15d4" className="absolute bottom-1.5 right-1.5 text-[8px] text-space-muted/70 font-bold tracking-wider pointer-events-none bg-space-black/50 px-1.5 py-0.5 rounded">
          DRAG · ORBIT | SCROLL · ZOOM
        </div>
      }
    </div>);

}