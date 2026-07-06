import React, { useEffect, useRef } from '@fuser/vendor/react';
import type { Asteroid } from '../data/types';
import { getKeplerianPos } from '../utils/canvasDraw';
import { SOLAR_SYSTEM_OBJECTS } from '../data/solarSystemData';

// ==========================================
// ENHANCED 3D STAR COMPASS / GYRO & CLOSE-APPROACH PLOTTER (HTML DIV OVERLAY)
// Shared attitude-indicator overlay used by both the Geocentric Map and Helio Map panels.
// ==========================================
interface GyroCompassOverlayProps {
  rotationX: number;
  rotationZ: number;
  mode?: 'geocentric' | 'helio';
  selectedAsteroid?: Asteroid;
  asteroids?: Asteroid[];
  missionTime?: number;
  selectedObjectType?: 'asteroid' | 'solar_system' | 'satellite' | 'belt';
  selectedSolarObjectId?: string;
}

export function GyroCompassOverlay({
  rotationX,
  rotationZ,
  mode = 'geocentric',
  selectedAsteroid,
  asteroids = [],
  missionTime = 0.5,
  selectedObjectType,
  selectedSolarObjectId
}: GyroCompassOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 260;
      const height = rect.height || 260;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const isHelio = mode === 'helio';
      const cx = width / 2;
      // The Helio-mode compass keeps a vertically centered pivot (no upward
      // offset) and a tighter radius/margin so its brackets and ring never
      // clip against the smaller container it now renders in.
      const cy = isHelio ? height / 2 : height / 2 - 12;
      const compassRadius = Math.min(width, height) * (isHelio ? 0.34 : 0.44);
      const scaleFactor = Math.min(width, height) / 180;
      const adjustedScaleFactor = scaleFactor;

      // Bearing toward the currently selected object, expressed in the same
      // raw ecliptic-plane angle convention used elsewhere in this overlay —
      // this drives the "TGT" marker below so the pilot can orient the
      // camera toward whatever is currently selected using the same N/E/S/W
      // logic as the rest of the compass.
      let targetBearingRad: number | null = null;
      if (isHelio) {
        if (selectedObjectType === 'solar_system' && selectedSolarObjectId) {
          const obj = SOLAR_SYSTEM_OBJECTS.find((o) => o.id === selectedSolarObjectId);
          if (obj) {
            const orb = obj.orbit;
            const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
            let E = meanAnomaly;
            for (let j = 0; j < 4; j++) E = meanAnomaly + orb.e * Math.sin(E);
            const pos = getKeplerianPos(orb, E);
            targetBearingRad = Math.atan2(pos.y, pos.x);
          }
        } else if (selectedObjectType === 'asteroid' && selectedAsteroid) {
          const orb = selectedAsteroid.orbit;
          const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
          let E = meanAnomaly;
          for (let j = 0; j < 5; j++) E = meanAnomaly + orb.e * Math.sin(E);
          const pos = getKeplerianPos(orb, E);
          targetBearingRad = Math.atan2(pos.y, pos.x);
        }
      }

      // Bearing toward the Sun as seen from the camera's current focus. The
      // Helio camera now frames the selected object while letting the Sun
      // settle on the opposite side of the view (see HelioCanvas FOCUS_LERP),
      // so the Sun's bearing relative to the object is exactly the reverse
      // of the object's own bearing from the Sun. When nothing is selected
      // the camera stays Sun-centered, so no bearing marker is needed.
      const sunBearingRad = isHelio && targetBearingRad !== null ? targetBearingRad + Math.PI : null;

      // 3D Projection helper for plotted bodies and stars
      const project = (x: number, y: number, z: number, maxVal: number) => {
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;

        const cosZ = Math.cos(rotationZ);
        const sinZ = Math.sin(rotationZ);
        let x2 = x * cosZ - y1 * sinZ;
        let y2 = x * sinZ + y1 * cosZ;

        return {
          x: cx + x2 / maxVal * (compassRadius - 12),
          y: cy + y2 / maxVal * (compassRadius - 12),
          z: z1
        };
      };

      // 1. Draw a dark semi-transparent backing circle with a subtle glow
      ctx.beginPath();
      ctx.arc(cx, cy, compassRadius + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(7, 4, 3, 0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Draw tactical corner brackets around the compass box — Helio mode
      // uses a tighter margin so the brackets stay fully inside the smaller
      // container instead of clipping against its edges.
      const boxSize = compassRadius + (isHelio ? 7 : 12);
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.45)';
      ctx.lineWidth = 1.2;
      const bracketLen = 6 * adjustedScaleFactor;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(cx - boxSize, cy - boxSize + bracketLen);
      ctx.lineTo(cx - boxSize, cy - boxSize);
      ctx.lineTo(cx - boxSize + bracketLen, cy - boxSize);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(cx + boxSize, cy - boxSize + bracketLen);
      ctx.lineTo(cx + boxSize, cy - boxSize);
      ctx.lineTo(cx + boxSize - bracketLen, cy - boxSize);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(cx - boxSize, cy + boxSize - bracketLen);
      ctx.lineTo(cx - boxSize, cy + boxSize);
      ctx.lineTo(cx - boxSize + bracketLen, cy + boxSize);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(cx + boxSize, cy + boxSize - bracketLen);
      ctx.lineTo(cx + boxSize, cy + boxSize);
      ctx.lineTo(cx + boxSize - bracketLen, cy + boxSize);
      ctx.stroke();

      // Corner sub-labels for high-tech feel — Helio mode shows a single,
      // shorter "SUN REF" tag instead of the two-corner geocentric pair, so
      // it never runs past the tighter box edges.
      ctx.fillStyle = 'rgba(16, 243, 165, 0.5)';
      ctx.font = `6px 'Share Tech Mono', monospace`;
      if (isHelio) {
        ctx.textAlign = 'left';
        ctx.fillText('SUN REF', cx - boxSize + 3, cy - boxSize + 8);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText('SOLAR SYSTEM', cx - boxSize + 3, cy - boxSize + 8);
        ctx.textAlign = 'right';
        ctx.fillText('MOON ALIGNED', cx + boxSize - 3, cy - boxSize + 8);
      }

      // 3. Draw concentric rings for range reference
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.08)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 4]);
      for (let r = 0; r <= 0.75; r += 0.25) {
        if (r === 0) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, compassRadius * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 4. Draw outer HUD ring with fine ticks
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, compassRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 4b. Draw secondary thin outer ring with a dash pattern and center crosshair
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, compassRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center crosshair
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.2)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();

      // Draw ticks every 15 degrees
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const tickLen = a % (Math.PI / 2) === 0 ? 6 : 3;
        ctx.strokeStyle = a % (Math.PI / 2) === 0 ? 'rgba(250, 204, 21, 0.7)' : 'rgba(250, 204, 21, 0.3)';
        ctx.beginPath();
        ctx.moveTo(cx + cos * (compassRadius - tickLen), cy + sin * (compassRadius - tickLen));
        ctx.lineTo(cx + cos * compassRadius, cy + sin * compassRadius);
        ctx.stroke();
      }

      // 5. Draw 3D Horizon Line (Pitch Gyro) & Tilted Ecliptic Plane
      ctx.save();
      // Clip to the compass circle so the horizon line and orbits don't spill out
      ctx.beginPath();
      ctx.arc(cx, cy, compassRadius - 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw a dashed pitch grid
      const pitchOffset = Math.sin(rotationX) * compassRadius * 0.6;
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Horizon line (Celestial Equator)
      ctx.beginPath();
      ctx.moveTo(cx - compassRadius, cy + pitchOffset);
      ctx.lineTo(cx + compassRadius, cy + pitchOffset);
      ctx.stroke();

      // Pitch +30 / -30 lines
      ctx.strokeStyle = 'rgba(16, 243, 165, 0.1)';
      ctx.beginPath();
      ctx.moveTo(cx - compassRadius * 0.6, cy + pitchOffset - compassRadius * 0.3);
      ctx.lineTo(cx + compassRadius * 0.6, cy + pitchOffset - compassRadius * 0.3);
      ctx.moveTo(cx - compassRadius * 0.6, cy + pitchOffset + compassRadius * 0.3);
      ctx.lineTo(cx + compassRadius * 0.6, cy + pitchOffset + compassRadius * 0.3);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // 5b. Draw Tilted Ecliptic Plane Ring (23.4° tilt) — skipped in the
      // simplified Helio-mode gyro; the Helio main panel already shows the
      // full ecliptic/orbit geometry, so this overlay stays minimal.
      if (mode !== 'helio') {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.18)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        const eclipticTilt = 23.4 * (Math.PI / 180);
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
          const ex = 15 * Math.cos(a);
          const ey = 15 * Math.sin(a) * Math.cos(eclipticTilt);
          const ez = 15 * Math.sin(a) * Math.sin(eclipticTilt);
          const p = project(ex, ey, ez, 20);
          if (a === 0) {
            ctx.moveTo(p.x, p.y);
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw tiny label for Ecliptic Plane
        const ecLabelP = project(15 * Math.cos(0.5), 15 * Math.sin(0.5) * Math.cos(eclipticTilt), 15 * Math.sin(0.5) * Math.sin(eclipticTilt), 20);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.font = `5px 'Share Tech Mono', monospace`;
        ctx.fillText('ECLIPTIC PLANE', ecLabelP.x + 2, ecLabelP.y);

        // 5c. Draw Aligned Solar System Map — mini planet ring, redundant with
        // the Helio main panel so it's skipped there too.
        const getSolarOrbitPoint = (r: number, theta: number) => {
          const xp = r * Math.cos(theta);
          const yp = r * Math.sin(theta);
          const cosI = Math.cos(23.5 * (Math.PI / 180));
          const sinI = Math.sin(23.5 * (Math.PI / 180));
          const cosN = Math.cos(0.8);
          const sinN = Math.sin(0.8);
          const x = xp * cosN - yp * sinN * cosI;
          const y = xp * sinN + yp * cosN * cosI;
          const z = yp * sinI;
          return project(x, y, z, compassRadius);
        };

        // Draw Central Sun
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(cx, cy, 3 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();

        const planets = [
        { name: 'MERCURY', r: compassRadius * 0.22, color: '#9e9e9e', speed: 4.1 },
        { name: 'VENUS', r: compassRadius * 0.36, color: '#e3bb76', speed: 1.6 },
        { name: 'EARTH', r: compassRadius * 0.50, color: '#10f3a5', speed: 1.0 },
        { name: 'MARS', r: compassRadius * 0.64, color: '#ff5522', speed: 0.53 },
        { name: 'JUPITER', r: compassRadius * 0.78, color: '#d4a373', speed: 0.08 },
        { name: 'SATURN', r: compassRadius * 0.92, color: '#f4e285', speed: 0.03 }];


        planets.forEach((planet) => {
          // Draw orbit line
          ctx.strokeStyle = planet.color + '66'; // brighter, more saturated
          ctx.shadowColor = planet.color;
          ctx.shadowBlur = 3 * scaleFactor;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          let first = true;
          for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.1) {
            const p = getSolarOrbitPoint(planet.r, theta);
            if (first) {
              ctx.moveTo(p.x, p.y);
              first = false;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;

          // Draw planet body
          const angle = missionTime * 360 * planet.speed * (Math.PI / 180);
          const bodyP = getSolarOrbitPoint(planet.r, angle);

          // Draw a small dot with a soft glow
          ctx.fillStyle = planet.color;
          ctx.shadowColor = planet.color;
          ctx.shadowBlur = 4 * scaleFactor;
          ctx.beginPath();
          ctx.arc(bodyP.x, bodyP.y, 2 * scaleFactor, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Draw a tiny label for the planet
          ctx.fillStyle = planet.color + 'aa';
          ctx.font = `bold ${Math.max(4.5, Math.floor(5 * scaleFactor))}px 'Share Tech Mono', monospace`;
          ctx.fillText(planet.name, bodyP.x + 4, bodyP.y + 2);
        });
      }

      // 5d. Draw 3D Coordinate Axis Gizmo at the center
      const axisLen = compassRadius * 0.3;
      const pX = project(axisLen, 0, 0, compassRadius);
      const pY = project(0, axisLen, 0, compassRadius);
      const pZ = project(0, 0, axisLen, compassRadius);

      // X Axis (Red)
      ctx.strokeStyle = '#ff4500';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pX.x, pX.y);
      ctx.stroke();
      ctx.fillStyle = '#ff4500';
      ctx.font = "bold 7px 'Share Tech Mono', monospace";
      ctx.fillText('X', pX.x + (pX.x >= cx ? 3 : -7), pX.y + 2);

      // Y Axis (Green)
      ctx.strokeStyle = '#10f3a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pY.x, pY.y);
      ctx.stroke();
      ctx.fillStyle = '#10f3a5';
      ctx.fillText('Y', pY.x + (pY.x >= cx ? 3 : -7), pY.y + 2);

      // Z Axis (Blue)
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pZ.x, pZ.y);
      ctx.stroke();
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('Z', pZ.x + (pZ.x >= cx ? 3 : -7), pZ.y + 2);

      ctx.restore(); // restore clipping

      // 6. Draw Rotating Tactical Reference Points (N, E, S, W with degrees)
      const directions = [
      { label: 'N 0°', angle: -rotationZ - Math.PI / 2, color: '#10f3a5' },
      { label: 'E 90°', angle: -rotationZ, color: 'rgba(255, 255, 255, 0.85)' },
      { label: 'S 180°', angle: -rotationZ + Math.PI / 2, color: 'rgba(255, 255, 255, 0.85)' },
      { label: 'W 270°', angle: -rotationZ + Math.PI, color: 'rgba(255, 255, 255, 0.85)' }];


      ctx.font = `bold ${Math.max(7.0, Math.floor(8.0 * adjustedScaleFactor))}px 'Oswald', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      directions.forEach((dir) => {
        const x = cx + Math.cos(dir.angle) * (compassRadius * 0.82);
        const y = cy + Math.sin(dir.angle) * (compassRadius * 0.82);
        ctx.fillStyle = dir.color;
        ctx.fillText(dir.label, x, y);
      });

      // Intermediate Reference Points (NE, SE, SW, NW with degrees) — dropped
      // in the simplified Helio-mode gyro to keep the readout uncluttered.
      if (mode !== 'helio') {
        const intermediateDirections = [
        { label: 'NE 45°', angle: -rotationZ - Math.PI / 4, color: 'rgba(255, 255, 255, 0.5)' },
        { label: 'SE 135°', angle: -rotationZ + Math.PI / 4, color: 'rgba(255, 255, 255, 0.5)' },
        { label: 'SW 225°', angle: -rotationZ + 3 * Math.PI / 4, color: 'rgba(255, 255, 255, 0.5)' },
        { label: 'NW 315°', angle: -rotationZ - 3 * Math.PI / 4, color: 'rgba(255, 255, 255, 0.5)' }];


        ctx.font = `${Math.max(5.5, Math.floor(6.0 * adjustedScaleFactor))}px 'Oswald', sans-serif`;
        intermediateDirections.forEach((dir) => {
          const x = cx + Math.cos(dir.angle) * (compassRadius * 0.82);
          const y = cy + Math.sin(dir.angle) * (compassRadius * 0.82);
          ctx.fillStyle = dir.color;
          ctx.fillText(dir.label, x, y);
        });
      }

      // 6b. Draw a bearing marker toward the currently selected object, using
      // the exact same screen-angle convention as the N/E/S/W labels above —
      // this lets the pilot orient the camera toward the target even while
      // it sits off-screen, since the Sun (not the target) is the fixed
      // rotation/translation reference.
      if (isHelio && targetBearingRad !== null) {
        const bearingAngle = -rotationZ + targetBearingRad;
        const bx = cx + Math.cos(bearingAngle) * (compassRadius * 0.94);
        const by = cy + Math.sin(bearingAngle) * (compassRadius * 0.94);

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(bearingAngle + Math.PI / 2);
        ctx.fillStyle = '#ff5500';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 4 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(0, -5 * scaleFactor);
        ctx.lineTo(3.2 * scaleFactor, 4 * scaleFactor);
        ctx.lineTo(-3.2 * scaleFactor, 4 * scaleFactor);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#ff5500';
        ctx.font = `bold ${Math.max(6, Math.floor(6.5 * adjustedScaleFactor))}px 'Share Tech Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lx = cx + Math.cos(bearingAngle) * (compassRadius * 0.94 + 9 * scaleFactor);
        const ly = cy + Math.sin(bearingAngle) * (compassRadius * 0.94 + 9 * scaleFactor);
        ctx.fillText('TGT', lx, ly);
        ctx.restore();
      }

      // 6c. Draw a bearing marker toward the Sun (fixed rotation/translation
      // reference for this map), styled distinctly from the orange TGT
      // marker: a small glowing golden sun glyph with radiating spokes,
      // matching the Sun's own rendered color in the Helio map.
      if (isHelio && sunBearingRad !== null) {
        const sunAngle = -rotationZ + sunBearingRad;
        const sx = cx + Math.cos(sunAngle) * (compassRadius * 0.94);
        const sy = cy + Math.sin(sunAngle) * (compassRadius * 0.94);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 5 * scaleFactor;
        // Sun disc
        ctx.beginPath();
        ctx.arc(0, 0, 2.4 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
        // Radiating spokes
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 3.2 * scaleFactor, Math.sin(a) * 3.2 * scaleFactor);
          ctx.lineTo(Math.cos(a) * 5 * scaleFactor, Math.sin(a) * 5 * scaleFactor);
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 3 * scaleFactor;
        ctx.font = `bold ${Math.max(6, Math.floor(6.5 * adjustedScaleFactor))}px 'Share Tech Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const slx = cx + Math.cos(sunAngle) * (compassRadius * 0.94 + 9 * scaleFactor);
        const sly = cy + Math.sin(sunAngle) * (compassRadius * 0.94 + 9 * scaleFactor);
        ctx.fillText('SUN', slx, sly);
        ctx.restore();
      }

      // 7. Draw active radar sweep line for dynamic feel
      const sweepAngle = Date.now() * 0.001 % (Math.PI * 2);
      const sweepGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, compassRadius);
      sweepGlow.addColorStop(0, 'rgba(16, 243, 165, 0)');
      sweepGlow.addColorStop(1, 'rgba(16, 243, 165, 0.05)');
      ctx.fillStyle = sweepGlow;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, compassRadius, sweepAngle - 0.25, sweepAngle);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(16, 243, 165, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + compassRadius * Math.cos(sweepAngle), cy + compassRadius * Math.sin(sweepAngle));
      ctx.stroke();

      // 11. Draw Map/Compass Title & Attitude Metadata
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.max(8, Math.floor(9 * adjustedScaleFactor))}px 'Share Tech Mono', monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(mode === 'helio' ? 'ATTITUDE GYRO' : '3D SOLAR SYSTEM GYRO', cx - compassRadius - 5, cy + compassRadius + 14);

      // Convert rotationZ to degrees
      let rotZDeg = Math.round((rotationZ * (180 / Math.PI) % 360 + 360) % 360);
      const decDeg = Math.round(rotationX * (180 / Math.PI));

      ctx.fillStyle = '#10f3a5';
      ctx.font = `${Math.max(7, Math.floor(7.5 * adjustedScaleFactor))}px 'Share Tech Mono', monospace`;
      ctx.fillText(
        mode === 'helio' ? `DEC: ${decDeg}°  ROT: ${rotZDeg}°` : `DEC: ${decDeg}°  ROT: ${rotZDeg}°  SYS: HELIO.ALIGN  PROJ: LUNAR.PLANE`,
        cx - compassRadius - 5,
        cy + compassRadius + 24
      );

      ctx.restore();
    };

    render();

    // Smooth rendering loop
    let frameId: number;
    const loop = () => {
      render();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, [rotationX, rotationZ, mode, selectedAsteroid, asteroids, missionTime, selectedObjectType, selectedSolarObjectId]);

  return (
    <div
      data-fuser-slot-id="gyro-compass-container"
      className={
      mode === 'helio' ?
      'absolute bottom-6 left-6 z-20 w-[15vw] h-[15vw] max-w-[170px] max-h-[170px] min-w-[135px] min-h-[135px] bg-transparent pointer-events-none transition-all duration-300' :
      'absolute bottom-6 left-6 z-20 w-[25vw] h-[25vw] max-w-[300px] max-h-[300px] min-w-[250px] min-h-[250px] bg-transparent pointer-events-none transition-all duration-300'
      }>

      
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>);

}
