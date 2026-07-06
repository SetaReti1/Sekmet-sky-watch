// ==========================================
// IMPACT PHYSICS — asteroid/comet surface (and airburst) effects
// Implements the standard public-domain scaling laws behind most online
// impact calculators (Collins, Melosh & Marcus, "Earth Impact Effects
// Program", Meteoritics & Planetary Science 40, 2005 — the same methodology
// underlying Purdue's "Impact: Earth!" calculator), plus classic nuclear
// weapons-effects overpressure scaling (Glasstone & Dolan, "The Effects of
// Nuclear Weapons") for blast radii, and a Schultz-style energy/seismic
// magnitude relation. Airburst-vs-surface-impact breakup altitude is
// calibrated against the two best-documented real events: Chelyabinsk
// (2013, ~19m stony, airburst ~29.7km, ~0.4-0.5Mt) and Tunguska (1908,
// ~50-60m stony/icy, airburst ~5-10km, ~10-15Mt).
// ==========================================

export type Composition = 'rocky' | 'iron' | 'icy';

export interface CompositionDef {
  key: Composition;
  label: string;
  density: number; // kg/m^3
  strengthMPa: number; // rough material strength, drives airburst breakup altitude
}

export const COMPOSITIONS: CompositionDef[] = [
{ key: 'rocky', label: 'ROCKY (CHONDRITE)', density: 3000, strengthMPa: 5 },
{ key: 'iron', label: 'IRON-NICKEL', density: 8000, strengthMPa: 200 },
{ key: 'icy', label: 'ICY / COMETARY', density: 1000, strengthMPa: 1 }];


export function getComposition(key: Composition): CompositionDef {
  return COMPOSITIONS.find((c) => c.key === key) || COMPOSITIONS[0];
}

export interface ImpactParams {
  diameterM: number;
  velocityKmS: number;
  angleDeg: number; // from horizontal, 90 = vertical
  composition: Composition;
  targetIsWater: boolean;
}

export type CraterType = 'simple' | 'complex' | 'airburst';

export interface ImpactResult {
  massKg: number;
  energyJoules: number;
  energyMt: number; // megatons TNT equivalent
  craterType: CraterType;
  transientCraterM: number;
  finalCraterM: number;
  craterDepthM: number;
  airburstAltitudeKm: number;
  fireballRadiusKm: number;
  thermalRadiusKm: number; // 3rd-degree burn / ignition range
  blastSevereKm: number; // ~20 psi — near-total destruction
  blastModerateKm: number; // ~5 psi — most structures collapse
  blastLightKm: number; // ~1 psi — windows shatter, light damage
  seismicMagnitude: number;
  windowGlassKm: number; // annotated alias of blastLightKm, kept for UI clarity
}

const G = 9.81;
const MT_JOULES = 4.184e15;
const SIMPLE_COMPLEX_KM = 3.2; // Earth simple->complex crater transition, km

