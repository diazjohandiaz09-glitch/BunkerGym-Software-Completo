const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '×' : '☰';
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '☰';
  }));
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const serviceCards = document.getElementById('service-cards');
const serviceError = document.getElementById('service-error');
const adminCards = document.getElementById('admin-services');
const adminFeedback = document.getElementById('admin-feedback');
const adminServicesUrl = '/api/public/services';

const publicModules = [
  { id: 'gym', endpoint: '/api/gym', name: 'Espacio Bunker', port: 3001 },
  { id: 'training', endpoint: '/api/training', name: 'Entrenamiento', port: 3002 },
  { id: 'recovery', endpoint: '/api/recovery', name: 'Acompañamiento', port: 3003 },
  { id: 'community', endpoint: '/api/community', name: 'Comunidad', port: 3004 },
  { id: 'contact', endpoint: '/api/contact', name: 'Contacto', port: 3005 },
  { id: 'plans', endpoint: '/api/plans', name: 'Planes', port: 3006 },
  { id: 'facilities', endpoint: '/api/facilities', name: 'Instalaciones', port: 3007 },
  { id: 'faq', endpoint: '/api/faq', name: 'Preguntas frecuentes', port: 3008 },
  { id: 'store', endpoint: '/api/store/products', name: 'Tienda virtual', port: 3010, group: 'COMERCIO DIGITAL', description: 'Catálogo de productos Bunker, precios e inventario actualizado.', href: '#tienda', action: 'IR A LA TIENDA' },
  { id: 'orders', endpoint: '/api/orders/health', name: 'Pedidos y compras', port: 3011, group: 'COMERCIO DIGITAL', description: 'Registro y seguimiento de pedidos de la tienda virtual.', href: '#tienda', action: 'HACER UN PEDIDO' },
  { id: 'site', endpoint: '/api/site/settings', name: 'Configuración del sitio', port: 3012, group: 'PLATAFORMA', description: 'Contenido dinámico y personalización de la experiencia web.', href: '#inicio', action: 'DESCUBRIR BUNKER' },
  { id: 'gallery', endpoint: '/api/gallery', name: 'Galería y cultura visual', port: 3013, group: 'CONTENIDO VISUAL', description: 'Fotografías de nuestros espacios y sesiones de entrenamiento.', href: '#cultura-bunker', action: 'VER GALERÍA' }
];

const sectionTargets = {
  plans: { grid: 'plans-grid', alert: 'plans-alert' },
  facilities: { grid: 'facilities-grid', alert: 'facilities-alert' },
  faq: { grid: 'faq-list', alert: 'faq-alert' },
  gallery: { grid: 'visual-gallery', alert: 'gallery-alert' }
};

