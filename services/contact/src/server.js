import express from 'express';
import contactRoutes from './routes/contact-routes.js';

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3005);

app.get('/health', (_request, response) => {
  response.json({ service: 'contact', status: 'ok' });
});
app.use('/api/contact', contactRoutes);

app.listen(port, '127.0.0.1', () => {
  console.log(`contact-service escuchando en http://127.0.0.1:${port}`);
});