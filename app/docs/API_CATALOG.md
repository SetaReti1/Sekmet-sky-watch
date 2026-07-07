# Catálogo de APIs — Near Earth Object Encounters

Documento de referencia para todas las fuentes de datos externas que usa (o
planea usar) esta app. Está organizado por **categoría funcional**. Cada
entrada indica qué hace la API, qué endpoint/ruta interna del app la consume,
la frecuencia de refresco (TTL) contra la caché compartida, y el estado
actual de integración.

Todas las llamadas salen desde rutas server-side `/app-api/*` (nunca desde el
browser directamente), y las tres fuentes activas hoy pasan primero por el
**Satellite Snapshot Cache** (`env.SAT_CACHE`, resource compartido) antes de
tocar el upstream real — así no se satura ninguna API pública con refetches
innecesarios cuando varios paneles/usuarios están abiertos a la vez.

---

## 1. Detección y Aproximación de Objetos Cercanos a la Tierra (NEO)

### NASA/JPL SBDB Close-Approach Data (CAD) API
- **Función:** lista de asteroides/cometas con aproximación cercana a la
  Tierra dentro de una ventana de fechas — fecha, distancia (LD/km),
  velocidad relativa, magnitud absoluta (usada para estimar diámetro).
- **Host:** `ssd-api.jpl.nasa.gov`
- **Endpoint upstream:** `GET /cad.api?date-min=...&date-max=...&dist-max=...&sort=date&fullname=true`
- **Ruta interna:** `GET /app-api/cad`
- **Alimenta:** Helio Map, Geocentric Map, Impact Risk Globe (marcadores), NEO
  Size Class Map, panel de propiedades de objeto seleccionado.
- **Caché:** slice `cad` en el snapshot compartido — TTL 6 horas.
- **Estado:** ✅ integrado y en caché.

---

## 2. Evaluación de Riesgo de Impacto (Defensa Planetaria)

### NASA/JPL Sentry Risk List API
- **Función:** catálogo de objetos bajo vigilancia por posibilidad de
  impacto futuro — probabilidad acumulada (`ps_cum`), escala de Palermo,
  velocidad de impacto, número de impactos potenciales registrados.
- **Host:** `ssd-api.jpl.nasa.gov`
- **Endpoint upstream:** `GET /sentry.api`
- **Ruta interna:** `GET /app-api/sentry`
- **Alimenta:** Impact Risk Globe (marcadores por nivel de riesgo/tier),
  panel de propiedades cuando se selecciona un objeto Sentry.
- **Caché:** slice `sentry` en el snapshot compartido — TTL **adaptativo**:
  60 min en condiciones normales, **30 min** si hay un evento real activo
  (ver "Cadencia adaptativa" más abajo).
- **Estado:** ✅ integrado y en caché.

### Marcadores de "ground track" (lat/lon) por objeto — `impactLatLon()`

Cada objeto Sentry se plota ahora en el globo (Impact Risk Globe) en una
latitud/longitud específica, derivada de forma determinística a partir de su
propia designación (`impactLatLon(des)` en `src/components/HexGlobeRadar.tsx`,
reutilizada en el render loop, el hit-test de clicks y el panel de
propiedades / DATA FEED en `src/client.tsx`). **Importante:** ni la API de
Sentry ni ninguna fuente real publican una latitud/longitud de impacto —
el punto de impacto de un NEO futuro no es algo conocible hasta que el
objeto está mucho más cerca de la Tierra — así que estas coordenadas están
etiquetadas explícitamente como "MODELED" / "GROUND TRACK (MODELED)" en la UI,
nunca como un dato oficial descargado.

### Evaluación de Space-Track.org (rechazada)

