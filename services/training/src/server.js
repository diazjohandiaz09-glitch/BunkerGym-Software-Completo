import express from 'express';
import trainingRoutes from './routes/training-routes.js';

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3002);

app.get('/health', (_request, response) => {
  response.json({ service: 'training', status: 'ok' });
});
app.use('/api/training', trainingRoutes);

app.listen(port, '127.0.0.1', () => {
  console.log(`training-service escuchando en http://127.0.0.1:${port}`);
});