let currentServices = [];
let busyServiceIds = new Set();
const renderedModuleStatus = new Map();

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Error HTTP ${response.status}`);
  return body;
}

function createStatusMessage(kind, serviceName) {
  const message = document.createElement('p');
  message.className = `service-unavailable service-unavailable--${kind}`;
  if (kind === 'disabled') {
    message.textContent = 'Este microservicio fue apagado desde el centro de administración.';
  } else {
    message.textContent = 'Este microservicio no está disponible en este momento. Intenta de nuevo más tarde.';
  }
  message.setAttribute('role', 'status');
  message.dataset.service = serviceName;
  return message;
}

function createServiceCard(definition, status, data) {
  const isAvailable = status.status === 'online' && data;
  const card = document.createElement(isAvailable ? 'a' : 'article');
  card.className = `service-card ${isAvailable ? '' : 'service-card--unavailable'}`;
  if (isAvailable) {
    card.href = data.href || definition.href || '#servicios';
    if (card.href.startsWith('https://')) {
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }
  } else {
    card.setAttribute('aria-disabled', 'true');
  }

  const number = document.createElement('span');
  number.className = 'service-card-number';
  number.textContent = data?.number || String(definition.port - 3000).padStart(2, '0');

  const label = document.createElement('span');
  label.className = 'service-card-label';
  label.textContent = data?.label || definition.group || 'BUNKER GYM';

  const state = document.createElement('span');
  state.className = `service-card-state state-${status.status}`;
  state.textContent = status.status === 'disabled' ? 'APAGADO' : status.status === 'online' ? 'EN LÍNEA' : 'SIN CONEXIÓN';

  const title = document.createElement('h3');
  title.textContent = data?.title || definition.name.toUpperCase();

  const description = document.createElement('p');
  description.textContent = data?.description || definition.description || 'Un módulo digital de la experiencia Bunker Gym.';

  card.append(number, state, label, title, description);
  if (isAvailable) {
    const action = document.createElement('span');
    action.className = 'service-card-action';
    action.textContent = `${data.action || definition.action || 'CONOCER MÁS'} ↗`;
    card.append(action);
  } else {
    card.append(createStatusMessage(status.status, definition.id));
  }
  return card;
}

async function renderPublicCards() {
  if (!serviceCards) return;
  const cards = await Promise.all(publicModules.map(async definition => {
    const status = currentServices.find(item => item.id === definition.id);
    if (!status) return createServiceCard(definition, { status: 'offline' }, null);
    if (status.status !== 'online') return createServiceCard(definition, status, null);
    try {
      const data = await requestJson(definition.endpoint);
      return createServiceCard(definition, status, data);
    } catch (error) {
      console.warn(`No se pudo cargar ${definition.name}:`, error);
      return createServiceCard(definition, { ...status, status: 'offline' }, null);
    }
  }));
  serviceCards.replaceChildren(...cards);
  serviceCards.setAttribute('aria-busy', 'false');
  if (serviceError) {
    serviceError.hidden = true;
    serviceError.textContent = '';
  }
}

function syncSectionAlerts() {
  document.querySelectorAll('[data-microservice-alert]').forEach(alert => {
    const id = alert.dataset.microserviceAlert;
    const status = currentServices.find(item => item.id === id);
    if (status?.status === 'online') {
      alert.hidden = true;
      alert.textContent = '';
      return;
    }
    alert.hidden = false;
    alert.className = 'section-service-alert';
    if (id === 'contact') alert.classList.add('section-service-alert--contact');
    if (status?.status === 'disabled') {
      alert.textContent = 'Este microservicio fue apagado desde el centro de administración.';
      alert.classList.add('section-service-alert--disabled');
    } else {
      alert.textContent = 'Este microservicio no está disponible en este momento. Revisa su estado en el centro de administración.';
      alert.classList.add('section-service-alert--offline');
    }
  });
}

function updateAdminCounters(services) {
  const total = document.getElementById('admin-total');
  const online = document.getElementById('admin-online');
  const disabled = document.getElementById('admin-disabled');
  if (total) total.textContent = String(services.length);
  if (online) online.textContent = String(services.filter(item => item.status === 'online').length);
  if (disabled) disabled.textContent = String(services.filter(item => item.status === 'disabled').length);
}

function statusLabel(service) {
  if (service.status === 'online') return 'EN LÍNEA';
  if (service.status === 'disabled') return 'APAGADO';
  return 'NO DISPONIBLE';
}

function renderAdminRows(services) {
  if (!adminCards) return;
  adminCards.replaceChildren();
  const groups = ['Experiencia', 'Nuevos módulos'];
  groups.forEach(groupName => {
    const groupServices = services.filter(item => item.group === groupName);
    if (!groupServices.length) return;
    const heading = document.createElement('h3');
    heading.className = 'admin-group-title';
    heading.textContent = groupName.toUpperCase();
    adminCards.append(heading);

    const grid = document.createElement('div');
    grid.className = 'admin-grid';
    groupServices.forEach(service => {
      const row = document.createElement('article');
      row.className = `admin-row admin-row--${service.status}`;

      const top = document.createElement('div');
      top.className = 'admin-row-top';
      const titleWrap = document.createElement('div');
      titleWrap.className = 'admin-row-title';
      const title = document.createElement('h4');
      title.textContent = service.name;
      const code = document.createElement('span');
      code.textContent = `ID: ${service.id} · PUERTO ${service.port}`;
      titleWrap.append(title, code);
      const badge = document.createElement('span');
      badge.className = `admin-status admin-status--${service.status}`;
      badge.textContent = statusLabel(service);
      top.append(titleWrap, badge);

      const description = document.createElement('p');
      description.className = 'admin-row-description';
      description.textContent = service.description;

      const controls = document.createElement('div');
      controls.className = 'admin-row-controls';
      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch';
      switchLabel.title = service.enabled ? 'Apagar microservicio' : 'Encender microservicio';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(service.enabled);
      input.disabled = busyServiceIds.has(service.id);
      input.setAttribute('aria-label', `${service.enabled ? 'Apagar' : 'Encender'} ${service.name}`);
      const track = document.createElement('span');
      track.className = 'switch-track';
      switchLabel.append(input, track);
      const switchText = document.createElement('span');
      switchText.className = 'switch-caption';
      switchText.textContent = service.enabled ? 'ACTIVO' : 'APAGADO';
      controls.append(switchLabel, switchText);

      input.addEventListener('change', () => changeServiceState(service.id, input.checked));
      if (service.enabled && service.status === 'offline') {
        const restart = document.createElement('button');
        restart.type = 'button';
        restart.className = 'admin-restart';
        restart.textContent = 'REINICIAR ↻';
        restart.disabled = busyServiceIds.has(service.id);
        restart.addEventListener('click', () => restartService(service.id));
        controls.append(restart);
      }

      row.append(top, description, controls);
      grid.append(row);
    });
    adminCards.append(grid);
  });
}

async function refreshServices({ quiet = false } = {}) {
  try {
    const result = await requestJson(adminServicesUrl, { cache: 'no-store' });
    currentServices = result.services || [];
    updateAdminCounters(currentServices);
    renderAdminRows(currentServices);
    await renderPublicCards();
    syncSectionAlerts();
    await Promise.all([
      loadPlans(),
      loadFacilities(),
      loadFaq(),
      loadGallery(),
      loadStoreProducts(),
      loadSiteSettings()
    ]);
    if (!quiet && adminFeedback) adminFeedback.textContent = 'Estados sincronizados con el supervisor local.';
  } catch (error) {
    console.error('No se pudo conectar con Bunker Control Center:', error);
    if (adminFeedback) adminFeedback.textContent = 'No se pudo conectar con el supervisor. Comprueba que ejecutaste npm run dev.';
    if (serviceError) {
      serviceError.hidden = false;
      serviceError.textContent = 'No se pudo consultar el estado de los microservicios. El panel administrativo debe estar iniciado.';
    }
  }
}

async function changeServiceState(id, enabled) {
  busyServiceIds.add(id);
  renderAdminRows(currentServices);
  if (adminFeedback) adminFeedback.textContent = enabled ? 'Iniciando microservicio…' : 'Apagando proceso del microservicio…';
  try {
    await requestJson(`/api/admin/services/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    });
    if (adminFeedback) adminFeedback.textContent = enabled
      ? 'Microservicio encendido y disponible.'
      : 'Microservicio apagado. La sección pública ya muestra su aviso de indisponibilidad.';
  } catch (error) {
    if (adminFeedback) adminFeedback.textContent = `No fue posible cambiar el estado: ${error.message}`;
  } finally {
    busyServiceIds.delete(id);
    await refreshServices({ quiet: true });
  }
}

