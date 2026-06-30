import React, { useState, useEffect, useRef, useMemo } from '@fuser/vendor/react';
import { createRoot } from '@fuser/vendor/react-dom/client';
import { Play, Pause, RefreshCw, RotateCcw } from '@fuser/vendor/lucide-react';

// ==========================================
// VECTOR GRAPHICS HELPERS
// ==========================================
const drawArrowhead = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string) => {
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

const drawDiamond = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, fill = true) => {
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

const drawSelectedRhombus = (
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
  // The front tip is at (size * 1.5, 0), back tip is at (-size * 1.5, 0).
  // The top tip is at (0, -size * 0.8), bottom tip is at (0, size * 0.8).
  const w = size * 1.5;
  const h = size * 0.8;

  ctx.beginPath();
  ctx.moveTo(w, 0); // front tip
  ctx.lineTo(0, -h); // top tip
  ctx.lineTo(-w, 0); // back tip
  ctx.lineTo(0, h); // bottom tip
  ctx.closePath();

  // "el borderline bajalo a 3 puntos de grosor" -> set stroke style and lineWidth to 3
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Fill with semi-transparent color
  ctx.fillStyle = color + '33'; // semi-transparent
  ctx.fill();

  // "y en su centro coloca un punto" -> And in its center place a dot.
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, 1.5 * scaleFactor), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
};

