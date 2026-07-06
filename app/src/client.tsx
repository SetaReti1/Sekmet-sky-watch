import React, { useState, useEffect, useMemo } from '@fuser/vendor/react';
import { createRoot } from '@fuser/vendor/react-dom/client';
import type { Asteroid } from './data/types';
import { generateAsteroids, mapCadToAsteroids } from './data/asteroidData';
import { generateSatellites, SATELLITE_COUNTS } from './data/satelliteData';
import { SOLAR_SYSTEM_OBJECTS, SOLAR_BODY_CATEGORIES } from './data/solarSystemData';

import { BootSequence } from './components/BootSequence';
import { GeocentricCanvas } from './components/GeocentricCanvas';
import { HelioCanvas } from './components/HelioCanvas';
import { NEO_SIZE_CATEGORIES, categorizeAsteroidSize } from './components/SizeMapCanvas';
import { ImpactSimulator } from './components/ImpactSimulator';
import type { ImpactResult } from './utils/impactPhysics';
import { ImpactRiskGlobe, FALLBACK_SENTRY, riskTier, impactLatLon, deriveWindowOffsetDays, RISK_TIER_LEVELS, type SentryObject } from './components/HexGlobeRadar';

// ==========================================
// MAIN COMPONENT — assembles the four map panels (Geocentric, Helio, Impact
// Risk Globe, NEO Size Class) plus the shared mission-time/data-feed chrome.
// ==========================================
export default function App() {
  const [booting, setBooting] = useState(true);
  const handleBootComplete = useMemo(() => () => setBooting(false), []);
  const [asteroids, setAsteroids] = useState<Asteroid[]>(() => generateAsteroids());
  const [asteroidSourceLabel, setAsteroidSourceLabel] = useState<string>('CACHED SNAPSHOT');
  const allSatellites = useMemo(() => generateSatellites(), []);

  // State
  const [selectedId, setSelectedId] = useState<number>(0);
  const [selectedObjectType, setSelectedObjectType] = useState<'asteroid' | 'solar_system' | 'satellite' | 'belt' | 'sentry'>('satellite');
  const [selectedSolarObjectId, setSelectedSolarObjectId] = useState<string>('p_earth');
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<number>(0);
  const [sentryObjects, setSentryObjects] = useState<SentryObject[]>(FALLBACK_SENTRY);
  const [sentrySourceLabel, setSentrySourceLabel] = useState<string>('CACHED SNAPSHOT');
  const [selectedSentryIdx, setSelectedSentryIdx] = useState<number>(0);
  const [impactSimResult, setImpactSimResult] = useState<ImpactResult | null>(null);
  const [impactSimPoint, setImpactSimPoint] = useState<{lat: number;lon: number;} | null>(null);
  const [impactSimIsWater, setImpactSimIsWater] = useState<boolean>(false);
  const handleImpactSimResult = useMemo(
    () => (r: ImpactResult, point: {lat: number;lon: number;}, water: boolean) => {
      setImpactSimResult(r);
      setImpactSimPoint(point);
      setImpactSimIsWater(water);
    },
    []
  );
  const [showDataFeed, setShowDataFeed] = useState<boolean>(false);
  const [showPropsPopup, setShowPropsPopup] = useState<boolean>(false);
  // Retractable-panel state — MAP PROJECTION DESC, the hero title panel, and
  // OBJECT PROPERTIES can each be collapsed down to just their header strip
  // (distinct from fully closing OBJECT PROPERTIES) so they never crowd out
  // a dense view like the Impact Simulator.
  const [mapDescCollapsed, setMapDescCollapsed] = useState<boolean>(false);
  const [heroCollapsed, setHeroCollapsed] = useState<boolean>(false);
  const [objPropsCollapsed, setObjPropsCollapsed] = useState<boolean>(false);
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [sizeCategoryFilter, setSizeCategoryFilter] = useState<Record<string, boolean>>({
    planet: true,
    planetoid: true,
    small: true,
    medium: true,
    large: true,
    major: true
  });
  // Impact Risk Globe DATA FEED category filter — Sentry Palermo-scale tiers
  // (SEVERE/ELEVATED/GUARDED/LOW/MINIMAL), independent of the NEO size classes above.
  const [sentryTierFilter, setSentryTierFilter] = useState<Record<string, boolean>>({
    SEVERE: true,
    ELEVATED: true,
    GUARDED: true,
    LOW: true,
    MINIMAL: true
  });
  const toggleSentryTier = (key: string) => {
    setSentryTierFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      addLog(`TOGGLE IMPACT CATEGORY: ${key} -> ${next[key] ? 'ON' : 'OFF'}`);
      return next;
    });
  };
  // Per-size-class object cap for the Helio/SizeMap panels — keeps the
  // visualizer and data feed readable when the tracked catalogue grows.
  // Closest-approach and Sentry-watch objects are always prioritized within
  // each class before the cap is applied (see limitedAsteroidsByCategory).
  const [objectLimitPerCategory, setObjectLimitPerCategory] = useState<number>(100);
  const HELIO_CATEGORY_KEYS = useMemo(() => [...SOLAR_BODY_CATEGORIES.map((c) => c.key), ...NEO_SIZE_CATEGORIES.map((c) => c.key)], []);

  // Active Map Modal State ('geocentric' | 'helio' | 'radar' | 'sizemap' | null)
  const [activeModal, setActiveModal] = useState<'geocentric' | 'helio' | 'radar' | 'sizemap' | null>(null);

  // Selected Map projected in main panel background ('geocentric' | 'helio' | 'radar' | 'sizemap')
  const [selectedMap, setSelectedMap] = useState<'geocentric' | 'helio' | 'radar' | 'sizemap'>('geocentric');

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

  // Selected Sentry (impact-risk) object
  const selectedSentryObject = useMemo(() => {
    return sentryObjects[selectedSentryIdx] || sentryObjects[0];
  }, [sentryObjects, selectedSentryIdx]);

  // Drives the OBJECT PROPERTIES popup's title block — every selection type
  // gets an explicit "kind" eyebrow plus a real, prominent name so the panel
  // never reads as unlabeled data.
  const propsPanelInfo = useMemo(() => {
    if (selectedObjectType === 'solar_system') {
      return { kind: 'PLANETARY BODY', name: selectedSolarObject.name.toUpperCase() };
    }
    if (selectedObjectType === 'satellite') {
      return { kind: 'TRACKED SATELLITE', name: `SAT-${selectedSatellite.id}` };
    }
    if (selectedObjectType === 'belt') {
      return { kind: 'REGION', name: 'MAIN ASTEROID BELT' };
    }
    if (selectedObjectType === 'sentry') {
      return { kind: 'IMPACT RISK OBJECT', name: selectedSentryObject ? selectedSentryObject.des : '—' };
    }
    return { kind: 'CLOSE-APPROACH OBJECT', name: selectedAsteroid.des };
  }, [selectedObjectType, selectedSolarObject, selectedSatellite, selectedSentryObject, selectedAsteroid]);

  // Filtered Satellites based on search, selected filters, and category filter
  const filteredSatellites = useMemo(() => {
    return allSatellites.filter((s) => {
      if (selectedCategoryFilter !== 'all' && s.category !== selectedCategoryFilter) return false;
      if (!satelliteFilter[s.category]) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          s.category.toLowerCase().includes(query) ||
          `sat-${s.id}`.toLowerCase().includes(query));

      }
      return true;
    });
  }, [allSatellites, satelliteFilter, searchQuery, selectedCategoryFilter]);

  // Filtered Solar System Objects based on search, gated by the planet/planetoid
  // category toggles so isolating "PLANETOID" (etc.) in the Helio legend hides
  // the rest of the bodies from both the visualizer and the data feed table.
  const filteredSolarObjects = useMemo(() => {
    return SOLAR_SYSTEM_OBJECTS.filter((o) => {
      // Planets always stay visible as a fixed reference frame, even while a
      // NEO size class or the planetoid category is isolated in the Helio map.
      if (o.type !== 'planet' && sizeCategoryFilter[o.type] === false) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          o.name.toLowerCase().includes(query) ||
          o.type.toLowerCase().includes(query));

      }
      return true;
    });
  }, [searchQuery, sizeCategoryFilter]);

  // Per-size-class capped + prioritized asteroid set — every size band is
  // capped at `objectLimitPerCategory` (default 100), keeping the closest
  // approaches and any Sentry impact-risk watch objects first so the most
  // relevant NEOs are never crowded out by the rest of the catalogue.
  const limitedAsteroidsByCategory = useMemo(() => {
    const groups: Record<string, Asteroid[]> = {};
    asteroids.forEach((a) => {
      const key = categorizeAsteroidSize(a.size).key;
      (groups[key] ||= []).push(a);
    });
    Object.keys(groups).forEach((key) => {
      groups[key] = [...groups[key]].
      sort((x, y) => {
        // Sentry watch objects always rank above non-Sentry; within each
        // tier, closer approaches (lower LD) rank higher.
        const scoreX = (x.sentry ? 1 : 0) * 1e6 - x.ld;
        const scoreY = (y.sentry ? 1 : 0) * 1e6 - y.ld;
        return scoreY - scoreX;
      }).
      slice(0, objectLimitPerCategory);
    });
    return groups;
  }, [asteroids, objectLimitPerCategory]);

  const limitedAsteroids = useMemo(
    () => Object.values(limitedAsteroidsByCategory).flat(),
    [limitedAsteroidsByCategory]
  );

  // Filtered Asteroids based on search (drawn from the capped/prioritized set)
  const filteredAsteroids = useMemo(() => {
    return limitedAsteroids.filter((a) =>
    a.des.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.date.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [limitedAsteroids, searchQuery]);

  // NEO size-class filtered set: same search box, but also gated by the size-category toggles
  const filteredSizeAsteroids = useMemo(() => {
    return filteredAsteroids.filter((a) => sizeCategoryFilter[categorizeAsteroidSize(a.size).key] !== false);
  }, [filteredAsteroids, sizeCategoryFilter]);

  // Helio map's own category-gated asteroid stream — same idea as
  // filteredSizeAsteroids, reused so the Helio DATA FEED can list matching
  // NEOs whenever a size class is isolated instead of always showing planets.
  const filteredHelioAsteroids = filteredSizeAsteroids;

  // NEO size-class counts (NASA CNEOS-style hazard bands) for the size map legend —
  // reflects the currently plotted (capped) set so the legend matches what's on screen.
  const sizeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    NEO_SIZE_CATEGORIES.forEach((c) => {
      counts[c.key] = 0;
    });
    limitedAsteroids.forEach((a) => {
      const cat = categorizeAsteroidSize(a.size);
      counts[cat.key] = (counts[cat.key] || 0) + 1;
    });
    return counts;
  }, [limitedAsteroids]);

  // Add log helper
  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev.slice(0, 15)]);
  };

  // Handle asteroid click
  const handleSelectAsteroid = (id: number, name: string) => {
    setSelectedObjectType('asteroid');
    setSelectedId(id);
    setShowDataFeed(true);
    setShowPropsPopup(true);
    addLog(`SELECTING OBJECT: ${name}`);
    addLog(`RECALCULATING ORBITAL PROPAGATION... OK`);
  };

  // Handle satellite click
  const handleSelectSatellite = (id: number) => {
    setSelectedObjectType('satellite');
    setSelectedSatelliteId(id);
    setShowDataFeed(true);
    setShowPropsPopup(true);
    addLog(`SELECTING SATELLITE: SAT-${id}`);
    addLog(`TRACKING ORBITAL TELEMETRY... OK`);
  };

  // Handle solar system object click
  const handleSelectSolarObject = (id: string, name: string) => {
    setSelectedObjectType('solar_system');
    setSelectedSolarObjectId(id);
    setShowDataFeed(true);
    setShowPropsPopup(true);
    addLog(`SELECTING PLANETARY BODY: ${name.toUpperCase()}`);
    addLog(`PROPAGATING PLANETARY ORBITAL TELEMETRY... OK`);
  };

  // Handle asteroid belt click
  const handleSelectBelt = () => {
    setSelectedObjectType('belt');
    setShowDataFeed(true);
    setShowPropsPopup(true);
    addLog('SELECTING REGION: MAIN ASTEROID BELT');
    addLog('AGGREGATING 260 TRACKED BELT MEMBERS... OK');
  };

  // Toggle satellite layer
  const toggleSatellite = (key: string) => {
    setSatelliteFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      addLog(`TOGGLE SATELLITE FILTER: ${key.toUpperCase()} -> ${next[key] ? 'ON' : 'OFF'}`);
      return next;
    });
  };

  // Toggle NEO size-class layer
  const toggleSizeCategory = (key: string) => {
    setSizeCategoryFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      addLog(`TOGGLE SIZE CLASS: ${key.toUpperCase()} -> ${next[key] ? 'ON' : 'OFF'}`);
      return next;
    });
  };

  // Helio map category click: isolates a single category (planet, planetoid,
  // or NEO size class) into the visualizer + data feed. Clicking the already-
  // isolated category clears the filter back to "show everything".
  const handleHelioCategoryClick = (key: string) => {
    setSizeCategoryFilter((prev) => {
      const isIsolated = HELIO_CATEGORY_KEYS.every((k) => prev[k] !== false === (k === key));
      const next: Record<string, boolean> = {};
      HELIO_CATEGORY_KEYS.forEach((k) => {
        next[k] = isIsolated ? true : k === key;
      });
      addLog(isIsolated ? 'SIZE/CATEGORY FILTER CLEARED — SHOWING ALL' : `ISOLATED CATEGORY: ${key.toUpperCase()}`);
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

  // Fetch the real NASA/JPL Sentry impact-risk catalogue once on mount, shared
  // between the Impact Risk Globe canvas and the categorized DATA FEED stream.
  useEffect(() => {
    let cancelled = false;
    fetch('/app-api/sentry').
    then((r) => r.json()).
    then((json) => {
      if (cancelled) return;
      if (json?.ok && Array.isArray(json.objects) && json.objects.length > 0) {
        setSentryObjects(json.objects);
        setSentrySourceLabel(`LIVE • ${json.objects.length}/${json.count ?? json.objects.length} REC`);
      } else {
        setSentrySourceLabel('CACHED SNAPSHOT · UPLINK EMPTY');
      }
    }).
    catch(() => {
      if (!cancelled) setSentrySourceLabel('CACHED SNAPSHOT · UPLINK OFFLINE');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the real NASA/JPL SBDB Close-Approach Data feed once on mount — this
  // replaces the procedural close-approach roster with real designations,
  // dates, distances, velocities, and magnitude-derived sizes across every
  // panel (Helio Map, Geocentric Map, Radar, NEO Size Class).
  useEffect(() => {
    let cancelled = false;
    fetch('/app-api/cad').
    then((r) => r.json()).
    then((json) => {
      if (cancelled) return;
      if (json?.ok && Array.isArray(json.objects) && json.objects.length > 0) {
        setAsteroids(mapCadToAsteroids(json.objects));
        setAsteroidSourceLabel(`LIVE • ${json.objects.length}/${json.count ?? json.objects.length} REC`);
        addLog(`JPL CAD 200 OK · ${json.objects.length} REC LIVE`);
      } else {
        setAsteroidSourceLabel('CACHED SNAPSHOT · UPLINK EMPTY');
      }
    }).
    catch(() => {
      if (!cancelled) setAsteroidSourceLabel('CACHED SNAPSHOT · UPLINK OFFLINE');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSentry = (idx: number) => {
    setSelectedObjectType('sentry');
    setSelectedSentryIdx(idx);
    setShowDataFeed(true);
    setShowPropsPopup(true);
    const obj = sentryObjects[idx];
    if (obj) addLog(`SELECTING IMPACT RISK: ${obj.des}`);
  };

  // NEO impact-risk category counts (Sentry Palermo-scale tiers) for the DATA FEED stream
  const sentryTierCounts = useMemo(() => {
    const counts: Record<string, number> = { SEVERE: 0, ELEVATED: 0, GUARDED: 0, LOW: 0, MINIMAL: 0 };
    sentryObjects.forEach((o) => {
      counts[riskTier(o.ps_cum).label] = (counts[riskTier(o.ps_cum).label] || 0) + 1;
    });
    return counts;
  }, [sentryObjects]);

  // Sorted chronologically by modeled monitoring-window offset — from today's
  // reference date toward the next upcoming impact predictions — instead of
  // grouped by risk tier, so the DATA FEED reads as a real approaching timeline.
  const filteredSentry = useMemo(() => {
    return sentryObjects.
    filter((o) => sentryTierFilter[riskTier(o.ps_cum).label] !== false).
    filter((o) =>
    o.des.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.fullname.toLowerCase().includes(searchQuery.toLowerCase())
    ).
    slice().
    sort((a, b) => deriveWindowOffsetDays(a.des) - deriveWindowOffsetDays(b.des));
  }, [sentryObjects, searchQuery, sentryTierFilter]);

  // Highest-urgency upcoming impact-risk objects for the top-of-panel alert
  // banner: ELEVATED+ tier, soonest modeled window first, top 3.
  const upcomingImpactAlerts = useMemo(() => {
    return sentryObjects.
    map((o, idx) => ({ o, idx, tier: riskTier(o.ps_cum), offsetDays: deriveWindowOffsetDays(o.des) })).
    filter((r) => r.tier.level >= 3 && r.offsetDays >= 0).
    sort((a, b) => b.tier.level - a.tier.level || a.offsetDays - b.offsetDays).
    slice(0, 3);
  }, [sentryObjects]);

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
    <div className="w-full h-auto min-h-full lg:h-full max-w-[1800px] mx-auto flex flex-col gap-1 text-xs font-mono select-none">
      
      {booting && <BootSequence onComplete={handleBootComplete} />}

      {/* MOBILE/TABLET TITLE BAR — the hero title + stats live inside an absolutely-positioned
                                                                  overlay on desktop, which the stacked mobile/tablet layout can clip. Below lg,
                                                                  the app name gets its own sticky strip at the very top instead; on tablet widths
                                                                  (md+) that strip also carries the source line, live stats, and footer detail
                                                                  that would otherwise only live in the hidden desktop hero panel. */}
      <div className="lg:hidden sticky top-0 z-30 flex flex-col gap-1.5 px-3 py-2 border border-glow-yellow rounded bg-space-black/95 backdrop-blur-md shadow-[0_0_15px_rgba(250,204,21,0.1)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div data-fuser-slot-id="mobile-title-eyebrow" className="text-[8px] tracking-[0.3em] text-space-muted font-bold">TACTICAL ORBITAL COMMAND</div>
            <h1
              data-fuser-slot-id="mobile-app-title"
              className="font-display uppercase text-glow-green leading-[0.82] tracking-tight text-[18px] sm:text-[32px] whitespace-nowrap"
              style={{ transform: 'scaleX(0.85)', transformOrigin: 'left center' }}>

              NEAR EARTH OBJECT ENCOUNTERS
            </h1>
          </div>

          {/* Tablet-only stats block — moved up beside the title at title height,
                                                                        right-aligned. Only the footer line stays below the divider. */}
          <div className="hidden md:flex md:flex-col gap-1 items-end shrink-0 text-right">
            <div className="flex items-center gap-3 text-[9px] tracking-wider">
              <span className="text-glow-green text-[11px] font-bold tabular-nums">{formattedDate}</span>
              <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                <span data-fuser-slot-id="tablet-title-earth" className="text-glow-green font-bold shrink-0">EARTH</span>
                <span data-fuser-slot-id="tablet-title-src" className="text-space-muted whitespace-nowrap">SRC JPL CNEOS • NASA SSD • SBDB</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[9px] tracking-wider text-space-muted">
              <div className="flex items-center gap-1.5 text-[8px] shrink-0 whitespace-nowrap">
                <span data-fuser-slot-id="tablet-title-sat-label" className="text-glow-green font-bold">SATELLITES</span>
                <span data-fuser-slot-id="section-text-185d2db0">CELESTRAK</span>
                <span className="text-space-orange/30">•</span>
                <span data-fuser-slot-id="tablet-title-ast-label" className="text-space-orange font-bold">ASTEROIDS</span>
                <span data-fuser-slot-id="section-text-4776bc39">JPL</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                TRACKED <span data-fuser-slot-id="tablet-title-tracked" className="text-space-orange font-bold">{asteroids.length}</span>
                <span className="text-space-orange/30 px-0.5">•</span>
                PLOTTED <span className="text-space-orange font-bold">22</span>
                <span className="text-space-orange/30 px-0.5">•</span>
                SENTRY <span className="text-space-orange font-bold">16</span>
                <span className="text-space-orange/30 px-0.5">•</span>
                SATS <span data-fuser-slot-id="tablet-title-activesats" className="text-glow-green font-bold">15,821</span>
              </div>
            </div>
          </div>

          <span className="w-1.5 h-1.5 rounded-full bg-[#10f3a5] animate-pulse shrink-0 md:hidden" />
        </div>

        {/* Tablet-only footer line — stats block above now lives beside the title. */}
        <div className="hidden md:flex md:flex-col gap-1.5 pt-1.5 border-t border-space-orange/20">
          <div className="flex items-center justify-between gap-3 text-[8px] text-space-muted border-t border-space-orange/10 pt-1">
            <span data-fuser-slot-id="section-text-0917a608" className="whitespace-nowrap">DRAG ORBIT • MOUSE WHEEL ZOOM | TRUE SCALE</span>
            <span data-fuser-slot-id="tablet-title-credit" className="whitespace-nowrap">CREATED BY <span data-fuser-slot-id="section-text-e5d374d9" className="text-white font-bold">Your Name</span> WITH fuser.studio</span>
          </div>
        </div>
      </div>

      {/* ==========================================
                                                                                                                                                MAIN GRID: SIDEBAR vs TERMINAL
                                                                                                                                               ========================================== */}
      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(200px,calc(25%-100px))_1fr] gap-1 flex-1 min-h-0 lg:h-full">
        
        {/* LEFT COLUMN: MAPS SIDEBAR (narrowed ~100px, min 200px) — on tablet (md) this
                                                                    row of mini maps drops below the main terminal as a 2x2 grid; on phone it
                                                                    stays a stacked column above the terminal; on desktop it's the left rail. */}
        <div className="order-1 md:order-2 lg:order-1 flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-col gap-1 h-auto lg:h-full min-h-0 min-w-0 lg:min-w-[200px] overflow-y-auto lg:overflow-visible pr-0.5 lg:pr-0">
          
          {/* MINI GEOCENTRIC MAP */}
          <div
            onClick={() => {
              setSelectedMap('geocentric');
              setSelectedObjectType('satellite');
              setSelectedSatelliteId(0);
              setSearchQuery('');
              addLog('PROJECTED GEOCENTRIC TELEMETRY TO MAIN PANEL');
            }}
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col h-[190px] md:h-[210px] lg:h-auto lg:flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
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
              <GeocentricCanvas satellites={allSatellites} filter={satelliteFilter} selectedSatelliteId={selectedSatelliteId} selectedObjectType={selectedObjectType} isMini={true} missionTime={missionTime} paused={selectedMap === 'geocentric'} />
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
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col h-[190px] md:h-[210px] lg:h-auto lg:flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
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
                asteroids={limitedAsteroids}
                missionTime={missionTime}
                selectedObjectType={selectedObjectType}
                selectedSolarObjectId={selectedSolarObjectId}
                categoryFilter={sizeCategoryFilter}
                isMini={true}
                paused={selectedMap === 'helio'} />
              
            </div>
          </div>

          {/* MINI IMPACT RISK GLOBE */}
          <div
            onClick={() => {
              setSelectedMap('radar');
              setSelectedObjectType('asteroid');
              setSelectedId(0);
              setSearchQuery('');
              addLog('PROJECTED IMPACT RISK GLOBE TO MAIN PANEL');
            }}
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col h-[190px] md:h-[210px] lg:h-auto lg:flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
            selectedMap === 'radar' ? 'border-glow-green shadow-[0_0_15px_rgba(16,243,165,0.25)]' : 'border-glow-yellow hover:border-glow-green'}`
            }>
            
            <div data-fuser-slot-id="section-text-353e30bc" className={`absolute top-2 left-2 border px-2 py-0.5 rounded text-[9px] font-bold tracking-wider bg-space-black z-10 transition-colors ${
            selectedMap === 'radar' ? 'border-glow-green text-space-accent' : 'border-glow-yellow text-space-yellow group-hover:text-space-accent group-hover:border-glow-green'}`
            }>
              IMPACT RISK GLOBE • {selectedMap === 'radar' ? 'ACTIVE MAIN' : 'PROJECT TO MAIN'}
            </div>
            
            <button data-fuser-slot-id="section-button-text-ff2538c8"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal('radar');
              addLog('OPENING DETAILED IMPACT RISK GLOBE...');
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
              <ImpactRiskGlobe isMini={true} missionTime={missionTime} objects={sentryObjects} selectedIdx={selectedSentryIdx} onSelect={handleSelectSentry} sourceLabel={sentrySourceLabel} paused={selectedMap === 'radar'} />
            </div>
          </div>

          {/* MINI NEO SIZE CLASS MAP */}
          <div
            onClick={() => {
              setSelectedMap('sizemap');
              setSelectedObjectType('asteroid');
              setSelectedId(0);
              setSearchQuery('');
              addLog('PROJECTED NEO SIZE-CLASS MAP TO MAIN PANEL');
            }}
            className={`group border rounded p-2 bg-space-card relative overflow-hidden flex flex-col h-[190px] md:h-[210px] lg:h-auto lg:flex-1 min-h-0 cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
            selectedMap === 'sizemap' ? 'border-glow-green shadow-[0_0_15px_rgba(16,243,165,0.25)]' : 'border-glow-yellow hover:border-glow-green'}`
            }>

            <div data-fuser-slot-id="section-text-sizemap-badge" className={`absolute top-2 left-2 border px-2 py-0.5 rounded text-[9px] font-bold tracking-wider bg-space-black z-10 transition-colors ${
            selectedMap === 'sizemap' ? 'border-glow-green text-space-accent' : 'border-glow-yellow text-space-yellow group-hover:text-space-accent group-hover:border-glow-green'}`
            }>
              IMPACT SIMULATOR • {selectedMap === 'sizemap' ? 'ACTIVE MAIN' : 'PROJECT TO MAIN'}
            </div>

            <button data-fuser-slot-id="section-button-text-sizemap-expand"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal('sizemap');
              addLog('OPENING IMPACT SIMULATOR...');
            }}
            className="absolute top-2 right-2 border border-glow-yellow hover:border-glow-green px-2 py-0.5 rounded text-space-yellow hover:text-space-accent text-[9px] font-bold tracking-wider bg-space-black z-30 transition-colors pointer-events-auto">

              [EXPAND]
            </button>

            {/* Hover overlay indicator */}
            <div className="absolute inset-0 bg-space-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex items-center justify-center">
              <span data-fuser-slot-id="section-text-sizemap-hover" className="text-space-accent font-bold text-[10px] tracking-widest bg-space-black/95 px-3 py-1.5 border border-space-accent rounded shadow-[0_0_10px_rgba(16,243,165,0.4)]">
                PROJECT TO MAIN SCREEN
              </span>
            </div>

            {/* Compact target readout, styled after the satellite key overlay */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10 flex flex-wrap gap-x-2 gap-y-0.5 pointer-events-none bg-space-black/70 rounded px-1.5 py-1 border border-space-orange/10">
              <span data-fuser-slot-id="section-text-impactsim-mini-label" className="text-[8px] text-space-muted font-bold">TARGET <span data-fuser-slot-id="section-text-11b6c0ee" className="text-white">{selectedAsteroid.des}</span> · {selectedAsteroid.size} · {selectedAsteroid.kms} KM/S</span>
            </div>

            <div className="flex-1 mt-4 mb-6 relative overflow-hidden pointer-events-none">
              <ImpactSimulator selectedAsteroid={selectedAsteroid} isMini={true} paused={selectedMap === 'sizemap'} />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN TERMINAL */}
        <div className="order-2 md:order-1 lg:order-2 flex flex-col gap-1 h-[560px] md:h-[520px] lg:h-full min-h-0 relative border border-glow-yellow rounded bg-space-card overflow-hidden">
          
          {/* HIGH-DEFINITION INTERACTIVE BACKGROUND MAP */}
          <div className="absolute inset-0 w-full h-full z-0 opacity-100 transition-opacity duration-500">
            {selectedMap === 'geocentric' &&
            <GeocentricCanvas satellites={allSatellites} filter={satelliteFilter} selectedSatelliteId={selectedSatelliteId} selectedObjectType={selectedObjectType} onSelectSatellite={handleSelectSatellite} missionTime={missionTime} />
            }
            {selectedMap === 'helio' &&
            <HelioCanvas
              selectedAsteroid={selectedAsteroid}
              asteroids={limitedAsteroids}
              missionTime={missionTime}
              onSelectAsteroid={handleSelectAsteroid}
              selectedObjectType={selectedObjectType}
              selectedSolarObjectId={selectedSolarObjectId}
              onSelectSolarObject={handleSelectSolarObject}
              categoryFilter={sizeCategoryFilter} />

            }
            {selectedMap === 'radar' &&
            <ImpactRiskGlobe missionTime={missionTime} objects={sentryObjects} selectedIdx={selectedSentryIdx} onSelect={handleSelectSentry} sourceLabel={sentrySourceLabel} />
            }
            {selectedMap === 'sizemap' &&
            <ImpactSimulator selectedAsteroid={selectedAsteroid} onLog={addLog} onResult={handleImpactSimResult} />
            }
          </div>

          {/* OVERLAYS CONTAINER (using pointer-events-none so user can click/drag background map) */}
          <div className="absolute inset-0 flex flex-col gap-1 p-2 z-10 pointer-events-none h-full overflow-hidden">

            {/* PROXIMITY / IMPACT-RISK ALERT BANNER (TOP OF PANEL, RADAR VIEW ONLY) */}
            {/* Docked top-right (not centered) so it never overlaps the MAP
                   PROJECTION DESC panel or OBJECT PROPERTIES panel, which both
                   anchor top/left. Icon badge is a MAGI-style wireframe hex-node
                   glyph matching the orange/red tactical-HUD logo reference. */}
            {selectedMap === 'radar' && upcomingImpactAlerts.length > 0 &&
            <div className="absolute top-2 right-2 z-30 pointer-events-auto w-[172px] sm:w-[250px] md:w-[300px] max-h-[calc(100%-1rem)] rounded-sm border border-red-500/70 bg-red-950/70 backdrop-blur-[3px] shadow-[0_0_18px_rgba(239,68,68,0.4)] overflow-hidden flex flex-col">
                <div className="flex items-center gap-1.5 px-2 py-1 border-b border-red-500/40 bg-red-500/10 shrink-0">
                  <svg viewBox="0 0 32 32" className="w-4 h-4 shrink-0" style={{ filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.9))' }} aria-hidden="true">
                    <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke="#ef4444" strokeWidth="1.4" />
                    <polygon points="16,8 22,11.5 22,18.5 16,22 10,18.5 10,11.5" fill="rgba(239,68,68,0.15)" stroke="#fca5a5" strokeWidth="1" />
                    <circle cx="16" cy="15" r="1.6" fill="#fca5a5" />
                    <line x1="16" y1="2" x2="16" y2="8" stroke="#ef4444" strokeWidth="1" />
                    <line x1="4" y1="9" x2="10" y2="11.5" stroke="#ef4444" strokeWidth="1" />
                    <line x1="28" y1="9" x2="22" y2="11.5" stroke="#ef4444" strokeWidth="1" />
                  </svg>
                  <span data-fuser-slot-id="section-text-alert-title" className="text-[8px] sm:text-[9px] font-bold tracking-[0.15em] sm:tracking-[0.2em] text-red-300 uppercase truncate">Próximos Impactos</span>
                  <span data-fuser-slot-id="section-text-alert-count" className="ml-auto text-[7px] sm:text-[8px] text-red-300/70 font-bold shrink-0 whitespace-nowrap">{sentryObjects.filter((o) => riskTier(o.ps_cum).level >= 3).length} ELEV+</span>
                </div>
                <div className="flex flex-col divide-y divide-red-500/15 overflow-y-auto">
                  {upcomingImpactAlerts.map(({ o, idx, tier, offsetDays }) => {
                  const nextDate = new Date(Date.now() + offsetDays * 86400000);
                  return (
                    <button
                      key={o.des}
                      data-fuser-slot-id={`section-alert-row-${o.des}`}
                      onClick={() => handleSelectSentry(idx)}
                      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 py-1 text-left hover:bg-red-500/10 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.color, boxShadow: `0 0 5px ${tier.color}` }} />
                        <span className="text-[9px] sm:text-[10px] font-bold text-white shrink-0">{o.des}</span>
                        <span className="text-[7px] sm:text-[8px] font-bold shrink-0 uppercase" style={{ color: tier.color }}>{tier.label}</span>
                        <span data-fuser-slot-id="section-text-8ac3569e" className="text-[8px] text-space-muted/80 truncate hidden md:inline">PS(CUM) {o.ps_cum.toFixed(2)} · IP {o.ip.toExponential(1)}</span>
                        <span data-fuser-slot-id="section-text-64723e76" className="ml-auto text-[7px] sm:text-[8px] font-bold text-yellow-300 shrink-0 whitespace-nowrap">{nextDate.toISOString().slice(0, 10)}</span>
                      </button>);

                })}
                </div>
              </div>
            }

            {/* FLOATING MAP DESCRIPTION PANEL (UPPER LEFT CORNER) — retractable:
                  collapses to just its header strip so it can be tucked away
                  over dense views like the Impact Simulator. */}
            <div className="hidden sm:flex absolute top-2 left-2 z-20 pointer-events-auto max-w-[280px] md:w-[30%] md:max-w-[30%] rounded-none p-2.5 bg-black/50 backdrop-blur-[3px] transition-all duration-300 flex-col gap-1 shadow-[0_0_15px_rgba(250,204,21,0.15)]">
              <button data-fuser-slot-id="section-button-mapdesc-toggle"
              onClick={() => setMapDescCollapsed((v) => !v)}
              className="flex items-center justify-between border-b border-space-orange/20 pb-1 w-full text-left group/mapdesc">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10f3a5] animate-pulse" />
                  <span data-fuser-slot-id="section-text-d02416d0" className="text-[9px] text-space-orange font-bold tracking-widest uppercase">MAP PROJECTION DESC</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span data-fuser-slot-id="section-text-3a1189c1" className="text-[8px] text-space-muted font-bold">SYS.REF // {selectedMap.toUpperCase()}</span>
                  <span className="text-[9px] font-bold text-space-yellow group-hover/mapdesc:text-glow-green transition-colors">{mapDescCollapsed ? '[+]' : '[–]'}</span>
                </div>
              </button>
              <div className={`overflow-hidden transition-all duration-300 flex flex-col gap-1 ${mapDescCollapsed ? 'max-h-0 opacity-0' : 'max-h-[220px] opacity-100 mt-1'}`}>
                <div className="text-[11px] font-bold text-glow-green uppercase tracking-wide">
                  {selectedMap === 'geocentric' && 'GEOCENTRIC ORBITAL DENSITY'}
                  {selectedMap === 'helio' && 'HELIOCENTRIC SYSTEM ORBITS'}
                  {selectedMap === 'radar' && 'HEXGRID IMPACT-RISK PROJECTION'}
                  {selectedMap === 'sizemap' && 'EARTH IMPACT SIMULATOR'}
                </div>
                <p className="text-[10px] text-space-muted leading-relaxed">
                  {selectedMap === 'geocentric' && 'Monitors near-Earth space traffic, tracking 15,821 active satellites (LEO, MEO, GEO belts) and lunar orbital intersections. Essential for analyzing collision risks and orbital clustering.'}
                  {selectedMap === 'helio' && 'Visualizes the inner solar system planetary orbits (Mercury to Saturn) and plots Keplerian trajectories of Near-Earth Asteroids (NEOs). Used to calculate long-term orbital resonances and planetary flybys.'}
                  {selectedMap === 'radar' && 'Live honeycomb-tessellated 3D Earth globe with dashed 1,000km atmosphere-layer shells and approach-trajectory corridors, plotting NASA/JPL Sentry impact-risk objects — real cumulative impact probability, Palermo scale, and potential-impact windows sourced from ssd-api.jpl.nasa.gov.'}
                  {selectedMap === 'sizemap' && 'Models a ground or ocean strike from the selected tracked NEO. Click the world map to place the impact point; tune diameter, velocity, angle, and composition, then read live crater size, thermal and blast-damage radii, and estimated seismic magnitude — computed from published crater-scaling and blast-effects physics, plotted on real Natural Earth coastline data.'}
                </p>
                <div className="border-t border-space-orange/10 pt-1 mt-0.5 flex flex-wrap gap-x-2 text-[8px] text-space-muted/80">
                  <span>PROJ: <span className="text-white">{selectedMap === 'geocentric' ? 'GEOCENTRIC 3D' : selectedMap === 'helio' ? 'HELIOCENTRIC' : selectedMap === 'sizemap' ? 'EQUIRECTANGULAR · CLICK-TO-IMPACT' : 'AZIMUTHAL RADIAL'}</span></span>
                  <span>RANGE: <span className="text-white">{selectedMap === 'geocentric' ? '384,400 KM' : selectedMap === 'helio' ? '35.0 AU' : selectedMap === 'sizemap' ? 'GLOBAL' : '20.0 LD'}</span></span>
                </div>
              </div>
            </div>

            {/* SELECTED OBJECT PROPERTIES PANEL (LEFT SIDE OF MAIN SCREEN) */}
            {showPropsPopup &&
            <div className="absolute left-2 top-2 bottom-2 md:top-1/2 md:bottom-auto md:-translate-y-1/2 z-20 pointer-events-auto w-[calc(100%-1rem)] max-w-[230px] md:w-[30%] md:max-w-[30%] max-h-[calc(100%-16px)] overflow-y-auto rounded-none p-2.5 bg-black/70 backdrop-blur-[3px] flex flex-col gap-1.5 border border-glow-yellow/60 shadow-[0_0_18px_rgba(250,204,21,0.18)] transition-all duration-300">
                <div className="flex items-center justify-between border-b border-space-orange/20 pb-1 sticky -top-2.5 -mx-2.5 px-2.5 pt-2.5 bg-black/80 backdrop-blur-[3px] z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10f3a5] animate-pulse" />
                    <span data-fuser-slot-id="section-text-2f68a97a" className="text-[9px] text-space-orange font-bold tracking-widest uppercase">OBJECT PROPERTIES</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button data-fuser-slot-id="section-button-objprops-toggle"
                  onClick={() => setObjPropsCollapsed((v) => !v)}
                  className="text-[9px] font-bold text-space-yellow hover:text-glow-green transition-colors">
                      {objPropsCollapsed ? '[+]' : '[–]'}
                    </button>
                    <button data-fuser-slot-id="section-button-text-d467272d"
                  onClick={() => {
                    setShowPropsPopup(false);
                    addLog('CLOSED OBJECT PROPERTIES PANEL');
                  }}
                  className="text-[9px] font-bold text-space-yellow hover:text-glow-green transition-colors">
                      [X]
                    </button>
                  </div>
                </div>

                {/* Prominent name block — every selection type gets an explicit kind
                eyebrow plus its real designation/name, so the panel is never unlabeled */}
                <div className={`flex-col gap-0.5 pb-1.5 border-b border-space-orange/10 ${objPropsCollapsed ? 'hidden' : 'flex'}`}>
                  <span data-fuser-slot-id="section-text-props-kind" className="text-[8px] text-space-muted tracking-widest font-bold uppercase">{propsPanelInfo.kind}</span>
                  <span data-fuser-slot-id="section-text-props-name" className="text-sm font-bold text-glow-green uppercase tracking-wide leading-tight break-words">{propsPanelInfo.name}</span>
                </div>

                {!objPropsCollapsed && (selectedObjectType === 'solar_system' ?
              <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-b2bb4638" className="text-[9px] text-space-muted">TYPE</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSolarObject.type.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-2af9fba4" className="text-[9px] text-space-muted">DIAMETER</span>
                      <span data-fuser-slot-id="section-text-2f2d51d6" className="text-[10px] font-bold text-white text-right">{selectedSolarObject.size}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-fad7e52f" className="text-[9px] text-space-muted">ORBIT DISTANCE</span>
                      <span data-fuser-slot-id="section-text-9f3cc3cf" className="text-[10px] font-bold text-white text-right">{selectedSolarObject.orbit.a.toFixed(3)} AU</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-d43321ee" className="text-[9px] text-space-muted">ORBITAL PERIOD</span>
                      <span data-fuser-slot-id="section-text-b0dc286f" className="text-[10px] font-bold text-white text-right">{selectedSolarObject.orbit.period.toFixed(1)} D</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-03b9e198" className="text-[9px] text-space-muted">MOONS / TEMP</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSolarObject.details.moons} / {selectedSolarObject.details.temp}</span>
                    </div>
                  </div> :
              selectedObjectType === 'satellite' ?
              <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-d25e0109" className="text-[9px] text-space-muted">CATEGORY</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSatellite.category.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-7bc16118" className="text-[9px] text-space-muted">ORBIT ALTITUDE</span>
                      <span data-fuser-slot-id="section-text-88f8c47b" className="text-[10px] font-bold text-white text-right">{Math.round(selectedSatellite.radius * 100)} KM</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-f49f78e4" className="text-[9px] text-space-muted">INCLINATION</span>
                      <span className="text-[10px] font-bold text-white text-right">{(selectedSatellite.inclination * 180 / Math.PI).toFixed(1)}°</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-45d0135b" className="text-[9px] text-space-muted">SPEED</span>
                      <span data-fuser-slot-id="section-text-5fd3d24c" className="text-[10px] font-bold text-white text-right">{(selectedSatellite.speed * 1000).toFixed(1)} KM/S</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-612defb7" className="text-[9px] text-space-muted">ORBITAL PERIOD</span>
                      <span data-fuser-slot-id="section-text-18a38174" className="text-[10px] font-bold text-white text-right">{Math.round(2 * Math.PI * (selectedSatellite.radius * 100 + 6371) / (selectedSatellite.speed * 1000) / 60)} MIN</span>
                    </div>
                  </div> :
              selectedObjectType === 'belt' ?
              <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-8c435878" className="text-[9px] text-space-muted">LOCATION</span>
                      <span data-fuser-slot-id="section-text-a0ff82c8" className="text-[10px] font-bold text-white text-right">MARS ↔ JUPITER</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-6826d205" className="text-[9px] text-space-muted">BAND RANGE</span>
                      <span data-fuser-slot-id="section-text-69b3130e" className="text-[10px] font-bold text-white text-right">2.06 – 3.28 AU</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-bd2268aa" className="text-[9px] text-space-muted">TRACKED MEMBERS</span>
                      <span data-fuser-slot-id="section-text-8e45b388" className="text-[10px] font-bold text-white text-right">260 RENDERED</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-c8fe9a55" className="text-[9px] text-space-muted">EST. TOTAL POPULATION</span>
                      <span data-fuser-slot-id="section-text-1e5c96a8" className="text-[10px] font-bold text-white text-right">1.1M+ &gt;1KM</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-5b5a7018" className="text-[9px] text-space-muted">COMPOSITION</span>
                      <span data-fuser-slot-id="section-text-a477423c" className="text-[10px] font-bold text-white text-right">C / S / M TYPE</span>
                    </div>
                    <p data-fuser-slot-id="section-body-b0dd1ed8" className="text-[9px] text-space-muted leading-relaxed border-t border-space-orange/10 pt-1.5 mt-0.5">
                      A debris ring of rocky planetesimals left over from solar system formation, held in place by Jupiter's gravity. Largest member is the dwarf planet Ceres (~940 KM). Sparse enough that spacecraft cross it routinely without collision risk.
                    </p>
                  </div> :
              selectedObjectType === 'sentry' ?
              <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-fullname" className="text-[9px] text-space-muted">FULL DESIGNATION</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject?.fullname ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-tier" className="text-[9px] text-space-muted">RISK TIER</span>
                      <span className="text-[10px] font-bold text-right" style={{ color: riskTier(selectedSentryObject?.ps_cum ?? -99).color }}>{riskTier(selectedSentryObject?.ps_cum ?? -99).label}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-ip" className="text-[9px] text-space-muted">CUM. IMPACT PROB.</span>
                      <span className="text-[10px] font-bold text-glow-green text-right">{selectedSentryObject ? selectedSentryObject.ip.toExponential(2) : '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-ps" className="text-[9px] text-space-muted">PALERMO SCALE (CUM/MAX)</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject ? `${selectedSentryObject.ps_cum.toFixed(2)} / ${selectedSentryObject.ps_max.toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-diameter" className="text-[9px] text-space-muted">EST. DIAMETER</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject ? `${selectedSentryObject.diameter.toFixed(3)} KM` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-vinf" className="text-[9px] text-space-muted">IMPACT VELOCITY</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject ? `${selectedSentryObject.v_inf.toFixed(2)} KM/S` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-nimp" className="text-[9px] text-space-muted">POTENTIAL IMPACTS</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject?.n_imp ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-range" className="text-[9px] text-space-muted">MONITORING WINDOW</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject?.range ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-sentry-lastobs" className="text-[9px] text-space-muted">LAST OBSERVED</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedSentryObject?.last_obs ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 border-t border-space-orange/10 pt-1.5 mt-0.5">
                      <span data-fuser-slot-id="section-text-sentry-groundtrack" className="text-[9px] text-space-muted">GROUND TRACK (MODELED)</span>
                      <span className="text-[10px] font-bold text-space-orange text-right">
                        {selectedSentryObject ? (() => {
                      const gt = impactLatLon(selectedSentryObject.des);
                      return `${gt.lat >= 0 ? gt.lat.toFixed(2) + '°N' : (-gt.lat).toFixed(2) + '°S'} ${gt.lon >= 0 ? gt.lon.toFixed(2) + '°E' : (-gt.lon).toFixed(2) + '°W'}`;
                    })() : '—'}
                      </span>
                    </div>
                  </div> :

              <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-bbee9412" className="text-[9px] text-space-muted">APPROACH DATE</span>
                      <span className="text-[10px] font-bold text-white text-right">{selectedAsteroid.date}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-446469de" className="text-[9px] text-space-muted">CLOSEST APPROACH</span>
                      <span data-fuser-slot-id="section-text-593d2c04" className="text-[10px] font-bold text-white text-right">{selectedAsteroid.ld} LD</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-e75ad6f6" className="text-[9px] text-space-muted">DISTANCE</span>
                      <span data-fuser-slot-id="section-text-7cfaf02e" className="text-[10px] font-bold text-white text-right">{selectedAsteroid.km.toLocaleString()} KM</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-5ab1e014" className="text-[9px] text-space-muted">VELOCITY</span>
                      <span data-fuser-slot-id="section-text-e5d6e3d5" className="text-[10px] font-bold text-white text-right">{selectedAsteroid.kms} KM/S</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-0dcdcbe3" className="text-[9px] text-space-muted">EST. DIAMETER</span>
                      <span data-fuser-slot-id="section-text-c8373d0d" className="text-[10px] font-bold text-white text-right">{selectedAsteroid.size}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span data-fuser-slot-id="section-text-7d1ce553" className="text-[9px] text-space-muted">SENTRY WATCH</span>
                      <span className={`text-[10px] font-bold text-right ${selectedAsteroid.sentry ? 'text-red-500' : 'text-white'}`}>{selectedAsteroid.sentry ? '▲ ACTIVE' : 'NONE'}</span>
                    </div>
                  </div>)
              }
              </div>
            }

            {/* HERO TITLE & STATS PANEL — desktop only; below lg this same content is
                                                                          folded into the sticky mobile/tablet title bar above the main grid instead. */}
            <div className={`hidden lg:flex lg:relative lg:w-full self-end rounded-none p-3 bg-black/50 backdrop-blur-[3px] overflow-hidden flex-col justify-between flex-shrink-0 pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${heroCollapsed ? 'h-auto min-h-0 py-2' : showDataFeed ? 'lg:max-w-[26%] h-auto min-h-0 py-2' : 'lg:max-w-[30%] h-auto min-h-[170px]'}`}>
              {/* Background Grid & Space Graphic */}
              <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-space-accent via-transparent to-transparent pointer-events-none" />



              {/* Header Title */}
              <div className="relative z-10 flex flex-col">
                <div className="text-left flex items-start justify-between gap-2">
                  <div className="min-w-0">
                  <div data-fuser-slot-id="section-text-93fd5f81" className={`text-[9px] text-space-muted tracking-widest font-bold overflow-hidden transition-all duration-300 ${showDataFeed || heroCollapsed ? 'max-h-0 opacity-0' : 'max-h-6 opacity-100'}`}>
                    SEKHMET ORBITAL COMMAND • PROJECT: {selectedMap.toUpperCase()}
                  </div>
                  <h1 data-fuser-slot-id="section-title-7acc9962" className={`text-glow-green font-display w-full tracking-tight font-bold uppercase transform scale-x-[0.85] scale-y-[1.1] origin-left inline-block whitespace-nowrap transition-all duration-300 ${showDataFeed || heroCollapsed ? 'text-[18px] leading-[0.85] mt-0' : 'text-[28px] sm:text-[32px] leading-[0.85] mt-1'}`}>
                    {showDataFeed || heroCollapsed ? <>NEAR EARTH OBJECT ENCOUNTERS</> : <>NEAR EARTH<br />OBJECT<br />ENCOUNTERS</>}
                  </h1>
                  </div>
                  <button data-fuser-slot-id="section-button-hero-toggle"
                  onClick={() => setHeroCollapsed((v) => !v)}
                  className="shrink-0 text-[9px] font-bold text-space-yellow hover:text-glow-green transition-colors mt-0.5">
                    {heroCollapsed ? '[+]' : '[–]'}
                  </button>
                </div>
                
                {/* Source Line with EARTH in green */}
                <div className={`flex items-center gap-1.5 text-[10px] tracking-wider overflow-hidden transition-all duration-300 ${heroCollapsed ? 'max-h-0 opacity-0 mt-0' : 'max-h-6 opacity-100 mt-1.5'}`}>
                  <span data-fuser-slot-id="section-text-8fe290aa" className="text-glow-green font-bold">EARTH</span>
                  <span data-fuser-slot-id="section-text-8e1f4c1b" className="text-space-muted">SRC JPL CNEOS • NASA SSD • SBDB</span>
                </div>
              </div>

              {/* Live Stats as a single line matching the mockup — collapses away when the data feed is open */}
              <div className={`relative z-10 text-[10px] tracking-wider text-space-muted overflow-hidden transition-all duration-300 ${showDataFeed || heroCollapsed ? 'max-h-0 opacity-0 py-0 my-0 border-transparent' : 'max-h-10 opacity-100 py-1.5 my-1 border-t border-b border-space-orange/20'}`}>
                TRACKED <span data-fuser-slot-id="section-text-8bd1d489" className="text-space-orange font-bold">{asteroids.length}</span> • PLOTTED <span className="text-space-orange font-bold">22</span> • SENTRY WATCH <span className="text-space-orange font-bold">16</span> • ACTIVE SATS <span data-fuser-slot-id="section-text-88b96a26" className="text-glow-green font-bold">15,821</span>
              </div>

              {/* Footer of Top Right Panel — collapses away when the data feed is open */}
              <div className={`relative z-10 flex flex-col items-start text-[9px] text-space-muted gap-1 overflow-hidden transition-all duration-300 ${showDataFeed || heroCollapsed ? 'max-h-0 opacity-0' : 'max-h-16 opacity-100 mt-1'}`}>
                <div className="space-y-0.5">
                  <div className="text-glow-green text-xs font-bold">{formattedDate}</div>
                  <div className="text-[8px]">DRAG ORBIT • MOUSE WHEEL ZOOM | TRUE SCALE | <span data-fuser-slot-id="section-text-be6cddd4" className="text-glow-green font-bold">SATELLITES</span> CELESTRAK • <span data-fuser-slot-id="section-text-8b1f4762" className="text-space-orange font-bold">ASTEROIDS</span> JPL</div>
                </div>
                <div className="text-left text-[8px] whitespace-nowrap">
                  CREATED BY <span data-fuser-slot-id="section-text-72457109" className="text-white font-bold">Your Name</span> WITH fuser.studio
                </div>
              </div>
            </div>

            {/* DATA FEED & SELECTED OBJECT DETAIL */}
            {showDataFeed ?
            <div className={`w-full md:max-w-[40%] lg:max-w-[38%] self-end border border-glow-yellow/70 rounded p-2.5 bg-space-black/50 md:bg-space-black/30 lg:bg-space-black/50 backdrop-blur-[3px] flex flex-col flex-1 min-h-0 justify-between pointer-events-auto hover:border-glow-green/70 transition-all duration-300 ${selectedMap === 'radar' ? 'mb-14 sm:mb-16' : ''}`}>
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
                    selectedMap === 'helio' ? `HELIOCENTRIC STREAM • ${filteredSolarObjects.length} BODIES / ${filteredHelioAsteroids.length} NEO` :
                    selectedMap === 'sizemap' ? `NEO SIZE-CLASS STREAM • ${filteredSizeAsteroids.length}/${filteredAsteroids.length} OBJ` :
                    selectedMap === 'radar' ? `IMPACT RISK STREAM • ${filteredSentry.length} SENTRY OBJ` :
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

                  {selectedMap === 'geocentric' &&
                <div className="flex flex-wrap gap-1 bg-space-black/60 p-1.5 border border-space-orange/15 rounded">
                      {['all', 'starlink', 'oneweb', 'weather', 'gps', 'geobelt', 'other'].map((cat) =>
                  <button data-fuser-slot-id={{ "all": "section-text-d0bf8b0b", "starlink": "section-text-fc241f8b", "oneweb": "section-text-7c28c113", "weather": "section-text-c7a8cf46", "gps": "section-text-2ddd1b0b", "geobelt": "section-text-428505f8", "other": "section-text-bd0a5153" }[cat]}
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${
                  selectedCategoryFilter === cat ?
                  'bg-space-orange text-white' :
                  'bg-space-black/60 text-space-muted hover:text-white border border-space-orange/10'}`
                  }>
                    
                          {cat}
                        </button>
                  )}
                    </div>
                }

                  {selectedMap === 'radar' &&
                <div className="flex flex-wrap gap-1.5 bg-space-black/60 p-1.5 border border-space-orange/15 rounded">
                      {(['SEVERE', 'ELEVATED', 'GUARDED', 'LOW', 'MINIMAL'] as const).map((tierLabel) => {
                    const tierColor = riskTier(tierLabel === 'SEVERE' ? -1 : tierLabel === 'ELEVATED' ? -3 : tierLabel === 'GUARDED' ? -4.5 : tierLabel === 'LOW' ? -6 : -7).color;
                    return (
                      <span data-fuser-slot-id={{ "SEVERE": "section-text-d59c38aa", "ELEVATED": "section-text-2ca72df1", "GUARDED": "section-text-b64a9c84", "LOW": "section-text-2cf9445f", "MINIMAL": "section-text-79428677" }[tierLabel]} key={tierLabel} className="flex items-center gap-1 text-[8px] font-bold uppercase" style={{ color: tierColor }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tierColor, boxShadow: `0 0 4px ${tierColor}` }} />
                            {tierLabel} <span className="text-white">{sentryTierCounts[tierLabel] ?? 0}</span>
                          </span>);

                  })}
                    </div>
                }

                  {(selectedMap === 'sizemap' || selectedMap === 'helio') &&
                <div className="flex flex-wrap items-center gap-1 bg-space-black/60 p-1.5 border border-space-orange/15 rounded">
                      {selectedMap === 'helio' &&
                  <span data-fuser-slot-id="section-text-helio-sizekey-label" className="text-[8px] text-space-muted font-bold tracking-wider mr-0.5">SIZE CLASS ▸</span>
                  }
                      {selectedMap === 'helio' && SOLAR_BODY_CATEGORIES.map((cat) =>
                  <button data-fuser-slot-id={{ "planet": "section-text-e6e10884", "planetoid": "section-text-c604c4af" }[cat.key]}
                  key={cat.key}
                  onClick={() => handleHelioCategoryClick(cat.key)}
                  title={cat.range}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all border ${
                  sizeCategoryFilter[cat.key] !== false ?
                  'text-white border-space-orange/10' :
                  'text-space-muted/50 border-space-orange/5 opacity-50'}`
                  }
                  style={sizeCategoryFilter[cat.key] !== false ? { background: `${cat.color}22`, borderColor: `${cat.color}55` } : undefined}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color, boxShadow: sizeCategoryFilter[cat.key] !== false ? `0 0 4px ${cat.color}` : 'none' }} />
                          <span style={{ color: cat.color }}>{cat.key === 'planet' ? '◉' : '◎'}</span>
                          {cat.label}
                        </button>
                  )}
                      {NEO_SIZE_CATEGORIES.map((cat) =>
                  <button data-fuser-slot-id={{ "small": "section-text-0d396573", "medium": "section-text-c4c0c963", "large": "section-text-28a82644", "major": "section-text-205f2f0f" }[cat.key]}
                  key={cat.key}
                  onClick={() => selectedMap === 'helio' ? handleHelioCategoryClick(cat.key) : toggleSizeCategory(cat.key)}
                  title={cat.range}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all border ${
                  sizeCategoryFilter[cat.key] !== false ?
                  'text-white border-space-orange/10' :
                  'text-space-muted/50 border-space-orange/5 opacity-50'}`
                  }
                  style={sizeCategoryFilter[cat.key] !== false ? { background: `${cat.color}22`, borderColor: `${cat.color}55` } : undefined}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color, boxShadow: sizeCategoryFilter[cat.key] !== false ? `0 0 4px ${cat.color}` : 'none' }} />
                          {selectedMap === 'helio' &&
                    <span style={{ color: cat.color }}>{{ small: '●', medium: '◆', large: '■', major: '✦' }[cat.key]}</span>
                    }
                          {cat.key}
                        </button>
                  )}
                      <div className="flex items-center gap-1 ml-auto pl-1.5 border-l border-space-orange/15">
                        <span data-fuser-slot-id="section-text-object-limit-label" className="text-[8px] text-space-muted font-bold tracking-wider whitespace-nowrap">CAP/CLASS</span>
                        <button data-fuser-slot-id="section-button-text-635a9890"
                    onClick={() => setObjectLimitPerCategory((v) => Math.max(10, v - 25))}
                    className="w-4 h-4 flex items-center justify-center rounded border border-space-orange/20 text-space-yellow hover:border-glow-green hover:text-glow-green text-[9px] font-bold leading-none">
                          −
                        </button>
                        <span className="text-[9px] text-white font-bold tabular-nums w-6 text-center">{objectLimitPerCategory}</span>
                        <button data-fuser-slot-id="section-button-text-2ef2ef6a"
                    onClick={() => setObjectLimitPerCategory((v) => Math.min(500, v + 25))}
                    className="w-4 h-4 flex items-center justify-center rounded border border-space-orange/20 text-space-yellow hover:border-glow-green hover:text-glow-green text-[9px] font-bold leading-none">
                          +
                        </button>
                      </div>
                    </div>
                }

                  {selectedMap === 'radar' &&
                <div className="flex flex-wrap gap-1 bg-space-black/60 p-1.5 border border-space-orange/15 rounded">
                      {RISK_TIER_LEVELS.map((tier) =>
                  <button data-fuser-slot-id={{ "SEVERE": "section-text-d69e78d4", "ELEVATED": "section-text-9f9f9435", "GUARDED": "section-text-b74cdcae", "LOW": "section-text-1ff27423", "MINIMAL": "section-text-004a16c1" }[tier.key]}
                  key={tier.key}
                  onClick={() => toggleSentryTier(tier.key)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all border ${
                  sentryTierFilter[tier.key] !== false ?
                  'text-white border-space-orange/10' :
                  'text-space-muted/50 border-space-orange/5 opacity-50'}`
                  }
                  style={sentryTierFilter[tier.key] !== false ? { background: `${tier.color}22`, borderColor: `${tier.color}55` } : undefined}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tier.color, boxShadow: sentryTierFilter[tier.key] !== false ? `0 0 4px ${tier.color}` : 'none' }} />
                          {tier.key} <span className="text-space-muted/70 font-normal normal-case">({sentryTierCounts[tier.key] ?? 0})</span>
                        </button>
                  )}
                    </div>
                }

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
                            {HELIO_CATEGORY_KEYS.every((k) => sizeCategoryFilter[k] !== false) &&
                        <tr
                          onClick={handleSelectBelt}
                          className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                          selectedObjectType === 'belt' ?
                          'bg-space-orange/25 text-white font-bold' :
                          'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                          }>
                              <td data-fuser-slot-id="section-body-2de01b1b" className="p-1.5 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 ${selectedObjectType === 'belt' ? 'bg-[#10f3a5]' : 'bg-[#facc15]/60'}`} style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
                                MAIN ASTEROID BELT
                              </td>
                              <td data-fuser-slot-id="section-body-57249e5e" className="p-1.5">BELT</td>
                              <td data-fuser-slot-id="section-body-14e2b443" className="p-1.5 text-right text-glow-green">2.06–3.28</td>
                              <td data-fuser-slot-id="section-body-7712b03c" className="p-1.5 text-right">—</td>
                              <td data-fuser-slot-id="section-body-9081e37e" className="p-1.5 text-right">~10°</td>
                            </tr>
                        }
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
                            {filteredHelioAsteroids.map((ast) => {
                          const cat = categorizeAsteroidSize(ast.size);
                          return (
                            <tr
                              key={`helio-ast-${ast.id}`}
                              onClick={() => handleSelectAsteroid(ast.id, ast.des)}
                              className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                              selectedObjectType === 'asteroid' && selectedId === ast.id ?
                              'bg-space-orange/25 text-white font-bold' :
                              'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                              }>
                                <td className="p-1.5 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ast.sentry ? '#ef4444' : cat.color }} />
                                  {ast.des}
                                </td>
                                <td className="p-1.5" style={{ color: cat.color }}>{cat.label}</td>
                                <td data-fuser-slot-id="section-body-92bb142d" className="p-1.5 text-right text-glow-green">{ast.ld.toFixed(2)} LD</td>
                                <td data-fuser-slot-id="section-body-04292222" className="p-1.5 text-right">{ast.kms.toFixed(1)} KM/S</td>
                                <td className="p-1.5 text-right">{ast.sentry ? 'SENTRY' : '—'}</td>
                              </tr>);

                        })}
                            {filteredSolarObjects.length === 0 && filteredHelioAsteroids.length === 0 &&
                        <tr>
                                <td data-fuser-slot-id="section-body-8cb55249" colSpan={5} className="p-4 text-center text-space-muted">NO OBJECTS MATCH ACTIVE CATEGORY</td>
                              </tr>
                        }
                          </tbody>
                        </> :
                    selectedMap === 'sizemap' ?
                    <>
                          <thead className="bg-space-orange/10 text-space-orange sticky top-0 font-bold z-10">
                            <tr>
                              <th data-fuser-slot-id="section-label-sizemap-des" className="p-1.5 border-b border-space-orange/20">DES</th>
                              <th data-fuser-slot-id="section-label-sizemap-class" className="p-1.5 border-b border-space-orange/20">SIZE CLASS</th>
                              <th data-fuser-slot-id="section-label-sizemap-size" className="p-1.5 border-b border-space-orange/20 text-right">DIAM</th>
                              <th data-fuser-slot-id="section-label-sizemap-ld" className="p-1.5 border-b border-space-orange/20 text-right">LD</th>
                              <th data-fuser-slot-id="section-label-sizemap-sentry" className="p-1.5 border-b border-space-orange/20 text-center">SENTRY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSizeAsteroids.map((ast) => {
                          const cat = categorizeAsteroidSize(ast.size);
                          return (
                            <tr
                              key={ast.id}
                              onClick={() => handleSelectAsteroid(ast.id, ast.des)}
                              className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                              selectedObjectType === 'asteroid' && selectedId === ast.id ?
                              'bg-space-orange/25 text-white font-bold' :
                              'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                              }>
                                  <td className="p-1.5 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color, boxShadow: `0 0 4px ${cat.color}` }} />
                                    {ast.des}
                                  </td>
                                  <td className="p-1.5" style={{ color: cat.color }}>{cat.key.toUpperCase()}</td>
                                  <td className="p-1.5 text-right text-glow-green">{ast.size}</td>
                                  <td className="p-1.5 text-right">{ast.ld.toFixed(1)}</td>
                                  <td className="p-1.5 text-center">
                                    {ast.sentry ? <span className="text-red-500 font-bold">▲</span> : <span className="text-space-muted/30">-</span>}
                                  </td>
                                </tr>);

                        })}
                            {filteredSizeAsteroids.length === 0 &&
                        <tr>
                                <td data-fuser-slot-id="section-body-sizemap-empty" colSpan={5} className="p-4 text-center text-space-muted">NO OBJECTS MATCH ACTIVE SIZE CLASSES</td>
                              </tr>
                        }
                          </tbody>
                        </> :
                    selectedMap === 'radar' ?
                    <>
                          <thead className="bg-space-orange/10 text-space-orange sticky top-0 font-bold z-10">
                            <tr>
                              <th data-fuser-slot-id="section-label-radar-des" className="p-1.5 border-b border-space-orange/20">DES</th>
                              <th data-fuser-slot-id="section-label-radar-tier" className="p-1.5 border-b border-space-orange/20">CATEGORY</th>
                              <th data-fuser-slot-id="section-label-radar-ip" className="p-1.5 border-b border-space-orange/20 text-right">IP</th>
                              <th data-fuser-slot-id="section-label-radar-ps" className="p-1.5 border-b border-space-orange/20 text-right">PS(CUM)</th>
                              <th data-fuser-slot-id="section-label-radar-nextdate" className="p-1.5 border-b border-space-orange/20 text-right">NEXT MODELED</th>
                              <th data-fuser-slot-id="section-label-radar-window" className="p-1.5 border-b border-space-orange/20 text-right">WINDOW</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Chronological — ordered from today toward the next modeled encounters;
                          filteredSentry is already sorted ascending by modeled window offset. */}
                            {filteredSentry.map((obj) => {
                          const idx = sentryObjects.indexOf(obj);
                          const tier = riskTier(obj.ps_cum);
                          const offsetDays = deriveWindowOffsetDays(obj.des);
                          const nextDate = new Date(Date.now() + offsetDays * 86400000);
                          const alreadyImpacted = offsetDays < 0;
                          return (
                            <tr
                              key={obj.des}
                              onClick={() => handleSelectSentry(idx)}
                              className={`cursor-pointer border-b border-space-orange/5 transition-colors ${
                              selectedSentryIdx === idx ?
                              'bg-space-orange/25 text-white font-bold' :
                              'hover:bg-space-orange/5 text-space-muted hover:text-white'}`
                              }>
                                        <td className="p-1.5 flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tier.color, boxShadow: `0 0 4px ${tier.color}` }} />
                                          {obj.des}
                                        </td>
                                        <td className="p-1.5" style={{ color: tier.color }}>{tier.label}</td>
                                        <td className="p-1.5 text-right text-glow-green">{obj.ip.toExponential(2)}</td>
                                        <td className="p-1.5 text-right">{obj.ps_cum.toFixed(2)}</td>
                                        <td className="p-1.5 text-right font-bold" style={{ color: alreadyImpacted ? '#ef4444' : '#facc15' }}>
                                          {nextDate.toISOString().slice(0, 10)} {alreadyImpacted ? '(ELAPSED)' : '(PRED)'}
                                        </td>
                                        <td className="p-1.5 text-right">{obj.range}</td>
                                      </tr>);

                        })}
                            {filteredSentry.length === 0 &&
                        <tr>
                                <td data-fuser-slot-id="section-body-radar-empty" colSpan={6} className="p-4 text-center text-space-muted">NO IMPACT-RISK OBJECTS MATCH SEARCH</td>
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

            {/* Mission time propagation bar hidden by default per prior design request — the
                            missionTime clock still auto-advances continuously (isPlaying stays true by
                            default) — but re-surfaced specifically on the Helio Map, where a visible
                            scrub timeline is useful for stepping through planetary/NEO positions. */}
            {selectedMap === 'helio' &&
            <div className="pointer-events-auto w-full flex items-center gap-2 sm:gap-3 border border-glow-yellow/60 bg-space-black/75 backdrop-blur-[3px] rounded px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-[0_0_12px_rgba(250,204,21,0.15)]">
              <button
                onClick={() => {
                  setIsPlaying((p) => !p);
                  addLog(isPlaying ? 'MISSION CLOCK PAUSED' : 'MISSION CLOCK RESUMED');
                }}
                aria-label={isPlaying ? 'Pause mission clock' : 'Resume mission clock'}
                className="shrink-0 w-7 h-7 flex items-center justify-center border border-glow-yellow hover:border-glow-green rounded text-space-yellow hover:text-glow-green text-[11px] font-bold transition-colors">
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button data-fuser-slot-id="section-button-text-efedb699"
              onClick={() => {
                setMissionTime(0.5);
                addLog('MISSION TIME RESET TO NOW');
              }}
              className="shrink-0 px-2 py-1 border border-glow-yellow hover:border-glow-green rounded text-[9px] font-bold tracking-wider text-space-yellow hover:text-glow-green transition-colors">
                NOW
              </button>
              <span data-fuser-slot-id="section-text-helio-timeline-label" className="hidden sm:inline text-[9px] text-space-muted font-bold tracking-widest shrink-0">MISSION TIME</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.0005}
                value={missionTime}
                onChange={(e) => setMissionTime(parseFloat(e.target.value))}
                aria-label="Scrub mission time"
                className="flex-1 accent-[#10f3a5] h-1.5 cursor-pointer" />
              <span className="shrink-0 text-glow-green font-bold text-[11px] tabular-nums tracking-wide">{formattedDate}</span>
            </div>
            }

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
                <h2 className="text-lg font-display tracking-wider text-space-yellow">
                  {activeModal === 'geocentric' && 'DETAILED GEOCENTRIC ORBITAL TELEMETRY'}
                  {activeModal === 'helio' && 'DETAILED HELIOCENTRIC SYSTEM MAP'}
                  {activeModal === 'radar' && 'DETAILED IMPACT RISK GLOBE'}
                  {activeModal === 'sizemap' && 'EARTH IMPACT SIMULATOR'}
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
              <GeocentricCanvas satellites={allSatellites} filter={satelliteFilter} selectedSatelliteId={selectedSatelliteId} selectedObjectType={selectedObjectType} onSelectSatellite={handleSelectSatellite} isMini={true} missionTime={missionTime} />
              }
                {activeModal === 'helio' &&
              <HelioCanvas
                selectedAsteroid={selectedAsteroid}
                asteroids={limitedAsteroids}
                missionTime={missionTime}
                onSelectAsteroid={handleSelectAsteroid}
                selectedObjectType={selectedObjectType}
                selectedSolarObjectId={selectedSolarObjectId}
                onSelectSolarObject={handleSelectSolarObject}
                categoryFilter={sizeCategoryFilter}
                isMini={true} />

              }
                {activeModal === 'radar' &&
              <ImpactRiskGlobe missionTime={missionTime} objects={sentryObjects} selectedIdx={selectedSentryIdx} onSelect={handleSelectSentry} sourceLabel={sentrySourceLabel} />
              }
                {activeModal === 'sizemap' &&
              <ImpactSimulator selectedAsteroid={selectedAsteroid} onLog={addLog} onResult={handleImpactSimResult} />
              }
                
                {/* Canvas controls instructions overlay */}
                {activeModal !== 'sizemap' &&
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-space-muted bg-space-black/90 px-3 py-1.5 rounded border border-space-orange/10 z-10 whitespace-nowrap">
                  {activeModal === 'geocentric' && 'DRAG TO ROTATE • SCROLL TO ZOOM'}
                  {activeModal === 'helio' && 'ORBITAL ELLIPSE SCALE: 50 PX/AU'}
                  {activeModal === 'radar' && 'RADAR RANGE: 20 LUNAR DISTANCES'}
                </div>
              }
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

                {activeModal === 'sizemap' &&
              <div className="border border-space-orange/20 rounded p-3 bg-space-black/40 flex-1">
                    <div data-fuser-slot-id="section-text-sizemap-telemetry-title" className="text-space-yellow font-bold mb-2 border-b border-space-orange/10 pb-1 text-[11px] flex items-center justify-between">
                      <span data-fuser-slot-id="section-text-da9386af">SIMULATION SOURCE OBJECT</span>
                    </div>
                    <div className="text-[11px] text-space-muted space-y-1.5">
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-sizemap-selected-class">DESIGNATION:</span>
                        <span data-fuser-slot-id="section-text-28331921" className="font-bold text-glow-green">{selectedAsteroid.des}</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-sizemap-selected-diameter">DEFAULT DIAMETER:</span>
                        <span data-fuser-slot-id="section-text-400b1195">{selectedAsteroid.size}</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-046dedb4">DEFAULT VELOCITY:</span>
                        <span data-fuser-slot-id="section-text-0ebd25eb">{selectedAsteroid.kms} KM/S</span>
                      </div>
                      <div className="flex justify-between text-white">
                        <span data-fuser-slot-id="section-text-sizemap-selected-sentry">SENTRY WATCH:</span>
                        {selectedAsteroid.sentry ?
                    <span data-fuser-slot-id="section-text-cbc3701e" className="text-red-500 font-bold animate-pulse">▲ ACTIVE</span> :
                    <span data-fuser-slot-id="section-text-f3c3d1bf">NONE</span>
                    }
                      </div>
                      <p data-fuser-slot-id="section-body-18026c9d" className="text-[9px] text-space-muted/70 leading-relaxed border-t border-space-orange/10 pt-2 mt-1">
                        Select a different close-approach object from the DATA FEED to load its diameter and velocity into the simulator, or override them directly with the sliders on the map panel. Click anywhere on the world map to relocate the impact point.
                      </p>
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

// Mount React App
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}