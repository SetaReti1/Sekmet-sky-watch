import type { SolarSystemObject } from '../data/types';

// ==========================================
// SHARED CANVAS VECTOR-GRAPHICS HELPERS
// Small drawing primitives reused by the Geocentric, Helio, and Gyro Compass panels.
// ==========================================
export const drawArrowhead = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 1.8);
  ctx.lineTo(-size * 0.7, 0);
  ctx.lineTo(-size, size / 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const drawDiamond = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, fill = true) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};

// NEO size-class marker glyphs — one distinct shape per hazard band so the object
// viewer reads size at a glance without relying on color alone: small = dot,
// medium = diamond, large = square, major = glowing 4-point hazard star.
export const drawSizeMarker = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, catKey: string) => {
  ctx.save();
  ctx.fillStyle = color;
  switch (catKey) {
    case 'small':
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.9, size * 0.62), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'medium':
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size, cy);
      ctx.lineTo(cx, cy + size);
      ctx.lineTo(cx - size, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case 'large':
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-size * 0.75, -size * 0.75, size * 1.5, size * 1.5);
      ctx.restore();
      break;
    case 'major':
    default:{
        ctx.shadowColor = color;
        ctx.shadowBlur = size * 2.2;
        const spikes = 4;
        const outerR = size * 1.7;
        const innerR = size * 0.6;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = Math.PI / spikes * i - Math.PI / 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
  }
  ctx.restore();
};

export const drawSelectedRhombus = (
ctx: CanvasRenderingContext2D,
cx: number,
cy: number,
size: number,
color: string,
trajectoryAngle: number,
scaleFactor: number) =>
{
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(trajectoryAngle);

  // A rhombus (diamond) shape aligned with the trajectory
  const w = size * 1.5;
  const h = size * 0.8;

  ctx.beginPath();
  ctx.moveTo(w, 0); // front tip
  ctx.lineTo(0, -h); // top tip
  ctx.lineTo(-w, 0); // back tip
  ctx.lineTo(0, h); // bottom tip
  ctx.closePath();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = color + '33'; // semi-transparent
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, 1.5 * scaleFactor), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
};

