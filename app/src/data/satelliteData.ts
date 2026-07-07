import type { Satellite } from './types';

// ==========================================
// SATELLITE CONSTELLATION DATA (Geocentric Map panel)
// ==========================================
export const SATELLITE_COUNTS = {
  starlink: 10631,
  oneweb: 651,
  weather: 44,
  gps: 187,
  geobelt: 507,
  other: 3801
};

// Generate ~800 visual satellites to represent 15,821 active satellites
export const generateSatellites = (): Satellite[] => {
  const list: Satellite[] = [];
  let id = 0;

  // Starlink: Lower Earth Orbit (LEO), high density, cyan
  for (let k = 0; k < 350; k++) {
    list.push({
      id: id++,
      category: 'starlink',
      radius: Math.random() * 15 + 12, // Close to Earth
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.01,
      inclination: (Math.random() * 30 + 40) * (Math.PI / 180), // Polar/inclined
      node: Math.random() * Math.PI * 2
    });
  }

  // OneWeb: Slightly higher LEO, blue
  for (let k = 0; k < 120; k++) {
    list.push({
      id: id++,
      category: 'oneweb',
      radius: Math.random() * 12 + 25,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.015 + 0.008,
      inclination: (Math.random() * 10 + 80) * (Math.PI / 180), // Highly polar
      node: Math.random() * Math.PI * 2
    });
  }

  // Weather: Scattered, white
  for (let k = 0; k < 30; k++) {
    list.push({
      id: id++,
      category: 'weather',
      radius: Math.random() * 20 + 20,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.012 + 0.005,
      inclination: (Math.random() * 45 + 15) * (Math.PI / 180),
      node: Math.random() * Math.PI * 2
    });
  }

  // GPS / GNSS: Medium Earth Orbit (MEO), green
  for (let k = 0; k < 50; k++) {
    list.push({
      id: id++,
      category: 'gps',
      radius: Math.random() * 15 + 45,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.008 + 0.004,
      inclination: 55 * (Math.PI / 180), // GPS specific inclination
      node: Math.random() * Math.PI * 2
    });
  }

  // Geo Belt: High altitude, equatorial, orange
  for (let k = 0; k < 100; k++) {
    list.push({
      id: id++,
      category: 'geobelt',
      radius: 85 + Math.random() * 3, // GEO belt
      angle: Math.random() * Math.PI * 2,
      speed: 0.002, // Synchronous
      inclination: (Math.random() * 2 - 1) * (Math.PI / 180), // Equatorial
      node: Math.random() * Math.PI * 2
    });
  }

  // Other: Scattered, lavender
  for (let k = 0; k < 150; k++) {
    list.push({
      id: id++,
      category: 'other',
      radius: Math.random() * 60 + 15,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.014 + 0.003,
      inclination: Math.random() * Math.PI,
      node: Math.random() * Math.PI * 2
    });
  }

  return list;
};
