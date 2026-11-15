import express from 'express';
import recoveryRoutes from './routes/recovery-routes.js';

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3003);

app.get('/health', (_request, response) => {
  response.json({ service: 'recovery', status: 'ok' });
});
app.use('/api/recovery', recoveryRoutes);

app.listen(port, '127.0.0.1', () => {
  console.log(`recovery-service escuchando en http://127.0.0.1:${port}`);
});