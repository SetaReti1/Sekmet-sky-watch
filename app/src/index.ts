import { readCachePayload, writeCachePayload, ttlForPayload, hasActiveEvent, WORLDMAP_TTL_MS } from './utils/apiCache';

type Env = {
  fuser: {
    inputs: Record<string, { value?: unknown }>;
    clientScriptTag(): string;
  };
  SAT_CACHE: {
    fetch(req: Request): Promise<Response>;
  };
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // NASA/JPL Sentry impact-risk catalogue — narrow server-side proxy for the
    // hex-grid Impact Risk Globe panel. Fixed upstream host/path; no client params.
    // Backed by the shared SAT_CACHE snapshot store so repeat loads (and other
    // panels re-mounting) don't re-hit the upstream inside the TTL window.
    if (url.pathname === '/app-api/sentry') {
      const cachePayload = await readCachePayload(env.SAT_CACHE);
      const cached = cachePayload.sentry;
      const sentryTtl = ttlForPayload(cachePayload);
      const isFresh = !!cached && Date.now() - cached.fetchedAt < sentryTtl;
      if (isFresh) {
        return Response.json({
          ok: true,
          objects: cached.objects,
          count: cached.count,
          source: 'NASA/JPL Sentry Data API (cached)',
          cachedAt: cached.fetchedAt,
          refreshCadence: hasActiveEvent(cachePayload) ? 'EVENT · 30min' : 'NORMAL · 60min',
        });
      }
      try {
        const upstream = await fetch('https://ssd-api.jpl.nasa.gov/sentry.api', {
          headers: { accept: 'application/json' },
        });
        if (!upstream.ok) throw new Error(`Sentry upstream ${upstream.status}`);
        const json: any = await upstream.json();
        const rows: any[] = Array.isArray(json?.data) ? json.data : [];
        const objects = rows
          .map((d: any) => ({
            des: String(d.des ?? d.fullname ?? 'UNKNOWN'),
            fullname: String(d.fullname ?? d.des ?? ''),
            diameter: parseFloat(d.diameter) || 0,
            ip: parseFloat(d.ip) || 0,
            ps_cum: parseFloat(d.ps_cum) || -99,
            ps_max: parseFloat(d.ps_max) || -99,
            v_inf: parseFloat(d.v_inf) || 0,
            n_imp: Number(d.n_imp) || 0,
            range: String(d.range ?? ''),
            last_obs: String(d.last_obs ?? ''),
          }))
          .sort((a, b) => b.ip - a.ip)
          .slice(0, 40);
        const nextSentryPayload = { ...cachePayload, sentry: { objects, count: rows.length, fetchedAt: Date.now() } };
        await writeCachePayload(env.SAT_CACHE, nextSentryPayload);
        return Response.json({
          ok: true,
          objects,
          count: rows.length,
          source: 'NASA/JPL Sentry Data API',
          refreshCadence: hasActiveEvent(nextSentryPayload) ? 'EVENT · 30min' : 'NORMAL · 60min',
        });
      } catch (err) {
        if (cached) {
          return Response.json({ ok: true, objects: cached.objects, count: cached.count, source: 'NASA/JPL Sentry Data API (stale cache — upstream unreachable)', cachedAt: cached.fetchedAt });
        }
        return Response.json({ ok: false, objects: [], error: 'Sentry upstream unreachable' }, { status: 502 });
      }
    }

    // NASA/JPL SBDB Close-Approach Data API — narrow server-side proxy that powers
    // the real close-approach asteroid roster (Helio/Geocentric/Radar/SizeMap panels).
    // Fixed upstream host/path/query; window is a fixed 2026 range matching mission time.
    if (url.pathname === '/app-api/cad') {
      const cachePayload = await readCachePayload(env.SAT_CACHE);
      const cached = cachePayload.cad;
      const cadTtl = ttlForPayload(cachePayload);
      const isFresh = !!cached && Date.now() - cached.fetchedAt < cadTtl;
      if (isFresh) {
        return Response.json({
          ok: true,
          objects: cached.objects,
          count: cached.count,
          source: 'NASA/JPL SBDB Close Approach Data API (cached)',
          cachedAt: cached.fetchedAt,
          refreshCadence: hasActiveEvent(cachePayload) ? 'EVENT · 30min' : 'NORMAL · 60min',
        });
      }
      try {
        const upstream = await fetch(
          'https://ssd-api.jpl.nasa.gov/cad.api?date-min=2026-05-01&date-max=2026-10-31&dist-max=0.2&sort=date&fullname=true',
          { headers: { accept: 'application/json' } }
        );
        if (!upstream.ok) throw new Error(`CAD upstream ${upstream.status}`);
        const json: any = await upstream.json();
        const fields: string[] = Array.isArray(json?.fields) ? json.fields : [];
        const idx = (name: string) => fields.indexOf(name);
        const iDes = idx('des');
        const iCd = idx('cd');
        const iDist = idx('dist');
        const iVrel = idx('v_rel');
        const iH = idx('h');
        const iFullname = idx('fullname');
        const rows: any[] = Array.isArray(json?.data) ? json.data : [];
        const objects = rows.map((r: any[]) => {
          const desRaw = String(r[iDes] ?? 'UNKNOWN');
          const fullname = iFullname >= 0 ? String(r[iFullname] ?? desRaw).trim() : desRaw;
          const distAu = parseFloat(r[iDist]) || 0;
          const h = parseFloat(r[iH]);
          // Absolute magnitude -> approximate diameter (km), standard SBDB assumption (albedo 0.14)
          const diameterM = Number.isFinite(h) ? Math.round(1329 / Math.sqrt(0.14) * Math.pow(10, -0.2 * h) * 1000) : NaN;
          return {
            des: desRaw,
            fullname,
            cd: String(r[iCd] ?? ''),
            ld: parseFloat((distAu * 389.174).toFixed(2)), // AU -> lunar distances
            km: Math.round(distAu * 149597870.7),
            kms: parseFloat(r[iVrel]) || 0,
            h,
            diameterM: Number.isFinite(diameterM) ? diameterM : null,
          };
        });
        const nextCadPayload = { ...cachePayload, cad: { objects, count: rows.length, fetchedAt: Date.now() } };
        await writeCachePayload(env.SAT_CACHE, nextCadPayload);
        return Response.json({
          ok: true,
          objects,
          count: rows.length,
          source: 'NASA/JPL SBDB Close Approach Data API',
          refreshCadence: hasActiveEvent(nextCadPayload) ? 'EVENT · 30min' : 'NORMAL · 60min',
        });
      } catch (err) {
        if (cached) {
          return Response.json({ ok: true, objects: cached.objects, count: cached.count, source: 'NASA/JPL SBDB Close Approach Data API (stale cache — upstream unreachable)', cachedAt: cached.fetchedAt });
        }
        return Response.json({ ok: false, objects: [], error: 'CAD upstream unreachable' }, { status: 502 });
      }
    }

    // Real-world coastline trace — narrow server-side proxy for the Impact Risk
    // Globe's continent outlines. Fixed upstream host/path (Natural Earth 110m
    // land polygons, the standard public-domain world-map dataset used by most
    // web globes/atlases). Simplified + decimated server-side so the traced
    // geography stays recognizable while keeping the payload small.
    if (url.pathname === '/app-api/worldmap') {
      const cachePayload = await readCachePayload(env.SAT_CACHE);
      const cachedWorld = cachePayload.worldmap;
      const isWorldFresh = !!cachedWorld && Date.now() - cachedWorld.fetchedAt < WORLDMAP_TTL_MS;
      if (isWorldFresh) {
        return Response.json(
          { ok: true, polygons: cachedWorld.polygons, count: cachedWorld.count, source: 'Natural Earth 110m Land (naturalearthdata.com) (cached)', cachedAt: cachedWorld.fetchedAt },
          { headers: { 'cache-control': 'public, max-age=86400' } }
        );
      }
      try {
        const upstream = await fetch(
          'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_land.geojson',
          { headers: { accept: 'application/vnd.geo+json, application/json' } }
        );
        if (!upstream.ok) throw new Error(`worldmap upstream ${upstream.status}`);
        const geo: any = await upstream.json();
        const features: any[] = Array.isArray(geo?.features) ? geo.features : [];
        const MAX_POINTS_PER_RING = 90;
        const polygons: [number, number][][] = [];

        const decimate = (ring: [number, number][]): [number, number][] => {
          if (ring.length <= MAX_POINTS_PER_RING) return ring;
          const step = ring.length / MAX_POINTS_PER_RING;
          const out: [number, number][] = [];
          for (let i = 0; i < MAX_POINTS_PER_RING; i++) {
            out.push(ring[Math.floor(i * step)]);
          }
          return out;
        };

        const addRing = (coords: number[][]) => {
          // coords are [lon, lat] per GeoJSON spec; convert to [lat, lon] to
          // match this app's existing lat/lon convention.
          let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
          const latLon: [number, number][] = coords.map(([lon, lat]) => {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            return [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100];
          });
          // Skip slivers/tiny islets so the globe reads as clean continent
          // silhouettes rather than a dust of unreadable specks at this scale.
          const span = Math.max(maxLat - minLat, maxLon - minLon);
          if (span < 0.6) return;
          polygons.push(decimate(latLon));
        };

        features.forEach((f: any) => {
          const geom = f?.geometry;
          if (!geom) return;
          if (geom.type === 'Polygon') {
            const outer = geom.coordinates?.[0];
            if (Array.isArray(outer)) addRing(outer);
          } else if (geom.type === 'MultiPolygon') {
            (geom.coordinates ?? []).forEach((poly: number[][][]) => {
              const outer = poly?.[0];
              if (Array.isArray(outer)) addRing(outer);
            });
          }
        });

        await writeCachePayload(env.SAT_CACHE, { ...cachePayload, worldmap: { polygons, count: polygons.length, fetchedAt: Date.now() } });
        return Response.json(
          { ok: true, polygons, count: polygons.length, source: 'Natural Earth 110m Land (naturalearthdata.com)' },
          { headers: { 'cache-control': 'public, max-age=86400' } }
        );
      } catch (err) {
        if (cachedWorld) {
          return Response.json(
            { ok: true, polygons: cachedWorld.polygons, count: cachedWorld.count, source: 'Natural Earth 110m Land (naturalearthdata.com) (stale cache — upstream unreachable)', cachedAt: cachedWorld.fetchedAt },
            { headers: { 'cache-control': 'public, max-age=86400' } }
          );
        }
        return Response.json({ ok: false, polygons: [], error: 'worldmap upstream unreachable' }, { status: 502 });
      }
    }

    // Return a 200 OK for any other API probes or health checks
    if (url.pathname.startsWith('/app-api/')) {
      return Response.json({ status: 'ok', message: 'Space Terminal Online' });
    }

    return new Response(
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Near Earth Object Encounters</title>
  
  <script>
    // Robust fix for "pushState" is read-only errors in sandboxed/iframe environments
    (function() {
      try {
        const proto = Object.getPrototypeOf(window.history) || window.history;
        ['pushState', 'replaceState'].forEach(method => {
          try {
            const desc = Object.getOwnPropertyDescriptor(proto, method);
            if (desc && !desc.writable && desc.configurable) {
              Object.defineProperty(proto, method, {
                value: proto[method],
                writable: true,
                configurable: true
              });
            }
          } catch (e) {}
        });
      } catch (e) {}

      try {
        ['pushState', 'replaceState'].forEach(method => {
          try {
            const desc = Object.getOwnPropertyDescriptor(window.history, method);
            if (desc && !desc.writable && desc.configurable) {
              Object.defineProperty(window.history, method, {
                value: window.history[method],
                writable: true,
                configurable: true
              });
            }
          } catch (e) {}
        });
      } catch (e) {}

      try {
        const realHistory = window.history;
        let pushStateOverride = realHistory.pushState ? realHistory.pushState.bind(realHistory) : function() {};
        let replaceStateOverride = realHistory.replaceState ? realHistory.replaceState.bind(realHistory) : function() {};

        const historyProxy = new Proxy(realHistory, {
          get(target, prop) {
            if (prop === 'pushState') return pushStateOverride;
            if (prop === 'replaceState') return replaceStateOverride;
            const val = Reflect.get(target, prop);
            return typeof val === 'function' ? val.bind(target) : val;
          },
          set(target, prop, value) {
            if (prop === 'pushState') {
              pushStateOverride = value;
              return true;
            }
            if (prop === 'replaceState') {
              replaceStateOverride = value;
              return true;
            }
            return Reflect.set(target, prop, value);
          },
          getOwnPropertyDescriptor(target, prop) {
            if (prop === 'pushState' || prop === 'replaceState') {
              return {
                value: prop === 'pushState' ? pushStateOverride : replaceStateOverride,
                writable: true,
                enumerable: true,
                configurable: true
              };
            }
            return Reflect.getOwnPropertyDescriptor(target, prop);
          },
          defineProperty(target, prop, descriptor) {
            if (prop === 'pushState' || prop === 'replaceState') {
              if ('value' in descriptor) {
                if (prop === 'pushState') pushStateOverride = descriptor.value;
                if (prop === 'replaceState') replaceStateOverride = descriptor.value;
              }
              return true;
            }
            return Reflect.defineProperty(target, prop, descriptor);
          }
        });

        const winDesc = Object.getOwnPropertyDescriptor(window, 'history');
        if (!winDesc || winDesc.configurable) {
          Object.defineProperty(window, 'history', {
            get() { return historyProxy; },
            configurable: true
          });
        }
      } catch (e) {}
    })();
  </script>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@300;400;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            display: ['"Bebas Neue"', 'sans-serif'],
            oswald: ['Oswald', 'sans-serif'],
            mono: ['"Share Tech Mono"', 'monospace'],
          },
          colors: {
            space: {
              black: '#070505',
              card: '#0d0a09',
              accent: '#10f3a5', // glowing green
              orange: '#facc15', // mapped to yellow for full backward compatibility
              yellow: '#facc15', // glowing yellow
              muted: '#8e7a72',
            }
          }
        }
      }
    }
  </script>

  <style>
    /* Custom Sci-Fi Terminal Styles */
    :root {
      --glow-green: 0 0 8px rgba(16, 243, 165, 0.8), 0 0 20px rgba(16, 243, 165, 0.3);
      --glow-orange: 0 0 8px rgba(250, 204, 21, 0.8), 0 0 20px rgba(250, 204, 21, 0.3);
      --glow-yellow: 0 0 8px rgba(250, 204, 21, 0.8), 0 0 20px rgba(250, 204, 21, 0.3);
    }

    body {
      background-color: #070403;
      color: #facc15;
      font-family: 'Share Tech Mono', monospace;
      overflow-x: hidden;
    }

    #root {
      height: 100%;
      width: 100%;
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(250, 204, 21, 0.05);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(250, 204, 21, 0.3);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(250, 204, 21, 0.6);
    }

    /* Glow utilities */
    .text-glow-green {
      color: #10f3a5;
      text-shadow: var(--glow-green);
    }
    .text-glow-orange {
      color: #facc15;
      text-shadow: var(--glow-yellow);
    }
    .text-glow-yellow {
      color: #facc15;
      text-shadow: var(--glow-yellow);
    }
    .border-glow-orange {
      border-color: rgba(250, 204, 21, 0.4);
      box-shadow: 0 0 10px rgba(250, 204, 21, 0.15), inset 0 0 10px rgba(250, 204, 21, 0.05);
    }
    .border-glow-yellow {
      border-color: rgba(250, 204, 21, 0.4);
      box-shadow: 0 0 10px rgba(250, 204, 21, 0.15), inset 0 0 10px rgba(250, 204, 21, 0.05);
    }
    .border-glow-green {
      border-color: rgba(16, 243, 165, 0.4);
      box-shadow: 0 0 10px rgba(16, 243, 165, 0.15), inset 0 0 10px rgba(16, 243, 165, 0.05);
    }

    /* Vertically elongated and condensed font effect to match the sci-fi terminal look */
    .condensed-title {
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 0.02em;
      line-height: 0.85;
      transform: scaleY(1.2) scaleX(0.95);
      transform-origin: top left;
      display: inline-block;
    }

    /* Vivid background for the main screen instead of flat black */
    .vivid-main-screen {
      background: radial-gradient(circle at center, rgba(250, 110, 21, 0.18) 0%, rgba(7, 4, 3, 0.96) 80%), #070403;
      background-image: 
        radial-gradient(circle at center, rgba(250, 110, 21, 0.2) 0%, transparent 75%),
        linear-gradient(rgba(250, 110, 21, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(250, 110, 21, 0.03) 1px, transparent 1px);
      background-size: 100% 100%, 32px 32px, 32px 32px;
    }

    /* Wireframe sphere rotation for boot loader */
    @keyframes sphere-spin {
      from { transform: rotateX(-18deg) rotateY(0deg); }
      to { transform: rotateX(-18deg) rotateY(360deg); }
    }

    /* CRT Scanline overlay effect */
    .crt::after {
      content: " ";
      display: block;
      position: absolute;
      top: 0; left: 0; bottom: 0; right: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      z-index: 999;
      background-size: 100% 4px, 6px 100%;
      pointer-events: none;
    }
  </style>
  
  <!-- Import Map for capability-backed React -->
  <script type="importmap">
  {
    "imports": {
      "@fuser/vendor/react": "/_app-capabilities/v1/artifacts/react-client/builtin/react.js",
      "@fuser/vendor/react-dom": "/_app-capabilities/v1/artifacts/react-client/builtin/react-dom.js",
      "@fuser/vendor/react-dom/client": "/_app-capabilities/v1/artifacts/react-client/builtin/react-dom-client.js",
      "@fuser/vendor/react/jsx-dev-runtime": "/_app-capabilities/v1/artifacts/react-client/builtin/react-jsx-dev-runtime.js",
      "@fuser/vendor/react/jsx-runtime": "/_app-capabilities/v1/artifacts/react-client/builtin/react-jsx-runtime.js",
      "@fuser/vendor/lucide-react": "/_app-capabilities/v1/artifacts/lucide-icons/builtin/lucide-react.js"
    }
  }
  </script>
</head>
<body class="crt bg-space-black min-h-screen h-auto lg:h-screen overflow-y-auto lg:overflow-hidden p-2 select-none">
  <div id="root"></div>
  ${env.fuser.clientScriptTag()}
</body>
</html>`,
      {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    );
  },
};