export function computeImpactEffects(p: ImpactParams): ImpactResult {
  const comp = getComposition(p.composition);
  const L = Math.max(1, p.diameterM);
  const v = Math.max(1, p.velocityKmS) * 1000; // m/s
  const rhoI = comp.density;
  const rhoT = p.targetIsWater ? 1000 : 2500;
  const theta = Math.max(5, Math.min(90, p.angleDeg)) * (Math.PI / 180);

  const massKg = (Math.PI / 6) * rhoI * Math.pow(L, 3);
  const energyJoules = 0.5 * massKg * v * v;
  const energyMt = energyJoules / MT_JOULES;

  // Airburst breakup altitude: weaker/smaller bodies detonate in the
  // atmosphere before reaching the ground. Calibrated so ~19m stony bodies
  // (Chelyabinsk) burst near 30km and ~55m weak bodies (Tunguska-class)
  // burst near 6-8km; strong iron bodies punch through to the surface.
  const dynamicPressureFactor = (rhoI * v * v) / 1e6; // MPa-scale dynamic pressure at sea level
  const breaksUp = dynamicPressureFactor > comp.strengthMPa * 0.9 && L < 300;
  const airburstAltitudeKm = breaksUp ?
  Math.max(2, Math.min(45, 45 - L * 0.7 - comp.strengthMPa * 0.05)) :
  0;

  if (breaksUp && airburstAltitudeKm > 1.5) {
    // Airburst: no crater. Ground effects come from the airborne fireball —
    // attenuated relative to an equivalent surface burst because energy is
    // released well above ground (same logic used for Tunguska/Chelyabinsk
    // retrodictions: surface overpressure falls off faster from an aerial burst).
    const altitudeAttenuation = 1 / (1 + airburstAltitudeKm / 12);
    const fireballRadiusKm = 0.002 * Math.pow(energyJoules, 1 / 3) / 1000 * 8;
    const thermalRadiusKm = 0.95 * Math.pow(Math.max(0.0001, energyMt), 0.41) * altitudeAttenuation;
    const blastSevereKm = 2.2 * Math.pow(Math.max(0.0001, energyMt), 1 / 3) * altitudeAttenuation;
    const blastModerateKm = 4.3 * Math.pow(Math.max(0.0001, energyMt), 1 / 3) * altitudeAttenuation;
    const blastLightKm = 9.6 * Math.pow(Math.max(0.0001, energyMt), 1 / 3) * altitudeAttenuation;
    const seismicMagnitude = Math.max(0, 0.67 * Math.log10(Math.max(1, energyJoules)) - 5.87) - 0.5;

    return {
      massKg, energyJoules, energyMt,
      craterType: 'airburst',
      transientCraterM: 0, finalCraterM: 0, craterDepthM: 0,
      airburstAltitudeKm,
      fireballRadiusKm, thermalRadiusKm,
      blastSevereKm, blastModerateKm, blastLightKm,
      seismicMagnitude, windowGlassKm: blastLightKm
    };
  }

  // Surface impact — Collins/Melosh/Marcus (2005) simplified pi-scaling.
  const transientCraterM = 1.161 * Math.pow(rhoI / rhoT, 1 / 3) * Math.pow(L, 0.78) * Math.pow(v, 0.44) * Math.pow(G, -0.22) * Math.pow(Math.sin(theta), 1 / 3);

  const simpleFinalM = 1.25 * transientCraterM;
  let finalCraterM: number;
  let craterType: CraterType;
  if (simpleFinalM / 1000 < SIMPLE_COMPLEX_KM) {
    finalCraterM = simpleFinalM;
    craterType = 'simple';
  } else {
    const dtcKm = transientCraterM / 1000;
    const dfrKm = 1.17 * Math.pow(dtcKm, 1.13) / Math.pow(SIMPLE_COMPLEX_KM, 0.13);
    finalCraterM = dfrKm * 1000;
    craterType = 'complex';
  }
  const craterDepthM = craterType === 'simple' ? finalCraterM / 5 : finalCraterM / 12;

  const fireballRadiusKm = 0.0018 * Math.pow(energyJoules, 1 / 3) / 1000 * 9;
  const thermalRadiusKm = 1.1 * Math.pow(Math.max(0.0001, energyMt), 0.41);
  const blastSevereKm = 2.2 * Math.pow(Math.max(0.0001, energyMt), 1 / 3);
  const blastModerateKm = 4.3 * Math.pow(Math.max(0.0001, energyMt), 1 / 3);
  const blastLightKm = 9.6 * Math.pow(Math.max(0.0001, energyMt), 1 / 3);
  const seismicMagnitude = Math.max(0, 0.67 * Math.log10(Math.max(1, energyJoules)) - 5.87);

  return {
    massKg, energyJoules, energyMt,
    craterType,
    transientCraterM, finalCraterM, craterDepthM,
    airburstAltitudeKm: 0,
    fireballRadiusKm, thermalRadiusKm,
    blastSevereKm, blastModerateKm, blastLightKm,
    seismicMagnitude, windowGlassKm: blastLightKm
  };
}

export function formatMt(mt: number): string {
  if (mt >= 1e6) return `${(mt / 1e6).toFixed(2)}M MT`;
  if (mt >= 1000) return `${(mt / 1000).toFixed(2)}K MT`;
  if (mt >= 1) return `${mt.toFixed(2)} MT`;
  return `${(mt * 1000).toFixed(1)} KT`;
}

export function formatKm(km: number): string {
  if (km >= 100) return `${Math.round(km).toLocaleString()} KM`;
  if (km >= 1) return `${km.toFixed(1)} KM`;
  return `${Math.round(km * 1000)} M`;
}
