# Sky Watch - Near Earth Object Encounters

Aplicación de visualización orbital 3D desarrollada en React + TypeScript que muestra:
- **Mapa Geocéntrico**: Satélites activos en órbita terrestre (LEO, MEO, GEO)
- **Mapa Heliocéntrico**: Sistema solar con planetas y planetas enanos
- **Radar de Encuentros**: Asteroides cercanos a Tierra con datos de JPL CNEOS

## 🚀 Instalación y Ejecución

### Prerrequisitos
- Node.js >= 18.x
- npm >= 9.x

### Pasos

1. **Clonar el repositorio**
```bash
git clone https://github.com/SetaReti1/Sekmet-sky-watch
cd Sekmet-sky-watch
```

2. **Instalar dependencias**
```bash
cd app
npm install
```

3. **Ejecutar la aplicación**
```bash
npm run dev
```

4. **Abrir en el navegador**
La aplicación estará disponible en: `http://localhost:3000`

## 📁 Estructura del Proyecto

```
app/
├── src/
│   ├── client.tsx          # Componente principal React
│   ├── index.ts            # Servidor HTTP (Fuser Studio)
│   └── fuser.surface.json  # Configuración de slots
├── index.html              # HTML principal con Tailwind CDN
├── package.json            # Dependencias y scripts
├── vite.config.ts          # Configuración de Vite
├── tsconfig.json           # Configuración de TypeScript
└── tailwind.config.js      # Configuración de Tailwind CSS
```

## 🛠️ Tecnologías

- **React 19** - Biblioteca UI
- **TypeScript** - Tipado estático
- **Vite** - Bundler y dev server
- **Tailwind CSS** - Estilos utility-first
- **Lucide React** - Iconos
- **Canvas API** - Gráficos 3D orbitales

## 🎮 Características

- Visualización 3D interactiva de órbitas
- Animaciones en tiempo real
- Filtros por categoría de satélites
- Búsqueda de objetos espaciales
- Panel de telemetría detallada
- Controles de tiempo (play/pause/scrub)
- Modales expandidos con información detallada

## 📝 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo (hot reload)
npm run build    # Build de producción
npm run preview  # Preview del build
```

## 🎨 Diseño

Interfaz estilo terminal sci-fi con:
- Tema oscuro con efectos de brillo (glow)
- Tipografía monoespaciada
- Efectos CRT scanlines
- Paleta de colores: negro, verde neón, amarillo/naranja

## 📄 Licencia

Este proyecto fue creado con Fuser Studio.

</content>
