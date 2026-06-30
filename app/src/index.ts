type Env = {
  fuser: {
    inputs: Record<string, { value?: unknown }>;
    clientScriptTag(): string;
  };
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Return a 200 OK for any API probes or health checks
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
<body class="crt bg-space-black h-screen overflow-hidden p-2 select-none">
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