Se evaluó `space-track.org` (login gate: token CSRF + cookie de sesión vía
`POST /ajaxauth/login`) como posible fuente para este mapa. Se descartó por
dos razones:
1. **No es una API pública abierta** — cada consulta requiere una cuenta de
   usuario registrada y una sesión autenticada; esta app no tiene forma de
   recolectar, almacenar o refrescar credenciales de usuario de forma segura
   (no hay bóveda de secretos disponible para la app, y las credenciales
   nunca deben vivir en código cliente ni pedirse como flujo ad-hoc).
2. **No es el dato correcto de todas formas** — el catálogo de Space-Track es
   de elementos orbitales de satélites (TLE/GP) y conjunciones, no de
   probabilidad de impacto ni coordenadas de impacto de asteroides/NEOs.

---

## 3. Cartografía / Geometría de Referencia

### Natural Earth 110m Land (GeoJSON)
- **Función:** contorno vectorial público-dominio de continentes/islas,
  usado para trazar la silueta real de la Tierra en el globo wireframe.
- **Host:** `d2ad6b4ur7yvpq.cloudfront.net` (mirror CDN de naturalearthdata.com)
- **Endpoint upstream:** `GET /naturalearth-3.3.0/ne_110m_land.geojson`
- **Ruta interna:** `GET /app-api/worldmap`
- **Alimenta:** Impact Risk Globe (contorno de continentes).
- **Caché:** slice `worldmap` en el snapshot compartido — TTL 30 días
  (geometría estática, no cambia entre despliegues).
- **Estado:** ✅ integrado y en caché.

---

## 4. Catálogo de Satélites Activos

### CelesTrak GP Element Sets (catálogo general de satélites activos)
- **Función:** catálogo de satélites activos (Starlink, OneWeb, GPS/GNSS,
  meteorológicos, cinturón GEO, ISS, etc.) con elementos orbitales para
  propagación de dos cuerpos.
- **Host previsto:** `celestrak.org`
- **Endpoint previsto:** `GET /NORAD/elements/gp.php?GROUP=active&FORMAT=json`
- **Ruta interna prevista:** `GET /app-api/satellites`
- **Alimenta hoy:** Geocentric Map (satélites), leyenda "ACTIVE SATELLITE KEY".
  Actualmente la posición/categoría de cada satélite se genera de forma
  procedural en `src/data/satelliteData.ts` (semilla determinista), como
  respaldo mientras no hay integración en vivo.
- **Caché prevista:** el resource `SAT_CACHE` ("Satellite Snapshot Cache") ya
  está conectado y listo para guardar exactamente este payload bajo la clave
  `snapshot.payload` — es la razón de ser del resource. Cuando se active la
  integración en vivo, la ruta `/app-api/satellites` debe seguir el mismo
  patrón que `/app-api/cad` y `/app-api/sentry`: leer `readCachePayload`,
  servir cache si está fresca, si no, hacer fetch, y escribir con
  `writeCachePayload`.
- **Estado:** ⏳ pendiente — datos simulados hoy, resource de caché ya
  aprovisionado y compartido (`env.SAT_CACHE`) para cuando se conecte.

---

## Cadencia adaptativa (normal vs. evento real)

Archivo: `src/utils/apiCache.ts` — funciones `hasActiveEvent()` y `ttlForPayload()`.

Los slices `cad` y `sentry` ya no usan un TTL fijo: cada lectura de caché
evalúa el propio contenido cacheado para decidir si hay un "evento real" en
curso, y ajusta el TTL en consecuencia:

- **Condiciones normales:** TTL de **60 minutos** (`NORMAL_TTL_MS`).
- **Evento real detectado:** TTL de **30 minutos** (`EVENT_TTL_MS`), gatillado
  si cualquiera de estas condiciones es verdadera sobre el snapshot cacheado:
  - Algún objeto Sentry tiene `ps_cum` por encima de `-3` (nivel ELEVATED o
    superior en la escala de riesgo del Impact Risk Globe).
  - Algún objeto CAD tiene una aproximación (`ld`) por debajo de **5
    distancias lunares** — un paso genuinamente cercano.
