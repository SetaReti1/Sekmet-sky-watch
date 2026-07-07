import type { SolarSystemObject, BeltRock } from './types';

// ==========================================
// SOLAR-BODY CATEGORIES (Helio Map size-class legend)
// Sits alongside NEO_SIZE_CATEGORIES (SizeMapCanvas) so the Helio panel's
// legend/data-feed can isolate planets and planetoids the same way it
// isolates small/medium/large/major NEOs.
// ==========================================
export const SOLAR_BODY_CATEGORIES = [
{ key: 'planet', label: 'PLANET', range: '8 BODIES', color: '#a0c4ff' },
{ key: 'planetoid', label: 'PLANETOID', range: '12 BODIES', color: '#cdb4db' }] as
const;

// ==========================================
// SOLAR SYSTEM BODIES + MAIN ASTEROID BELT (Helio Map panel)
// ==========================================
export const SOLAR_SYSTEM_OBJECTS: SolarSystemObject[] = [
{
  id: 'p_mercury',
  name: 'Mercury',
  type: 'planet',
  color: '#9e9e9e',
  size: '4,879 km',
  orbit: { a: 0.3871, e: 0.2056, i: 7.005, omega: 29.124, w: 48.331, period: 87.969, phase: 120 },
  details: { mass: '3.301e23 kg', temp: '-173 to 427°C', moons: 0, gravity: '3.7 m/s²' }
},
{
  id: 'p_venus',
  name: 'Venus',
  type: 'planet',
  color: '#e3bb76',
  size: '12,104 km',
  orbit: { a: 0.7233, e: 0.0068, i: 3.3947, omega: 54.884, w: 76.680, period: 224.701, phase: 250 },
  details: { mass: '4.867e24 kg', temp: '462°C', moons: 0, gravity: '8.87 m/s²' }
},
{
  id: 'p_earth',
  name: 'Earth',
  type: 'planet',
  color: '#10f3a5',
  size: '12,742 km',
  orbit: { a: 1.0000, e: 0.0167, i: 0.0000, omega: 114.207, w: -11.260, period: 365.256, phase: 0 },
  details: { mass: '5.972e24 kg', temp: '-88 to 58°C', moons: 1, gravity: '9.81 m/s²' }
},
{
  id: 'p_mars',
  name: 'Mars',
  type: 'planet',
  color: '#ff5522',
  size: '6,779 km',
  orbit: { a: 1.5237, e: 0.0934, i: 1.8506, omega: 286.537, w: 49.578, period: 686.980, phase: 80 },
  details: { mass: '6.417e23 kg', temp: '-143 to 35°C', moons: 2, gravity: '3.71 m/s²' }
},
{
  id: 'p_jupiter',
  name: 'Jupiter',
  type: 'planet',
  color: '#d4a373',
  size: '139,820 km',
  orbit: { a: 5.2028, e: 0.0484, i: 1.303, omega: 273.867, w: 100.464, period: 4332.59, phase: 15 },
  details: { mass: '1.898e27 kg', temp: '-108°C', moons: 95, gravity: '24.79 m/s²' }
},
{
  id: 'p_saturn',
  name: 'Saturn',
  type: 'planet',
  color: '#f4e285',
  size: '116,460 km',
  orbit: { a: 9.5371, e: 0.0541, i: 2.484, omega: 339.392, w: 113.665, period: 10759.22, phase: 190 },
  details: { mass: '5.683e26 kg', temp: '-139°C', moons: 146, gravity: '10.44 m/s²' }
},
{
  id: 'p_uranus',
  name: 'Uranus',
  type: 'planet',
  color: '#a0c4ff',
  size: '50,724 km',
  orbit: { a: 19.1913, e: 0.0473, i: 0.773, omega: 96.998, w: 74.006, period: 30688.5, phase: 310 },
  details: { mass: '8.681e25 kg', temp: '-197°C', moons: 28, gravity: '8.69 m/s²' }
},
{
  id: 'p_neptune',
  name: 'Neptune',
  type: 'planet',
  color: '#4895ef',
  size: '49,244 km',
  orbit: { a: 30.0690, e: 0.0086, i: 1.770, omega: 276.340, w: 131.784, period: 60182.0, phase: 45 },
  details: { mass: '1.024e26 kg', temp: '-201°C', moons: 16, gravity: '11.15 m/s²' }
},
// Planetoids (Dwarf Planets)
{
  id: 'p_ceres',
  name: 'Ceres',
  type: 'planetoid',
  color: '#b0c4de',
  size: '940 km',
  orbit: { a: 2.7675, e: 0.0758, i: 10.593, omega: 73.12, w: 80.33, period: 1681.63, phase: 200 },
  details: { mass: '9.393e20 kg', temp: '-100°C', moons: 0, gravity: '0.28 m/s²' }
},
{
  id: 'p_pluto',
  name: 'Pluto',
  type: 'planetoid',
  color: '#cdb4db',
  size: '2,376 km',
  orbit: { a: 39.482, e: 0.2488, i: 17.16, omega: 113.83, w: 110.30, period: 90560, phase: 100 },
  details: { mass: '1.303e22 kg', temp: '-229°C', moons: 5, gravity: '0.62 m/s²' }
},
{
  id: 'p_eris',
  name: 'Eris',
  type: 'planetoid',
  color: '#ffc8dd',
  size: '2,326 km',
  orbit: { a: 67.668, e: 0.4407, i: 44.04, omega: 151.60, w: 35.87, period: 203830, phase: 150 },
  details: { mass: '1.66e22 kg', temp: '-243°C', moons: 1, gravity: '0.82 m/s²' }
},
{
  id: 'p_haumea',
  name: 'Haumea',
  type: 'planetoid',
  color: '#ffafcc',
  size: '1,632 km',
  orbit: { a: 43.335, e: 0.1912, i: 28.19, omega: 239.51, w: 121.10, period: 104230, phase: 280 },
  details: { mass: '4.01e21 kg', temp: '-223°C', moons: 2, gravity: '0.40 m/s²' }
},
{
  id: 'p_makemake',
  name: 'Makemake',
  type: 'planetoid',
  color: '#bde0fe',
  size: '1,430 km',
  orbit: { a: 45.791, e: 0.159, i: 28.96, omega: 295.21, w: 79.62, period: 113180, phase: 340 },
  details: { mass: '3.1e21 kg', temp: '-239°C', moons: 1, gravity: '0.5 m/s²' }
},
{
  id: 'p_quaoar',
  name: 'Quaoar',
  type: 'planetoid',
  color: '#ffd6a5',
  size: '1,110 km',
  orbit: { a: 43.694, e: 0.0392, i: 7.99, omega: 188.83, w: 157.34, period: 105586, phase: 60 },
  details: { mass: '1.2e21 kg', temp: '-220°C', moons: 1, gravity: '0.19 m/s²' }
},
{
  id: 'p_orcus',
  name: 'Orcus',
  type: 'planetoid',
  color: '#a9def9',
  size: '910 km',
  orbit: { a: 39.170, e: 0.227, i: 20.573, omega: 268.81, w: 72.31, period: 89557, phase: 320 },
  details: { mass: '6.32e20 kg', temp: '-231°C', moons: 1, gravity: '0.17 m/s²' }
},
{
  id: 'p_gonggong',
  name: 'Gonggong',
  type: 'planetoid',
  color: '#e4c1f9',
  size: '1,230 km',
  orbit: { a: 67.485, e: 0.5058, i: 30.7, omega: 336.85, w: 207.6, period: 202307, phase: 210 },
  details: { mass: '1.75e21 kg', temp: '-243°C', moons: 1, gravity: '0.25 m/s²' }
},
{
  id: 'p_varuna',
  name: 'Varuna',
  type: 'planetoid',
  color: '#d0f4de',
  size: '668 km',
  orbit: { a: 42.75, e: 0.05617, i: 17.2, omega: 97.31, w: 262.29, period: 102156, phase: 170 },
  details: { mass: '3.7e20 kg', temp: '-226°C', moons: 0, gravity: '0.14 m/s²' }
},
{
  id: 'p_ixion',
  name: 'Ixion',
  type: 'planetoid',
  color: '#fde4cf',
  size: '617 km',
  orbit: { a: 39.6485, e: 0.2430, i: 19.618, omega: 71.06, w: 300.71, period: 91163, phase: 30 },
  details: { mass: '3.0e20 kg', temp: '-230°C', moons: 0, gravity: '0.13 m/s²' }
},
{
  id: 'p_salacia',
  name: 'Salacia',
  type: 'planetoid',
  color: '#cdeac0',
  size: '854 km',
  orbit: { a: 42.05, e: 0.10618, i: 23.92, omega: 280.05, w: 311.6, period: 99593, phase: 250 },
  details: { mass: '4.92e20 kg', temp: '-228°C', moons: 1, gravity: '0.15 m/s²' }
},
{
  id: 'p_sedna',
  name: 'Sedna',
  type: 'planetoid',
  color: '#ffb4a2',
  size: '995 km',
  orbit: { a: 506.0, e: 0.8496, i: 11.93, omega: 144.31, w: 311.29, period: 4163850, phase: 130 },
  details: { mass: '~1e21 kg', temp: '-240°C', moons: 0, gravity: '0.14 m/s²' }
}];