// [drawNearestStarsMap moved below to have access to all types and constants]

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface Asteroid {
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

interface Satellite {
  id: number;
  category: 'starlink' | 'oneweb' | 'weather' | 'gps' | 'geobelt' | 'other';
  radius: number;
  angle: number;
  speed: number;
  inclination: number;
  node: number;
}

// ==========================================
// PROCEDURAL DATA GENERATORS
// ==========================================
const SATELLITE_COUNTS = {
  starlink: 10631,
  oneweb: 651,
  weather: 44,
  gps: 187,
  geobelt: 507,
  other: 3801
};

// Generate 107 Asteroids
const generateAsteroids = (): Asteroid[] => {
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
  '2026 AB9', '2026 BC2', '2026 CD8', '2026 DE4', '2026 EF1', '2026 FG5', '2026 GH9',
  '2026 HJ2', '2026 IK7', '2026 JK1', '2026 KL4', '2026 LM9', '2026 MN3', '2026 NO2',
  '2026 OP8', '2026 PQ1', '2026 QR7', '2026 RS3', '2026 ST9', '2026 TU4', '2026 UV1',
  '2026 VW8'];


  return Array.from({ length: 107 }, (_, i) => {
    const des = names[i] || `2026 OB${i}`;
    const ld = parseFloat((Math.random() * 19.8 + 0.2).toFixed(1));
    const km = Math.round(ld * 384400);
    const kms = parseFloat((Math.random() * 28 + 4).toFixed(1));
    const size = `${Math.floor(Math.random() * 380 + 20)}m`;
    const sentry = Math.random() < 0.15; // 15% Sentry watch

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

// Generate ~800 visual satellites to represent 15,821 active satellites
const generateSatellites = (): Satellite[] => {
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

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function App() {
  const asteroids = useMemo(() => generateAsteroids(), []);
  const allSatellites = useMemo(() => generateSatellites(), []);

  // State
  const [selectedId, setSelectedId] = useState<number>(0);
  const [selectedObjectType, setSelectedObjectType] = useState<'asteroid' | 'solar_system' | 'satellite'>('satellite');
  const [selectedSolarObjectId, setSelectedSolarObjectId] = useState<string>('p_earth');
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<number>(0);
  const [showDataFeed, setShowDataFeed] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [missionTime, setMissionTime] = useState<number>(0.5); // 0 to 1 slider
  const [satelliteFilter, setSatelliteFilter] = useState<Record<string, boolean>>({
    starlink: true,
    oneweb: true,
    weather: true,
    gps: true,
    geobelt: true,
    other: true
  });

  // Active Map Modal State ('geocentric' | 'helio' | 'radar' | null)
  const [activeModal, setActiveModal] = useState<'geocentric' | 'helio' | 'radar' | null>(null);

  // Selected Map projected in main panel background ('geocentric' | 'helio' | 'radar')
  const [selectedMap, setSelectedMap] = useState<'geocentric' | 'helio' | 'radar'>('geocentric');

  // Search filter for asteroids
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Log Feed entries
  const [logs, setLogs] = useState<string[]>([
  'BOOT - CNEOS UPLINK INIT',
  'CAD WINDOW 2026-06-05 -> 2026-09-03',
  'CELESTRAK GP UPLINK - SATELLITE CATALOGUE',
  'CELESTRAK OFFLINE - SERVING CACHED SNAPSHOT',
  '15,821 ACTIVE SATELLITES - TWO-BODY PROPAGATION',
  'JPL CAD 200 OK - 107 REC',
  'JPL SENTRY 200 OK - 2163 REC',
  'SYSTEM READY - PLOTTING ORBITAL INTERSECTS']
  );

  // Selected Asteroid
  const selectedAsteroid = useMemo(() => {
    return asteroids.find((a) => a.id === selectedId) || asteroids[0];
  }, [asteroids, selectedId]);

  // Selected Solar System Object
  const selectedSolarObject = useMemo(() => {
    return SOLAR_SYSTEM_OBJECTS.find((o) => o.id === selectedSolarObjectId) || SOLAR_SYSTEM_OBJECTS[2];
  }, [selectedSolarObjectId]);

  // Selected Satellite
  const selectedSatellite = useMemo(() => {
    return allSatellites.find((s) => s.id === selectedSatelliteId) || allSatellites[0];
  }, [allSatellites, selectedSatelliteId]);

  // Filtered Satellites based on search and selected filters
  const filteredSatellites = useMemo(() => {
    return allSatellites.filter((s) => {
      if (!satelliteFilter[s.category]) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          s.category.toLowerCase().includes(query) ||
          `sat-${s.id}`.toLowerCase().includes(query));

      }
      return true;
    });
  }, [allSatellites, satelliteFilter, searchQuery]);

  // Filtered Solar System Objects based on search
  const filteredSolarObjects = useMemo(() => {
    return SOLAR_SYSTEM_OBJECTS.filter((o) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          o.name.toLowerCase().includes(query) ||
          o.type.toLowerCase().includes(query));

      }
      return true;
    });
  }, [searchQuery]);

  // Filtered Asteroids based on search
  const filteredAsteroids = useMemo(() => {
    return asteroids.filter((a) =>
    a.des.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.date.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [asteroids, searchQuery]);

  // Add log helper
  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev.slice(0, 15)]);
  };

  // Handle asteroid click
  const handleSelectAsteroid = (id: number, name: string) => {
    setSelectedObjectType('asteroid');
    setSelectedId(id);
    setShowDataFeed(true);
    addLog(`SELECTING OBJECT: ${name}`);
    addLog(`RECALCULATING ORBITAL PROPAGATION... OK`);
  };

  // Handle satellite click
  const handleSelectSatellite = (id: number) => {
    setSelectedObjectType('satellite');
    setSelectedSatelliteId(id);
    setShowDataFeed(true);
    addLog(`SELECTING SATELLITE: SAT-${id}`);
    addLog(`TRACKING ORBITAL TELEMETRY... OK`);
  };

  // Handle solar system object click
  const handleSelectSolarObject = (id: string, name: string) => {
    setSelectedObjectType('solar_system');
    setSelectedSolarObjectId(id);
    setShowDataFeed(true);
    addLog(`SELECTING PLANETARY BODY: ${name.toUpperCase()}`);
    addLog(`PROPAGATING PLANETARY ORBITAL TELEMETRY... OK`);
  };

  // Toggle satellite layer
  const toggleSatellite = (key: string) => {
    setSatelliteFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      addLog(`TOGGLE SATELLITE FILTER: ${key.toUpperCase()} -> ${next[key] ? 'ON' : 'OFF'}`);
      return next;
    });
  };

  // Format date display based on missionTime (scrubbing)
  const formattedDate = useMemo(() => {
    // Map 0 -> 1 to a date range in 2026
    const baseDate = new Date(2026, 5, 25, 6, 51); // 2026-Jun-25 06:51
    const offsetHours = (missionTime - 0.5) * 2400; // +/- 50 days
    const targetDate = new Date(baseDate.getTime() + offsetHours * 60 * 60 * 1000);

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const y = targetDate.getFullYear();
    const m = months[targetDate.getMonth()];
    const d = String(targetDate.getDate()).padStart(2, '0');
    const h = String(targetDate.getHours()).padStart(2, '0');
    const min = String(targetDate.getMinutes()).padStart(2, '0');

    return `${y}-${m}-${d} ${h}:${min}Z`;
  }, [missionTime]);

  // Animation loop for mission time
  useEffect(() => {
    if (!isPlaying) return;

    let frame: number;
    const tick = () => {
      setMissionTime((prev) => {
        let next = prev + 0.0005;
        if (next > 1.0) next = 0.0; // Loop back
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full h-full max-w-[1800px] mx-auto flex flex-col gap-1 text-xs font-mono select-none">
      
      {/* ==========================================
                                                          MAIN GRID: SIDEBAR vs TERMINAL
                                                         ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-1 h-full min-h-0">
        
        {/* LEFT COLUMN: MAPS SIDEBAR (1/4 of total view, i.e. 1/3 of the 3/4 main column) */}
        <div className="lg:col-span-3 flex flex-col gap-1 h-full min-h-0">
          
          {/* MINI GEOCENTRIC MAP */}
          <div
            onClick={() => {
              setSelectedMap('geocentric');
              setSelectedObjectType('satellite');
              setSelectedSatelliteId(0);
              setSearchQuery('');
              addLog('PROJECTED GEOCENTRIC TELEMETRY TO MAIN PANEL');
            }}
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
            selectedMap === 'geocentric' ? 'border-glow-green shadow-[0_0_15px_rgba(16,243,165,0.25)]' : 'border-glow-yellow hover:border-glow-green'}`
            }>
            
            <div data-fuser-slot-id="section-text-345d707d" className={`absolute top-2 left-2 border px-2 py-0.5 rounded text-[9px] font-bold tracking-wider bg-space-black z-10 transition-colors ${
            selectedMap === 'geocentric' ? 'border-glow-green text-space-accent' : 'border-glow-yellow text-space-yellow group-hover:text-space-accent group-hover:border-glow-green'}`
            }>
              GEOCENTRIC MAP • {selectedMap === 'geocentric' ? 'ACTIVE MAIN' : 'PROJECT TO MAIN'}
            </div>
            
            <button data-fuser-slot-id="section-button-text-587e7495"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal('geocentric');
              addLog('OPENING DETAILED GEOCENTRIC TELEMETRY...');
            }}
            className="absolute top-2 right-2 border border-glow-yellow hover:border-glow-green px-2 py-0.5 rounded text-space-yellow hover:text-space-accent text-[9px] font-bold tracking-wider bg-space-black z-30 transition-colors pointer-events-auto">
              
              [EXPAND]
            </button>
            
            {/* Hover overlay indicator */}
            <div className="absolute inset-0 bg-space-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex items-center justify-center">
              <span data-fuser-slot-id="section-text-aa96162c" className="text-space-accent font-bold text-[10px] tracking-widest bg-space-black/95 px-3 py-1.5 border border-space-accent rounded shadow-[0_0_10px_rgba(16,243,165,0.4)]">
                PROJECT TO MAIN SCREEN
              </span>
            </div>

            <div className="flex-1 mt-4 relative overflow-hidden pointer-events-none">
              <GeocentricCanvas satellites={allSatellites} filter={satelliteFilter} selectedSatelliteId={selectedSatelliteId} selectedObjectType={selectedObjectType} />
            </div>
          </div>

          {/* MINI HELIO MAP */}
          <div
            onClick={() => {
              setSelectedMap('helio');
              setSelectedObjectType('solar_system');
              setSelectedSolarObjectId('p_earth');
              setSearchQuery('');
              addLog('PROJECTED HELIOCENTRIC SYSTEM MAP TO MAIN PANEL');
            }}
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
            selectedMap === 'helio' ? 'border-glow-green shadow-[0_0_15px_rgba(16,243,165,0.25)]' : 'border-glow-yellow hover:border-glow-green'}`
            }>
            
            <div data-fuser-slot-id="section-text-9285554f" className={`absolute top-2 left-2 border px-2 py-0.5 rounded text-[9px] font-bold tracking-wider bg-space-black z-10 transition-colors ${
            selectedMap === 'helio' ? 'border-glow-green text-space-accent' : 'border-glow-yellow text-space-yellow group-hover:text-space-accent group-hover:border-glow-green'}`
            }>
              HELIO MAP • {selectedMap === 'helio' ? 'ACTIVE MAIN' : 'PROJECT TO MAIN'}
            </div>
            
            <button data-fuser-slot-id="section-button-text-062543cd"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal('helio');
              addLog('OPENING DETAILED HELIOCENTRIC SYSTEM MAP...');
            }}
            className="absolute top-2 right-2 border border-glow-yellow hover:border-glow-green px-2 py-0.5 rounded text-space-yellow hover:text-space-accent text-[9px] font-bold tracking-wider bg-space-black z-30 transition-colors pointer-events-auto">
              
              [EXPAND]
            </button>
            
            {/* Hover overlay indicator */}
            <div className="absolute inset-0 bg-space-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex items-center justify-center">
              <span data-fuser-slot-id="section-text-175907af" className="text-space-accent font-bold text-[10px] tracking-widest bg-space-black/95 px-3 py-1.5 border border-space-accent rounded shadow-[0_0_10px_rgba(16,243,165,0.4)]">
                PROJECT TO MAIN SCREEN
              </span>
            </div>

            <div className="flex-1 mt-4 relative overflow-hidden pointer-events-none">
              <HelioCanvas
                selectedAsteroid={selectedAsteroid}
                asteroids={asteroids}
                missionTime={missionTime}
                selectedObjectType={selectedObjectType}
                selectedSolarObjectId={selectedSolarObjectId} />
              
            </div>
          </div>

          {/* MINI ENCOUNTER RADAR */}
          <div
            onClick={() => {
              setSelectedMap('radar');
              setSelectedObjectType('asteroid');
              setSelectedId(0);
              setSearchQuery('');
              addLog('PROJECTED ENCOUNTER RADAR SWEEP TO MAIN PANEL');
            }}
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
            selectedMap === 'radar' ? 'border-glow-green shadow-[0_0_15px_rgba(16,243,165,0.25)]' : 'border-glow-yellow hover:border-glow-green'}`
            }>
            
            <div data-fuser-slot-id="section-text-353e30bc" className={`absolute top-2 left-2 border px-2 py-0.5 rounded text-[9px] font-bold tracking-wider bg-space-black z-10 transition-colors ${
            selectedMap === 'radar' ? 'border-glow-green text-space-accent' : 'border-glow-yellow text-space-yellow group-hover:text-space-accent group-hover:border-glow-green'}`
            }>
              ENCOUNTER RADAR • {selectedMap === 'radar' ? 'ACTIVE MAIN' : 'PROJECT TO MAIN'}
            </div>
            
            <button data-fuser-slot-id="section-button-text-ff2538c8"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal('radar');
              addLog('OPENING DETAILED ENCOUNTER RADAR SWEEP...');
            }}
            className="absolute top-2 right-2 border border-glow-yellow hover:border-glow-green px-2 py-0.5 rounded text-space-yellow hover:text-space-accent text-[9px] font-bold tracking-wider bg-space-black z-30 transition-colors pointer-events-auto">
              
              [EXPAND]
            </button>
            
            {/* Hover overlay indicator */}
            <div className="absolute inset-0 bg-space-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex items-center justify-center">
              <span data-fuser-slot-id="section-text-19590ad5" className="text-space-accent font-bold text-[10px] tracking-widest bg-space-black/95 px-3 py-1.5 border border-space-accent rounded shadow-[0_0_10px_rgba(16,243,165,0.4)]">
                PROJECT TO MAIN SCREEN
              </span>
            </div>

            <div className="flex-1 mt-4 relative overflow-hidden pointer-events-none">
              <RadarCanvas selectedAsteroid={selectedAsteroid} asteroids={asteroids} missionTime={missionTime} />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN TERMINAL (3/4 of total view) */}
        <div className="lg:col-span-9 flex flex-col gap-1 h-full min-h-0 relative border border-glow-yellow rounded bg-space-card overflow-hidden">
          
          {/* HIGH-DEFINITION INTERACTIVE BACKGROUND MAP */}
          <div className="absolute inset-0 w-full h-full z-0 opacity-100 transition-opacity duration-500">
            {selectedMap === 'geocentric' &&
            <GeocentricCanvas satellites={allSatellites} filter={satelliteFilter} selectedSatelliteId={selectedSatelliteId} selectedObjectType={selectedObjectType} />
            }
            {selectedMap === 'helio' &&
            <HelioCanvas
              selectedAsteroid={selectedAsteroid}
              asteroids={asteroids}
              missionTime={missionTime}
              onSelectAsteroid={handleSelectAsteroid}
              selectedObjectType={selectedObjectType}
              selectedSolarObjectId={selectedSolarObjectId}
              onSelectSolarObject={handleSelectSolarObject} />

            }
            {selectedMap === 'radar' &&
            <RadarCanvas selectedAsteroid={selectedAsteroid} asteroids={asteroids} missionTime={missionTime} onSelectAsteroid={handleSelectAsteroid} />
            }
          </div>

          {/* OVERLAYS CONTAINER (using pointer-events-none so user can click/drag background map) */}
          <div className="absolute inset-0 flex flex-col gap-1 p-2 z-10 pointer-events-none h-full overflow-hidden">
            
            {/* FLOATING MAP DESCRIPTION PANEL (UPPER LEFT CORNER) */}
            <div className="hidden sm:flex absolute top-2 left-2 z-20 pointer-events-auto max-w-[280px] md:max-w-[320px] rounded-none p-2.5 bg-black/60 backdrop-blur-md transition-all duration-300 flex-col gap-1 shadow-[0_0_15px_rgba(250,204,21,0.15)]">
              <div className="flex items-center justify-between border-b border-space-orange/20 pb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10f3a5] animate-pulse" />
                  <span data-fuser-slot-id="section-text-d02416d0" className="text-[9px] text-space-orange font-bold tracking-widest uppercase">MAP PROJECTION DESC</span>
                </div>
                <span data-fuser-slot-id="section-text-3a1189c1" className="text-[8px] text-space-muted font-bold">SYS.REF // {selectedMap.toUpperCase()}</span>
              </div>
              <div className="text-[11px] font-bold text-glow-green uppercase tracking-wide">
                {selectedMap === 'geocentric' && 'GEOCENTRIC ORBITAL DENSITY'}
                {selectedMap === 'helio' && 'HELIOCENTRIC SYSTEM ORBITS'}
                {selectedMap === 'radar' && 'CLOSE-APPROACH RADAR SWEEP'}
              </div>
              <p className="text-[10px] text-space-muted leading-relaxed">
                {selectedMap === 'geocentric' && 'Monitors near-Earth space traffic, tracking 15,821 active satellites (LEO, MEO, GEO belts) and lunar orbital intersections. Essential for analyzing collision risks and orbital clustering.'}
                {selectedMap === 'helio' && 'Visualizes the inner solar system planetary orbits (Mercury to Saturn) and plots Keplerian trajectories of Near-Earth Asteroids (NEOs). Used to calculate long-term orbital resonances and planetary flybys.'}
                {selectedMap === 'radar' && 'A tactical radar projection mapping all tracked asteroids within 20 Lunar Distances (LD) of Earth. Projects closest approach dates and distances to prioritize potential impact hazards.'}
              </p>
              <div className="border-t border-space-orange/10 pt-1 mt-0.5 flex flex-wrap gap-x-2 text-[8px] text-space-muted/80">
                <span>PROJ: <span className="text-white">{selectedMap === 'geocentric' ? 'GEOCENTRIC 3D' : selectedMap === 'helio' ? 'HELIOCENTRIC' : 'AZIMUTHAL RADIAL'}</span></span>
                <span>RANGE: <span className="text-white">{selectedMap === 'geocentric' ? '384,400 KM' : selectedMap === 'helio' ? '35.0 AU' : '20.0 LD'}</span></span>
              </div>
            </div>

            {/* HERO TITLE & STATS PANEL */}
            <div className="w-full lg:max-w-[30%] self-end rounded-none p-3 bg-black/60 backdrop-blur-md relative overflow-hidden flex flex-col justify-between h-auto min-h-[170px] flex-shrink-0 pointer-events-auto transition-all duration-300">
              {/* Background Grid & Space Graphic */}
              <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-space-accent via-transparent to-transparent pointer-events-none" />



              {/* Header Title */}
              <div className="relative z-10 flex flex-col">
                <div className="text-left">
                  <div data-fuser-slot-id="section-text-93fd5f81" className="text-[9px] text-space-muted tracking-widest font-bold">
                    TACTICAL ORBITAL COMMAND • PROJECT: {selectedMap.toUpperCase()}
                  </div>
                  <h1 data-fuser-slot-id="section-title-7acc9962" className="text-[38px] sm:text-[42px] leading-[0.85] text-glow-green font-display w-full tracking-tight font-bold uppercase mt-1 transform scale-x-[0.85] scale-y-[1.1] origin-left inline-block whitespace-nowrap">
                    NEAR EARTH<br />OBJECT<br />ENCOUNTERS
                  </h1>
                </div>
                
                {/* Source Line with EARTH in green */}
                <div className="flex items-center gap-1.5 text-[10px] tracking-wider mt-1.5">
                  <span data-fuser-slot-id="section-text-8fe290aa" className="text-glow-green font-bold">EARTH</span>
                  <span data-fuser-slot-id="section-text-8e1f4c1b" className="text-space-muted">SRC JPL CNEOS • NASA SSD • SBDB</span>
                </div>
              </div>

              {/* Live Stats as a single line matching the mockup */}
              <div className="relative z-10 text-[10px] tracking-wider py-1.5 my-1 border-t border-b border-space-orange/20 text-space-muted">
                TRACKED <span data-fuser-slot-id="section-text-8bd1d489" className="text-space-orange font-bold">107</span> • PLOTTED <span className="text-space-orange font-bold">22</span> • SENTRY WATCH <span className="text-space-orange font-bold">16</span> • ACTIVE SATS <span data-fuser-slot-id="section-text-88b96a26" className="text-glow-green font-bold">15,821</span>
              </div>

              {/* Footer of Top Right Panel */}
              <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end text-[9px] text-space-muted gap-1">
                <div className="space-y-0.5">
                  <div className="text-glow-green text-xs font-bold">{formattedDate}</div>
                  <div className="text-[8px]">DRAG ORBIT • MOUSE WHEEL ZOOM | TRUE SCALE | <span data-fuser-slot-id="section-text-be6cddd4" className="text-glow-green font-bold">SATELLITES</span> CELESTRAK • <span data-fuser-slot-id="section-text-8b1f4762" className="text-space-orange font-bold">ASTEROIDS</span> JPL</div>
                </div>
                <div className="text-right text-[8px] mt-1 sm:mt-0 whitespace-nowrap">
                  CREATED BY <span data-fuser-slot-id="section-text-72457109" className="text-white font-bold">@seta.reti</span> WITH fuser.studio
                </div>
              </div>
            </div>

            {/* DATA FEED & SELECTED OBJECT DETAIL */}
            {showDataFeed ?
            <div className="w-full lg:max-w-[30%] self-end border border-glow-yellow/70 rounded p-2.5 bg-space-black/80 backdrop-blur-md flex flex-col flex-1 min-h-0 justify-between pointer-events-auto hover:border-glow-green/70 transition-all duration-300">
                {/* Upper Section: Uplink Status & Terminal Logs */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center border-b border-space-orange/20 pb-1">
                    <div className="flex items-center gap-2">
                      <div data-fuser-slot-id="section-text-9f1aba30" className="border border-glow-yellow/70 px-2 py-0.5 rounded text-space-orange text-[9px] font-bold tracking-wider bg-space-black">
                        DATA FEED
                      </div>
                      <div className="text-[9px] text-glow-green flex items-center gap-1 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10f3a5] animate-pulse" />
                        UPLINK ONLINE
                      </div>
                    </div>
                    <button data-fuser-slot-id="section-button-text-84efa43d"
                  onClick={() => {
                    setShowDataFeed(false);
                    addLog('CLOSED DATA FEED PANEL');
                  }}
                  className="px-2 py-0.5 border border-glow-yellow hover:border-glow-green rounded text-space-yellow hover:text-glow-green text-[9px] font-bold transition-all hover:scale-105">
                      [X CLOSE]
                    </button>
                  </div>

                  {/* Terminal Log */}
                  <div className="bg-space-black/80 border border-space-orange/10 rounded p-1.5 h-[65px] overflow-y-auto font-mono text-[9px] text-space-muted space-y-0.5">
                    <div data-fuser-slot-id="section-text-101ace4f" className="text-space-orange font-bold mb-0.5">▶ DATA UPLINK / RAW RETURN</div>
                    {logs.map((log, index) =>
                  <div key={index} className="flex gap-2">
                        <span className="text-space-orange/40">[{10 - index}]</span>
                        <span data-fuser-slot-id={{ "BOOT - CNEOS UPLINK INIT": "section-text-a782c8d4", "CAD WINDOW 2026-06-05 -> 2026-09-03": "section-text-30b4bbcf", "CELESTRAK GP UPLINK - SATELLITE CATALOGUE": "section-text-03ebeab7", "CELESTRAK OFFLINE - SERVING CACHED SNAPSHOT": "section-text-89564945", "15,821 ACTIVE SATELLITES - TWO-BODY PROPAGATION": "section-text-ebf53153", "JPL CAD 200 OK - 107 REC": "section-text-19973d86", "JPL SENTRY 200 OK - 2163 REC": "section-text-94657c3a", "SYSTEM READY - PLOTTING ORBITAL INTERSECTS": "section-text-d099df90" }[log]} className={log.includes('SELECTING') || log.includes('READY') ? 'text-glow-green font-bold' : ''}>
                          {log}
                        </span>
                      </div>
                  )}
                  </div>
                </div>

                {/* Middle Section: Close-Approach Table */}
                <div className="flex-1 flex flex-col gap-1.5 mt-1.5 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div data-fuser-slot-id="section-text-4bf40db7" className="text-space-orange font-bold text-[10px] tracking-wider">
                      {selectedMap === 'geocentric' ? `SATELLITE STREAM • ${filteredSatellites.length} PLOTTED` :
                    selectedMap === 'helio' ? `HELIOCENTRIC STREAM • ${filteredSolarObjects.length} PLANETS` :
                    `CLOSE-APPROACH STREAM • ${filteredAsteroids.length} OBJ`}
                    </div>
                    
                    {/* Search input */}
                    <input
                    type="text"
                    placeholder={
                    selectedMap === 'geocentric' ? 'SEARCH SATS...' :
                    selectedMap === 'helio' ? 'SEARCH BODIES...' : 'SEARCH DES...'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-space-black border border-space-orange/30 rounded px-2 py-0.5 text-[9px] text-white focus:outline-none focus:border-[#10f3a5] w-[110px]" />
                  </div>

                  {/* Table */}
                  <div className="flex-1 overflow-y-auto border border-space-orange/10 rounded bg-space-black/60">
                    <table className="w-full text-left text-[10px]">
                      {selectedMap === 'geocentric' ?
                    <>
                          <thead className="bg-space-orange/10 text-space-orange sticky top-0 font-bold z-10">
                            <tr>
                              <th data-fuser-slot-id="section-label-04026101" className="p-1.5 border-b border-space-orange/20">ID</th>
                              <th data-fuser-slot-id="section-label-2c914fe7" className="p-1.5 border-b border-space-orange/20">CAT</th>
                              <th data-fuser-slot-id="section-label-597d5076" className="p-1.5 border-b border-space-orange/20 text-right">ALTITUDE</th>
                              <th data-fuser-slot-id="section-label-61aca0b7" className="p-1.5 border-b border-space-orange/20 text-right">INCL</th>
                              <th data-fuser-slot-id="section-label-54cfbbd8" className="p-1.5 border-b border-space-orange/20 text-right">SPEED</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSatellites.slice(0, 100).map((sat) =>
                        <tr
                          key={sat.id}
                          onClick={() => handleSelectSatellite(sat.id)}
                          className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                          selectedObjectType === 'satellite' && selectedSatelliteId === sat.id ?
                          'bg-space-orange/25 text-white font-bold' :
                          'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                          }>
                          
                                <td data-fuser-slot-id="section-body-246ea925" className="p-1.5 flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${selectedObjectType === 'satellite' && selectedSatelliteId === sat.id ? 'bg-[#10f3a5]' : 'bg-space-orange/40'}`} />
                                  SAT-{sat.id}
                                </td>
                                <td className="p-1.5">{sat.category.toUpperCase()}</td>
                                <td data-fuser-slot-id="section-body-ea87e1d9" className="p-1.5 text-right text-glow-green">{Math.round(sat.radius * 100)} KM</td>
                                <td data-fuser-slot-id="section-body-efa33c6c" className="p-1.5 text-right">{(sat.inclination * 180 / Math.PI).toFixed(1)}°</td>
                                <td className="p-1.5 text-right">{(sat.speed * 1000).toFixed(1)}</td>
                              </tr>
                        )}
                            {filteredSatellites.length === 0 &&
                        <tr>
                                <td data-fuser-slot-id="section-body-7e36f5a5" colSpan={5} className="p-4 text-center text-space-muted">NO SATELLITES MATCH SEARCH</td>
                              </tr>
                        }
                          </tbody>
                        </> :
                    selectedMap === 'helio' ?
                    <>
                          <thead className="bg-space-orange/10 text-space-orange sticky top-0 font-bold z-10">
                            <tr>
                              <th data-fuser-slot-id="section-label-c28e8259" className="p-1.5 border-b border-space-orange/20">NAME</th>
                              <th data-fuser-slot-id="section-label-7f2955b9" className="p-1.5 border-b border-space-orange/20">TYPE</th>
                              <th data-fuser-slot-id="section-label-06a6f13b" className="p-1.5 border-b border-space-orange/20 text-right">DIST (AU)</th>
                              <th data-fuser-slot-id="section-label-75243cb5" className="p-1.5 border-b border-space-orange/20 text-right">PERIOD (D)</th>
                              <th data-fuser-slot-id="section-label-59aa5588" className="p-1.5 border-b border-space-orange/20 text-right">INCL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSolarObjects.map((obj) =>
                        <tr
                          key={obj.id}
                          onClick={() => handleSelectSolarObject(obj.id, obj.name)}
                          className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                          selectedObjectType === 'solar_system' && selectedSolarObjectId === obj.id ?
                          'bg-space-orange/25 text-white font-bold' :
                          'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                          }>
                          
                                <td className="p-1.5 flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${selectedObjectType === 'solar_system' && selectedSolarObjectId === obj.id ? 'bg-[#10f3a5]' : 'bg-space-orange/40'}`} />
                                  {obj.name.toUpperCase()}
                                </td>
                                <td className="p-1.5">{obj.type.toUpperCase()}</td>
                                <td className="p-1.5 text-right text-glow-green">{obj.orbit.a.toFixed(3)}</td>
                                <td className="p-1.5 text-right">{obj.orbit.period.toFixed(1)}</td>
                                <td data-fuser-slot-id="section-body-eca0f91c" className="p-1.5 text-right">{obj.orbit.i.toFixed(1)}°</td>
                              </tr>
                        )}
                            {filteredSolarObjects.length === 0 &&
                        <tr>
                                <td data-fuser-slot-id="section-body-8cb55249" colSpan={5} className="p-4 text-center text-space-muted">NO BODIES MATCH SEARCH</td>
                              </tr>
                        }
                          </tbody>
                        </> :

                    <>
                          <thead className="bg-space-orange/10 text-space-orange sticky top-0 font-bold z-10">
                            <tr>
                              <th data-fuser-slot-id="section-label-0cac9125" className="p-1.5 border-b border-space-orange/20">DES</th>
                              <th data-fuser-slot-id="section-label-a58b777b" className="p-1.5 border-b border-space-orange/20">DATE</th>
                              <th data-fuser-slot-id="section-label-6c0e2acc" className="p-1.5 border-b border-space-orange/20 text-right">LD</th>
                              <th data-fuser-slot-id="section-label-0882dcbf" className="p-1.5 border-b border-space-orange/20 text-right">KM/S</th>
                              <th data-fuser-slot-id="section-label-47caebab" className="p-1.5 border-b border-space-orange/20 text-center">SENTRY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAsteroids.map((ast) =>
                        <tr
                          key={ast.id}
                          onClick={() => handleSelectAsteroid(ast.id, ast.des)}
                          className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                          selectedObjectType === 'asteroid' && selectedId === ast.id ?
                          'bg-space-orange/25 text-white font-bold' :
                          'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                          }>
                          
                                <td className="p-1.5 flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${selectedObjectType === 'asteroid' && selectedId === ast.id ? 'bg-[#10f3a5]' : 'bg-space-orange/40'}`} />
                                  {ast.des}
                                </td>
                                <td className="p-1.5">{ast.date}</td>
                                <td className="p-1.5 text-right text-glow-green">{ast.ld.toFixed(1)}</td>
                                <td className="p-1.5 text-right">{ast.kms.toFixed(1)}</td>
                                <td className="p-1.5 text-center">
                                  {ast.sentry ? <span className="text-red-500 font-bold">▲</span> : <span className="text-space-muted/30">-</span>}
                                </td>
                              </tr>
                        )}
                            {filteredAsteroids.length === 0 &&
                        <tr>
                                <td data-fuser-slot-id="section-body-12de7b85" colSpan={5} className="p-4 text-center text-space-muted">NO OBJECTS MATCH SEARCH</td>
                              </tr>
                        }
                          </tbody>
                        </>
                    }
                    </table>
                  </div>
                </div>

                {/* Bottom Section: Selected Object Detail Panel */}
                <div className="border-t border-space-orange/20 pt-1.5 mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-space-black/80 p-2 rounded border border-space-orange/10">
                  {selectedObjectType === 'solar_system' ?
                <>
                      <div>
                        <div data-fuser-slot-id="section-text-41abee62" className="text-[9px] text-space-muted">SELECTED BODY</div>
                        <div className="text-xs font-bold text-glow-green">{selectedSolarObject.name.toUpperCase()}</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-9d016adf" className="text-[9px] text-space-muted">DIAMETER</div>
                        <div data-fuser-slot-id="section-text-372f9d05" className="text-xs font-bold text-white">{selectedSolarObject.size}</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-78d4d9f2" className="text-[9px] text-space-muted">ORBIT DISTANCE</div>
                        <div data-fuser-slot-id="section-text-9f3f0266" className="text-xs font-bold text-white">{selectedSolarObject.orbit.a.toFixed(3)} AU</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-fbb9d500" className="text-[9px] text-space-muted">MOONS / TEMP</div>
                        <div className="text-xs font-bold text-white">{selectedSolarObject.details.moons} / {selectedSolarObject.details.temp}</div>
                      </div>
                    </> :
                selectedObjectType === 'satellite' ?
                <>
                      <div>
                        <div data-fuser-slot-id="section-text-c404f7c3" className="text-[9px] text-space-muted">SELECTED SATELLITE</div>
                        <div data-fuser-slot-id="section-text-41de7ac9" className="text-xs font-bold text-glow-green">SAT-{selectedSatellite.id}</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-c83d9da0" className="text-[9px] text-space-muted">CATEGORY</div>
                        <div className="text-xs font-bold text-white">{selectedSatellite.category.toUpperCase()}</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-f3a1ca55" className="text-[9px] text-space-muted">ORBIT ALTITUDE</div>
                        <div data-fuser-slot-id="section-text-0300404e" className="text-xs font-bold text-white">{Math.round(selectedSatellite.radius * 100)} KM</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-bf9c758f" className="text-[9px] text-space-muted">INCL / SPEED</div>
                        <div data-fuser-slot-id="section-text-04205e73" className="text-xs font-bold text-white">
                          {(selectedSatellite.inclination * 180 / Math.PI).toFixed(1)}° / {(selectedSatellite.speed * 1000).toFixed(1)} KM/S
                        </div>
                      </div>
                    </> :

                <>
                      <div>
                        <div data-fuser-slot-id="section-text-c4a46745" className="text-[9px] text-space-muted">SELECTED OBJECT</div>
                        <div className="text-xs font-bold text-glow-green">{selectedAsteroid.des}</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-bd69a587" className="text-[9px] text-space-muted">CLOSEST APPROACH</div>
                        <div data-fuser-slot-id="section-text-d437dd77" className="text-xs font-bold text-white">{selectedAsteroid.ld} LD</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-e1aa65d4" className="text-[9px] text-space-muted">VELOCITY</div>
                        <div data-fuser-slot-id="section-text-f0db7254" className="text-xs font-bold text-white">{selectedAsteroid.kms} KM/S</div>
                      </div>
                      <div>
                        <div data-fuser-slot-id="section-text-16d2573c" className="text-[9px] text-space-muted">EST. DIAMETER</div>
                        <div data-fuser-slot-id="section-text-c534f9bd" className="text-xs font-bold text-white">{selectedAsteroid.size}</div>
                      </div>
                    </>
                }
                </div>
              </div> :

            <>
                <div className="flex-1 pointer-events-none" />
                <div className="flex justify-end p-2 pointer-events-auto">
                  <button
                  data-fuser-slot-id="section-button-text-c67d871d"
                  onClick={() => {
                    setShowDataFeed(true);
                    addLog('MANUALLY OPENED DATA FEED');
                  }}
                  className="border border-glow-yellow bg-space-black/95 hover:border-glow-green text-space-yellow hover:text-glow-green px-4 py-2 rounded-md text-[10px] font-bold tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.25)] transition-all duration-300 hover:scale-105">
                  
                    [▲ OPEN DATA FEED]
                  </button>
                </div>
              </>
            }

            {/* TIMELINE CONTROLS */}
            <div className="border border-glow-yellow/70 rounded p-2 bg-space-black/80 backdrop-blur-md flex flex-col md:flex-row items-center gap-2 flex-shrink-0 pointer-events-auto hover:border-glow-green/70 transition-all duration-300 w-full md:w-[60%] self-end">
              {/* Play/Pause Button */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-7 border border-glow-yellow/70 rounded flex items-center justify-center text-space-orange hover:bg-space-orange/10 hover:text-white transition-colors">
                  {isPlaying ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current ml-0.5" />}
                </button>

                <button data-fuser-slot-id="section-button-text-5eac75e2"
                onClick={() => {
                  setMissionTime(0.5);
                  addLog('RESET MISSION TIME TO NOW');
                }}
                className="px-2.5 h-7 border border-glow-yellow/70 rounded text-[9px] font-bold tracking-wider text-space-orange hover:bg-space-orange/10 hover:text-white transition-colors">
                  NOW
                </button>
              </div>

              {/* Timeline Slider */}
              <div className="flex-1 w-full flex flex-col gap-0.5">
                <div className="flex justify-between text-[8px] text-space-muted px-1 font-bold">
                  <span data-fuser-slot-id="section-text-50ae45d8">MISSION TIME PROPAGATION</span>
                  <span className="text-glow-green">{formattedDate}</span>
                </div>
                <div className="relative flex items-center h-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.0001"
                    value={missionTime}
                    onChange={(e) => {
                      setMissionTime(parseFloat(e.target.value));
                      setIsPlaying(false); // Pause on scrub
                    }}
                    className="w-full h-1 bg-space-orange/20 rounded-lg appearance-none cursor-pointer accent-[#10f3a5] outline-none" />
                  
                  {/* Glowing battery-like slider handle indicator */}
                  <div
                    className="absolute pointer-events-none w-2.5 h-4 bg-[#10f3a5] rounded-sm border border-white shadow-[0_0_8px_#10f3a5]"
                    style={{ left: `calc(${missionTime * 100}% - 5px)` }} />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ==========================================
                                                          HIGH-FIDELITY DETAILED MODAL OVERLAY
                                                         ========================================== */}
      {activeModal &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-space-black/95 backdrop-blur-md p-4 transition-all duration-300">
          <div className="relative w-full max-w-5xl border border-glow-yellow rounded-lg bg-space-card p-6 flex flex-col h-[90vh] shadow-[0_0_50px_rgba(250,204,21,0.25)]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-space-orange/20 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-space-yellow animate-pulse shadow-[0_0_8px_#facc15]" />
                <h2 className="text-xl font-display tracking-wider text-space-yellow">
                  {activeModal === 'geocentric' && 'DETAILED GEOCENTRIC ORBITAL TELEMETRY'}
                  {activeModal === 'helio' && 'DETAILED HELIOCENTRIC SYSTEM MAP'}
                  {activeModal === 'radar' && 'DETAILED ENCOUNTER RADAR SWEEP'}
                </h2>
              </div>
              <button data-fuser-slot-id="section-button-text-4fc71bde"
            onClick={() => setActiveModal(null)}
            className="px-3 py-1 border border-glow-yellow rounded text-[10px] font-bold tracking-wider text-space-yellow hover:bg-space-yellow hover:text-space-black transition-all">
                CLOSE [ESC]
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
              
              {/* Left Side: Large Interactive Canvas */}
              <div className="flex-1 bg-space-black/80 border border-space-orange/10 rounded relative overflow-hidden flex items-center justify-center min-h-[300px]">
                {activeModal === 'geocentric' &&
              <GeocentricCanvas satellites={allSatellites} filter={satelliteFilter} selectedSatelliteId={selectedSatelliteId} selectedObjectType={selectedObjectType} />
              }
                {activeModal === 'helio' &&
              <HelioCanvas
                selectedAsteroid={selectedAsteroid}
                asteroids={asteroids}
                missionTime={missionTime}
                onSelectAsteroid={handleSelectAsteroid}
                selectedObjectType={selectedObjectType}
                selectedSolarObjectId={selectedSolarObjectId}
                onSelectSolarObject={handleSelectSolarObject} />

              }
                {activeModal === 'radar' &&
              <RadarCanvas selectedAsteroid={selectedAsteroid} asteroids={asteroids} missionTime={missionTime} onSelectAsteroid={handleSelectAsteroid} />
              }
                
                {/* Canvas controls instructions overlay */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-space-muted bg-space-black/90 px-3 py-1.5 rounded border border-space-orange/10 z-10 whitespace-nowrap">
                  {activeModal === 'geocentric' && 'DRAG TO ROTATE • SCROLL TO ZOOM'}
                  {activeModal === 'helio' && 'ORBITAL ELLIPSE SCALE: 50 PX/AU'}
                  {activeModal === 'radar' && 'RADAR RANGE: 20 LUNAR DISTANCES'}
                </div>
              </div>

              {/* Right Side: Detailed Telemetry Readouts */}
              <div className="w-full lg:w-80 flex flex-col gap-1 overflow-y-auto pr-1">
                
                {/* Telemetry Panel */}
                <div className="border border-space-orange/20 rounded p-3 bg-space-black/40">
                  <div data-fuser-slot-id="section-text-4f08b439" className="text-space-yellow font-bold mb-2 border-b border-space-orange/10 pb-1 text-[11px]">
                    SYSTEM DIAGNOSTICS
                  </div>
                  <div className="space-y-1.5 text-[11px] text-space-muted">
                    <div className="flex justify-between">
                      <span data-fuser-slot-id="section-text-186ee201">STATUS:</span>
                      <span data-fuser-slot-id="section-text-90500c80" className="text-glow-green font-bold">NOMINAL</span>
                    </div>
                    <div className="flex justify-between">
                      <span data-fuser-slot-id="section-text-dc97442b">PROPAGATION:</span>
                      <span data-fuser-slot-id="section-text-9c740cbd" className="text-white">TWO-BODY KEPLER</span>
                    </div>
                    <div className="flex justify-between">
                      <span data-fuser-slot-id="section-text-6010fa00">TIME COORD:</span>
                      <span className="text-space-yellow">{formattedDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span data-fuser-slot-id="section-text-166743b5">TARGET OBJECT:</span>
                      <span className="text-glow-green font-bold">
                        {selectedObjectType === 'solar_system' ? selectedSolarObject.name.toUpperCase() : selectedObjectType === 'satellite' ? `SAT-${selectedSatellite.id}` : selectedAsteroid.des}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Specific Map Telemetry */}
                {activeModal === 'geocentric' &&
              <div className="border border-space-orange/20 rounded p-3 bg-space-black/40 flex-1">
                    <div data-fuser-slot-id="section-text-c14fb449" className="text-space-yellow font-bold mb-2 border-b border-space-orange/10 pb-1 text-[11px]">
                      SATELLITE CONSTELLATIONS
                    </div>
                    
                    {/* Render the full satellite key here in the modal so they can toggle filters! */}
                    <div className="space-y-2 text-[11px]">
                      {Object.keys(satelliteFilter).map((key) =>
                  <button
                    key={key}
                    onClick={() => toggleSatellite(key)}
                    className={`flex items-center justify-between w-full text-left transition-colors hover:bg-space-orange/10 p-1.5 rounded border border-space-orange/10 ${satelliteFilter[key] ? 'bg-space-orange/5 text-white' : 'opacity-40'}`}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                      key === 'starlink' ? 'bg-[#10f3a5]' :
                      key === 'oneweb' ? 'bg-blue-500' :
                      key === 'weather' ? 'bg-white' :
                      key === 'gps' ? 'bg-emerald-400' :
                      key === 'geobelt' ? 'bg-[#ff5522]' : 'bg-purple-400'}`
                      } />
                            <span className="uppercase">{key}</span>
                          </span>
                          <span className="text-space-muted font-bold">{SATELLITE_COUNTS[key as keyof typeof SATELLITE_COUNTS].toLocaleString()}</span>
                        </button>
                  )}
                    </div>
                  </div>
              }

                {activeModal === 'helio' &&
              <div className="border border-space-orange/20 rounded p-3 bg-space-black/40 flex-1">
                    <div data-fuser-slot-id="section-text-d22ca3cb" className="text-space-yellow font-bold mb-2 border-b border-space-orange/10 pb-1 text-[11px]">
                      ORBITAL ELEMENTS
                    </div>
                    {selectedObjectType === 'solar_system' ?
                <div className="space-y-2 text-[11px] text-space-muted">
                        <div>
                          <div className="flex justify-between text-white">
                            <span data-fuser-slot-id="section-text-bcd16d95">SEMI-MAJOR AXIS (a):</span>
                            <span data-fuser-slot-id="section-text-9c498b09">{selectedSolarObject.orbit.a.toFixed(4)} AU</span>
                          </div>
                          <div className="w-full bg-space-orange/10 h-1 mt-1 rounded-full overflow-hidden">
                            <div className="bg-space-yellow h-full" style={{ width: `${Math.min(100, selectedSolarObject.orbit.a / 40 * 100)}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-white">
                            <span data-fuser-slot-id="section-text-bccad9b0">ECCENTRICITY (e):</span>
                            <span>{selectedSolarObject.orbit.e.toFixed(4)}</span>
                          </div>
                          <div className="w-full bg-space-orange/10 h-1 mt-1 rounded-full overflow-hidden">
                            <div className="bg-space-yellow h-full" style={{ width: `${selectedSolarObject.orbit.e * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-983c5655">INCLINATION (i):</span>
                          <span>{selectedSolarObject.orbit.i.toFixed(2)}°</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-b0c5284f">ORBITAL PERIOD:</span>
                          <span data-fuser-slot-id="section-text-dd77f75d">{selectedSolarObject.orbit.period.toFixed(1)} DAYS</span>
                        </div>
                        <div className="flex justify-between text-white border-t border-space-orange/10 pt-1.5 mt-1.5">
                          <span data-fuser-slot-id="section-text-c3889df7">MASS:</span>
                          <span className="text-white font-bold">{selectedSolarObject.details.mass}</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-20a177f2">GRAVITY:</span>
                          <span className="text-white">{selectedSolarObject.details.gravity}</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-01e7b6df">TEMPERATURE:</span>
                          <span className="text-white">{selectedSolarObject.details.temp}</span>
                        </div>
                      </div> :
                selectedObjectType === 'satellite' ?
                <div className="space-y-2 text-[11px] text-space-muted">
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-18b24246">CATEGORY:</span>
                          <span className="font-bold text-glow-green">{selectedSatellite.category.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-acdf2041">ORBIT ALTITUDE:</span>
                          <span data-fuser-slot-id="section-text-ae0c5bee">{Math.round(selectedSatellite.radius * 100)} KM</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-3b45761a">INCLINATION:</span>
                          <span>{(selectedSatellite.inclination * 180 / Math.PI).toFixed(2)}°</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-bfaa7e82">ORBITAL SPEED:</span>
                          <span data-fuser-slot-id="section-text-dcdf397f">{(selectedSatellite.speed * 1000).toFixed(1)} KM/S</span>
                        </div>
                      </div> :

                <div className="space-y-2 text-[11px] text-space-muted">
                        <div>
                          <div className="flex justify-between text-white">
                            <span data-fuser-slot-id="section-text-48eecc0d">SEMI-MAJOR AXIS (a):</span>
                            <span data-fuser-slot-id="section-text-a03f03f9">{selectedAsteroid.orbit.a.toFixed(4)} AU</span>
                          </div>
                          <div className="w-full bg-space-orange/10 h-1 mt-1 rounded-full overflow-hidden">
                            <div className="bg-space-yellow h-full" style={{ width: `${Math.min(100, selectedAsteroid.orbit.a / 2.5 * 100)}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-white">
                            <span data-fuser-slot-id="section-text-c0e8f510">ECCENTRICITY (e):</span>
                            <span>{selectedAsteroid.orbit.e.toFixed(4)}</span>
                          </div>
                          <div className="w-full bg-space-orange/10 h-1 mt-1 rounded-full overflow-hidden">
                            <div className="bg-space-yellow h-full" style={{ width: `${selectedAsteroid.orbit.e * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-2459b4cd">INCLINATION (i):</span>
                          <span>{selectedAsteroid.orbit.i.toFixed(2)}°</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span data-fuser-slot-id="section-text-bce58ede">ORBITAL PERIOD:</span>
                          <span data-fuser-slot-id="section-text-cf75a2bc">{selectedAsteroid.orbit.period.toFixed(1)} DAYS</span>
                        </div>
                      </div>
                }
                  </div>
              }

                {activeModal === 'radar' &&
              <div className="border border-space-orange/20 rounded p-3 bg-space-black/40 flex-1">
                    <div data-fuser-slot-id="section-text-f08db943" className="text-space-yellow font-bold mb-2 border-b border-space-orange/10 pb-1 text-[11px]">
                      CLOSEST APPROACH DETECTED
                    </div>
                    <div className="space-y-2 text-[11px] text-space-muted">
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-f6b26516">MISS DISTANCE:</span>
                        <span data-fuser-slot-id="section-text-5b3d2f2a" className="text-glow-green font-bold">{selectedAsteroid.ld} LD</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-13592f89">METRIC EQUIV:</span>
                        <span data-fuser-slot-id="section-text-76fae6bc">{selectedAsteroid.km.toLocaleString()} KM</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-3d01c802">RELATIVE VELOCITY:</span>
                        <span data-fuser-slot-id="section-text-67d3dee4">{selectedAsteroid.kms} KM/S</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-9baff51e">EST. DIAMETER:</span>
                        <span data-fuser-slot-id="section-text-5a35d658">{selectedAsteroid.size}</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-39f7fa25">SENTRY WATCH:</span>
                        {selectedAsteroid.sentry ?
                    <span data-fuser-slot-id="section-text-5270de24" className="text-red-500 font-bold animate-pulse">▲ ACTIVE</span> :

                    <span data-fuser-slot-id="section-text-86a34e7b">NONE</span>
                    }
                      </div>
                    </div>
                  </div>
              }

              </div>

            </div>

          </div>
        </div>
      }
    </div>);

}

// ==========================================
// GEOCENTRIC MAP CANVAS (3D ORBITAL SIMULATION)
// ==========================================
function GeocentricCanvas({
  satellites,
  filter,
  selectedSatelliteId,
  selectedObjectType





}: {satellites: Satellite[];filter: Record<string, boolean>;selectedSatelliteId?: number;selectedObjectType?: 'asteroid' | 'solar_system' | 'satellite';}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotationX, setRotationX] = useState<number>(0.5);
  const [rotationZ, setRotationZ] = useState<number>(0.2);
  const [zoom, setZoom] = useState<number>(1.5);
  const isDragging = useRef<boolean>(false);
  const lastMousePos = useRef<{x: number;y: number;}>({ x: 0, y: 0 });

  // Handle Dragging to rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setRotationZ((prev) => prev + dx * 0.005);
    setRotationX((prev) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.005)));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Handle Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.5, Math.min(4.0, prev - e.deltaY * 0.001)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleOffset = 0;

    const render = () => {
      // Resize to match container
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      // Clear
      ctx.fillStyle = '#070505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      angleOffset += 0.002;

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
      const moonXp = moonRadius * Math.cos(moonAngle);
      const moonYp = moonRadius * Math.sin(moonAngle);
      const moonCosI = Math.cos(moonInclination);
      const moonSinI = Math.sin(moonInclination);
      const moonCosN = Math.cos(moonNode);
      const moonSinN = Math.sin(moonNode);
      const moonX = moonXp * moonCosN - moonYp * moonSinN * moonCosI;
      const moonY = moonXp * moonCosN * moonCosI + moonYp * moonSinN; // Adjusted rotation matrix components
      const moonZ = moonYp * moonSinI;
      const moonP = project(moonX, moonY, moonZ);

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
          ctx.fillText('☾ LUNA / MOON', moonP.x + 8, moonP.y - 2);
          ctx.fillStyle = 'rgba(200, 220, 255, 0.55)';
          ctx.font = '7px monospace';
          ctx.fillText('384,400 KM (1.0 LD)', moonP.x + 8, moonP.y + 6);
        }
      });

      // 5. Queue fading trajectory history trail
      for (let t = 0; t < 35; t++) {
        const trailAngle = moonAngle - t * 0.025;
        const txp = moonRadius * Math.cos(trailAngle);
        const typ = moonRadius * Math.sin(trailAngle);
        const tx = txp * moonCosN - typ * moonSinN * moonCosI;
        const ty = txp * moonCosN * moonCosI + typ * moonSinN;
        const tz = typ * moonSinI;
        const tp = project(tx, ty, tz);

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

      // Draw Nearest Stars Map
      drawNearestStarsMap(ctx, canvas.width, canvas.height, rotationX, rotationZ, scaleFactor);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [satellites, filter, rotationX, rotationZ, zoom, selectedSatelliteId, selectedObjectType]);

  return (
    <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block" />
    </div>);
}

// ==========================================
// HELIOCENTRIC MAP CANVAS (3D SYSTEM SIMULATION)
// ==========================================
interface SolarSystemObject {
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

const SOLAR_SYSTEM_OBJECTS: SolarSystemObject[] = [
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
}];


const draw3DPolyhedron = (
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

const drawSelectedHUD = (
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

const getKeplerianPos = (orb: {a: number;e: number;i: number;omega: number;w: number;period: number;phase: number;}, E: number) => {
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

// ==========================================
// ENHANCED 3D STAR COMPASS / GYRO & CLOSE-APPROACH PLOTTER
// ==========================================
const drawNearestStarsMap = (
ctx: CanvasRenderingContext2D,
width: number,
height: number,
rotationX: number,
rotationZ: number,
scaleFactor: number,
mode: 'geocentric' | 'helio' = 'geocentric',
selectedAsteroid?: Asteroid,
asteroids: Asteroid[] = [],
missionTime: number = 0.5) =>
{
  // Only draw compass on larger screens/canvases to prevent overlapping in mini-maps
  if (width < 450 || height < 450) {
    return;
  }

  ctx.save();

  // Position it in the bottom left corner, slightly offset to avoid any potential overlap
  const compassRadius = 52 * scaleFactor; // slightly larger and more prominent
  const cx = compassRadius + 30;
  const cy = height - compassRadius - 35;

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

  // 2. Draw tactical corner brackets around the compass box
  const boxSize = compassRadius + 12;
  ctx.strokeStyle = 'rgba(16, 243, 165, 0.45)';
  ctx.lineWidth = 1.2;
  const bracketLen = 6 * scaleFactor;

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

  // Corner sub-labels for high-tech feel
  ctx.fillStyle = 'rgba(16, 243, 165, 0.5)';
  ctx.font = `6px 'Share Tech Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('SOLAR SYSTEM', cx - boxSize + 3, cy - boxSize + 8);
  ctx.textAlign = 'right';
  ctx.fillText('MOON ALIGNED', cx + boxSize - 3, cy - boxSize + 8);

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
  ctx.strokeStyle = 'rgba(16, 243, 165, 0.18)';
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

  // 5b. Draw Tilted Ecliptic Plane Ring (23.4° tilt)
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

  // 5c. Draw Aligned Solar System Map (highly performant, no heavy gradients/text shadows)
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
    ctx.strokeStyle = planet.color + '22'; // subtle color
    ctx.lineWidth = 0.8;
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

    // Draw planet body
    const angle = missionTime * 360 * planet.speed * (Math.PI / 180);
    const bodyP = getSolarOrbitPoint(planet.r, angle);

    // Draw a small dot
    ctx.fillStyle = planet.color;
    ctx.beginPath();
    ctx.arc(bodyP.x, bodyP.y, 2 * scaleFactor, 0, Math.PI * 2);
    ctx.fill();

    // Draw a tiny label for the planet
    ctx.fillStyle = planet.color + 'aa';
    ctx.font = `bold ${Math.max(4.5, Math.floor(5 * scaleFactor))}px 'Share Tech Mono', monospace`;
    ctx.fillText(planet.name, bodyP.x + 4, bodyP.y + 2);
  });

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

  // 6. Draw Rotating Right Ascension Coordinates (0h ♈, 6h, 12h, 18h)
  const directions = [
  { label: '0h ♈', angle: -rotationZ - Math.PI / 2, color: '#10f3a5' },
  { label: '6h', angle: -rotationZ, color: 'rgba(255, 255, 255, 0.75)' },
  { label: '12h', angle: -rotationZ + Math.PI / 2, color: 'rgba(255, 255, 255, 0.75)' },
  { label: '18h', angle: -rotationZ + Math.PI, color: 'rgba(255, 255, 255, 0.75)' }];

  ctx.font = `bold ${Math.max(7.0, Math.floor(8.0 * scaleFactor))}px 'Oswald', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  directions.forEach((dir) => {
    const x = cx + Math.cos(dir.angle) * (compassRadius - 10);
    const y = cy + Math.sin(dir.angle) * (compassRadius - 10);
    ctx.fillStyle = dir.color;
    ctx.fillText(dir.label, x, y);
  });

  // Intermediate Right Ascension coordinates (3h, 9h, 15h, 21h)
  const intermediateDirections = [
  { label: '3h', angle: -rotationZ - Math.PI / 4, color: 'rgba(255, 255, 255, 0.4)' },
  { label: '9h', angle: -rotationZ + Math.PI / 4, color: 'rgba(255, 255, 255, 0.4)' },
  { label: '15h', angle: -rotationZ + 3 * Math.PI / 4, color: 'rgba(255, 255, 255, 0.4)' },
  { label: '21h', angle: -rotationZ - 3 * Math.PI / 4, color: 'rgba(255, 255, 255, 0.4)' }];

  ctx.font = `${Math.max(5.5, Math.floor(6.0 * scaleFactor))}px 'Oswald', sans-serif`;
  intermediateDirections.forEach((dir) => {
    const x = cx + Math.cos(dir.angle) * (compassRadius - 10);
    const y = cy + Math.sin(dir.angle) * (compassRadius - 10);
    ctx.fillStyle = dir.color;
    ctx.fillText(dir.label, x, y);
  });

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
  ctx.font = `bold ${Math.max(8, Math.floor(9 * scaleFactor))}px 'Share Tech Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('3D SOLAR SYSTEM ALIGNMENT GYRO', cx - compassRadius - 5, cy + compassRadius + 14);

  // Convert rotationZ to RA hours (0 to 24)
  let raRad = (rotationZ % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  let raHours = raRad / (Math.PI * 2) * 24;
  let raH = Math.floor(raHours);
  let raM = Math.floor((raHours - raH) * 60);
  const decDeg = Math.round(rotationX * (180 / Math.PI));

  ctx.fillStyle = '#10f3a5';
  ctx.font = `${Math.max(7, Math.floor(7.5 * scaleFactor))}px 'Share Tech Mono', monospace`;
  ctx.fillText(`DEC: ${decDeg}°  RA: ${raH}h ${raM}m  SYS: HELIO.ALIGN  PROJ: LUNAR.PLANE`, cx - compassRadius - 5, cy + compassRadius + 24);

  ctx.restore();
};

function HelioCanvas({
  selectedAsteroid,
  asteroids = [],
  missionTime,
  onSelectAsteroid,
  selectedObjectType,
  selectedSolarObjectId,
  onSelectSolarObject








}: {selectedAsteroid: Asteroid;asteroids?: Asteroid[];missionTime: number;onSelectAsteroid?: (id: number, name: string) => void;selectedObjectType?: 'asteroid' | 'solar_system';selectedSolarObjectId?: string;onSelectSolarObject?: (id: string, name: string) => void;}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotationX, setRotationX] = useState<number>(0.5);
  const [rotationZ, setRotationZ] = useState<number>(0.2);
  const [zoom, setZoom] = useState<number>(1.25);
  const isDragging = useRef<boolean>(false);
  const dragDistance = useRef<number>(0);
  const lastMousePos = useRef<{x: number;y: number;}>({ x: 0, y: 0 });

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

    setRotationZ((prev) => prev + dx * 0.005);
    setRotationX((prev) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.005)));

    dragDistance.current += Math.hypot(dx, dy);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Handle Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.02, Math.min(10.0, prev - e.deltaY * 0.001)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize to match container
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear
    ctx.fillStyle = '#070505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Dynamic scale factor based on canvas size
    const scaleFactor = Math.min(canvas.width, canvas.height) / 240;

    // 3D Projection helper
    const project = (x: number, y: number, z: number) => {
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
      const orb = obj.orbit;
      const isSelected = selectedObjectType === 'solar_system' && selectedSolarObjectId === obj.id;

      // Draw Orbit Line in 3D
      ctx.strokeStyle = isSelected ? obj.color : obj.type === 'planet' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = isSelected ? 1.5 : 0.8;
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

      // Draw integrated arrowheads along planet orbits in 3D for planets
      if (obj.type === 'planet') {
        const arrowCount = 3;
        for (let a = 0; a < arrowCount; a++) {
          const arrowAngle = a * Math.PI * 2 / arrowCount + missionTime * 0.1 * (365.25 / orb.period);
          const pos1 = getKeplerianPos(orb, arrowAngle);
          const p1 = project(pos1.x, pos1.y, pos1.z);

          const dAngle = 0.02;
          const pos2 = getKeplerianPos(orb, arrowAngle + dAngle);
          const p2 = project(pos2.x, pos2.y, pos2.z);

          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          drawArrowhead(ctx, p1.x, p1.y, angle, 4 * scaleFactor, isSelected ? obj.color : 'rgba(255, 255, 255, 0.2)');
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
      const polySize = (obj.type === 'planet' ? obj.name === 'Earth' || obj.name === 'Jupiter' || obj.name === 'Saturn' ? 4 : 3 : 2) * scaleFactor * zoom;
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

      // Label
      if (obj.type === 'planet' || isSelected) {
        ctx.fillStyle = isSelected ? '#ffffff' : obj.color;
        ctx.font = `${isSelected ? 'bold' : ''} ${Math.max(8, Math.round(9 * scaleFactor))}px monospace`;
        ctx.fillText(obj.name.toUpperCase(), p.x + 6 * scaleFactor, p.y + 3 * scaleFactor);
      }

      // If selected, draw HUD overlay reticle on it!
      if (isSelected) {
        drawSelectedHUD(ctx, p, pos, obj.name, obj.orbit.a, 0, obj.size, scaleFactor, canvas.width, canvas.height);
      }
    });

    // Draw All Other Asteroids' orbits in faint orange
    asteroids.forEach((ast) => {
      if (selectedObjectType === 'asteroid' && ast.id === selectedAsteroid.id) return;

      // Faint orbit line
      ctx.strokeStyle = 'rgba(255, 85, 34, 0.05)';
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

      // Draw Asteroid Diamond
      const orb = ast.orbit;
      const meanAnomaly = (missionTime * 360 * (365.25 / orb.period) + orb.phase) * (Math.PI / 180);
      let E = meanAnomaly;
      for (let j = 0; j < 4; j++) {
        E = meanAnomaly + orb.e * Math.sin(E);
      }
      const pos = getKeplerianPos(orb, E);
      const p = project(pos.x, pos.y, pos.z);

      drawDiamond(ctx, p.x, p.y, 2.5 * scaleFactor, 'rgba(255, 85, 34, 0.4)');
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

    // Draw Nearest Stars Map
    drawNearestStarsMap(ctx, canvas.width, canvas.height, rotationX, rotationZ, scaleFactor, 'helio', selectedAsteroid, asteroids, missionTime);

  }, [selectedAsteroid, asteroids, missionTime, rotationX, rotationZ, zoom, selectedObjectType, selectedSolarObjectId]);

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

    // Helper projection function for click detection
    const projectClick = (x: number, y: number, z: number) => {
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
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        className="w-full h-full block" />
      

      {/* Zoom / Camera Controls Overlay */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20 pointer-events-auto">
        <button data-fuser-slot-id="section-button-text-9aeb4aa9"
        onClick={(e) => {e.stopPropagation();setZoom((prev) => Math.min(10.0, prev * 1.3));}}
        className="w-7 h-7 bg-space-black/90 border border-glow-yellow/70 rounded flex items-center justify-center text-space-yellow hover:border-glow-green hover:text-glow-green transition-all font-bold text-sm">
          +
        </button>
        <button data-fuser-slot-id="section-button-text-14a0c948"
        onClick={(e) => {e.stopPropagation();setZoom((prev) => Math.max(0.02, prev / 1.3));}}
        className="w-7 h-7 bg-space-black/90 border border-glow-yellow/70 rounded flex items-center justify-center text-space-yellow hover:border-glow-green hover:text-glow-green transition-all font-bold text-sm">
          -
        </button>
        <button data-fuser-slot-id="section-button-text-7d61057f"
        onClick={(e) => {e.stopPropagation();setZoom(1.25);setRotationX(0.5);setRotationZ(0.2);}}
        className="w-7 h-7 bg-space-black/90 border border-glow-yellow/70 rounded flex items-center justify-center text-space-yellow hover:border-glow-green hover:text-glow-green transition-all text-[9px] font-bold">
          RST
        </button>
      </div>
    </div>);

}

// ==========================================
// ENCOUNTER RADAR CANVAS
// ==========================================
function RadarCanvas({ selectedAsteroid, asteroids, missionTime, onSelectAsteroid }: {selectedAsteroid: Asteroid;asteroids: Asteroid[];missionTime: number;onSelectAsteroid?: (id: number, name: string) => void;}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let sweepAngle = 0;

    const render = () => {
      // Resize to match container
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      // Clear with slight trail effect
      ctx.fillStyle = 'rgba(7, 5, 5, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxRadius = Math.max(0, Math.min(cx, cy) - 15);
      if (maxRadius <= 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      const scaleRef = maxRadius / 105;

      // Draw Radar Rings (representing Lunar Distances: 5, 10, 15, 20 LD)
      ctx.strokeStyle = 'rgba(255, 85, 34, 0.15)';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 4; r++) {
        const radius = maxRadius / 4 * r;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Ring Labels
        ctx.fillStyle = 'rgba(255, 85, 34, 0.5)';
        ctx.font = `${Math.max(7, Math.round(8 * scaleRef))}px monospace`;
        ctx.fillText(`${r * 5} LD`, cx + 3, cy - radius + 10 * scaleRef);
      }

      // Draw Crosshairs
      ctx.strokeStyle = 'rgba(255, 85, 34, 0.08)';
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.stroke();

      // Draw Radar Sweep Line
      sweepAngle = (sweepAngle + 0.015) % (Math.PI * 2);
      const sweepX = cx + maxRadius * Math.cos(sweepAngle);
      const sweepY = cy + maxRadius * Math.sin(sweepAngle);

      // Sweep gradient trail
      const sweepGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
      sweepGlow.addColorStop(0, 'rgba(255, 85, 34, 0)');
      sweepGlow.addColorStop(1, 'rgba(255, 85, 34, 0.05)');
      ctx.fillStyle = sweepGlow;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, sweepAngle - 0.2, sweepAngle);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 85, 34, 0.4)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Draw Asteroids on Radar
      asteroids.forEach((ast) => {
        // Map asteroid close approach distance (ld) to radar radius
        const radius = ast.ld / 20.0 * maxRadius;
        if (radius > maxRadius) return; // Out of range

        // Calculate angle based on its ID to space them out realistically
        const angle = ast.id * 137.5 * (Math.PI / 180);

        // Animate their positions slightly based on missionTime to simulate approach vectors
        const approachOffset = (missionTime - 0.5) * 40 * scaleRef; // Movement along approach vector
        const x = cx + (radius + approachOffset) * Math.cos(angle);
        const y = cy + (radius + approachOffset) * Math.sin(angle);

        const isSelected = ast.id === selectedAsteroid.id;

        // Draw Dot
        if (isSelected) {
          // Draw trajectory line with integrated arrowheads pointing towards Earth (center)
          ctx.strokeStyle = 'rgba(16, 243, 165, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          // Line goes from outer edge of radar through the asteroid position to the center (Earth)
          const startX = cx + maxRadius * Math.cos(angle);
          const startY = cy + maxRadius * Math.sin(angle);
          ctx.moveTo(startX, startY);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw 2 integrated arrowheads along this trajectory line pointing towards Earth
          const arrowRadii = [maxRadius * 0.75, maxRadius * 0.35];
          arrowRadii.forEach((r) => {
            const ax = cx + r * Math.cos(angle);
            const ay = cy + r * Math.sin(angle);
            // Direction of motion is inwards, so angle is angle + Math.PI
            drawArrowhead(ctx, ax, ay, angle + Math.PI, 6 * scaleRef, '#10f3a5');
          });

          // Draw selected asteroid as a 2D rhombus (size reduced to 1/3 of original 8 * scaleRef)
          drawSelectedRhombus(ctx, x, y, 8 * scaleRef / 3, '#10f3a5', angle + Math.PI, scaleRef);

          // Label
          ctx.fillStyle = '#10f3a5';
          ctx.font = `bold ${Math.max(8, Math.round(9 * scaleRef))}px monospace`;
          ctx.fillText(ast.des, x + 12 * scaleRef, y + 3 * scaleRef);
        } else {
          // Normal orange diamond
          drawDiamond(ctx, x, y, 3.5 * scaleRef, 'rgba(255, 85, 34, 0.75)');
        }
      });

      // Draw Earth in the center of the radar
      ctx.fillStyle = '#10f3a5';
      ctx.beginPath();
      ctx.arc(cx, cy, 4 * scaleRef, 0, Math.PI * 2);
      ctx.fill();

      // Date indicators around the outer ring to match mockup
      ctx.fillStyle = 'rgba(255, 85, 34, 0.4)';
      ctx.font = `${Math.max(7, Math.round(8 * scaleRef))}px monospace`;
      ctx.fillText('11 AUG', cx - maxRadius - 10 * scaleRef, cy + 3 * scaleRef);
      ctx.fillText('27 JUN', cx + maxRadius + 5 * scaleRef, cy + 3 * scaleRef);
      ctx.fillText('20 JUL', cx - 18 * scaleRef, cy + maxRadius + 12 * scaleRef);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [selectedAsteroid, asteroids, missionTime]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectAsteroid) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxRadius = Math.max(0, Math.min(cx, cy) - 15);
    if (maxRadius <= 0) return;
    const scaleRef = maxRadius / 105;

    let closestAst: Asteroid | null = null;
    let minDistance = 15;

    asteroids.forEach((ast) => {
      const radius = ast.ld / 20.0 * maxRadius;
      if (radius > maxRadius) return;

      const angle = ast.id * 137.5 * (Math.PI / 180);
      const approachOffset = (missionTime - 0.5) * 40 * scaleRef;
      const x = cx + (radius + approachOffset) * Math.cos(angle);
      const y = cy + (radius + approachOffset) * Math.sin(angle);

      const dist = Math.hypot(clickX - x, clickY - y);
      if (dist < minDistance) {
        minDistance = dist;
        closestAst = ast;
      }
    });

    if (closestAst) {
      onSelectAsteroid((closestAst as Asteroid).id, (closestAst as Asteroid).des);
    }
  };

  return (
    <div className="relative flex-1 w-full h-full cursor-pointer">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full block" />
    </div>);
}

// Mount React App
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}