async function restartService(id) {
  busyServiceIds.add(id);
  renderAdminRows(currentServices);
  if (adminFeedback) adminFeedback.textContent = 'Reiniciando microservicio…';
  try {
    await requestJson(`/api/admin/services/${encodeURIComponent(id)}/restart`, { method: 'POST' });
    if (adminFeedback) adminFeedback.textContent = 'Microservicio reiniciado correctamente.';
  } catch (error) {
    if (adminFeedback) adminFeedback.textContent = `No fue posible reiniciar el servicio: ${error.message}`;
  } finally {
    busyServiceIds.delete(id);
    await refreshServices({ quiet: true });
  }
}

async function loadModuleData(id, endpoint, target) {
  const grid = document.getElementById(target.grid);
  const alert = document.getElementById(target.alert);
  if (!grid || !alert) return;
  const status = currentServices.find(item => item.id === id);
  const renderKey = status?.status || 'offline';
  if (renderedModuleStatus.get(id) === renderKey) return;
  alert.hidden = true;
  alert.textContent = '';
  if (!status || status.status !== 'online') {
    renderedModuleStatus.set(id, renderKey);
    grid.replaceChildren();
    alert.hidden = false;
    alert.textContent = status?.status === 'disabled'
      ? 'Este microservicio fue apagado desde el centro de administración. Esta sección se habilitará cuando vuelvas a encenderlo.'
      : 'Este microservicio no está disponible en este momento. Intenta nuevamente más tarde.';
    alert.className = `module-alert module-alert--${status?.status === 'disabled' ? 'disabled' : 'offline'}`;
    return;
  }
  try {
    const data = await requestJson(endpoint);
    renderedModuleStatus.set(id, renderKey);
    grid.replaceChildren();
    if (id === 'plans') {
      data.items.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'extra-card';
        const number = document.createElement('span');
        number.className = 'extra-card-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const tag = document.createElement('span');
        tag.className = 'extra-card-tag';
        tag.textContent = item.tag;
        const title = document.createElement('h3');
        title.textContent = item.name;
        const detail = document.createElement('p');
        detail.textContent = item.detail;
        const note = document.createElement('small');
        note.textContent = item.note;
        card.append(number, tag, title, detail, note);
        grid.append(card);
      });
    } else if (id === 'facilities') {
      data.items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'extra-card facility-card';
        const number = document.createElement('span');
        number.className = 'extra-card-number';
        number.textContent = item.icon;
        const title = document.createElement('h3');
        title.textContent = item.name;
        const detail = document.createElement('p');
        detail.textContent = item.detail;
        card.append(number, title, detail);
        grid.append(card);
      });
    } else if (id === 'faq') {
      data.items.forEach(item => {
        const details = document.createElement('details');
        details.className = 'faq-item';
        const summary = document.createElement('summary');
        summary.textContent = item.question;
        const answer = document.createElement('p');
        answer.textContent = item.answer;
        details.append(summary, answer);
        grid.append(details);
      });
    } else if (id === 'gallery') {
      data.items.forEach(item => {
        const figure = document.createElement('figure');
        if (item.featured) figure.classList.add('gallery-feature');
        const image = document.createElement('img');
        image.src = item.image;
        image.alt = item.alt || item.title || 'Galería Bunker Gym';
        image.loading = 'lazy';
        const caption = document.createElement('figcaption');
        const title = document.createElement('b');
        title.textContent = item.title || 'BUNKER GYM';
        const description = document.createElement('span');
        description.textContent = item.caption || '';
        caption.append(title, description);
        figure.append(image, caption);
        grid.append(figure);
      });
    }
  } catch (error) {
    renderedModuleStatus.delete(id);
    grid.replaceChildren();
    alert.hidden = false;
    alert.textContent = 'No fue posible cargar el contenido de este microservicio. Comprueba su estado en el centro de administración.';
    alert.className = 'module-alert module-alert--offline';
    console.warn(`Error cargando ${id}:`, error);
  }
}

