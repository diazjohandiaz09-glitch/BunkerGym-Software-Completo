BUNKER GYM - SITIO WEB Y MICROSERVICIOS
========================================

ESTRUCTURA:
- index.html, styles.css y script.js: sitio público responsive y sus secciones.
- panelmicroservicios/: centro administrativo separado con inicio y cierre de sesión.
- services/gym, training, recovery, community y contact: cinco microservicios originales.
- services/plans, facilities y faq: microservicios de planes, instalaciones y preguntas frecuentes.
- services/store: catálogo, precios, inventario y reserva de existencias para pedidos.
- services/orders: checkout de demostración, folios, registro y estados de pedidos.
- services/site: configuración persistente de textos y contenidos editables de la web.
- services/gallery: galería fotográfica independiente para el contenido visual de la página.
- services/admin: supervisor local, autenticación, proxy administrativo y gestión de los módulos comerciales.
- vite.config.js: servidor web, proxy de APIs y compilación multipágina.
- data/microservices.json: estado deseado persistente de cada microservicio.

REQUISITOS:
- Node.js 20.19 o posterior y npm.

EJECUCIÓN LOCAL:
1. En la carpeta del proyecto, ejecuta: npm install
2. Ejecuta: npm run dev
3. Sitio público: http://127.0.0.1:5173
4. Panel administrativo: http://127.0.0.1:5173/panelmicroservicios/

ACCESO AL PANEL:
- Usuario inicial: admin.
- En el primer arranque, el supervisor genera una contraseña aleatoria y la muestra una sola vez en la consola donde se ejecuta npm run dev.
- Guarda esa contraseña en un gestor de contraseñas. No se almacena en el proyecto web.
- El hash de contraseña y la clave de firma se guardan fuera del directorio público, en la carpeta hermana: bunker_gym_web - copia.private/admin-auth.json.
- Las sesiones duran 8 horas, se guardan en cookies HttpOnly y SameSite=Strict, y se invalidan al cerrar sesión o reiniciar el supervisor.
- Dentro del panel, el botón CAMBIAR CONTRASEÑA abre un formulario que exige contraseña actual, nueva contraseña y confirmación.
- La nueva contraseña requiere al menos 12 y como máximo 128 caracteres; el servidor rechaza la contraseña actual incorrecta, la confirmación distinta y la reutilización de la contraseña vigente.
- Al cambiarla se genera un salt nuevo, se calcula un nuevo hash scrypt y se guarda el archivo privado mediante reemplazo atómico.
- El cambio rota la clave de firma, cierra todas las sesiones anteriores y crea una sesión nueva solo para el navegador que hizo el cambio.
- La verificación de contraseña actual también tiene bloqueo temporal después de seis intentos fallidos en 15 minutos.
- Tras seis intentos fallidos de inicio de sesión desde el mismo cliente se bloquean nuevos intentos durante 15 minutos.
- Para regenerar credenciales olvidadas: detén npm run dev, elimina el archivo admin-auth.json de la carpeta privada indicada y vuelve a iniciar npm run dev. Se generará una contraseña inicial nueva y se mostrará una sola vez en la consola.
- No compartas el archivo admin-auth.json ni la contraseña.

ORIGEN Y COOKIES:
- Por defecto el panel acepta el origen local http://127.0.0.1:5173 y http://localhost:5173.
- Si usas otro dominio/puerto, define PANEL_ALLOWED_ORIGINS con una lista separada por comas antes de iniciar el servidor.
- Si publicas mediante HTTPS, define ADMIN_COOKIE_SECURE=true.
- No expongas el puerto del supervisor 3009 a internet. Mantén el proxy y agrega autenticación HTTPS en cualquier despliegue remoto.

MICROSERVICIOS Y PUERTOS:
- gym: 3001 - Espacio Bunker
- training: 3002 - Entrenamiento
- recovery: 3003 - Acompañamiento
- community: 3004 - Comunidad
- contact: 3005 - Contacto
- plans: 3006 - Planes y modalidades
- facilities: 3007 - Instalaciones
- faq: 3008 - Preguntas frecuentes
- admin: 3009 - Supervisor y administración
- store: 3010 - Tienda virtual e inventario
- orders: 3011 - Pedidos y compras
- site: 3012 - Configuración de la web
- gallery: 3013 - Galería y cultura visual

CONTROL REAL:
- El panel usa PATCH /api/admin/services/:id con { "enabled": false|true }.
- Apagar detiene el proceso Node del microservicio. Encender inicia un proceso independiente.
- POST /api/admin/services/:id/restart reinicia un servicio.
- GET /api/admin/services devuelve el estado y requiere sesión administrativa.
- Las rutas de administración comprueban la sesión firmada y el origen de las solicitudes que modifican datos.
- El estado deseado se guarda en data/microservices.json y se respeta al reiniciar el supervisor.
- La página pública avisa cuando un microservicio está apagado.

TIENDA Y ADMINISTRACIÓN COMERCIAL:
- La tienda pública consume /api/store/products y muestra el inventario disponible.
- El checkout valida los datos del comprador y las cantidades contra el inventario del microservicio store.
- Los pedidos reciben un folio BG, guardan comprador, artículos, total y estado en data/orders.json.
- La compra es exclusivamente demostrativa: no integra pasarela de pago, no procesa tarjetas y no realiza cobros.
- En el panel, la pestaña PEDIDOS permite consultar compras y actualizar su estado; cancelar un pedido devuelve las unidades al inventario.
- La pestaña CATÁLOGO permite crear, editar, activar/desactivar productos, precios e inventario.
- La pestaña CONFIGURAR WEB permite editar textos del hero, sección nosotros, cinta de anuncios y tienda; el microservicio site persiste los cambios en data/site-settings.json.
- Los servicios store, orders, site y gallery pueden encenderse o apagarse desde MICROSERVICIOS; las secciones públicas muestran el aviso correspondiente cuando un servicio está apagado.
- La galería visual consume /api/gallery y se administra como microservicio independiente.

NOTAS:
- Las tarjetas y los módulos públicos consumen sus APIs independientes.
- El acompañamiento de recuperación no sustituye la valoración ni el tratamiento de profesionales de salud.
- El reel de Instagram depende de la disponibilidad y políticas de la plataforma.
- WhatsApp, dirección e Instagram conservan los datos originales del proyecto.


PRESENTACIÓN Y RECURSOS ESTÁTICOS:
- La portada pública ya no muestra la cuadrícula de tarjetas de microservicios; el control de procesos permanece solo en /panelmicroservicios/.
- La tienda incluye búsqueda por texto y filtros por suplementos, ropa y accesorios.
- Los suplementos aparecen con etiqueta de fotografía de referencia y aviso visible para distinguir la imagen de la presentación comercial real.
- Los recursos que se cargan por URL dinámica están duplicados en public/assets para que Vite también los incluya en dist durante la compilación de producción.
- Después de actualizar archivos estáticos, ejecuta npm run build para regenerar dist.