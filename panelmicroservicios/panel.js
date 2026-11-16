const groupOrder = ['Experiencia', 'Nuevos módulos', 'Comercio digital', 'Contenido visual'];
const container = document.getElementById('service-groups');
const feedback = document.getElementById('feedback');
const supervisorState = document.getElementById('supervisor-state');
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginFeedback = document.getElementById('login-feedback');
const loginSubmit = document.getElementById('login-submit');
const passwordInput = document.getElementById('login-password');
const logoutButton = document.getElementById('logout-button');
const passwordOpenButton = document.getElementById('password-open');
const passwordModal = document.getElementById('password-modal');
const changePasswordForm = document.getElementById('change-password-form');
const credentialUpdateButton = document.getElementById('password-save');
const changePasswordFeedback = document.getElementById('change-password-feedback');
const busy = new Set();
let services = [];
let refreshInProgress = false;

const $ = id => document.getElementById(id);

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.includes('/auth/')) {
    showLogin('Tu sesión ha expirado. Vuelve a iniciar sesión.');
  }
  if (!response.ok) throw new Error(body.error || `Error HTTP ${response.status}`);
  return body;
}

function showLogin(message = '') {
  loginScreen.hidden = false;
  dashboard.hidden = true;
  logoutButton.hidden = true;
  passwordOpenButton.hidden = true;
  closePasswordModal();
  loginFeedback.textContent = message;
  services = [];
}

function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
  passwordOpenButton.hidden = false;
  activateAdminTab('services');
  void loadAdminWorkspace();
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle('feedback--error', isError);
}

async function checkSession() {
  try {
    const state = await api('/api/admin/auth/session');
    if (state.authenticated) {
      showDashboard();
      await refresh();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin('No se pudo verificar la sesión. Comprueba que el supervisor esté iniciado.');
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginFeedback.textContent = '';
  loginSubmit.disabled = true;
  loginSubmit.textContent = 'VERIFICANDO…';
  try {
    await api('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('login-username').value.trim(),
        password: passwordInput.value
      })
    });
    passwordInput.value = '';
    showDashboard();
    await refresh();
  } catch (error) {
    loginFeedback.textContent = error.message || 'No se pudo iniciar sesión.';
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.innerHTML = 'INICIAR SESIÓN <span>↗</span>';
  }
});

$('toggle-password').addEventListener('click', event => {
  const visible = passwordInput.type === 'password';
  passwordInput.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'OCULTAR' : 'MOSTRAR';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});

logoutButton.addEventListener('click', async () => {
  try {
    await api('/api/admin/auth/logout', { method: 'POST' });
    showLogin('Sesión cerrada correctamente.');
  } catch (error) {
    setFeedback(`No se pudo cerrar la sesión: ${error.message}`, true);
  }
});

function closePasswordModal() {
  passwordModal.hidden = true;
  changePasswordForm.reset();
  changePasswordFeedback.textContent = '';
  credentialUpdateButton.disabled = false;
  credentialUpdateButton.innerHTML = 'GUARDAR CONTRASEÑA <span>↗</span>';
}

function openPasswordModal() {
  changePasswordForm.reset();
  changePasswordFeedback.textContent = '';
  passwordModal.hidden = false;
  $('current-password').focus();
}

passwordOpenButton.addEventListener('click', openPasswordModal);
$('password-close').addEventListener('click', closePasswordModal);
$('password-cancel').addEventListener('click', closePasswordModal);

passwordModal.addEventListener('click', event => {
  if (event.target === passwordModal) closePasswordModal();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !passwordModal.hidden) closePasswordModal();
});

changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const currentPassword = $('current-password').value;
  const newPassword = $('new-password').value;
  const confirmPassword = $('confirm-password').value;

  if (newPassword.length < 12) {
    changePasswordFeedback.textContent = 'La nueva contraseña debe tener al menos 12 caracteres.';
    return;
  }
  if (newPassword !== confirmPassword) {
    changePasswordFeedback.textContent = 'La confirmación no coincide con la nueva contraseña.';
    return;
  }
  if (newPassword === currentPassword) {
    changePasswordFeedback.textContent = 'La nueva contraseña debe ser diferente de la actual.';
    return;
  }

  credentialUpdateButton.disabled = true;
  credentialUpdateButton.textContent = 'ACTUALIZANDO…';
  changePasswordFeedback.textContent = '';
  try {
    const result = await api('/api/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    closePasswordModal();
    setFeedback(result.message || 'Contraseña actualizada correctamente. Las otras sesiones se cerraron.');
    await refresh({ quiet: true });
  } catch (error) {
    changePasswordFeedback.textContent = error.message || 'No se pudo actualizar la contraseña.';
    credentialUpdateButton.disabled = false;
    credentialUpdateButton.innerHTML = 'GUARDAR CONTRASEÑA <span>↗</span>';
  }
});

function updateCounters() {
  $('stat-total').textContent = services.length;
  $('stat-online').textContent = services.filter(service => service.status === 'online').length;
  $('stat-disabled').textContent = services.filter(service => service.status === 'disabled').length;
  $('stat-offline').textContent = services.filter(service => service.status === 'offline').length;
}

function statusText(service) {
  if (service.status === 'online') return 'EN LÍNEA';
  if (service.status === 'disabled') return 'APAGADO';
  return 'NO DISPONIBLE';
}

function createServiceCard(service) {
  const card = document.createElement('article');
  card.className = `service-card service-card--${service.status}`;

  const top = document.createElement('div');
  top.className = 'card-top';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = service.name;
  const meta = document.createElement('small');
  meta.className = 'card-meta';
  meta.textContent = `ID: ${service.id} · PUERTO ${service.port}`;
  titleWrap.append(title, meta);

  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${service.status}`;
  badge.textContent = statusText(service);
  top.append(titleWrap, badge);

  const description = document.createElement('p');
  description.className = 'card-description';
  description.textContent = service.description;

  const controls = document.createElement('div');
  controls.className = 'card-controls';
  const switchLabel = document.createElement('label');
  switchLabel.className = 'switch';
  switchLabel.title = service.enabled ? 'Apagar microservicio' : 'Encender microservicio';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(service.enabled);
  input.disabled = busy.has(service.id);
  input.setAttribute('aria-label', `${service.enabled ? 'Apagar' : 'Encender'} ${service.name}`);

  const track = document.createElement('span');
  track.className = 'switch-track';
  switchLabel.append(input, track);

  const caption = document.createElement('span');
  caption.className = 'switch-caption';
  caption.textContent = service.enabled ? 'ACTIVO' : 'APAGADO';
  controls.append(switchLabel, caption);
  input.addEventListener('change', () => changeState(service.id, input.checked));

  if (service.enabled && service.status === 'offline') {
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'restart-button';
    restart.textContent = 'REINICIAR ↻';
    restart.disabled = busy.has(service.id);
    restart.addEventListener('click', () => restartService(service.id));
    controls.append(restart);
  }

  card.append(top, description, controls);
  return card;
}

function render() {
  container.replaceChildren();
  for (const groupName of groupOrder) {
    const items = services.filter(service => service.group === groupName);
    if (!items.length) continue;
    const title = document.createElement('h3');
    title.className = 'group-title';
    title.textContent = groupName.toUpperCase();
    const grid = document.createElement('div');
    grid.className = 'service-grid';
    items.forEach(service => grid.append(createServiceCard(service)));
    container.append(title, grid);
  }
}

async function refresh({ quiet = false } = {}) {
  if (refreshInProgress || dashboard.hidden) return;
  refreshInProgress = true;
  try {
    const result = await api('/api/admin/services');
    services = result.services || [];
    updateCounters();
    render();
    supervisorState.textContent = 'CONECTADO · ESTADOS ACTUALIZADOS';
    if (!quiet) setFeedback('Estados sincronizados con el supervisor local.');
  } catch (error) {
    supervisorState.textContent = 'SIN CONEXIÓN CON EL SUPERVISOR';
    setFeedback(`No se pudo consultar el estado: ${error.message}. Comprueba que npm run dev esté iniciado.`, true);
    if (!services.length && !dashboard.hidden) {
      container.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No fue posible cargar los microservicios. Actualiza esta página después de iniciar el servidor.';
      container.append(empty);
    }
  } finally {
    refreshInProgress = false;
  }
}

async function changeState(id, enabled) {
  const service = services.find(item => item.id === id);
  if (!service) return;
  busy.add(id);
  render();
  setFeedback(enabled ? `Encendiendo ${service.name}…` : `Apagando ${service.name}…`);
  try {
    const result = await api(`/api/admin/services/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    });
    setFeedback(enabled
      ? `${result.service.name} está encendido y disponible.`
      : `${result.service.name} fue apagado. La página pública mostrará el aviso de microservicio apagado.`);
  } catch (error) {
    setFeedback(`No fue posible cambiar el estado de ${service.name}: ${error.message}`, true);
  } finally {
    busy.delete(id);
    await refresh({ quiet: true });
  }
}