function loadPlans() {
  return loadModuleData('plans', '/api/plans', sectionTargets.plans);
}
function loadFacilities() {
  return loadModuleData('facilities', '/api/facilities', sectionTargets.facilities);
}
function loadFaq() {
  return loadModuleData('faq', '/api/faq', sectionTargets.faq);
}
function loadGallery() {
  return loadModuleData('gallery', '/api/gallery', sectionTargets.gallery);
}

const storeProductsGrid = document.getElementById('store-products');
const cartItemsNode = document.getElementById('cart-items');
const cartTotalNode = document.getElementById('cart-total');
const cartCountNode = document.getElementById('cart-count');
const checkoutForm = document.getElementById('checkout-form');
const checkoutButton = document.getElementById('checkout-submit');
const checkoutFeedback = document.getElementById('checkout-feedback');
const orderSuccess = document.getElementById('order-success');
let storeProducts = [];
let selectedStoreCategory = 'Todos';
let storeSearchTerm = '';
const storeCart = new Map();

function moneyCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function serviceIsOnline(id) {
  return currentServices.find(item => item.id === id)?.status === 'online';
}

function getVisibleProducts() {
  const query = storeSearchTerm.trim().toLocaleLowerCase('es-CO');
  return storeProducts.filter(product => {
    const matchesCategory = selectedStoreCategory === 'Todos' || product.category === selectedStoreCategory;
    const searchable = [product.name, product.category, product.description].join(' ').toLocaleLowerCase('es-CO');
    return matchesCategory && (!query || searchable.includes(query));
  });
}

