// ==========================================
// SHARED DOMAIN TYPES
// Used across the Geocentric, Helio, Impact Risk Globe, and NEO Size Class panels.
// ==========================================
export interface Asteroid {
  id: number;
  des: string;
  date: string;
  ld: number;
  km: number;
  kms: number;
  size: string;
  sentry: boolean;
  orbit: {
    a: number; // semi-major axis
    e: number; // eccentricity
    i: number; // inclination
    omega: number; // argument of perihelion
    w: number; // longitude of ascending node
    period: number; // orbital period in days
    phase: number; // initial phase angle
  };
}

export interface Satellite {
  id: number;
  category: 'starlink' | 'oneweb' | 'weather' | 'gps' | 'geobelt' | 'other';
  radius: number;
  angle: number;
  speed: number;
  inclination: number;
  node: number;
}

export interface CadObject {
  des: string;
  fullname: string;
  cd: string;
  ld: number;
  km: number;
  kms: number;
  h: number;
  diameterM: number | null;
}

export interface SolarSystemObject {
  id: string;
  name: string;
  type: 'planet' | 'planetoid';
  color: string;
  size: string;
  orbit: {
    a: number;
    e: number;
    i: number;
    omega: number;
    w: number;
    period: number;
    phase: number;
  };
  details: {
    mass: string;
    temp: string;
    moons: number;
    gravity: string;
  };
}

export interface BeltRock {
  a: number;
  e: number;
  i: number;
  omega: number;
  w: number;
  period: number;
  phase: number;
  size: number;
  spin: number;
  hue: number;
}