async function restartService(id) {
  const service = services.find(item => item.id === id);
  if (!service) return;
  busy.add(id);
  render();
  setFeedback(`Reiniciando ${service.name}…`);
  try {
    const result = await api(`/api/admin/services/${encodeURIComponent(id)}/restart`, { method: 'POST' });
    setFeedback(`${result.service.name} se reinició correctamente.`);
  } catch (error) {
    setFeedback(`No fue posible reiniciar ${service.name}: ${error.message}`, true);
  } finally {
    busy.delete(id);
    await refresh({ quiet: true });
  }
}

$('refresh-button').addEventListener('click', () => refresh());
$('year').textContent = new Date().getFullYear();
void checkSession();

window.setInterval(() => {
  if (!document.hidden && !dashboard.hidden) void refresh({ quiet: true });
}, 10000);
// -----------------------------------------------------------------------------
// Administración comercial: pedidos, catálogo y contenido del sitio.
// Todas las rutas /api/admin/* mantienen la autenticación del servidor.
// -----------------------------------------------------------------------------
const adminTabButtons = [...document.querySelectorAll('[data-tab-target]')];
const adminTabPanels = [...document.querySelectorAll('[data-admin-tab-panel]')];
let cachedOrders = [];
let cachedProducts = [];
let cachedSiteSettings = null;
let editingProductId = '';

