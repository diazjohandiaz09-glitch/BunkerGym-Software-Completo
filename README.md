# Bunker Gym — software completo

Sitio web público y arquitectura de microservicios para Bunker Gym.

## Requisitos
- Node.js 20.19 o posterior
- npm

## Instalación y ejecución
```bash
npm install
npm run dev
```

- Sitio público: http://127.0.0.1:5173
- Panel administrativo: http://127.0.0.1:5173/panelmicroservicios/

En el primer inicio, el supervisor crea una contraseña administrativa aleatoria y la muestra una sola vez en la consola. Guárdala de forma segura. No hay una contraseña predeterminada incluida en el repositorio.

## Microservicios
| Servicio | Puerto |
|---|---:|
| gym | 3001 |
| training | 3002 |
| recovery | 3003 |
| community | 3004 |
| contact | 3005 |
| plans | 3006 |
| facilities | 3007 |
| faq | 3008 |
| admin (supervisor) | 3009 |
| store | 3010 |
| orders | 3011 |
| site | 3012 |
| gallery | 3013 |

## Compilar
```bash
npm run build
```

## Seguridad y datos
- No publiques archivos `.env`, claves, tokens ni credenciales.
- Los pedidos reales se guardan localmente en `data/orders.json`, que se crea automáticamente y está excluido de Git.
- El archivo de autenticación administrativa se mantiene fuera del repositorio.
- La tienda/checkout es demostrativa: no integra pasarela de pago ni realiza cobros.
- El supervisor escucha en localhost; no expongas directamente el puerto 3009 a Internet.
- Para un despliegue público, configura HTTPS, secretos de entorno y un proxy inverso seguro.

## Estructura
- `services/`: 13 servicios independientes.
- `panelmicroservicios/`: interfaz administrativa.
- `assets/` y `public/assets/`: recursos gráficos.
- `data/`: configuración y catálogo de ejemplo.
- `vite.config.js`: servidor de desarrollo, proxy y compilación.
