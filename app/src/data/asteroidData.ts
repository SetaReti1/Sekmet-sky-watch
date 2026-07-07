import type { Asteroid, CadObject } from './types';

// ==========================================
// NEAR-EARTH OBJECT DATA — procedural generator + real NASA CAD feed mapper
// ==========================================

// Verified real-world diameters (meters) for named/catalogued NEAs and notable
// large asteroids, cross-referenced against JPL SBDB / NASA CNEOS published sizes.
// Anything not in this map falls back to a procedurally generated small/medium
// filler diameter so the four hazard bands (small/medium/large/major) are all
// populated by real, correctly-categorized objects instead of pure noise.
const REAL_ASTEROID_SIZES: Record<string, number> = {
  '99942 Apophis': 340,
  '101955 Bennu': 490,
  'Toutatis': 4500,
  'Eros': 16840,
  'Geographos': 2500,
  'Icarus': 1400,
  'Mithra': 2400,
  'Hermes': 630,
  'Adonis': 600,
  'Duende': 40,
  'Florence': 4900,
  'Phaethon': 5800,
  '1036 Ganymed': 35000,
  '3552 Don Quixote': 18400,
  '1866 Sisyphus': 8500,
  '1627 Ivar': 8000,
  '887 Alinda': 4200,
  '719 Albert': 2400,
  '4769 Castalia': 1400,
  '162173 Ryugu': 900,
  '25143 Itokawa': 330,
  '2062 Aten': 900,
  '6489 Golevka': 530,
  '2005 YU55': 300,
  '2007 TU24': 250,
  '1998 KY26': 30,
  '2011 AG5': 135,
  '2020 QG': 3,
  '2021 UA1': 2,
  '2011 CQ1': 1,
  '2015 TC25': 6
};

// Generate 107 Asteroids
export const generateAsteroids = (): Asteroid[] => {
  const names = [
  '2026 LX', '99942 Apophis', '101955 Bennu', '2026 JN25', 'Toutatis', 'Eros', 'Geographos',
  'Icarus', 'Mithra', 'Hermes', 'Adonis', 'Duende', 'Florence', 'Phaethon', '2026 AD3',
  '2026 CA1', '2026 ER9', '2026 FT2', '2026 GP5', '2026 HQ8', '2026 JS1', '2026 KT4',
  '2026 LU7', '2026 MV3', '2026 NW2', '2026 OX6', '2026 PY1', '2026 QZ9', '2026 RS4',
  '2026 TK2', '2026 UV5', '2026 WD1', '2026 XY3', '2026 YZ7', '2026 AA4', '2026 BB9',
  '2026 CC2', '2026 DD1', '2026 EE5', '2026 FF8', '2026 GG3', '2026 HH7', '2026 II1',
  '2026 JJ4', '2026 KK2', '2026 LL9', '2026 MM5', '2026 NN1', '2026 OO3', '2026 PP8',
  '2026 QQ4', '2026 RR7', '2026 SS1', '2026 TT3', '2026 UU9', '2026 VV2', '2026 WW5',
  '2026 XX1', '2026 YY8', '2026 AB3', '2026 BC7', '2026 CD4', '2026 DE2', '2026 EF9',
  '2026 FG1', '2026 GH5', '2026 HJ8', '2026 IK3', '2026 JK2', '2026 KL7', '2026 LM1',
  '2026 MN4', '2026 NO9', '2026 OP3', '2026 PQ5', '2026 QR1', '2026 RS8', '2026 ST4',
  '2026 TU2', '2026 UV9', '2026 VW3', '2026 WX1', '2026 XY8', '2026 YZ4', '2026 ZA3',
  '1036 Ganymed', '3552 Don Quixote', '1866 Sisyphus', '1627 Ivar', '887 Alinda', '719 Albert', '4769 Castalia',
  '162173 Ryugu', '25143 Itokawa', '2062 Aten', '6489 Golevka', '2005 YU55', '2007 TU24', '1998 KY26',
  '2011 AG5', '2020 QG', '2021 UA1', '2011 CQ1', '2015 TC25', '2026 EF1', '2026 GH9',
  '2026 VW8'];


  return Array.from({ length: 107 }, (_, i) => {
    const des = names[i] || `2026 OB${i}`;
    const ld = parseFloat((Math.random() * 19.8 + 0.2).toFixed(1));
    const km = Math.round(ld * 384400);
    const kms = parseFloat((Math.random() * 28 + 4).toFixed(1));
    const realDiameter = REAL_ASTEROID_SIZES[des];
    const size = realDiameter != null ? `${realDiameter}m` : `${Math.floor(Math.random() * 120 + 8)}m`;
    const sentry = realDiameter != null ? realDiameter > 130 && realDiameter < 5000 : Math.random() < 0.15; // Sentry watch skews toward mid/large PHAs

    // Generate random date in 2026
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const randomMonth = months[Math.floor(Math.random() * months.length)];
    const randomDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const date = `2026-${randomMonth}-${randomDay}`;

    // Procedural Keplerian orbital elements
    const a = Math.random() * 1.5 + 0.8; // Semi-major axis (AU)
    const e = Math.random() * 0.5 + 0.05; // Eccentricity
    const iAngle = Math.random() * 20 + 2; // Inclination (degrees)
    const omega = Math.random() * 360; // Arg of perihelion
    const w = Math.random() * 360; // Long of ascending node
    const period = Math.pow(a, 1.5) * 365.25; // Kepler's 3rd Law
    const phase = Math.random() * 360;

    return {
      id: i,
      des,
      date,
      ld,
      km,
      kms,
      size,
      sentry,
      orbit: { a, e, i: iAngle, omega, w, period, phase }
    };
  });
};

// Deterministic string hash -> [0,1) pseudo-random, used to derive stable
// procedural orbital elements for real NASA CAD objects (the API returns
// close-approach kinematics, not full Keplerian elements).
const hash01 = (s: string, salt: number): number => {
  let h = salt >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
    h ^= h >>> 13;
  }
  return (h >>> 0) % 100000 / 100000;
};

// Map real NASA/JPL SBDB Close-Approach Data API rows onto the app's Asteroid
// shape. Kinematics (date, distance, velocity, magnitude-derived size) are
// real; orbital elements used for the 3D helio plot are procedurally derived
// but deterministic per object, since CAD only reports close-approach state.
export const mapCadToAsteroids = (rows: CadObject[]): Asteroid[] => {
  return rows.map((r, i) => {
    // "2026-Jan-01 01:43" -> "2026-JAN-01"
    const cdMatch = r.cd.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})/);
    const date = cdMatch ? `${cdMatch[1]}-${cdMatch[2].toUpperCase()}-${cdMatch[3]}` : r.cd;
    const diameterM = r.diameterM ?? Math.round(hash01(r.des, 7) * 120 + 8);
    const size = `${diameterM}m`;
    const sentry = diameterM > 130 && diameterM < 5000 && r.ld < 10;

    const a = hash01(r.des, 11) * 1.5 + 0.8;
    const e = hash01(r.des, 22) * 0.5 + 0.05;
    const iAngle = hash01(r.des, 33) * 20 + 2;
    const omega = hash01(r.des, 44) * 360;
    const w = hash01(r.des, 55) * 360;
    const period = Math.pow(a, 1.5) * 365.25;
    const phase = hash01(r.des, 66) * 360;

    return {
      id: i,
      des: r.fullname || r.des,
      date,
      ld: r.ld,
      km: r.km,
      kms: r.kms,
      size,
      sentry,
      orbit: { a, e, i: iAngle, omega, w, period, phase }
    };
  });
};
