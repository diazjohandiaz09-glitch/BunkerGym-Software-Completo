import express from 'express';
import gymRoutes from './routes/gym-routes.js';

const app = express();
const port = Number(process.env.PORT || 3001);

app.get('/health', (_request, response) => {
  response.json({ service: 'gym', status: 'ok' });
});
app.use('/api/gym', gymRoutes);

app.listen(port, '127.0.0.1', () => {
  console.log(`gym-service escuchando en http://127.0.0.1:${port}`);
});