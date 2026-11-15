import express from 'express';
import plansRoutes from './routes/plans-routes.js';
const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3006);
app.get('/health', (_request, response) => response.json({ service: 'plans', status: 'ok' }));
app.use('/api/plans', plansRoutes);
app.listen(port, '127.0.0.1', () => console.log(`plans-service escuchando en http://127.0.0.1:${port}`));