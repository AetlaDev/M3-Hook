import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import monkey from 'vite-plugin-monkey';

function m3HookDevAssets(): Plugin {
  return {
    name: 'm3-hook-dev-assets',
    apply: 'serve',
    config: () => ({ server: { cors: false } }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE');
        res.setHeader(
          'Access-Control-Allow-Headers',
          (req.headers['access-control-request-headers'] as string) ?? '*',
        );
        if (req.url && req.url.startsWith('/hook/')) {
          res.setHeader('Cache-Control', 'no-store');
        }
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith('m3e-'),
          },
        },
      }),
      monkey({
        entry: 'src/main.ts',
        userscript: {
          name: 'M3 Hook',
          namespace: '',
          version: '0.1.0',
          description: '注入式辅助',
          downloadURL: 'https://aetladev.github.io/M3-Hook/m3-hook.user.js',
          updateURL: 'https://aetladev.github.io/M3-Hook/m3-hook.user.js',
          match: ['https://www.ccw.site/detail/*'],
          'run-at': 'document-start',
          noframes: true,
          grant: 'none',
        },
        build: {
          fileName: 'm3-hook.user.js',
        },
        server: {
          open: false,
        },
      }),
      m3HookDevAssets(),
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: false,
    },
    build: {
      target: 'es2020',
    },
  };
});
