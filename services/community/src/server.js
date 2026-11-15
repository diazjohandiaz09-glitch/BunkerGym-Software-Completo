import express from 'express';
import communityRoutes from './routes/community-routes.js';

const app = express();
const port = Number(process.env.PORT || 3004);

app.get('/health', (_request, response) => {
  response.json({ service: 'community', status: 'ok' });
});
app.use('/api/community', communityRoutes);

app.listen(port, '127.0.0.1', () => {
  console.log(`community-service escuchando en http://127.0.0.1:${port}`);
});