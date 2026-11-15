import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3013);

const gallery = [
  { id: 'bunker-interior', image: '/assets/gym-interior.jpg', alt: 'Vista del interior de Bunker Gym', title: 'EL ESPACIO', caption: 'La cultura del hierro comienza aquí.', featured: true },
  { id: 'strength-session', image: '/assets/entrenamiento-1.jpg', alt: 'Sesión de entrenamiento de fuerza', title: 'EL PROCESO', caption: 'Constancia en cada repetición.', featured: false },
  { id: 'training-technique', image: '/assets/entrenamiento-2.jpg', alt: 'Trabajo de fuerza y técnica en el gimnasio', title: 'LA TÉCNICA', caption: 'Intención antes que apariencia.', featured: false }
];

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ service: 'gallery', status: 'ok' }));
app.get('/api/gallery', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    title: 'CULTURA DEL HIERRO',
    label: 'CONTENIDO VISUAL',
    description: 'Imágenes de los espacios y el entrenamiento de Bunker Gym.',
    items: gallery
  });
});
app.listen(port, '127.0.0.1', () => console.log('gallery-service escuchando en ' + port));