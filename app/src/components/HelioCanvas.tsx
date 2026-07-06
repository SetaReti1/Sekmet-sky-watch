import React, { useState, useEffect, useRef } from '@fuser/vendor/react';
import type { Asteroid, SolarSystemObject } from '../data/types';
import { SOLAR_SYSTEM_OBJECTS, ASTEROID_BELT } from '../data/solarSystemData';
import {
  drawArrowhead,
  drawSizeMarker,
  drawSelectedRhombus,
  drawBeltTriangle,
  draw3DPolyhedron,
  drawSelectedHUD,
  getKeplerianPos } from
'../utils/canvasDraw';
import { categorizeAsteroidSize } from './SizeMapCanvas';
import { GyroCompassOverlay } from './GyroCompassOverlay';

// ==========================================
// HELIOCENTRIC MAP PANEL (3D SYSTEM SIMULATION)
// Sun-centered view: planets, planetoids, the main asteroid belt, and every
// tracked near-Earth object plotted on its true Keplerian orbit.
// ==========================================
export function HelioCanvas({
  selectedAsteroid,
  asteroids = [],
  missionTime,
  onSelectAsteroid,
  selectedObjectType,
  selectedSolarObjectId,
  onSelectSolarObject,
  isMini,
  categoryFilter,
  paused = false

}: {selectedAsteroid: Asteroid;asteroids?: Asteroid[];missionTime: number;onSelectAsteroid?: (id: number, name: string) => void;selectedObjectType?: 'asteroid' | 'solar_system' | 'satellite' | 'belt';selectedSolarObjectId?: string;onSelectSolarObject?: (id: string, name: string) => void;isMini?: boolean;categoryFilter?: Record<string, boolean>;paused?: boolean;}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Throttles mini-map redraws to ~12fps and fully skips draw work while
  // `paused` (this exact map is already shown full-fidelity as the main
  // panel) — this effect re-runs on every missionTime tick from the parent's
  // mission clock, so without this guard all 4 sidebar thumbnails would
  // redraw at 60fps continuously regardless of visibility.
  const lastMiniDrawRef = useRef<number>(0);
  const [rotationX, setRotationX] = useState<number>(0.5);
  const [rotationZ, setRotationZ] = useState<number>(0.2);
  const [zoom, setZoom] = useState<number>(1.25);
  // Mirrors of the above, updated synchronously on every drag/wheel/auto-fit
  // step so the draw effect below can read live values without listing them
  // as deps — avoids a redundant full redraw on every drag mousemove pixel on
  // top of the redraw the parent's mission-time tick already triggers.
  const rotXRef = useRef<number>(0.5);
  const rotZRef = useRef<number>(0.2);
  const zoomRef = useRef<number>(1.25);
  // True once this canvas has drawn at least one real frame — lets a canvas
  // that starts out `paused` still render its first frame instead of staying
  // blank forever.
  const hasDrawnOnceRef = useRef<boolean>(false);
  const isDragging = useRef<boolean>(false);
  const dragDistance = useRef<number>(0);
  const lastMousePos = useRef<{x: number;y: number;}>({ x: 0, y: 0 });
  // Auto-fit zoom: whenever the focused object (Sun-relative selection)
  // changes, we ease `zoom` toward a value that keeps both the selected
  // object and the Sun inside the visible frame. `autoFitRef` tracks which
  // selection the current auto-fit pass belongs to (and whether it's still
  // easing); `userZoomOverrideRef` is set the moment the viewer manually
  // zooms (wheel or +/-/RST buttons) so their choice isn't fought every
  // frame — a fresh selection re-arms the auto-fit again.
  const autoFitRef = useRef<{key: string;active: boolean;}>({ key: '', active: false });
  const userZoomOverrideRef = useRef<boolean>(false);

  // Handle Dragging to rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    dragDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setRotationZ((prev) => {
      const next = prev + dx * 0.005;
      rotZRef.current = next;
      return next;
    });
    setRotationX((prev) => {
      const next = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.005));
      rotXRef.current = next;
      return next;
    });

    dragDistance.current += Math.hypot(dx, dy);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Native, explicitly non-passive wheel listener — see GeocentricCanvas for why
  // React's synthetic onWheel can't actually block page scroll here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      userZoomOverrideRef.current = true;
      setZoom((prev) => {
        const next = Math.max(0.02, Math.min(10.0, prev - e.deltaY * 0.001));
        zoomRef.current = next;
        return next;
      });
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Read live interaction values from refs instead of the effect's closure —
    // keeps rotationX/rotationZ/zoom out of the dependency array below so a
    // drag/zoom gesture doesn't trigger an extra full redraw on top of the one
    // the parent's mission-time tick already drives every frame.
    const rotationX = rotXRef.current;
    const rotationZ = rotZRef.current;
    const zoom = zoomRef.current;
    if (paused && hasDrawnOnceRef.current) return; // shown full-size in the main panel already; skip the redundant redraw
    if (isMini && !paused) {
      const now = performance.now();
      if (now - lastMiniDrawRef.current < 85) return; // ~12fps for sidebar thumbnails
      lastMiniDrawRef.current = now;
    }

    // Resize to match container
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear
    ctx.fillStyle = '#070505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasDrawnOnceRef.current = true;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Dynamic scale factor based on canvas size
    const scaleFactor = Math.min(canvas.width, canvas.height) / 240;

    // 3D Projection helper (camera-relative, always centered on the Sun at cx/cy)
    const projectBase = (x: number, y: number, z: number) => {
      const scale = 50 * scaleFactor; // base scale
      const sx = x * scale;
      const sy = y * scale;
      const sz = z * scale;

      // Rotate around X axis
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      let y1 = sy * cosX - sz * sinX;
      let z1 = sy * sinX + sz * cosX;

      // Rotate around Z axis
      const cosZ = Math.cos(rotationZ);
      const sinZ = Math.sin(rotationZ);
      let x2 = sx * cosZ - y1 * sinZ;
      let y2 = sx * sinZ + y1 * cosZ;

      return {
        x: cx + x2 * zoom,
        y: cy + y2 * zoom,
        z: z1
      };
    };

    // Camera focus: when an object is selected, frame it while keeping the
    // Sun in view as a fixed reference point. The Sun always base-projects
    // to exactly (cx, cy) (it sits at the coordinate origin), so panning the
    // full offset to dead-center the object would push the Sun an equal
    // distance off in the opposite direction — often off-screen entirely.
    // Instead we only apply a fraction (FOCUS_LERP) of that offset: the
    // selected object moves most of the way toward center while the Sun
    // settles on the opposite side, both landing inside the frame together.
    const FOCUS_LERP = 0.62;
    let focusPanX = 0;
    let focusPanY = 0;
    let focusKey = '';
    let focusRawDist = 0; // sun<->object screen distance at zoom=1, used for auto-fit below
    if (selectedObjectType === 'solar_system') {
      const focusObj = SOLAR_SYSTEM_OBJECTS.find((o) => o.id === selectedSolarObjectId);
      if (focusObj) {
        focusKey = `s_${focusObj.id}`;
        const orb = focusObj.orbit;
        const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
        let E = meanAnomaly;
        for (let j = 0; j < 4; j++) E = meanAnomaly + orb.e * Math.sin(E);
        const pos = getKeplerianPos(orb, E);
        const p = projectBase(pos.x, pos.y, pos.z);
        focusPanX = (cx - p.x) * FOCUS_LERP;
        focusPanY = (cy - p.y) * FOCUS_LERP;
        focusRawDist = Math.hypot(p.x - cx, p.y - cy) / Math.max(0.0001, zoom);
      }
    } else if (selectedObjectType === 'asteroid' && selectedAsteroid) {
      focusKey = `a_${selectedAsteroid.id}`;
      const orb = selectedAsteroid.orbit;
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 5; j++) E = meanAnomaly + orb.e * Math.sin(E);
      const pos = getKeplerianPos(orb, E);
      const p = projectBase(pos.x, pos.y, pos.z);
      focusPanX = (cx - p.x) * FOCUS_LERP;
      focusPanY = (cy - p.y) * FOCUS_LERP;
      focusRawDist = Math.hypot(p.x - cx, p.y - cy) / Math.max(0.0001, zoom);
    }

    // Auto-fit zoom: keep both the selected object and the Sun framed. A new
    // selection re-arms the fit (unless the viewer is actively overriding
    // zoom); each frame afterward eases `zoom` toward the ideal value so the
    // Sun and target settle inside the viewport together instead of one of
    // them drifting off-screen for distant orbits (e.g. outer planetoids).
    if (focusKey && focusKey !== autoFitRef.current.key) {
      autoFitRef.current = { key: focusKey, active: true };
      userZoomOverrideRef.current = false;
    } else if (!focusKey) {
      autoFitRef.current = { key: '', active: false };
    }
    if (focusKey && autoFitRef.current.active && !userZoomOverrideRef.current && focusRawDist > 0.01) {
      const minDim = Math.min(canvas.width, canvas.height);
      // Budget the pixel distance the Sun (the dominant term, since
      // FOCUS_LERP > 0.5) is allowed to sit from center, leaving margin for
      // its glow and the object's own label/HUD.
      const budget = minDim * 0.33;
      const idealZoom = Math.max(0.03, Math.min(8, budget / (focusRawDist * FOCUS_LERP)));
      const diff = idealZoom - zoom;
      if (Math.abs(diff) > 0.004) {
        const nextZoom = Math.max(0.02, Math.min(10.0, zoom + diff * 0.14));
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
      } else {
        autoFitRef.current.active = false;
      }
    }

    const project = (x: number, y: number, z: number) => {
      const b = projectBase(x, y, z);
      return { x: b.x + focusPanX, y: b.y + focusPanY, z: b.z };
    };

    // Draw starry background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let s = 0; s < 30; s++) {
      const sx = (Math.sin(s * 321) * 0.5 + 0.5) * canvas.width;
      const sy = (Math.cos(s * 654) * 0.5 + 0.5) * canvas.height;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Draw Sun in the center
    const sunProj = project(0, 0, 0);
    const sunGlow = ctx.createRadialGradient(sunProj.x, sunProj.y, 0, sunProj.x, sunProj.y, 18 * zoom * scaleFactor);
    sunGlow.addColorStop(0, '#ffaa00');
    sunGlow.addColorStop(0.3, 'rgba(255, 170, 0, 0.6)');
    sunGlow.addColorStop(1, 'rgba(255, 170, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunProj.x, sunProj.y, 18 * zoom * scaleFactor, 0, Math.PI * 2);
    ctx.fill();

    // Draw Sun as a spinning 3D polyhedron
    draw3DPolyhedron(ctx, 0, 0, 0, 6 * scaleFactor * zoom / (50 * scaleFactor * zoom), '#ffcc00', missionTime * 5, 'sun', project);

    // Draw Planets & Planetoids Orbits and Bodies
    SOLAR_SYSTEM_OBJECTS.forEach((obj) => {
      // Planets remain plotted as a fixed reference frame even when a NEO size
      // class or the planetoid category is isolated via the legend.
      if (categoryFilter && obj.type !== 'planet' && categoryFilter[obj.type] === false) return;
      const orb = obj.orbit;
      const isSelected = selectedObjectType === 'solar_system' && selectedSolarObjectId === obj.id;
      const isPlanetoid = obj.type === 'planetoid';

      // Draw Orbit Line in 3D
      ctx.save();
      if (isSelected) {
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = obj.color;
        ctx.shadowBlur = 6 * scaleFactor;
      } else if (isPlanetoid) {
        // Planetoid orbits get a highlighted, glowing tint in their own body
        // color so the dwarf-planet band still reads distinctly from planets/
        // NEOs — but kept thin while unselected so the selected object's own
        // (thicker) orbit stands out clearly once picked.
        ctx.strokeStyle = `${obj.color}90`;
        ctx.lineWidth = 0.7;
        ctx.shadowColor = obj.color;
        ctx.shadowBlur = 2.5 * scaleFactor;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 0.8;
      }
      ctx.beginPath();
      const steps = obj.type === 'planet' ? 60 : 40;
      for (let s = 0; s <= steps; s++) {
        const theta = s / steps * Math.PI * 2;
        const pos = getKeplerianPos(orb, theta);
        const p = project(pos.x, pos.y, pos.z);
        if (s === 0) ctx.moveTo(p.x, p.y);else
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();

      // Draw integrated arrowheads along planet + planetoid orbits in 3D,
      // marking direction of travel — planetoids get their own body-color arrows.
      if (obj.type === 'planet' || isPlanetoid) {
        const arrowCount = 3;
        for (let a = 0; a < arrowCount; a++) {
          const arrowAngle = a * Math.PI * 2 / arrowCount + missionTime * 0.1 * (365.25 / orb.period);
          const pos1 = getKeplerianPos(orb, arrowAngle);
          const p1 = project(pos1.x, pos1.y, pos1.z);

          const dAngle = 0.02;
          const pos2 = getKeplerianPos(orb, arrowAngle + dAngle);
          const p2 = project(pos2.x, pos2.y, pos2.z);

          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          drawArrowhead(ctx, p1.x, p1.y, angle, 4 * scaleFactor, isSelected ? obj.color : isPlanetoid ? `${obj.color}d0` : 'rgba(255, 255, 255, 0.2)');
        }
      }

      // Calculate position based on missionTime
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 4; j++) {
        E = meanAnomaly + orb.e * Math.sin(E);
      }
      const pos = getKeplerianPos(orb, E);
      const p = project(pos.x, pos.y, pos.z);

      // Draw Planet as a 3D Polyhedron (simple 3D object / polygon) instead of a circle!
      const polySize = (obj.type === 'planet' ? obj.name === 'Earth' || obj.name === 'Jupiter' || obj.name === 'Saturn' ? 4 : 3 : 2.4) * scaleFactor * zoom;
      const spinAngle = missionTime * 15 * (365.25 / orb.period);
      draw3DPolyhedron(ctx, pos.x, pos.y, pos.z, polySize / (50 * scaleFactor * zoom), obj.color, spinAngle, obj.type, project);

      // If Saturn, draw its rings!
      if (obj.name === 'Saturn') {
        ctx.strokeStyle = 'rgba(244, 226, 133, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.1) {
          const rx = pos.x + Math.cos(theta) * (polySize * 1.8 / (50 * scaleFactor * zoom));
          const ry = pos.y + Math.sin(theta) * (polySize * 1.8 / (50 * scaleFactor * zoom));
          const rp = project(rx, ry, pos.z);
          if (theta === 0) ctx.moveTo(rp.x, rp.y);else
          ctx.lineTo(rp.x, rp.y);
        }
        ctx.stroke();
      }

      // Label — planets always labeled; planetoids now labeled too (smaller,
      // glow-tinted) so the expanded dwarf-planet roster reads clearly at a glance.
      if (obj.type === 'planet' || isPlanetoid || isSelected) {
        ctx.save();
        ctx.fillStyle = isSelected ? '#ffffff' : obj.color;
        ctx.font = `${isSelected ? 'bold' : isPlanetoid ? '' : 'bold'} ${Math.max(7, Math.round((isPlanetoid && !isSelected ? 8 : 9) * scaleFactor))}px monospace`;
        if (isPlanetoid && !isSelected) {
          ctx.shadowColor = obj.color;
          ctx.shadowBlur = 3 * scaleFactor;
        }
        ctx.fillText(obj.name.toUpperCase(), p.x + 6 * scaleFactor, p.y + 3 * scaleFactor);
        ctx.restore();
      }

      // If selected, draw HUD overlay reticle on it!
      if (isSelected) {
        drawSelectedHUD(ctx, p, pos, obj.name, obj.orbit.a, 0, obj.size, scaleFactor, canvas.width, canvas.height);
      }
    });

    // Draw the Main Asteroid Belt — a scattered ring of small yellow triangle markers
    // between Mars and Jupiter, each tumbling and orbiting at its own true Keplerian rate.
    {
      const beltSelected = selectedObjectType === 'belt';

      // Belt boundary rings (inner/outer) to read as a "band" rather than noise.
      // Brighter + glowing when the belt itself is the selected object.
      ctx.save();
      if (beltSelected) {
        ctx.shadowColor = 'rgba(250, 204, 21, 0.9)';
        ctx.shadowBlur = 8 * scaleFactor;
      }
      ctx.strokeStyle = beltSelected ? 'rgba(255, 255, 255, 0.9)' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = beltSelected ? 1.8 : 0.8;
      [2.06, 3.28].forEach((radiusAU) => {
        ctx.beginPath();
        for (let s = 0; s <= 72; s++) {
          const theta = s / 72 * Math.PI * 2;
          const pos = getKeplerianPos({ a: radiusAU, e: 0, i: 0, omega: 0, w: 0, period: 1, phase: 0 }, theta);
          const p = project(pos.x, pos.y, pos.z);
          if (s === 0) ctx.moveTo(p.x, p.y);else
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      });
      ctx.restore();

      // When selected, wash the whole band with a faint glowing fill between the two rings
      if (beltSelected) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        for (let s = 0; s <= 72; s++) {
          const theta = s / 72 * Math.PI * 2;
          const pos = getKeplerianPos({ a: 3.28, e: 0, i: 0, omega: 0, w: 0, period: 1, phase: 0 }, theta);
          const p = project(pos.x, pos.y, pos.z);
          if (s === 0) ctx.moveTo(p.x, p.y);else
          ctx.lineTo(p.x, p.y);
        }
        for (let s = 72; s >= 0; s--) {
          const theta = s / 72 * Math.PI * 2;
          const pos = getKeplerianPos({ a: 2.06, e: 0, i: 0, omega: 0, w: 0, period: 1, phase: 0 }, theta);
          const p = project(pos.x, pos.y, pos.z);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ASTEROID_BELT.forEach((rock) => {
        const meanAnomaly = (missionTime * 360 * (365.25 / rock.period) + rock.phase) * (Math.PI / 180);
        let E = meanAnomaly;
        for (let j = 0; j < 3; j++) {
          E = meanAnomaly + rock.e * Math.sin(E);
        }
        const orb = { a: rock.a, e: rock.e, i: rock.i, omega: rock.omega, w: rock.w, period: rock.period, phase: rock.phase };
        const pos = getKeplerianPos(orb, E);
        const p = project(pos.x, pos.y, pos.z);

        const tumble = rock.spin + missionTime * 6 * (365.25 / rock.period);
        const color = beltSelected ? '#ffffff' : rock.hue ? '#cbd5e1' : '#94a3b8';
        const beltSize = rock.size * scaleFactor * Math.max(0.6, zoom * 0.6) * (beltSelected ? 1.3 : 1);
        if (beltSelected) {
          ctx.save();
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 4 * scaleFactor;
          drawBeltTriangle(ctx, p.x, p.y, beltSize, tumble, color, !!rock.hue);
          ctx.restore();
        } else {
          drawBeltTriangle(ctx, p.x, p.y, beltSize, tumble, color, !!rock.hue);
        }
      });

      // HUD label + line-to-sun when the belt region is the selected object
      if (beltSelected) {
        const labelAngle = missionTime * Math.PI * 0.3 + 0.6;
        const labelPos = getKeplerianPos({ a: 2.67, e: 0, i: 4, omega: 0, w: 0, period: 1, phase: 0 }, labelAngle);
        const lp = project(labelPos.x, labelPos.y, labelPos.z);

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sunProj.x, sunProj.y);
        ctx.lineTo(lp.x, lp.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!isMini) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(9, Math.round(10 * scaleFactor))}px monospace`;
          ctx.fillText('MAIN ASTEROID BELT', lp.x + 8 * scaleFactor, lp.y - 6 * scaleFactor);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = `${Math.max(8, Math.round(8 * scaleFactor))}px monospace`;
          ctx.fillText('2.06–3.28 AU • 260 TRACKED', lp.x + 8 * scaleFactor, lp.y + 6 * scaleFactor);
        }
        ctx.restore();
      }
    }

    // Draw All Other Asteroids' orbits, each marked by its NASA CNEOS-style size class
    asteroids.forEach((ast) => {
      if (selectedObjectType === 'asteroid' && ast.id === selectedAsteroid.id) return;
      const cat = categorizeAsteroidSize(ast.size);
      if (categoryFilter && categoryFilter[cat.key] === false) return;

      // Faint orbit line, tinted by size class
      ctx.strokeStyle = `${cat.color}0d`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const theta = s / steps * Math.PI * 2;
        const pos = getKeplerianPos(ast.orbit, theta);
        const p = project(pos.x, pos.y, pos.z);
        if (s === 0) ctx.moveTo(p.x, p.y);else
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Position + size-class marker glyph
      const orb = ast.orbit;
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 4; j++) {
        E = meanAnomaly + orb.e * Math.sin(E);
      }
      const pos = getKeplerianPos(orb, E);
      const p = project(pos.x, pos.y, pos.z);

      // Marker radius scales by hazard-size class so the roster reads
      // largest-to-smallest at a glance (major > large > medium > small),
      // trimmed down overall from the previous flat, larger glyph size.
      const sizeMul = cat.key === 'major' ? 1.05 : cat.key === 'large' ? 0.82 : cat.key === 'medium' ? 0.62 : 0.44;
      drawSizeMarker(ctx, p.x, p.y, 1.35 * scaleFactor * sizeMul, `${cat.color}b0`, cat.key);
    });

    // Draw Selected Asteroid Orbit & HUD (only if selectedObjectType is 'asteroid')
    if (selectedObjectType === 'asteroid') {
      const orb = selectedAsteroid.orbit;

      // Draw full orbit ellipse path in 3D
      ctx.strokeStyle = 'rgba(255, 85, 34, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let theta = 0; theta <= Math.PI * 2 + 0.05; theta += 0.05) {
        const pos = getKeplerianPos(orb, theta);
        const p = project(pos.x, pos.y, pos.z);
        if (theta === 0) ctx.moveTo(p.x, p.y);else
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Draw integrated arrowheads along the asteroid's elliptical orbit in 3D
      const astArrowCount = 4;
      for (let a = 0; a < astArrowCount; a++) {
        const E_arrow = a * Math.PI * 2 / astArrowCount + missionTime * 0.1;
        const pos1 = getKeplerianPos(orb, E_arrow);
        const p1 = project(pos1.x, pos1.y, pos1.z);

        const dE = 0.02;
        const pos2 = getKeplerianPos(orb, E_arrow + dE);
        const p2 = project(pos2.x, pos2.y, pos2.z);

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        drawArrowhead(ctx, p1.x, p1.y, angle, 5 * scaleFactor, 'rgba(255, 85, 34, 0.95)');
      }

      // Calculate current position of selected asteroid on its orbit
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 5; j++) {
        E = meanAnomaly + orb.e * Math.sin(E);
      }
      const pos = getKeplerianPos(orb, E);
      const p = project(pos.x, pos.y, pos.z);

      // Calculate trajectory angle
      const nextPos = getKeplerianPos(orb, E + 0.01);
      const np = project(nextPos.x, nextPos.y, nextPos.z);
      const trajectoryAngle = Math.atan2(np.y - p.y, np.x - p.x);

      // Draw selected rhombus (size increased by 8px)
      drawSelectedRhombus(ctx, p.x, p.y, 8 * scaleFactor / 3 + 8, '#facc15', trajectoryAngle, scaleFactor);

      // Draw line to Sun in 3D
      ctx.strokeStyle = 'rgba(255, 85, 34, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sunProj.x, sunProj.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // HUD Overlay
      drawSelectedHUD(ctx, p, pos, selectedAsteroid.des, orb.a, selectedAsteroid.kms, selectedAsteroid.size, scaleFactor, canvas.width, canvas.height);
    }

  }, [selectedAsteroid, asteroids, missionTime, rotationX, rotationZ, zoom, selectedObjectType, selectedSolarObjectId, isMini, categoryFilter, paused]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragDistance.current > 6) return; // Ignore clicks if they dragged the camera
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scaleFactor = Math.min(canvas.width, canvas.height) / 240;

    // Helper projection function for click detection — mirrors the draw
    // effect's camera-focus pan so hit-testing lines up with what's rendered.
    const projectClickBase = (x: number, y: number, z: number) => {
      const scale = 50 * scaleFactor;
      const sx = x * scale;
      const sy = y * scale;
      const sz = z * scale;

      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      let y1 = sy * cosX - sz * sinX;
      let z1 = sy * sinX + sz * cosX;

      const cosZ = Math.cos(rotationZ);
      const sinZ = Math.sin(rotationZ);
      let x2 = sx * cosZ - y1 * sinZ;
      let y2 = sx * sinZ + y1 * cosZ;

      return {
        x: cx + x2 * zoom,
        y: cy + y2 * zoom
      };
    };

    // Mirror the draw effect's full-frame camera (including the Sun-keeps-
    // in-view lerp) so hit-testing lines up with what's actually rendered.
    const CLICK_FOCUS_LERP = 0.62;
    let clickFocusPanX = 0;
    let clickFocusPanY = 0;
    if (selectedObjectType === 'solar_system') {
      const focusObj = SOLAR_SYSTEM_OBJECTS.find((o) => o.id === selectedSolarObjectId);
      if (focusObj) {
        const orb = focusObj.orbit;
        const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
        let E = meanAnomaly;
        for (let j = 0; j < 4; j++) E = meanAnomaly + orb.e * Math.sin(E);
        const pos = getKeplerianPos(orb, E);
        const p = projectClickBase(pos.x, pos.y, pos.z);
        clickFocusPanX = (cx - p.x) * CLICK_FOCUS_LERP;
        clickFocusPanY = (cy - p.y) * CLICK_FOCUS_LERP;
      }
    } else if (selectedObjectType === 'asteroid' && selectedAsteroid) {
      const orb = selectedAsteroid.orbit;
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 5; j++) E = meanAnomaly + orb.e * Math.sin(E);
      const pos = getKeplerianPos(orb, E);
      const p = projectClickBase(pos.x, pos.y, pos.z);
      clickFocusPanX = (cx - p.x) * CLICK_FOCUS_LERP;
      clickFocusPanY = (cy - p.y) * CLICK_FOCUS_LERP;
    }

    const projectClick = (x: number, y: number, z: number) => {
      const b = projectClickBase(x, y, z);
      return { x: b.x + clickFocusPanX, y: b.y + clickFocusPanY };
    };

    let closestSolar: SolarSystemObject | null = null;
    let closestAst: Asteroid | null = null;
    let minDistance = 18;

    // Check solar system objects
    SOLAR_SYSTEM_OBJECTS.forEach((obj) => {
      const orb = obj.orbit;
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 4; j++) {
        E = meanAnomaly + orb.e * Math.sin(E);
      }
      const pos = getKeplerianPos(orb, E);
      const p = projectClick(pos.x, pos.y, pos.z);

      const dist = Math.hypot(clickX - p.x, clickY - p.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestSolar = obj;
        closestAst = null;
      }
    });

    // Check asteroids
    if (!closestSolar) {
      asteroids.forEach((ast) => {
        const orb = ast.orbit;
        const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
        let E = meanAnomaly;
        for (let j = 0; j < 4; j++) {
          E = meanAnomaly + orb.e * Math.sin(E);
        }
        const pos = getKeplerianPos(orb, E);
        const p = projectClick(pos.x, pos.y, pos.z);

        const dist = Math.hypot(clickX - p.x, clickY - p.y);
        if (dist < minDistance) {
          minDistance = dist;
          closestAst = ast;
        }
      });
    }

    if (closestSolar) {
      if (onSelectSolarObject) {
        onSelectSolarObject(closestSolar.id, closestSolar.name);
      }
    } else if (closestAst) {
      if (onSelectAsteroid) {
        onSelectAsteroid(closestAst.id, closestAst.des);
      }
    }
  };

  return (
    <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        className="w-full h-full block" />
      
      {!isMini &&
      <GyroCompassOverlay
        rotationX={rotationX}
        rotationZ={rotationZ}
        mode="helio"
        selectedAsteroid={selectedAsteroid}
        asteroids={asteroids}
        missionTime={missionTime}
        selectedObjectType={selectedObjectType}
        selectedSolarObjectId={selectedSolarObjectId} />

      }

      {/* Zoom / Camera Controls Overlay */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20 pointer-events-auto">
        <button data-fuser-slot-id="section-button-text-9aeb4aa9"
        onClick={(e) => {e.stopPropagation();userZoomOverrideRef.current = true;setZoom((prev) => {const next = Math.min(10.0, prev * 1.3);zoomRef.current = next;return next;});}}
        className="w-7 h-7 bg-space-black/90 border border-glow-yellow/70 rounded flex items-center justify-center text-space-yellow hover:border-glow-green hover:text-glow-green transition-all font-bold text-sm">
          +
        </button>
        <button data-fuser-slot-id="section-button-text-14a0c948"
        onClick={(e) => {e.stopPropagation();userZoomOverrideRef.current = true;setZoom((prev) => {const next = Math.max(0.02, prev / 1.3);zoomRef.current = next;return next;});}}
        className="w-7 h-7 bg-space-black/90 border border-glow-yellow/70 rounded flex items-center justify-center text-space-yellow hover:border-glow-green hover:text-glow-green transition-all font-bold text-sm">
          -
        </button>
        <button data-fuser-slot-id="section-button-text-7d61057f"
        onClick={(e) => {e.stopPropagation();userZoomOverrideRef.current = false;autoFitRef.current = { key: '', active: false };zoomRef.current = 1.25;rotXRef.current = 0.5;rotZRef.current = 0.2;setZoom(1.25);setRotationX(0.5);setRotationZ(0.2);}}
        className="w-7 h-7 bg-space-black/90 border border-glow-yellow/70 rounded flex items-center justify-center text-space-yellow hover:border-glow-green hover:text-glow-green transition-all text-[9px] font-bold">
          RST
        </button>
      </div>
    </div>);

}
