import express from 'express';
import faqRoutes from './routes/faq-routes.js';
const app = express();
const port = Number(process.env.PORT || 3008);
app.get('/health', (_request, response) => response.json({ service: 'faq', status: 'ok' }));
app.use('/api/faq', faqRoutes);
app.listen(port, '127.0.0.1', () => console.log(`faq-service escuchando en http://127.0.0.1:${port}`));