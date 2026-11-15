import express from 'express';
import facilitiesRoutes from './routes/facilities-routes.js';
const app = express();
const port = Number(process.env.PORT || 3007);
app.get('/health', (_request, response) => response.json({ service: 'facilities', status: 'ok' }));
app.use('/api/facilities', facilitiesRoutes);
app.listen(port, '127.0.0.1', () => console.log(`facilities-service escuchando en http://127.0.0.1:${port}`));