- Cada respuesta de `/app-api/cad` y `/app-api/sentry` incluye un campo
  `refreshCadence` (`"NORMAL · 60min"` o `"EVENT · 30min"`) para que el
  frontend pueda mostrar la cadencia activa si se desea.
- El slice `worldmap` no participa de esta lógica — mantiene su TTL fijo de
  30 días porque es geometría estática.

### Auto-retorno a cadencia normal tras 3 horas

El modo evento (30 min) **no se queda activo indefinidamente**. Cada vez que
se detecta la condición de evento por primera vez, el payload guarda un
timestamp `eventDetectedAt`. Mientras la condición siga presente, el modo
evento permanece activo solo hasta que pasen **3 horas** desde ese primer
`eventDetectedAt` (`EVENT_MAX_DURATION_MS` en `apiCache.ts`) — pasado ese
límite, la cadencia vuelve automáticamente a la normal de 60 min, aunque el
mismo objeto siga técnicamente por debajo del umbral. Si la condición de
evento se despeja en algún momento (el objeto deja de cumplir el umbral),
`eventDetectedAt` se limpia; un evento posterior arranca su propia ventana
de 3 horas desde cero. Esta lógica vive en `resolveEventState()` dentro de
`src/utils/apiCache.ts` y se reevalúa en cada `writeCachePayload()` (al
guardar datos frescos) y en cada `ttlForPayload()` / `hasActiveEvent()` (al
decidir si la caché sigue vigente).

## Limpieza total de caché cada 7 días

Cada snapshot guarda un campo `epoch` (timestamp de cuándo empezó esa
"generación" de caché). En cada `readCachePayload()`, si `Date.now() - epoch`
supera `CACHE_MAX_AGE_MS` (7 días), **se descarta todo el payload** — los
tres slices, no solo el vencido — y se empieza una generación nueva desde
cero contra los upstreams reales la próxima vez que se pida cada slice. Esto
evita que datos huérfanos o un cambio de esquema queden pegados
indefinidamente en el resource compartido.

---

## Cómo funciona la caché compartida

Archivo: `src/utils/apiCache.ts`

- `readCachePayload(env.SAT_CACHE)` — hace `GET /snapshot` contra el resource
  y devuelve el último payload combinado (`{ cad, sentry, worldmap, epoch }`),
  o un payload vacío con `epoch` nuevo si no hay nada guardado todavía o si la
  generación anterior ya superó los 7 días (ver limpieza total arriba).
- `writeCachePayload(env.SAT_CACHE, payload)` — hace `POST /snapshot` con el
  payload combinado más reciente, preservando el `epoch` de la generación
  actual.
- `ttlForPayload(payload)` / `hasActiveEvent(payload)` — calculan el TTL
  vigente (60 min normal / 30 min evento) para los slices `cad` y `sentry`.
- Cada ruta `/app-api/*` sigue el mismo patrón:
  1. Lee el snapshot compartido.
  2. Si el slice correspondiente (`cad` / `sentry`) tiene menos del TTL
     adaptativo de antigüedad (o, para `worldmap`, menos de su TTL fijo de
     30 días), lo devuelve directo — **cero llamadas al upstream**.
  3. Si está vencido o no existe, llama al upstream real.
  4. Si el upstream responde bien, actualiza solo ese slice del payload y
     lo guarda de vuelta (preservando los demás slices intactos).
  5. Si el upstream falla y hay un slice cacheado (aunque esté vencido), lo
     sirve igual marcado como `"(stale cache — upstream unreachable)"` en
     vez de romper el panel.

Para agregar una nueva fuente (por ejemplo CelesTrak):
1. Agregar su forma de dato al tipo `CachePayload` en `apiCache.ts`.
2. Definir su TTL como constante exportada.
3. Crear la ruta `/app-api/<nombre>` en `src/index.ts` siguiendo el mismo
   patrón lectura → freshness check → fetch → escritura → fallback.
4. Documentar la nueva entrada en este archivo.