function safeProductImageUrl(value) {
  const fallback = '/assets/products/shirt.svg';
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  try {
    const parsed = new URL(value, window.location.origin);
    const isLocalAsset = parsed.origin === window.location.origin && parsed.pathname.startsWith('/assets/');
    const isSecureRemoteImage = parsed.protocol === 'https:' && !parsed.username && !parsed.password;
    return isLocalAsset || isSecureRemoteImage ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function renderStoreProducts() {
  if (!storeProductsGrid) return;
  storeProductsGrid.replaceChildren();
  if (!storeProducts.length) {
    const empty = document.createElement('p');
    empty.className = 'shop-empty';
    empty.textContent = 'Por ahora no hay productos disponibles en el catálogo.';
    storeProductsGrid.append(empty);
    return;
  }

  const visibleProducts = getVisibleProducts();
  if (!visibleProducts.length) {
    const empty = document.createElement('p');
    empty.className = 'shop-empty shop-empty--filtered';
    empty.textContent = 'No encontramos productos con esos filtros. Prueba otra categoría o búsqueda.';
    storeProductsGrid.append(empty);
    return;
  }

  visibleProducts.forEach(product => {
    const card = document.createElement('article');
    card.className = 'store-product-card';
    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-image-wrap';
    const image = document.createElement('img');
    image.src = safeProductImageUrl(product.image);
    image.alt = `Fotografía de referencia de ${product.name}`;
    image.loading = 'lazy';
    if (String(product.image).toLowerCase().endsWith('.jpg')) image.className = 'product-photo-real';
    imageWrap.append(image);
    if (product.category === 'Suplementos') {
      const photoTag = document.createElement('span');
      photoTag.className = 'product-photo-tag';
      photoTag.textContent = 'FOTO DE REFERENCIA';
      imageWrap.append(photoTag);
    }

    const body = document.createElement('div');
    body.className = 'product-body';
    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = product.category || 'BUNKER';
    const title = document.createElement('h3');
    title.textContent = product.name;
    const description = document.createElement('p');
    description.textContent = product.description;
    const meta = document.createElement('div');
    meta.className = 'product-meta';
    const price = document.createElement('b');
    price.textContent = moneyCOP(product.price);
    const stock = document.createElement('small');
    stock.textContent = `${product.stock} disponibles`;
    meta.append(price, stock);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-to-cart';
    add.textContent = 'AÑADIR AL CARRITO +';
    add.disabled = product.stock < 1;
    add.addEventListener('click', () => addToCart(product.id));
    body.append(category, title, description, meta, add);
    card.append(imageWrap, body);
    storeProductsGrid.append(card);
  });
}

const storeSearchInput = document.getElementById('store-search');
if (storeSearchInput) {
  storeSearchInput.addEventListener('input', () => {
    storeSearchTerm = storeSearchInput.value;
    renderStoreProducts();
  });
}
document.querySelectorAll('[data-store-category]').forEach(button => {
  button.addEventListener('click', () => {
    selectedStoreCategory = button.dataset.storeCategory || 'Todos';
    document.querySelectorAll('[data-store-category]').forEach(option => {
      const active = option === button;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    renderStoreProducts();
  });
});

async function loadStoreProducts() {
  if (!storeProductsGrid) return;
  if (!serviceIsOnline('store')) {
    storeProducts = [];
    storeCart.clear();
    renderStoreProducts();
    renderCart();
    return;
  }
  try {
    const result = await requestJson('/api/store/products', { cache: 'no-store' });
    storeProducts = result.products || [];
    for (const [id, quantity] of storeCart) {
      const product = storeProducts.find(item => item.id === id);
      if (!product || product.stock < 1) storeCart.delete(id);
      else if (quantity > product.stock) storeCart.set(id, product.stock);
    }
    renderStoreProducts();
    renderCart();
  } catch (error) {
    storeProductsGrid.replaceChildren();
    const message = document.createElement('p');
    message.className = 'shop-empty';
    message.textContent = 'No fue posible cargar el catálogo. Comprueba el microservicio Tienda virtual desde el panel administrativo.';
    storeProductsGrid.append(message);
    console.warn('Tienda Bunker: no fue posible cargar el catálogo.');
  }
}

function addToCart(productId) {
  const product = storeProducts.find(item => item.id === productId);
  if (!product || product.stock < 1) return;
  const next = (storeCart.get(productId) || 0) + 1;
  if (next > product.stock) {
    checkoutFeedback.textContent = `Solo hay ${product.stock} unidades de ${product.name}.`;
    return;
  }
  storeCart.set(productId, next);
  checkoutFeedback.textContent = '';
  renderCart();
}

function changeCartQuantity(productId, delta) {
  const product = storeProducts.find(item => item.id === productId);
  const next = (storeCart.get(productId) || 0) + delta;
  if (next < 1) storeCart.delete(productId);
  else if (product && next <= product.stock) storeCart.set(productId, next);
  else checkoutFeedback.textContent = 'No hay más unidades disponibles de este producto.';
  renderCart();
}

function renderCart() {
  if (!cartItemsNode) return;
  cartItemsNode.replaceChildren();
  let total = 0;
  let count = 0;
  for (const [productId, quantity] of storeCart) {
    const product = storeProducts.find(item => item.id === productId);
    if (!product) continue;
    const subtotal = product.price * quantity;
    total += subtotal;
    count += quantity;
    const row = document.createElement('div');
    row.className = 'cart-item';
    const info = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = product.name;
    const price = document.createElement('small');
    price.textContent = `${quantity} × ${moneyCOP(product.price)}`;
    info.append(name, price);
    const controls = document.createElement('div');
    controls.className = 'cart-controls';
    const less = document.createElement('button');
    less.type = 'button'; less.textContent = '−'; less.setAttribute('aria-label', `Quitar una unidad de ${product.name}`);
    less.addEventListener('click', () => changeCartQuantity(productId, -1));
    const qty = document.createElement('span');
    qty.textContent = String(quantity);
    const more = document.createElement('button');
    more.type = 'button'; more.textContent = '+'; more.setAttribute('aria-label', `Añadir una unidad de ${product.name}`);
    more.disabled = quantity >= product.stock;
    more.addEventListener('click', () => changeCartQuantity(productId, 1));
    controls.append(less, qty, more);
    row.append(info, controls);
    cartItemsNode.append(row);
  }
  if (!count) {
    const empty = document.createElement('p');
    empty.className = 'cart-empty';
    empty.textContent = 'Todavía no has añadido productos.';
    cartItemsNode.append(empty);
  }
  cartTotalNode.textContent = moneyCOP(total);
  cartCountNode.textContent = `${count} ${count === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'}`;
  checkoutButton.disabled = count === 0 || !serviceIsOnline('orders') || !serviceIsOnline('store');
}

function showOrderSuccess(order) {
  orderSuccess.replaceChildren();
  orderSuccess.hidden = false;
  const badge = document.createElement('span');
  badge.className = 'order-success-label';
  badge.textContent = '✓ PEDIDO VERIFICADO · SIMULACIÓN';
  const title = document.createElement('h3');
  title.textContent = '¡TU PEDIDO FUE REGISTRADO!';
  const description = document.createElement('p');
  description.textContent = 'Tu solicitud quedó guardada en el sistema de Bunker Gym. Esta confirmación es una simulación: no se realizó ningún cobro ni se procesó un pago.';
  const folio = document.createElement('b');
  folio.className = 'order-folio';
  folio.textContent = order.folio;
  const total = document.createElement('p');
  total.textContent = `Total registrado: ${moneyCOP(order.total)}`;
  const payment = document.createElement('small');
  payment.textContent = order.paymentStatus;
  orderSuccess.append(badge, title, description, folio, total, payment);
  orderSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

if (checkoutForm) {
  checkoutForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!storeCart.size) {
      checkoutFeedback.textContent = 'Añade al menos un producto antes de continuar.';
      return;
    }
    if (!serviceIsOnline('orders') || !serviceIsOnline('store')) {
      checkoutFeedback.textContent = 'La tienda o el servicio de pedidos no está disponible en este momento.';
      return;
    }
    if (!document.getElementById('simulation-consent').checked) {
      checkoutFeedback.textContent = 'Confirma que comprendes que se trata de una simulación.';
      return;
    }

    const customer = Object.fromEntries(new FormData(checkoutForm).entries());
    const items = Array.from(storeCart, ([productId, quantity]) => ({ productId, quantity }));
    checkoutButton.disabled = true;
    checkoutButton.textContent = 'VERIFICANDO PEDIDO…';
    checkoutFeedback.textContent = '';
    orderSuccess.hidden = true;
    try {
      const result = await requestJson('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({ customer, items })
      });
      if (!result.verified || !result.simulated) throw new Error('No se recibió una confirmación válida del pedido.');
      showOrderSuccess(result.order);
      storeCart.clear();
      checkoutForm.reset();
      await loadStoreProducts();
      renderCart();
    } catch (error) {
      checkoutFeedback.textContent = error.message || 'No fue posible registrar el pedido.';
      await loadStoreProducts();
      renderCart();
    } finally {
      checkoutButton.innerHTML = 'VERIFICAR PEDIDO <span>↗</span>';
      checkoutButton.disabled = !storeCart.size || !serviceIsOnline('orders') || !serviceIsOnline('store');
    }
  });
}

async function loadSiteSettings() {
  if (!serviceIsOnline('site')) return;
  try {
    const settings = await requestJson('/api/site/settings', { cache: 'no-store' });
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node && typeof value === 'string') node.textContent = value;
    };
    setText('site-hero-eyebrow', settings.heroEyebrow);
    setText('site-hero-title', settings.heroTitle);
    setText('site-hero-accent', settings.heroAccent);
    setText('site-hero-lead', settings.heroLead);
    setText('site-about-title', settings.aboutTitle);
    setText('site-about-accent', settings.aboutAccent);
    setText('site-about-text', settings.aboutText);
    setText('shop-title', settings.shopTitle);
    setText('shop-accent', settings.shopAccent);
    setText('shop-description', settings.shopDescription);
    setText('site-announcement', settings.announcement);
    const ticker = document.querySelector('.ticker');
    if (ticker) ticker.hidden = settings.announcementEnabled === false;
  } catch (error) {
    console.warn('No se pudo leer la configuración web.');
  }
}

const refreshButton = document.getElementById('admin-refresh');
if (refreshButton) refreshButton.addEventListener('click', () => refreshServices());
void refreshServices();
window.setInterval(() => {
  if (!document.hidden) void refreshServices({ quiet: true });
}, 10000);

window.addEventListener('load', () => {
  if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
});