import { defineConfig } from 'vite';

const services = {
  '/api/gym': 3001, '/api/training': 3002, '/api/recovery': 3003,
  '/api/community': 3004, '/api/contact': 3005, '/api/plans': 3006,
  '/api/facilities': 3007, '/api/faq': 3008, '/api/admin': 3009,
  '/api/store': 3010, '/api/orders': 3011, '/api/site': 3012, '/api/gallery': 3013,
  '/api/public': 3009
};

export default defineConfig({
  plugins: [{
    name: 'panelmicroservicios-route',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url || '').split('?')[0];
        if (pathname === '/panelmicroservicios') {
          response.statusCode = 302;
          response.setHeader('Location', '/panelmicroservicios/');
          response.end();
          return;
        }
        next();
      });
    }
  }],
  server: {
    host: '127.0.0.1',
    proxy: Object.fromEntries(Object.entries(services).map(([route, port]) => [
      route, { target: `http://127.0.0.1:${port}`, changeOrigin: true }
    ]))
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        panelmicroservicios: 'panelmicroservicios/index.html'
      }
    }
  }
});