// Draws a small triangular asteroid-belt marker, tumbling slightly as it orbits
export const drawBeltTriangle = (
ctx: CanvasRenderingContext2D,
cx: number,
cy: number,
size: number,
angle: number,
color: string,
glow: boolean) =>
{
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2.2;
  }
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.86, size * 0.6);
  ctx.lineTo(-size * 0.86, size * 0.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

export const draw3DPolyhedron = (
ctx: CanvasRenderingContext2D,
x: number,
y: number,
z: number,
size: number,
color: string,
spinAngle: number,
type: 'planet' | 'planetoid' | 'sun',
project: (x: number, y: number, z: number) => {x: number;y: number;z: number;}) =>
{
  if (type === 'planet' || type === 'planetoid' || type === 'sun') {
    const latRings = type === 'sun' ? 6 : type === 'planet' ? 5 : 3;
    const lonRings = type === 'sun' ? 8 : type === 'planet' ? 6 : 4;

    const cosS = Math.cos(spinAngle);
    const sinS = Math.sin(spinAngle);

    const rotateLocal = (lx: number, ly: number, lz: number) => {
      let rx = lx * cosS - ly * sinS;
      let ry = lx * sinS + ly * cosS;
      let rz = lz;

      let rx2 = rx * cosS - rz * sinS;
      let rz2 = rx * sinS + rz * cosS;

      return {
        x: x + rx2 * size,
        y: y + ry * size,
        z: z + rz2 * size
      };
    };

    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth = 1;

    for (let i = 1; i <= latRings; i++) {
      const phi = -Math.PI / 2 + i * Math.PI / (latRings + 1);
      const rLat = Math.cos(phi);
      const zLat = Math.sin(phi);

      ctx.beginPath();
      const steps = 16;
      for (let s = 0; s <= steps; s++) {
        const theta = s / steps * Math.PI * 2;
        const lx = rLat * Math.cos(theta);
        const ly = rLat * Math.sin(theta);
        const lz = zLat;

        const rot = rotateLocal(lx, ly, lz);
        const p = project(rot.x, rot.y, rot.z);
        if (s === 0) ctx.moveTo(p.x, p.y);else
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    for (let i = 0; i < lonRings; i++) {
      const theta0 = i * Math.PI / lonRings;

      ctx.beginPath();
      const steps = 16;
      for (let s = 0; s <= steps; s++) {
        const phi = s / steps * Math.PI * 2;
        const lx = Math.cos(phi) * Math.cos(theta0);
        const ly = Math.cos(phi) * Math.sin(theta0);
        const lz = Math.sin(phi);

        const rot = rotateLocal(lx, ly, lz);
        const p = project(rot.x, rot.y, rot.z);
        if (s === 0) ctx.moveTo(p.x, p.y);else
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    return;
  }

  let rawVertices: {x: number;y: number;z: number;}[] = [];
  let faces: number[][] = [];

  if (type === 'sun') {
    rawVertices = [
    { x: 0, y: 0, z: 1.5 }, { x: 0, y: 0, z: -1.5 },
    { x: 1.5, y: 0, z: 0 }, { x: -1.5, y: 0, z: 0 },
    { x: 0, y: 1.5, z: 0 }, { x: 0, y: -1.5, z: 0 },
    { x: 0.7, y: 0.7, z: 0.7 }, { x: -0.7, y: 0.7, z: 0.7 }, { x: -0.7, y: -0.7, z: 0.7 }, { x: 0.7, y: -0.7, z: 0.7 },
    { x: 0.7, y: 0.7, z: -0.7 }, { x: -0.7, y: 0.7, z: -0.7 }, { x: -0.7, y: -0.7, z: -0.7 }, { x: 0.7, y: -0.7, z: -0.7 }];

    faces = [
    [0, 6, 7], [0, 7, 8], [0, 8, 9], [0, 9, 6],
    [1, 10, 11], [1, 11, 12], [1, 12, 13], [1, 13, 10],
    [2, 6, 9], [2, 9, 13], [2, 13, 10], [2, 10, 6],
    [3, 7, 8], [3, 8, 12], [3, 12, 11], [3, 11, 7],
    [4, 6, 7], [4, 7, 11], [4, 11, 10], [4, 10, 6],
    [5, 8, 9], [5, 9, 13], [5, 13, 12], [5, 12, 8]];
  }

  const cosS = Math.cos(spinAngle);
  const sinS = Math.sin(spinAngle);

  const rotatedVertices = rawVertices.map((v) => {
    let rx = v.x * cosS - v.y * sinS;
    let ry = v.x * sinS + v.y * cosS;
    let rz = v.z;

    let ry2 = ry * cosS - rz * sinS;
    let rz2 = ry * sinS + rz * cosS;

    return {
      x: x + rx * size,
      y: y + ry2 * size,
      z: z + rz2 * size
    };
  });

  const projVertices = rotatedVertices.map((v) => project(v.x, v.y, v.z));

  faces.forEach((face) => {
    const p1 = projVertices[face[0]];
    const p2 = projVertices[face[1]];
    const p3 = projVertices[face[2]];

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();

    ctx.fillStyle = color + '22';
    ctx.fill();
    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
};

export const drawSelectedHUD = (
ctx: CanvasRenderingContext2D,
p: {x: number;y: number;},
pos: {x: number;y: number;z: number;},
name: string,
rSun: number,
kms: number,
size: string,
scaleFactor: number,
canvasWidth: number,
canvasHeight: number) =>
{
  ctx.strokeStyle = '#ff5522';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8 * scaleFactor, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p.x, p.y, 14 * scaleFactor, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255, 85, 34, 0.6)';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 18 * scaleFactor);
  ctx.lineTo(p.x, p.y - 10 * scaleFactor);
  ctx.moveTo(p.x, p.y + 10 * scaleFactor);
  ctx.lineTo(p.x, p.y + 18 * scaleFactor);
  ctx.moveTo(p.x - 18 * scaleFactor, p.y);
  ctx.lineTo(p.x - 10 * scaleFactor, p.y);
  ctx.moveTo(p.x + 10 * scaleFactor, p.y);
  ctx.lineTo(p.x + 18 * scaleFactor, p.y);
  ctx.stroke();

  const isRightSide = p.x > canvasWidth / 2;
  const isTopSide = p.y < canvasHeight / 2;

  const hudX = isRightSide ? p.x - 120 * scaleFactor : p.x + 40 * scaleFactor;
  const hudY = isTopSide ? p.y + 40 * scaleFactor : p.y - 40 * scaleFactor;

  ctx.strokeStyle = '#ff5522';
  ctx.beginPath();
  ctx.moveTo(p.x + (isRightSide ? -10 : 10) * scaleFactor, p.y + (isTopSide ? 10 : -10) * scaleFactor);
  ctx.lineTo(hudX, hudY);
  ctx.lineTo(hudX + (isRightSide ? -80 : 80) * scaleFactor, hudY);
  ctx.stroke();

  const textX = isRightSide ? hudX - 76 * scaleFactor : hudX + 4 * scaleFactor;
  ctx.fillStyle = '#ff5522';
  ctx.font = `bold ${Math.max(9, Math.round(10 * scaleFactor))}px monospace`;
  ctx.fillText(name.toUpperCase(), textX, hudY - 16 * scaleFactor);

  ctx.fillStyle = 'rgba(255, 85, 34, 0.85)';
  ctx.font = `${Math.max(8, Math.round(8 * scaleFactor))}px monospace`;

  ctx.fillText(`R_SUN: ${rSun.toFixed(3)} AU`, textX, hudY - 6 * scaleFactor);
  if (kms > 0) {
    ctx.fillText(`V_REL: ${kms.toFixed(1)} KM/S`, textX, hudY + 4 * scaleFactor);
  } else {
    ctx.fillText(`TYPE: PLANETARY`, textX, hudY + 4 * scaleFactor);
  }
  ctx.fillText(`SIZE: ${size}`, textX, hudY + 14 * scaleFactor);
};

export const getKeplerianPos = (orb: {a: number;e: number;i: number;omega: number;w: number;period: number;phase: number;}, E: number) => {
  // Position in orbital plane
  const x_orb = orb.a * (Math.cos(E) - orb.e);
  const y_orb = orb.a * Math.sqrt(1 - orb.e * orb.e) * Math.sin(E);
  const z_orb = 0;

  // Standard Keplerian orbital rotation:
  // 1. Rotate by argument of perihelion (omega) around Z axis
  const cosOmega = Math.cos(orb.omega * Math.PI / 180);
  const sinOmega = Math.sin(orb.omega * Math.PI / 180);
  const x1 = x_orb * cosOmega - y_orb * sinOmega;
  const y1 = x_orb * sinOmega + y_orb * cosOmega;
  const z1 = z_orb;

  // 2. Rotate by inclination (i) around X axis
  const cosI = Math.cos(orb.i * Math.PI / 180);
  const sinI = Math.sin(orb.i * Math.PI / 180);
  const x2 = x1;
  const y2 = y1 * cosI - z1 * sinI;
  const z2 = y1 * sinI + z1 * cosI;

  // 3. Rotate by longitude of ascending node (w) around Z axis
  const cosW = Math.cos(orb.w * Math.PI / 180);
  const sinW = Math.sin(orb.w * Math.PI / 180);
  const x3 = x2 * cosW - y2 * sinW;
  const y3 = x2 * sinW + y2 * cosW;
  const z3 = z2;

  return { x: x3, y: y3, z: z3 };
};
