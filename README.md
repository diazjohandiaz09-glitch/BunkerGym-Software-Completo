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

La primera ejecución genera credenciales administrativas aleatorias. La contraseña inicial se entrega una sola vez en un archivo privado fuera del directorio público del proyecto; consulta ese archivo en el equipo donde se ejecuta el servicio y guárdalo de forma segura. Después del primer inicio de sesión correcto, el archivo de entrega se elimina automáticamente.

## Microservicios
gym 3001; training 3002; recovery 3003; community 3004; contact 3005; plans 3006; facilities 3007; faq 3008; admin 3009; store 3010; orders 3011; site 3012; gallery 3013.

## Pruebas automatizadas
Ejecuta las pruebas con Node.js:
```bash
npm test
```

Para generar un informe de cobertura LCOV compatible con SonarCloud:
```bash
npx --yes c8@10.1.3 --include=assets/js/product-image-url.js --reporter=text --reporter=lcov --reports-dir=coverage npm test
```
El informe se genera en `coverage/lcov.info`. El flujo de GitHub Actions ejecuta las pruebas y la compilación en cada push a `main` y en cada pull request; también conserva el informe LCOV como artefacto durante 14 días.

## Compilar
```bash
npm run build
```

## Seguridad
- No publiques archivos .env, claves, tokens ni credenciales.
- Los pedidos, que contienen datos personales, se guardan fuera del directorio público del proyecto, en el directorio privado de datos.
- La autenticación administrativa se mantiene fuera del repositorio.
- La tienda/checkout es demostrativa: no integra pasarela de pago ni realiza cobros.
- No expongas directamente el puerto 3009 a Internet. Configura HTTPS y proxy inverso para cualquier despliegue público.
