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
Sitio: http://127.0.0.1:5173
Panel: http://127.0.0.1:5173/panelmicroservicios/

La primera ejecución crea una contraseña administrativa aleatoria y la muestra una sola vez en la consola. Guárdala de forma segura.

## Microservicios
gym 3001; training 3002; recovery 3003; community 3004; contact 3005; plans 3006; facilities 3007; faq 3008; admin 3009; store 3010; orders 3011; site 3012; gallery 3013.

## Compilar
```bash
npm run build
```

## Seguridad
- No publiques archivos .env, claves, tokens ni credenciales.
- Los pedidos reales se guardan localmente en data/orders.json, excluido de Git. El archivo se crea automáticamente vacío.
- La autenticación administrativa se mantiene fuera del repositorio.
- La tienda/checkout es demostrativa: no integra pasarela de pago ni realiza cobros.
- No expongas directamente el puerto 3009 a Internet. Configura HTTPS y proxy inverso para cualquier despliegue público.