interface _BeltRockLocal extends BeltRock {}

export const ASTEROID_BELT: BeltRock[] = Array.from({ length: 260 }, (_, k) => {
  // Deterministic pseudo-random spread using seeded trig, keeps field stable across renders
  const seed1 = Math.sin(k * 12.9898) * 43758.5453;
  const seed2 = Math.sin(k * 78.233) * 12543.112;
  const seed3 = Math.sin(k * 37.719) * 98765.432;
  const r1 = seed1 - Math.floor(seed1);
  const r2 = seed2 - Math.floor(seed2);
  const r3 = seed3 - Math.floor(seed3);
  const r4 = Math.sin(k * 5.372) * 5432.1 % 1;

  const a = 2.06 + r1 * 1.22; // Main Belt: ~2.06 - 3.28 AU (Hungarias to Cybeles band)
  const period = Math.pow(a, 1.5) * 365.25;

  return {
    a,
    e: 0.03 + r2 * 0.22,
    i: r3 * 12 - 6,
    omega: r1 * 360,
    w: r2 * 360,
    period,
    phase: r4 * 360,
    size: 0.55 + r3 * 1.15,
    spin: r2 * Math.PI * 2,
    hue: r1 > 0.85 ? 1 : 0 // rare brighter "flare" rocks
  };
});