function activateAdminTab(tab) {
  adminTabButtons.forEach(button => {
    const active = button.dataset.tabTarget === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  adminTabPanels.forEach(panel => { panel.hidden = panel.dataset.adminTabPanel !== tab; });
  if (tab === 'orders') void loadOrders();
  if (tab === 'catalog') void loadCatalog();
  if (tab === 'site') void loadSiteSettingsAdmin();
}
adminTabButtons.forEach(button => button.addEventListener('click', () => activateAdminTab(button.dataset.tabTarget)));
function loadAdminWorkspace() { void loadOrders(); void loadCatalog(); void loadSiteSettingsAdmin(); }

function cop(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
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

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = String(content);
  return element;
}
function feedbackAt(id, message, isError = false) {
  const target = $(id);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('feedback--error', isError);
}

async function loadOrders() {
  const list = $('orders-list');
  if (!list || dashboard.hidden) return;
  try {
    const result = await api('/api/admin/orders');
    cachedOrders = result.orders || [];
    $('orders-total').textContent = cachedOrders.length;
    $('orders-pending').textContent = cachedOrders.filter(order => !['ENTREGADO','CANCELADO'].includes(order.status)).length;
    $('orders-value').textContent = cop(cachedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
    list.replaceChildren();
    if (!cachedOrders.length) {
      list.append(node('p','empty-state','Todavía no hay compras registradas. Los pedidos aparecerán aquí.'));
      return;
    }
    cachedOrders.forEach(order => {
      const card = node('article','order-admin-card');
      const head = node('div','order-admin-head');
      const title = node('div','order-admin-title');
      title.append(node('b','',order.folio),node('small','',new Date(order.createdAt).toLocaleString('es-CO')));
      head.append(title,node('span','order-status',order.status));
      const customer = node('div','order-customer');
      customer.append(node('b','',order.customer?.name || 'Comprador'),node('span','',order.customer?.email || ''),node('span','',order.customer?.phone || ''));
      const address = node('p','order-address',[order.customer?.address,order.customer?.city].filter(Boolean).join(' · '));
      const lines = node('div','order-lines');
      (order.items || []).forEach(item => lines.append(node('p','',item.quantity + ' × ' + item.name + ' — ' + cop(item.subtotal))));
      const foot = node('div','order-admin-foot');
      foot.append(node('b','',cop(order.total)),node('small','',order.paymentStatus || 'SIMULACIÓN'));
      const statusWrap = node('label','order-status-control');
      statusWrap.append(node('span','','ACTUALIZAR ESTADO'));
      const select = document.createElement('select');
      ['RECIBIDO','CONFIRMADO','PREPARANDO','ENVIADO','ENTREGADO','CANCELADO'].forEach(value => {
        const option = document.createElement('option');
        option.value = value; option.textContent = value; option.selected = value === order.status;
        select.append(option);
      });
      select.disabled = order.status === 'CANCELADO';
      select.addEventListener('change',async () => {
        select.disabled = true;
        try {
          await api('/api/admin/orders/' + encodeURIComponent(order.id),{method:'PATCH',body:JSON.stringify({status:select.value})});
          feedbackAt('orders-feedback','Pedido ' + order.folio + ' actualizado a ' + select.value + '.');
          await loadOrders();
        } catch(error) {
          feedbackAt('orders-feedback',error.message,true);
          select.disabled = false; select.value = order.status;
        }
      });
      statusWrap.append(select);
      card.append(head,customer,address,lines,foot,statusWrap);
      list.append(card);
    });
  } catch(error) {
    list.replaceChildren(node('p','empty-state','No se pudieron cargar los pedidos. Verifica el microservicio Pedidos y compras.'));
    feedbackAt('orders-feedback',error.message,true);
  }
}

function resetProductForm() {
  $('product-form').reset();
  $('product-id').value = '';
  $('product-active').checked = true;
  $('product-form-title').textContent = 'NUEVO PRODUCTO';
  $('product-save').textContent = 'GUARDAR PRODUCTO';
  editingProductId = '';
}
function fillProductForm(product) {
  editingProductId = product.id;
  $('product-id').value = product.id;
  $('product-name').value = product.name || '';
  $('product-category').value = product.category || 'General';
  $('product-description').value = product.description || '';
  $('product-price').value = product.price || '';
  $('product-stock').value = product.stock ?? 0;
  $('product-image').value = product.image || '/assets/products/shirt.svg';
  $('product-active').checked = product.active !== false;
  $('product-form-title').textContent = 'EDITAR PRODUCTO';
  $('product-save').textContent = 'ACTUALIZAR PRODUCTO';
  $('product-form').scrollIntoView({behavior:'smooth',block:'center'});
}
async function loadCatalog() {
  const list = $('catalog-list');
  if (!list || dashboard.hidden) return;
  try {
    const result = await api('/api/admin/store/products');
    cachedProducts = result.products || [];
    list.replaceChildren();
    if (!cachedProducts.length) list.append(node('p','empty-state','No hay productos en el catálogo.'));
    cachedProducts.forEach(product => {
      const card = node('article','catalog-admin-card');
      const image = document.createElement('img');
      image.src = safeProductImageUrl(product.image); image.alt = product.name; image.loading = 'lazy';
      const details = node('div','catalog-admin-details');
      details.append(node('b','',product.name),node('small','',product.category),node('p','',product.description),node('strong','',cop(product.price)),node('small','', 'Inventario: ' + product.stock + ' · ' + (product.active ? 'ACTIVO' : 'INACTIVO')));
      const actions = node('div','catalog-admin-actions');
      const edit = node('button','admin-secondary-button','EDITAR');
      edit.type='button'; edit.addEventListener('click',()=>fillProductForm(product));
      const toggle = node('button','admin-secondary-button',product.active?'DESACTIVAR':'ACTIVAR');
      toggle.type='button'; toggle.addEventListener('click',async()=>{
        try {
          await api('/api/admin/store/products/' + encodeURIComponent(product.id),{method:'PUT',body:JSON.stringify({...product,active:!product.active})});
          feedbackAt('catalog-feedback','Estado del producto actualizado.');
          await loadCatalog();
        } catch(error) { feedbackAt('catalog-feedback',error.message,true); }
      });
      actions.append(edit,toggle); card.append(image,details,actions); list.append(card);
    });
  } catch(error) {
    list.replaceChildren(node('p','empty-state','No se pudo cargar el catálogo. Verifica el microservicio Tienda virtual.'));
    feedbackAt('catalog-feedback',error.message,true);
  }
}
$('product-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const payload = {
    name:$('product-name').value.trim(), category:$('product-category').value,
    description:$('product-description').value.trim(), price:Number($('product-price').value),
    stock:Number($('product-stock').value), image:$('product-image').value, active:$('product-active').checked
  };
  $('product-save').disabled=true;
  try {
    if(editingProductId) {
      await api('/api/admin/store/products/' + encodeURIComponent(editingProductId),{method:'PUT',body:JSON.stringify(payload)});
      feedbackAt('catalog-feedback','Producto actualizado. La tienda pública reflejará los cambios.');
    } else {
      await api('/api/admin/store/products',{method:'POST',body:JSON.stringify(payload)});
      feedbackAt('catalog-feedback','Producto creado y publicado en la tienda.');
    }
    resetProductForm(); await loadCatalog();
  } catch(error) { feedbackAt('catalog-feedback',error.message,true); }
  finally { $('product-save').disabled=false; }
});
$('product-reset').addEventListener('click',resetProductForm);

const siteFieldMap = {
  announcement:'setting-announcement', heroEyebrow:'setting-hero-eyebrow',
  heroTitle:'setting-hero-title', heroAccent:'setting-hero-accent', heroLead:'setting-hero-lead',
  aboutTitle:'setting-about-title', aboutAccent:'setting-about-accent', aboutText:'setting-about-text',
  shopTitle:'setting-shop-title', shopAccent:'setting-shop-accent', shopDescription:'setting-shop-description'
};
function renderSiteSettingsForm(settings) {
  cachedSiteSettings=settings;
  Object.entries(siteFieldMap).forEach(([key,id])=>{$(id).value=settings[key] || '';});
  $('setting-announcement-enabled').checked=settings.announcementEnabled !== false;
}
async function loadSiteSettingsAdmin() {
  if(dashboard.hidden) return;
  try {
    const result=await api('/api/admin/site-settings');
    renderSiteSettingsForm(result);
  } catch(error) { feedbackAt('site-settings-feedback',error.message,true); }
}
$('site-settings-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const payload=Object.fromEntries(Object.entries(siteFieldMap).map(([key,id])=>[key,$(id).value.trim()]));
  payload.announcementEnabled=$('setting-announcement-enabled').checked;
  $('site-settings-save').disabled=true;
  try {
    const result=await api('/api/admin/site-settings',{method:'PUT',body:JSON.stringify(payload)});
    renderSiteSettingsForm(result.settings);
    feedbackAt('site-settings-feedback','Configuración guardada. La web pública mostrará los nuevos textos.');
  } catch(error) { feedbackAt('site-settings-feedback',error.message,true); }
  finally { $('site-settings-save').disabled=false; }
});
$('site-settings-reset').addEventListener('click',()=>{
  if(cachedSiteSettings) renderSiteSettingsForm(cachedSiteSettings);
  feedbackAt('site-settings-feedback','Cambios sin guardar descartados.');
});
$('orders-refresh').addEventListener('click',loadOrders);
$('catalog-refresh').addEventListener('click',loadCatalog);
$('site-settings-refresh').addEventListener('click',loadSiteSettingsAdmin);