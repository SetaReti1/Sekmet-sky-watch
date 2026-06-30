# Sky Watch — Tactical Orbital Command

**Sky Watch** es un panel de comando orbital táctico (estilo "Tactical Orbital Command") que visualiza y rastrea en tiempo real la actividad espacial cercana a la Tierra. Reúne datos de satélites activos, objetos del sistema solar y asteroides cercanos a la Tierra (NEOs) en una única interfaz interactiva.

## ¿Qué hace?

La aplicación ofrece **tres mapas 3D interactivos** (rotación con arrastre, zoom con scroll) que se pueden proyectar en el panel principal:

- 🛰️ **Geocentric Map** — Densidad orbital centrada en la Tierra. Monitorea **15,821 satélites activos** clasificados en 6 constelaciones (Starlink, OneWeb, Weather, GPS, GEO Belt y otros), además de la órbita lunar y la ISS.
- ☀️ **Helio Map** — Mapa heliocéntrico del sistema solar interior. Visualiza las órbitas keplerianas de 8 planetas y 5 planetas enanos/planetoides, junto con las trayectorias de asteroides cercanos.
- 🎯 **Encounter Radar** — Radar táctico de aproximación cercana. Mapea asteroides dentro de **20 Distancias Lunares (LD)** de la Tierra, proyectando fechas y distancias de máxima aproximación.

## Características

- **107 asteroides NEO** propagados con elementos orbitales keplarianos (semieje mayor, excentricidad, inclinación, período, fase).
- **Línea de tiempo de misión** con scrubber (±50 días desde 2026-06-25) y animación en tiempo real.
- **Selector de objetos** con click en el canvas — cada clic recalcula la propagación orbital.
- **Data Feed** con logs de telemetría estilo terminal militar.
- **Modales de detalle** con elementos orbitales completos (a, e, i, período, masa, gravedad, lunas).
- Filtros de constelaciones, búsqueda, y HUD con indicadores RA/Dec.
- Simulación 3D con depth-sorting, eclipse rings, trajectory trails y efecto de barrido radar.

## Stack técnico

- **React + TypeScript** (vía `@fuser/vendor`)
- **Canvas 2D** para todos los renderizados 3D (proyección rotacional X/Z manual)
- **TailwindCSS** con paleta espacial (verde neón, amarillo táctico, naranja)
- Datos referenciados: JPL CNEOS, NASA SSD, SBDB, CelesTrak
- Compilado/exportado con **fuser.studio**

## Fuentes de datos (referenciadas en UI)

- **Satélites**: CelesTrak GP (Two-Body Propagation)
- **Asteroides**: JPL CNEOS Close-Approach Data (CAD) y Sentry Watch

---

Creado por **@seta.reti** con **fuser.studio**.
