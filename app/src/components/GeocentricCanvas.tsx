import React, { useState, useEffect, useRef } from '@fuser/vendor/react';
import type { Satellite } from '../data/types';
import { drawArrowhead, drawSelectedRhombus } from '../utils/canvasDraw';
import { GyroCompassOverlay } from './GyroCompassOverlay';

// ==========================================
// GEOCENTRIC MAP PANEL (3D ORBITAL SIMULATION)
// Earth-centered view: Moon, ISS, and the live satellite constellation.
// ==========================================
export function GeocentricCanvas({
  satellites,
  filter,
  selectedSatelliteId,
  selectedObjectType,
  onSelectSatellite,
  isMini,
  missionTime = 0.5,
  paused = false








}: {satellites: Satellite[];filter: Record<string, boolean>;selectedSatelliteId?: number;selectedObjectType?: 'asteroid' | 'solar_system' | 'satellite';onSelectSatellite?: (id: number) => void;isMini?: boolean;missionTime?: number;paused?: boolean;}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Throttles mini-map redraws to ~12fps and fully skips draw work while
  // `paused` (this exact map is already shown full-fidelity as the main
  // panel) — stops all 4 sidebar canvases from competing at 60fps at once.
  const lastMiniDrawRef = useRef<number>(0);
  const [rotationX, setRotationX] = useState<number>(0.5);
  const [rotationZ, setRotationZ] = useState<number>(0.2);
  const [zoom, setZoom] = useState<number>(1.5);
  // Mirrors of the above, updated synchronously on every drag/wheel event so the
  // render loop below can read live values without listing them as effect deps
  // (which used to tear down + restart the rAF loop on every mousemove pixel,
  // causing dragging to stutter and the main panel to drop frames).
  const rotXRef = useRef<number>(0.5);
  const rotZRef = useRef<number>(0.2);
  const zoomRef = useRef<number>(1.5);
  // True once this canvas has drawn at least one real frame — lets a canvas
  // that starts out `paused` (its main-panel counterpart is active on load)
  // still render its first frame instead of staying blank forever.
  const hasDrawnOnceRef = useRef<boolean>(false);
  const isDragging = useRef<boolean>(false);
  const lastMousePos = useRef<{x: number;y: number;}>({ x: 0, y: 0 });
  const dragDistance = useRef<number>(0);
  const angleOffsetRef = useRef<number>(0);

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
    dragDistance.current += Math.hypot(dx, dy);

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

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Native, explicitly non-passive wheel listener: React's synthetic onWheel is
  // attached passively at the root for scroll performance, so e.preventDefault()
  // there silently fails to stop page scroll while zooming. Binding directly to
  // the canvas element actually stops the page from scrolling under the gesture.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => {
        const next = Math.max(0.5, Math.min(4.0, prev - e.deltaY * 0.001));
        zoomRef.current = next;
        return next;
      });
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragDistance.current > 6) return; // Ignore clicks if they dragged the camera
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scaleFactor = Math.min(canvas.width, canvas.height) / 260;

    // 3D Projection helper (exact copy of the one in render)
    const projectClick = (x: number, y: number, z: number) => {
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      let y1 = y * cosX - z * sinX;
      let z1 = y * sinX + z * cosX;

      const cosZ = Math.cos(rotationZ);
      const sinZ = Math.sin(rotationZ);
      let x2 = x * cosZ - y1 * sinZ;
      let y2 = x * sinZ + y1 * cosZ;

      return {
        x: cx + x2 * zoom * scaleFactor,
        y: cy + y2 * zoom * scaleFactor
      };
    };

    let closestSat: Satellite | null = null;
    let minDistance = 15; // click radius in pixels

    satellites.forEach((sat) => {
      if (!filter[sat.category]) return;

      const currentAngle = sat.angle + angleOffsetRef.current * sat.speed * 50;
      const xp = sat.radius * Math.cos(currentAngle);
      const yp = sat.radius * Math.sin(currentAngle);
      const cosI = Math.cos(sat.inclination);
      const sinI = Math.sin(sat.inclination);
      const cosN = Math.cos(sat.node);
      const sinN = Math.sin(sat.node);

      const x = xp * cosN - yp * sinN * cosI;
      const y = xp * sinN + yp * cosN * cosI;
      const z = yp * sinI;

      const p = projectClick(x, y, z);
      const dist = Math.hypot(clickX - p.x, clickY - p.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestSat = sat;
      }
    });

    if (closestSat) {
      if (onSelectSatellite) {
        onSelectSatellite(closestSat.id);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    angleOffsetRef.current = 0;

    const MINI_FRAME_INTERVAL = 85; // ~12fps for sidebar thumbnails
    const render = () => {
      // Read live interaction values from refs instead of the effect's closure —
      // keeps rotationX/rotationZ/zoom out of the dependency array below so a
      // drag or zoom gesture updates these refs without tearing down and
      // restarting this whole animation loop every frame.
      const rotationX = rotXRef.current;
      const rotationZ = rotZRef.current;
      const zoom = zoomRef.current;
      if (paused && hasDrawnOnceRef.current) {
        // This exact map is currently projected full-size in the main panel —
        // skip all draw work here rather than rendering it twice at once.
        // (Still draws once below if it has never rendered a frame yet, so a
        // canvas that starts out paused isn't left permanently blank.)
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      if (isMini && !paused) {
        const now = performance.now();
        if (now - lastMiniDrawRef.current < MINI_FRAME_INTERVAL) {
          animationFrameId = requestAnimationFrame(render);
          return;
        }
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
      const scaleFactor = Math.min(canvas.width, canvas.height) / 260;
      const baseRadius = 45 * zoom * scaleFactor;

      // Draw starry background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let s = 0; s < 40; s++) {
        const sx = (Math.sin(s * 432) * 0.5 + 0.5) * canvas.width;
        const sy = (Math.cos(s * 876) * 0.5 + 0.5) * canvas.height;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Draw faint background orbital ring grids
      ctx.strokeStyle = 'rgba(255, 85, 34, 0.05)';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, baseRadius * r * 1.5, baseRadius * r * 0.8, rotationZ, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3D Projection helper
      const project = (x: number, y: number, z: number) => {
        // Rotate around X axis
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;

        // Rotate around Z axis
        const cosZ = Math.cos(rotationZ);
        const sinZ = Math.sin(rotationZ);
        let x2 = x * cosZ - y1 * sinZ;
        let y2 = x * sinZ + y1 * cosZ;

        return {
          x: cx + x2 * zoom * scaleFactor,
          y: cy + y2 * zoom * scaleFactor,
          z: z1
        };
      };

      const moonInclination = 23.5 * (Math.PI / 180);
      const moonNode = 0.8;

      // Moon orbital plane projection helper
      const getOrbitPoint = (r: number, theta: number) => {
        const xp = r * Math.cos(theta);
        const yp = r * Math.sin(theta);
        const cosI = Math.cos(moonInclination);
        const sinI = Math.sin(moonInclination);
        const cosN = Math.cos(moonNode);
        const sinN = Math.sin(moonNode);
        const x = xp * cosN - yp * sinN * cosI;
        const y = xp * sinN + yp * cosN * cosI;
        const z = yp * sinI;
        return project(x, y, z);
      };

      // Draw Earth in the center
      const earthRadius = 10;
      const earthProj = project(0, 0, 0);

      // Increment angleOffset for animations
      angleOffsetRef.current += 0.002;
      const angleOffset = angleOffsetRef.current;

      // Define Draw Queue structure for 3D depth sorting
      interface DrawItem {
        z: number;
        draw: () => void;
      }
      const drawQueue: DrawItem[] = [];

      // 1. Queue Earth Drawing
      drawQueue.push({
        z: 0,
        draw: () => {
          // Arrays to hold segment lines for depth sorting of the globe lines
          interface EarthSegment {
            p1: {x: number;y: number;z: number;};
            p2: {x: number;y: number;z: number;};
            color: string;
            width: number;
          }
          const backSegments: EarthSegment[] = [];
          const frontSegments: EarthSegment[] = [];

          // Helper to categorize segment
          const addSegment = (p1: {x: number;y: number;z: number;}, p2: {x: number;y: number;z: number;}, frontColor: string, backColor: string, frontWidth: number, backWidth: number) => {
            const avgZ = (p1.z + p2.z) / 2;
            if (avgZ >= 0) {
              frontSegments.push({ p1, p2, color: frontColor, width: frontWidth });
            } else {
              backSegments.push({ p1, p2, color: backColor, width: backWidth });
            }
          };

          // A. Generate Earth latitude rings (parallels)
          for (let lat = -4; lat <= 4; lat++) {
            const r = earthRadius * Math.cos(lat * Math.PI / 10);
            const z = earthRadius * Math.sin(lat * Math.PI / 10);
            for (let lon = 0; lon < 24; lon++) {
              const theta1 = lon * Math.PI * 2 / 24;
              const theta2 = (lon + 1) * Math.PI * 2 / 24;
              const p1 = project(r * Math.cos(theta1), r * Math.sin(theta1), z);
              const p2 = project(r * Math.cos(theta2), r * Math.sin(theta2), z);
              addSegment(
                p1, p2,
                'rgba(16, 243, 165, 0.85)', // Highlighted front parallel
                'rgba(16, 243, 165, 0.15)', // Faint back parallel
                1.2,
                0.8
              );
            }
          }

          // B. Generate Earth longitude rings (meridians)
          for (let lon = 0; lon < 8; lon++) {
            const theta = lon * Math.PI / 8;
            for (let lat = -10; lat < 10; lat++) {
              const phi1 = lat * Math.PI / 10;
              const phi2 = (lat + 1) * Math.PI / 10;
              const p1 = project(earthRadius * Math.cos(phi1) * Math.cos(theta), earthRadius * Math.cos(phi1) * Math.sin(theta), earthRadius * Math.sin(phi1));
              const p2 = project(earthRadius * Math.cos(phi2) * Math.cos(theta), earthRadius * Math.cos(phi2) * Math.sin(theta), earthRadius * Math.sin(phi2));
              addSegment(
                p1, p2,
                'rgba(16, 243, 165, 0.75)', // Highlighted front meridian
                'rgba(16, 243, 165, 0.12)', // Faint back meridian
                1.0,
                0.8
              );
            }
          }

          // C. Generate Equator Ring (brighter)
          for (let lon = 0; lon < 30; lon++) {
            const theta1 = lon * Math.PI * 2 / 30;
            const theta2 = (lon + 1) * Math.PI * 2 / 30;
            const p1 = project(earthRadius * Math.cos(theta1), earthRadius * Math.sin(theta1), 0);
            const p2 = project(earthRadius * Math.cos(theta2), earthRadius * Math.sin(theta2), 0);
            addSegment(
              p1, p2,
              'rgba(16, 243, 165, 0.95)', // Very bright equator front
              'rgba(16, 243, 165, 0.25)', // Faint equator back
              1.8,
              1.0
            );
          }

          // D. Generate Rotational Axis
          const axisSegments = 20;
          const axisLength = earthRadius * 1.5;
          for (let s = 0; s < axisSegments; s++) {
            const z1_val = -axisLength + s / axisSegments * (2 * axisLength);
            const z2_val = -axisLength + (s + 1) / axisSegments * (2 * axisLength);
            const p1 = project(0, 0, z1_val);
            const p2 = project(0, 0, z2_val);
            addSegment(
              p1, p2,
              'rgba(250, 204, 21, 0.85)', // Highlighted yellow axis front
              'rgba(250, 204, 21, 0.2)', // Faint yellow axis back
              1.2,
              0.8
            );
          }

          // Poles indicators helper
          const northPole = project(0, 0, earthRadius * 1.5);
          const southPole = project(0, 0, -earthRadius * 1.5);
          const drawPole = (p: {x: number;y: number;z: number;}) => {
            if (p.z >= 0) {
              ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
              ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
            } else {
              ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
              ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
            }
          };

          // 1. Draw all back segments
          backSegments.forEach((seg) => {
            ctx.strokeStyle = seg.color;
            ctx.lineWidth = seg.width;
            ctx.beginPath();
            ctx.moveTo(seg.p1.x, seg.p1.y);
            ctx.lineTo(seg.p2.x, seg.p2.y);
            ctx.stroke();
          });

          // Draw south/north poles if they are in the back
          if (southPole.z < 0) drawPole(southPole);
          if (northPole.z < 0) drawPole(northPole);

          // 2. Draw Earth solid backing with 70% transparent black fill (adding 20% opacity to 50%)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.arc(earthProj.x, earthProj.y, earthRadius * zoom * scaleFactor, 0, Math.PI * 2);
          ctx.fill();

          // 3. Draw all front segments
          frontSegments.forEach((seg) => {
            ctx.strokeStyle = seg.color;
            ctx.lineWidth = seg.width;
            ctx.beginPath();
            ctx.moveTo(seg.p1.x, seg.p1.y);
            ctx.lineTo(seg.p2.x, seg.p2.y);
            ctx.stroke();
          });

          // Draw south/north poles if they are in the front
          if (southPole.z >= 0) drawPole(southPole);
          if (northPole.z >= 0) drawPole(northPole);

          // 4. Draw Earth core glow
          const earthGlow = ctx.createRadialGradient(earthProj.x, earthProj.y, earthRadius * zoom * scaleFactor * 0.8, earthProj.x, earthProj.y, earthRadius * zoom * scaleFactor * 1.8);
          earthGlow.addColorStop(0, 'rgba(16, 243, 165, 0.5)');
          earthGlow.addColorStop(0.5, 'rgba(16, 243, 165, 0.15)');
          earthGlow.addColorStop(1, 'rgba(16, 243, 165, 0)');
          ctx.fillStyle = earthGlow;
          ctx.beginPath();
          ctx.arc(earthProj.x, earthProj.y, earthRadius * zoom * scaleFactor * 1.8, 0, Math.PI * 2);
          ctx.fill();

          // Label Earth
          ctx.fillStyle = 'rgba(16, 243, 165, 0.8)';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('EARTH', earthProj.x + earthRadius * zoom * scaleFactor * 1.2, earthProj.y - 2);
        }
      });

      // 2. Queue Moon Orbit Path (Dashed)
      const moonRadius = 115;
      let prevMoonOrbitP = getOrbitPoint(moonRadius, 0);
      for (let theta = 0.05; theta <= Math.PI * 2 + 0.05; theta += 0.05) {
        const currentP = getOrbitPoint(moonRadius, theta);
        const avgZ = (prevMoonOrbitP.z + currentP.z) / 2;
        const p1 = { x: prevMoonOrbitP.x, y: prevMoonOrbitP.y };
        const p2 = { x: currentP.x, y: currentP.y };

        drawQueue.push({
          z: avgZ,
          draw: () => {
            ctx.strokeStyle = 'rgba(200, 220, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
          }
        });
        prevMoonOrbitP = currentP;
      }

      // 3. Queue Moon Orbit Trajectory Arrowheads
      for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 2) {
        const shiftTheta = theta + angleOffset * 0.05;
        const p1 = getOrbitPoint(moonRadius, shiftTheta);
        const p2 = getOrbitPoint(moonRadius, shiftTheta + 0.05);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        drawQueue.push({
          z: p1.z,
          draw: () => {
            drawArrowhead(ctx, p1.x, p1.y, angle, 5 * scaleFactor, 'rgba(200, 220, 255, 0.4)');
          }
        });
      }

      // 4. Queue Moon Current Position & Telemetry
      const moonAngle = angleOffset * 0.15; // Slower orbital speed
      const moonP = getOrbitPoint(moonRadius, moonAngle);

      drawQueue.push({
        z: moonP.z,
        draw: () => {
          const moonBodyRadius = 3 * scaleFactor;
          // Solid backing
          ctx.fillStyle = '#0a0d14';
          ctx.beginPath();
          ctx.arc(moonP.x, moonP.y, moonBodyRadius, 0, Math.PI * 2);
          ctx.fill();

          // Wireframe circles
          ctx.strokeStyle = 'rgba(200, 220, 255, 0.8)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(moonP.x, moonP.y, moonBodyRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Crosshair lines inside Moon
          ctx.beginPath();
          ctx.moveTo(moonP.x - moonBodyRadius, moonP.y);
          ctx.lineTo(moonP.x + moonBodyRadius, moonP.y);
          ctx.moveTo(moonP.x, moonP.y - moonBodyRadius);
          ctx.lineTo(moonP.x, moonP.y + moonBodyRadius);
          ctx.stroke();

          // Moon Glow
          const moonGlow = ctx.createRadialGradient(moonP.x, moonP.y, 0, moonP.x, moonP.y, moonBodyRadius * 2);
          moonGlow.addColorStop(0, 'rgba(200, 220, 255, 0.4)');
          moonGlow.addColorStop(1, 'rgba(200, 220, 255, 0)');
          ctx.fillStyle = moonGlow;
          ctx.beginPath();
          ctx.arc(moonP.x, moonP.y, moonBodyRadius * 2, 0, Math.PI * 2);
          ctx.fill();

          // Draw Moon Telemetry Labels
          ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('☮ LUNA / MOON', moonP.x + 8, moonP.y - 2);
          ctx.fillStyle = 'rgba(200, 220, 255, 0.55)';
          ctx.font = '7px monospace';
          ctx.fillText('384,400 KM (1.0 LD)', moonP.x + 8, moonP.y + 6);
        }
      });

      // 5. Queue fading trajectory history trail
      for (let t = 0; t < 35; t++) {
        const trailAngle = moonAngle - t * 0.025;
        const tp = getOrbitPoint(moonRadius, trailAngle);

        drawQueue.push({
          z: tp.z,
          draw: () => {
            ctx.fillStyle = `rgba(200, 220, 255, ${0.5 * (1 - t / 35)})`;
            ctx.fillRect(tp.x - 1, tp.y - 1, 2, 2);
          }
        });
      }

      // 6. Queue Earth-Moon Gravity/Distance Vector
      drawQueue.push({
        z: (0 + moonP.z) / 2,
        draw: () => {
          ctx.strokeStyle = 'rgba(200, 220, 255, 0.12)';
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(earthProj.x, earthProj.y);
          ctx.lineTo(moonP.x, moonP.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // 7. Queue 2D Circular Grid (Yellow Reticula)
      const getGridOpacity = (ratio: number, baseAlpha = 0.6) => {
        if (ratio <= 1.0) {
          return baseAlpha * (1 - ratio * 0.2);
        } else {
          const fade = (ratio - 1.0) / 0.375;
          return Math.max(0, baseAlpha * 0.8 * (1 - fade));
        }
      };

      const circleSteps = 11;
      for (let c = 1; c <= circleSteps; c++) {
        const r = c / 8 * moonRadius;
        const ratio = c / 8;
        const opacity = getGridOpacity(ratio, 0.5);

        let prevP = getOrbitPoint(r, 0);
        for (let theta = 0.05; theta <= Math.PI * 2 + 0.05; theta += 0.05) {
          const currentP = getOrbitPoint(r, theta);
          const avgZ = (prevP.z + currentP.z) / 2;
          const p1 = { x: prevP.x, y: prevP.y };
          const p2 = { x: currentP.x, y: currentP.y };

          drawQueue.push({
            z: avgZ,
            draw: () => {
              if (c === 8) {
                ctx.strokeStyle = `rgba(250, 204, 21, ${opacity * 1.6})`;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([]);
              } else {
                ctx.strokeStyle = `rgba(250, 204, 21, ${opacity})`;
                ctx.lineWidth = 0.8;
                if (c % 2 === 0) {
                  ctx.setLineDash([2, 4]);
                } else {
                  ctx.setLineDash([4, 6]);
                }
              }
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          });
          prevP = currentP;
        }
      }

      // Draw radial lines (spokes) in the orbital plane
      const spokesCount = 12;
      const maxSpokeRadius = 11 / 8 * moonRadius;
      for (let s = 0; s < spokesCount; s++) {
        const theta = s * (Math.PI * 2 / spokesCount);
        const segments = 11;
        let prevP = getOrbitPoint(0, theta);
        for (let seg = 1; seg <= segments; seg++) {
          const r_seg = seg / segments * maxSpokeRadius;
          const ratio = seg / segments * (11 / 8);
          const p_seg = getOrbitPoint(r_seg, theta);
          const avgZ = (prevP.z + p_seg.z) / 2;
          const p1 = { x: prevP.x, y: prevP.y };
          const p2 = { x: p_seg.x, y: p_seg.y };

          drawQueue.push({
            z: avgZ,
            draw: () => {
              const opacity = getGridOpacity(ratio, 0.3);
              ctx.strokeStyle = `rgba(250, 204, 21, ${opacity})`;
              ctx.lineWidth = 0.6;
              ctx.setLineDash([2, 5]);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          });
          prevP = p_seg;
        }
      }

      // Draw yellow tick marks and labels along a static spoke
      const labelTheta = 0.5;
      const labels = [
      { ratio: 0.25, text: '0.25 LD' },
      { ratio: 0.5, text: '0.50 LD' },
      { ratio: 0.75, text: '0.75 LD' },
      { ratio: 1.0, text: '1.00 LD (MOON)' }];


      labels.forEach((lbl) => {
        const r = lbl.ratio * moonRadius;
        const lp = getOrbitPoint(r, labelTheta);

        drawQueue.push({
          z: lp.z,
          draw: () => {
            ctx.beginPath();
            ctx.arc(lp.x, lp.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(lp.x, lp.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
            ctx.fill();

            ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
            ctx.font = 'bold 8px monospace';
            ctx.fillText(lbl.text, lp.x + 5, lp.y + 3);
          }
        });
      });

      // 8. Queue ISS Orbit path & Arrowheads
      const issInclination = 51.6 * (Math.PI / 180);
      const issNode = 1.2;
      const issRadius = 11.5;

      let prevIssOrbitP = project(
        issRadius * Math.cos(0) * Math.cos(issNode) - issRadius * Math.sin(0) * Math.sin(issNode) * Math.cos(issInclination),
        issRadius * Math.cos(0) * Math.sin(issNode) + issRadius * Math.sin(0) * Math.cos(issNode) * Math.cos(issInclination),
        issRadius * Math.sin(0) * Math.sin(issInclination)
      );
      for (let theta = 0.05; theta <= Math.PI * 2 + 0.05; theta += 0.05) {
        const xp = issRadius * Math.cos(theta);
        const yp = issRadius * Math.sin(theta);
        const cosI = Math.cos(issInclination);
        const sinI = Math.sin(issInclination);
        const cosN = Math.cos(issNode);
        const sinN = Math.sin(issNode);
        const x = xp * cosN - yp * sinN * cosI;
        const y = xp * sinN + yp * cosN * cosI;
        const z = yp * sinI;
        const currentP = project(x, y, z);
        const avgZ = (prevIssOrbitP.z + currentP.z) / 2;
        const p1 = { x: prevIssOrbitP.x, y: prevIssOrbitP.y };
        const p2 = { x: currentP.x, y: currentP.y };

        drawQueue.push({
          z: avgZ,
          draw: () => {
            ctx.strokeStyle = 'rgba(16, 243, 165, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
        prevIssOrbitP = currentP;
      }

      for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 2) {
        const xp = issRadius * Math.cos(theta + angleOffset * 0.1);
        const yp = issRadius * Math.sin(theta + angleOffset * 0.1);
        const cosI = Math.cos(issInclination);
        const sinI = Math.sin(issInclination);
        const cosN = Math.cos(issNode);
        const sinN = Math.sin(issNode);
        const x = xp * cosN - yp * sinN * cosI;
        const y = xp * sinN + yp * cosN * cosI;
        const z = yp * sinI;
        const p1 = project(x, y, z);

        const dt = 0.05;
        const xp_next = issRadius * Math.cos(theta + angleOffset * 0.1 + dt);
        const yp_next = issRadius * Math.sin(theta + angleOffset * 0.1 + dt);
        const x_next = xp_next * cosN - yp_next * sinN * cosI;
        const y_next = xp_next * sinN + yp_next * cosN * cosI;
        const z_next = yp_next * sinI;
        const p2 = project(x_next, y_next, z_next);

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        drawQueue.push({
          z: p1.z,
          draw: () => {
            drawArrowhead(ctx, p1.x, p1.y, angle, 5 * scaleFactor, 'rgba(16, 243, 165, 0.6)');
          }
        });
      }

      // 9. Queue representative orbital rings for active categories
      const categories = [
      { key: 'starlink', r: 18, inc: 53 * Math.PI / 180, node: 0.5, color: 'rgba(16, 243, 165, 0.08)', arrowColor: 'rgba(16, 243, 165, 0.4)' },
      { key: 'oneweb', r: 30, inc: 87 * Math.PI / 180, node: 1.8, color: 'rgba(59, 130, 246, 0.08)', arrowColor: 'rgba(59, 130, 246, 0.4)' },
      { key: 'gps', r: 52, inc: 55 * Math.PI / 180, node: 3.1, color: 'rgba(52, 211, 153, 0.08)', arrowColor: 'rgba(52, 211, 153, 0.4)' },
      { key: 'geobelt', r: 86, inc: 0 * Math.PI / 180, node: 0, color: 'rgba(255, 85, 34, 0.08)', arrowColor: 'rgba(255, 85, 34, 0.4)' }];


      categories.forEach((cat) => {
        if (!filter[cat.key]) return;

        let prevRingP = project(
          cat.r * Math.cos(0) * Math.cos(cat.node) - cat.r * Math.sin(0) * Math.sin(cat.node) * Math.cos(cat.inc),
          cat.r * Math.cos(0) * Math.sin(cat.node) + cat.r * Math.sin(0) * Math.cos(cat.node) * Math.cos(cat.inc),
          cat.r * Math.sin(0) * Math.sin(cat.inc)
        );
        for (let theta = 0.1; theta <= Math.PI * 2 + 0.1; theta += 0.1) {
          const xp = cat.r * Math.cos(theta);
          const yp = cat.r * Math.sin(theta);
          const cosI = Math.cos(cat.inc);
          const sinI = Math.sin(cat.inc);
          const cosN = Math.cos(cat.node);
          const sinN = Math.sin(cat.node);
          const x = xp * cosN - yp * sinN * cosI;
          const y = xp * sinN + yp * cosN * cosI;
          const z = yp * sinI;
          const currentP = project(x, y, z);
          const avgZ = (prevRingP.z + currentP.z) / 2;
          const p1 = { x: prevRingP.x, y: prevRingP.y };
          const p2 = { x: currentP.x, y: currentP.y };

          drawQueue.push({
            z: avgZ,
            draw: () => {
              ctx.strokeStyle = cat.color;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          });
          prevRingP = currentP;
        }

        for (let theta = 0; theta < Math.PI * 2; theta += Math.PI * 2 / 3) {
          const shiftTheta = theta + angleOffset * 0.05;
          const xp = cat.r * Math.cos(shiftTheta);
          const yp = cat.r * Math.sin(shiftTheta);
          const cosI = Math.cos(cat.inc);
          const sinI = Math.sin(cat.inc);
          const cosN = Math.cos(cat.node);
          const sinN = Math.sin(cat.node);
          const x = xp * cosN - yp * sinN * cosI;
          const y = xp * sinN + yp * cosN * cosI;
          const z = yp * sinI;
          const p1 = project(x, y, z);

          const dt = 0.1;
          const xp_next = cat.r * Math.cos(shiftTheta + dt);
          const yp_next = cat.r * Math.sin(shiftTheta + dt);
          const x_next = xp_next * cosN - yp_next * sinN * cosI;
          const y_next = xp_next * sinN + yp_next * cosN * cosI;
          const z_next = yp_next * sinI;
          const p2 = project(x_next, y_next, z_next);

          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

          drawQueue.push({
            z: p1.z,
            draw: () => {
              drawArrowhead(ctx, p1.x, p1.y, angle, 4 * scaleFactor, cat.arrowColor);
            }
          });
        }
      });

      // 10. Queue Satellites
      satellites.forEach((sat) => {
        if (!filter[sat.category]) return;

        const currentAngle = sat.angle + angleOffset * sat.speed * 50;
        const xp = sat.radius * Math.cos(currentAngle);
        const yp = sat.radius * Math.sin(currentAngle);
        const cosI = Math.cos(sat.inclination);
        const sinI = Math.sin(sat.inclination);
        const cosN = Math.cos(sat.node);
        const sinN = Math.sin(sat.node);

        const x = xp * cosN - yp * sinN * cosI;
        const y = xp * sinN + yp * cosN * cosI;
        const z = yp * sinI;
        const p = project(x, y, z);

        const isSelected = selectedObjectType === 'satellite' && selectedSatelliteId === sat.id;

        if (isSelected) {
          // Draw full orbit ring for the selected satellite in yellow
          let prevRingP = project(
            sat.radius * Math.cos(0) * Math.cos(sat.node) - sat.radius * Math.sin(0) * Math.sin(sat.node) * Math.cos(sat.inclination),
            sat.radius * Math.cos(0) * Math.sin(sat.node) + sat.radius * Math.sin(0) * Math.cos(sat.node) * Math.cos(sat.inclination),
            sat.radius * Math.sin(0) * Math.sin(sat.inclination)
          );
          for (let theta = 0.1; theta <= Math.PI * 2 + 0.1; theta += 0.1) {
            const rxp = sat.radius * Math.cos(theta);
            const ryp = sat.radius * Math.sin(theta);
            const rcosI = Math.cos(sat.inclination);
            const rsinI = Math.sin(sat.inclination);
            const rcosN = Math.cos(sat.node);
            const rsinN = Math.sin(sat.node);
            const rx = rxp * rcosN - ryp * rsinN * rcosI;
            const ry = rxp * rsinN + ryp * rcosN * rcosI;
            const rz = ryp * rsinI;
            const currentP = project(rx, ry, rz);
            const avgZ = (prevRingP.z + currentP.z) / 2;
            const p1 = { x: prevRingP.x, y: prevRingP.y };
            const p2 = { x: currentP.x, y: currentP.y };

            drawQueue.push({
              z: avgZ,
              draw: () => {
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            });
            prevRingP = currentP;
          }
        }

        let color = '#ffffff';
        if (sat.category === 'starlink') color = '#10f3a5';else
        if (sat.category === 'oneweb') color = '#3b82f6';else
        if (sat.category === 'weather') color = '#ffffff';else
        if (sat.category === 'gps') color = '#34d399';else
        if (sat.category === 'geobelt') color = '#ff5522';else
        if (sat.category === 'other') color = '#c084fc';

        drawQueue.push({
          z: p.z,
          draw: () => {
            if (isSelected) {
              // Calculate trajectory angle
              const nextAngle = currentAngle + 0.01;
              const nxp = sat.radius * Math.cos(nextAngle);
              const nyp = sat.radius * Math.sin(nextAngle);
              const nx = nxp * cosN - nyp * sinN * cosI;
              const ny = nxp * sinN + nyp * cosN * cosI;
              const nz = nyp * sinI;
              const np = project(nx, ny, nz);
              const trajectoryAngle = Math.atan2(np.y - p.y, np.x - p.x);

              // Draw selected rhombus (size increased by 8px)
              drawSelectedRhombus(ctx, p.x, p.y, 8 * scaleFactor / 3 + 8, '#facc15', trajectoryAngle, scaleFactor);

              // Blinking outer circle
              if (Math.floor(Date.now() / 250) % 2 === 0) {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 14 * scaleFactor, 0, Math.PI * 2);
                ctx.stroke();
              }

              // Text label
              ctx.fillStyle = '#facc15';
              ctx.font = 'bold 9px monospace';
              ctx.fillText(`SAT-${sat.id} [SELECTED]`, p.x + 12, p.y - 4);
            } else {
              ctx.fillStyle = color;
              ctx.fillRect(p.x, p.y, 1.5, 1.5);
            }
          }
        });
      });

      // 12. Sort draw queue by depth (z) ascending and execute draw functions
      drawQueue.sort((a, b) => a.z - b.z);
      drawQueue.forEach((item) => item.draw());

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [satellites, filter, selectedSatelliteId, selectedObjectType, isMini, paused]);

  return (
    <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full block" />
      {!isMini &&
      <GyroCompassOverlay
        rotationX={rotationX}
        rotationZ={rotationZ}
        mode="geocentric"
        missionTime={missionTime} />

      }
    </div>);
}
