/* ============================================================
   app.js — Sistema de Matrículas Colegio San Andrés (SPA)
   ============================================================ */

const API = '/api';
let TOKEN = localStorage.getItem('token');
let USER = JSON.parse(localStorage.getItem('user') || '{}');
let CURRENT_VIEW = 'dashboard';

// ─── Helpers ───────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('Sesión expirada'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

function puede(...roles) {
  return roles.includes(USER.rol);
}

function toast(msg, type = 'success') {
  const t = $('#toast');
  t.textContent = msg; t.className = `toast ${type} visible`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function confirmar(msg) {
  return new Promise(resolve => {
    modal('Confirmar', `<p style="font-size:15px;line-height:1.6">${msg}</p>`,
      `<button class="btn btn-success" id="btn-confirm-yes">✓ Sí, continuar</button>
       <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
    );
    $('#btn-confirm-yes').onclick = () => { modalClose(); resolve(true); };
  });
}

function skeletonRow() {
  return `<tr><td colspan="9"><div class="skeleton" style="height:24px;margin:4px 0"></div></td></tr>`;
}

function loadingCard() {
  return `
    <div class="card">
      <div class="skeleton" style="height:20px;width:200px;margin-bottom:16px"></div>
      ${Array(4).fill('<div class="skeleton" style="height:16px;margin-bottom:10px"></div>').join('')}
    </div>`;
}

function loadingStats() {
  return `<div class="stats-grid">
    ${Array(4).fill(`<div class="stat-card"><div class="skeleton" style="height:32px;width:80px;margin-bottom:8px"></div><div class="skeleton" style="height:14px;width:120px"></div></div>`).join('')}
  </div>`;
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function badge(texto, tipo = 'gray') {
  return `<span class="badge badge-${tipo}">${escHtml(texto)}</span>`;
}

function badgeEstado(estado) {
  const m = {
    'PAGADA':'green','PENDIENTE_PAGO':'yellow','ANULADA':'red',
    'CONFIRMADO':'green','PENDIENTE':'yellow','RECHAZADO':'red',
    'PREINSCRITO':'blue','MATRICULADO':'green','RETIRADO':'red',
    'ESPERA':'yellow','ASIGNADO':'green','CANCELADO':'red',
    '1':'green','0':'gray',
  };
  return badge(estado, m[estado] || 'gray');
}

function modal(title, bodyHtml, footerHtml = '') {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-footer').innerHTML = footerHtml;
  $('#modal-overlay').classList.remove('hidden');
}

function modalClose() {
  $('#modal-overlay').classList.add('hidden');
}

$('#modal-close').onclick = modalClose;
$('#modal-overlay').onclick = e => { if (e.target === e.currentTarget) modalClose(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') modalClose(); });

// ─── Auth ──────────────────────────────────────────────────
function login(email, password) {
  api('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) })
    .then(data => {
      TOKEN = data.token; USER = data.user;
      localStorage.setItem('token', TOKEN);
      localStorage.setItem('user', JSON.stringify(USER));
      $('#login-screen').classList.add('hidden');
      $('#app').classList.remove('hidden');
      initApp();
    })
    .catch(err => {
      $('#login-error').textContent = err.message;
      $('#login-error').classList.remove('hidden');
    });
}

function logout() {
  if (TOKEN) api('/auth/logout', { method:'POST' }).catch(()=>{});
  TOKEN = null; USER = {};
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  $('#app').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
  $('#login-email').value = ''; $('#login-password').value = '';
}

$('#login-form').onsubmit = e => {
  e.preventDefault();
  $('#login-error').classList.add('hidden');
  login($('#login-email').value, $('#login-password').value);
};
$('#logout-btn').onclick = logout;

// ─── App Init ─────────────────────────────────────────────
function initApp() {
  renderUserInfo();
  renderNav();
  navigate('dashboard');
}

function renderUserInfo() {
  const initials = (USER.nombre?.[0] || '') + (USER.apellido?.[0] || '');
  $('#user-avatar').textContent = initials || '?';
  $('#user-name').textContent = `${USER.nombre} ${USER.apellido}`;
  $('#user-role').textContent = USER.rol;
}

function renderNav() {
  if (USER.rol === 'ADMIN') {
    $$('.admin-only').forEach(el => el.style.display = '');
  } else {
    $$('.admin-only').forEach(el => el.style.display = 'none');
  }
  // APODERADO solo ve estudiantes y matrículas
  if (USER.rol === 'APODERADO') {
    $$('.nav-item').forEach(el => {
      const v = el.dataset.view;
      if (!['dashboard','estudiantes','matriculas','reportes'].includes(v)) {
        el.style.display = 'none';
      }
    });
  }
  if (USER.rol === 'DOCENTE') {
    $$('.nav-item').forEach(el => {
      const v = el.dataset.view;
      if (!['dashboard','estudiantes','cursos','reportes'].includes(v)) {
        el.style.display = 'none';
      }
    });
  }
  if (USER.rol === 'FINANZAS') {
    $$('.nav-item').forEach(el => {
      const v = el.dataset.view;
      if (!['dashboard','matriculas','reportes'].includes(v)) {
        el.style.display = 'none';
      }
    });
  }
  if (USER.rol === 'SECRETARIA') {
    $$('.nav-item').forEach(el => {
      const v = el.dataset.view;
      if (v === 'usuarios' || v === 'anios') {
        el.style.display = 'none';
      }
    });
  }
}

// ─── Navigation ───────────────────────────────────────────
$$('.nav-item').forEach(el => {
  el.onclick = e => {
    e.preventDefault();
    navigate(el.dataset.view);
    // cerrar sidebar mobile
    $('#sidebar').classList.remove('open');
  };
});

$('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
$('#sidebar-close').onclick = () => $('#sidebar').classList.remove('open');

function navigate(view) {
  CURRENT_VIEW = view;
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const titles = { dashboard:'Dashboard', usuarios:'Usuarios', estudiantes:'Estudiantes',
                   cursos:'Cursos', matriculas:'Matrículas', reportes:'Reportes', anios:'Año Escolar' };
  $('#page-title').textContent = titles[view] || view;
  const renderers = { dashboard: renderDashboard, usuarios: renderUsuarios,
                      estudiantes: renderEstudiantes, cursos: renderCursos,
                      matriculas: renderMatriculas, reportes: renderReportes,
                      anios: renderAnios };
  (renderers[view] || renderDashboard)();
}

// ─── DASHBOARD ─────────────────────────────────────────────
async function renderDashboard() {
  const c = $('#content');
  c.innerHTML = loadingStats() + loadingCard() + loadingCard();
  try {
    const d = await api('/reportes/dashboard');
    if (!d.anio) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><h4>Sin año escolar activo</h4><p>Configura un año escolar en la sección Año Escolar para comenzar.</p></div>'; return; }

    let nivelesHtml = '';
    if (d.porNivel && d.porNivel.length) {
      nivelesHtml = '<div class="nivel-list">' + d.porNivel.map(n => `
        <div class="nivel-row">
          <span class="nivel-name">${escHtml(n.nivel)}</span>
          <span class="nivel-count">${n.total}</span>
        </div>`).join('') + '</div>';
    } else {
      nivelesHtml = '<p class="text-muted" style="padding:12px 0">Sin datos</p>';
    }

    const totalCupos = (d.totalMatriculados || 0) + (d.totalVacantes || 0);
    const ocupPct = totalCupos > 0 ? Math.round(d.totalMatriculados / totalCupos * 100) : 0;

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card success">
          <span class="stat-icon">🎓</span>
          <div class="stat-value">${d.totalMatriculados}</div>
          <div class="stat-label">Matriculados ${d.anio}</div>
        </div>
        <div class="stat-card warning">
          <span class="stat-icon">⏳</span>
          <div class="stat-value">${d.totalPendientes}</div>
          <div class="stat-label">Pendientes de pago</div>
        </div>
        <div class="stat-card info">
          <span class="stat-icon">💰</span>
          <div class="stat-value">$${Number(d.recaudado||0).toLocaleString('es-CL')}</div>
          <div class="stat-label">Recaudado</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📋</span>
          <div class="stat-value">${d.totalVacantes}</div>
          <div class="stat-label">Vacantes disponibles</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Ocupación general <span class="card-subtitle">${ocupPct}% de capacidad</span></div>
        <div class="progress-bar"><div class="progress-fill${ocupPct > 90 ? ' danger' : ocupPct > 70 ? ' warning' : ''}" style="width:${ocupPct}%"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Matriculados por nivel</div>
        ${nivelesHtml}
      </div>
    `;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Error al cargar</h4><p>${escHtml(err.message)}</p></div>`;
  }
}

// ─── USUARIOS ──────────────────────────────────────────────
async function renderUsuarios() {
  const c = $('#content');
  c.innerHTML = `<div class="section-header"><h3>Usuarios</h3></div>${loadingCard()}`;
  try {
    const roles = await api('/usuarios/roles/list');
    const usuarios = await api('/usuarios');
    let rows = usuarios.map(u => `
      <tr>
        <td><strong>${escHtml(u.nombre)} ${escHtml(u.apellido)}</strong></td>
        <td>${escHtml(u.email)}</td>
        <td>${escHtml(u.rut)}</td>
        <td>${badge(u.rol)}</td>
        <td>${badgeEstado(String(u.activo))}</td>
        <td>
          ${puede('ADMIN') ? `<button class="btn btn-sm btn-outline" onclick="editarUsuario('${u.id}')">✏️</button>` : ''}
          ${puede('ADMIN') && u.rol !== 'ADMIN' ? `<button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger-bg)" onclick="eliminarUsuario('${u.id}')">🗑️</button>` : ''}
        </td>
      </tr>`).join('');

    c.innerHTML = `
      <div class="section-header">
        <h3>Usuarios</h3>
        ${puede('ADMIN') ? '<button class="btn btn-primary" onclick="nuevoUsuario()"><span>+</span> Nuevo</button>' : ''}
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>RUT</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    window._roles = roles;
  } catch (err) { c.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`; }
}

function nuevoUsuario() {
  const roles = window._roles || [];
  modal('Nuevo Usuario', `
    <div class="form-grid">
      <div class="form-group"><label>Nombre</label><input id="f-nombre" required/></div>
      <div class="form-group"><label>Apellido</label><input id="f-apellido" required/></div>
      <div class="form-group"><label>Email</label><input type="email" id="f-email" required/></div>
      <div class="form-group"><label>RUT</label><input id="f-rut" placeholder="12.345.678-9" required/></div>
      <div class="form-group"><label>Contraseña</label><input type="password" id="f-password" required/></div>
      <div class="form-group"><label>Rol</label><select id="f-rol">${roles.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('')}</select></div>
    </div>`,
    `<button class="btn btn-primary" id="btn-save-usuario">Guardar</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-save-usuario').onclick = async () => {
    const body = {
      nombre: $('#f-nombre').value, apellido: $('#f-apellido').value,
      email: $('#f-email').value, rut: $('#f-rut').value,
      password: $('#f-password').value, rol: $('#f-rol').value
    };
    try { await api('/usuarios', { method:'POST', body: JSON.stringify(body) });
      toast('Usuario creado'); modalClose(); renderUsuarios();
    } catch (e) { toast(e.message, 'danger'); }
  };
}

function editarUsuario(id) {
  api(`/usuarios/${id}`).then(u => {
    const roles = window._roles || [];
    modal('Editar Usuario', `
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label><input id="f-nombre" value="${escHtml(u.nombre)}"/></div>
        <div class="form-group"><label>Apellido</label><input id="f-apellido" value="${escHtml(u.apellido)}"/></div>
        <div class="form-group"><label>Email</label><input id="f-email" value="${escHtml(u.email)}"/></div>
        <div class="form-group"><label>RUT</label><input id="f-rut" value="${escHtml(u.rut)}"/></div>
        <div class="form-group"><label>Rol</label><select id="f-rol">${roles.map(r => `<option value="${r.nombre}" ${r.nombre===u.rol?'selected':''}>${r.nombre}</option>`).join('')}</select></div>
        <div class="form-group"><label>Activo</label><select id="f-activo"><option value="1" ${u.activo?'selected':''}>Sí</option><option value="0" ${!u.activo?'selected':''}>No</option></select></div>
      </div>`,
      `<button class="btn btn-primary" id="btn-save-usuario">Guardar</button>
       <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
    );
    $('#btn-save-usuario').onclick = async () => {
      try { await api(`/usuarios/${id}`, { method:'PUT', body: JSON.stringify({
          nombre: $('#f-nombre').value, apellido: $('#f-apellido').value,
          email: $('#f-email').value, rut: $('#f-rut').value,
          rol: $('#f-rol').value, activo: parseInt($('#f-activo').value)
        })});
        toast('Usuario actualizado'); modalClose(); renderUsuarios();
      } catch (e) { toast(e.message, 'danger'); }
    };
  }).catch(e => toast(e.message, 'danger'));
}

async function eliminarUsuario(id) {
  const ok = await confirmar('¿Eliminar este usuario? Se desactivará su cuenta.');
  if (!ok) return;
  try {
    await api(`/usuarios/${id}`, { method:'DELETE' });
    toast('Usuario desactivado'); renderUsuarios();
  } catch (e) { toast(e.message, 'danger'); }
}

// ─── ESTUDIANTES ───────────────────────────────────────────
async function renderEstudiantes() {
  const c = $('#content');
  c.innerHTML = `<div class="section-header"><h3>Estudiantes</h3></div><div class="toolbar"><div class="skeleton" style="height:42px;flex:1"></div><div class="skeleton" style="height:42px;width:180px"></div></div>${loadingCard()}`;
  try {
    const q = new URLSearchParams(window.location.search).get('q') || '';
    const estado = new URLSearchParams(window.location.search).get('estado') || '';
    let url = '/estudiantes';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    const qs = params.toString();
    if (qs) url += '?' + qs;

    const estudiantes = await api(url);
    const busquedaActiva = q || estado;
    let rows = estudiantes.length
      ? estudiantes.map(e => `
      <tr>
        <td><strong>${escHtml(e.nombre)} ${escHtml(e.apellido)}</strong></td>
        <td>${escHtml(e.rut)}</td>
        <td>${escHtml(e.apoderado_nombre || '—')}</td>
        <td>${escHtml(e.apoderado_tel || '—')}</td>
        <td>${badgeEstado(e.estado)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="verEstudiante('${e.id}')">👁️</button>
          ${puede('ADMIN','SECRETARIA','APODERADO') ? `<button class="btn btn-sm btn-outline" onclick="editarEstudiante('${e.id}')">✏️</button>` : ''}
        </td>
      </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">${busquedaActiva ? 'Sin resultados para esta búsqueda' : 'No hay estudiantes registrados'}</td></tr>`;

    c.innerHTML = `
      <div class="section-header">
        <h3>Estudiantes</h3>
        ${puede('ADMIN','SECRETARIA','APODERADO') ? '<button class="btn btn-primary" onclick="nuevoEstudiante()"><span>+</span> Nuevo</button>' : ''}
      </div>
      <div class="toolbar">
        <input class="search-input" placeholder="Buscar nombre, apellido o RUT..." id="search-est" value="${escHtml(q)}" onkeyup="filtrarEstudiantes()"/>
        <select id="filter-est-estado" onchange="filtrarEstudiantes()">
          <option value="">Todos los estados</option>
          <option value="PREINSCRITO" ${estado==='PREINSCRITO'?'selected':''}>Pendiente</option>
          <option value="MATRICULADO" ${estado==='MATRICULADO'?'selected':''}>Matriculado</option>
          <option value="RETIRADO" ${estado==='RETIRADO'?'selected':''}>Retirado</option>
        </select>
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nombre</th><th>RUT</th><th>Apoderado</th><th>Tel. Apoderado</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { c.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`; }
}

const filtrarEstudiantes = debounce(() => {
  const params = new URLSearchParams();
  const q = $('#search-est').value;
  const estado = $('#filter-est-estado').value;
  if (q) params.set('q', q);
  if (estado) params.set('estado', estado);
  const qs = params.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '');
  window.history.replaceState({}, '', url);
  renderEstudiantes();
});

function nuevoEstudiante() {
  modal('Nuevo Estudiante', `
    <div class="form-section">Datos personales</div>
    <div class="form-grid">
      <div class="form-group"><label>RUT *</label><input id="f-rut" placeholder="22.111.001-1"/></div>
      <div class="form-group"><label>Nombre *</label><input id="f-nombre"/></div>
      <div class="form-group"><label>Apellido *</label><input id="f-apellido"/></div>
      <div class="form-group"><label>Fecha Nac. *</label><input type="date" id="f-fecha"/></div>
      <div class="form-group"><label>Género</label><select id="f-genero"><option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="Otro">Otro</option></select></div>
      <div class="form-group"><label>Teléfono</label><input id="f-tel"/></div>
      <div class="form-group"><label>Email</label><input type="email" id="f-email"/></div>
      <div class="form-group"><label>Dirección</label><input id="f-dir"/></div>
    </div>
    <div class="form-section">Información médica</div>
    <div class="form-grid-3">
      <div class="form-group"><label>Grupo sanguíneo</label><input id="f-gs"/></div>
      <div class="form-group"><label>Alergias</label><input id="f-alergias"/></div>
      <div class="form-group"><label>Medicamentos</label><input id="f-meds"/></div>
    </div>
    <div class="form-section">Historial académico</div>
    <div class="form-grid">
      <div class="form-group"><label>Colegio anterior</label><input id="f-colegio"/></div>
      <div class="form-group"><label>Año cursado anterior</label><input id="f-anio-ant"/></div>
    </div>
    <div class="form-section">Apoderado titular</div>
    <div class="form-grid">
      <div class="form-group"><label>RUT</label><input id="f-apod-rut"/></div>
      <div class="form-group"><label>Nombre</label><input id="f-apod-nombre"/></div>
      <div class="form-group"><label>Apellido</label><input id="f-apod-apellido"/></div>
      <div class="form-group"><label>Email</label><input type="email" id="f-apod-email"/></div>
      <div class="form-group"><label>Teléfono</label><input id="f-apod-tel"/></div>
      <div class="form-group"><label>Relación</label><select id="f-apod-rel"><option>Padre</option><option>Madre</option><option>Tutor</option><option>Otro</option></select></div>
    </div>`,
    `<button class="btn btn-primary" id="btn-save">Guardar</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-save').onclick = async () => {
    const body = {
      rut: $('#f-rut').value, nombre: $('#f-nombre').value, apellido: $('#f-apellido').value,
      fecha_nacimiento: $('#f-fecha').value, genero: $('#f-genero').value,
      direccion: $('#f-dir').value, telefono: $('#f-tel').value, email: $('#f-email').value,
      grupo_sanguineo: $('#f-gs').value, alergias: $('#f-alergias').value, medicamentos: $('#f-meds').value,
      colegio_anterior: $('#f-colegio').value, anio_cursado_anterior: $('#f-anio-ant').value
    };
    const apodRut = $('#f-apod-rut').value;
    if (apodRut) {
      body.apoderado = {
        rut: apodRut, nombre: $('#f-apod-nombre').value, apellido: $('#f-apod-apellido').value,
        email: $('#f-apod-email').value, telefono: $('#f-apod-tel').value, relacion: $('#f-apod-rel').value
      };
    }
    try { await api('/estudiantes', { method:'POST', body: JSON.stringify(body) });
      toast('Estudiante creado'); modalClose(); renderEstudiantes();
    } catch (e) { toast(e.message, 'danger'); }
  };
}

function verEstudiante(id) {
  api(`/estudiantes/${id}`).then(e => {
    const apods = (e.apoderados||[]).map(a => `
      <div class="detail-item"><label>${escHtml(a.relacion)}</label><span>${escHtml(a.nombre)} ${escHtml(a.apellido)} · ${escHtml(a.email)} · ${escHtml(a.telefono)}</span></div>`).join('');
    modal('Detalle del Estudiante', `
      <div class="detail-grid">
        <div class="detail-item"><label>Nombre</label><span>${escHtml(e.nombre)} ${escHtml(e.apellido)}</span></div>
        <div class="detail-item"><label>RUT</label><span>${escHtml(e.rut)}</span></div>
        <div class="detail-item"><label>Fecha Nac.</label><span>${escHtml(e.fecha_nacimiento)}</span></div>
        <div class="detail-item"><label>Género</label><span>${escHtml(e.genero||'—')}</span></div>
        <div class="detail-item"><label>Estado</label><span>${badgeEstado(e.estado)}</span></div>
        <div class="detail-item"><label>Dirección</label><span>${escHtml(e.direccion||'—')}</span></div>
        <div class="detail-item"><label>Teléfono</label><span>${escHtml(e.telefono||'—')}</span></div>
        <div class="detail-item"><label>Email</label><span>${escHtml(e.email||'—')}</span></div>
      </div>
      <div class="form-section">Salud</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Grupo sanguíneo</label><span>${escHtml(e.grupo_sanguineo||'—')}</span></div>
        <div class="detail-item"><label>Alergias</label><span>${escHtml(e.alergias||'—')}</span></div>
        <div class="detail-item"><label>Medicamentos</label><span>${escHtml(e.medicamentos||'—')}</span></div>
      </div>
      <div class="form-section">Historial</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Colegio anterior</label><span>${escHtml(e.colegio_anterior||'—')}</span></div>
        <div class="detail-item"><label>Año cursado</label><span>${escHtml(e.anio_cursado_anterior||'—')}</span></div>
      </div>
      <div class="form-section">Apoderados</div>
      <div class="detail-grid">${apods || '<p class="text-muted">Sin apoderados registrados</p>'}</div>
    `);
  }).catch(e => toast(e.message, 'danger'));
}

function editarEstudiante(id) {
  api(`/estudiantes/${id}`).then(e => {
    modal('Editar Estudiante', `
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label><input id="f-nombre" value="${escHtml(e.nombre)}"/></div>
        <div class="form-group"><label>Apellido</label><input id="f-apellido" value="${escHtml(e.apellido)}"/></div>
        <div class="form-group"><label>Fecha Nac.</label><input type="date" id="f-fecha" value="${escHtml(e.fecha_nacimiento)}"/></div>
        <div class="form-group"><label>Género</label><select id="f-genero"><option value="">—</option><option value="M" ${e.genero==='M'?'selected':''}>M</option><option value="F" ${e.genero==='F'?'selected':''}>F</option><option value="Otro" ${e.genero==='Otro'?'selected':''}>Otro</option></select></div>
        <div class="form-group"><label>Dirección</label><input id="f-dir" value="${escHtml(e.direccion||'')}"/></div>
        <div class="form-group"><label>Teléfono</label><input id="f-tel" value="${escHtml(e.telefono||'')}"/></div>
        <div class="form-group"><label>Email</label><input id="f-email" value="${escHtml(e.email||'')}"/></div>
        <div class="form-group"><label>Estado</label><select id="f-estado"><option value="PREINSCRITO" ${e.estado==='PREINSCRITO'?'selected':''}>PREINSCRITO</option><option value="MATRICULADO" ${e.estado==='MATRICULADO'?'selected':''}>MATRICULADO</option><option value="RETIRADO" ${e.estado==='RETIRADO'?'selected':''}>RETIRADO</option></select></div>
      </div>
      <div class="form-grid-3">
        <div class="form-group"><label>Alergias</label><input id="f-alergias" value="${escHtml(e.alergias||'')}"/></div>
        <div class="form-group"><label>Medicamentos</label><input id="f-meds" value="${escHtml(e.medicamentos||'')}"/></div>
        <div class="form-group"><label>Colegio anterior</label><input id="f-colegio" value="${escHtml(e.colegio_anterior||'')}"/></div>
      </div>`,
      `<button class="btn btn-primary" id="btn-save">Guardar</button>
       <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
    );
    $('#btn-save').onclick = async () => {
      try { await api(`/estudiantes/${id}`, { method:'PUT', body: JSON.stringify({
          nombre: $('#f-nombre').value, apellido: $('#f-apellido').value,
          fecha_nacimiento: $('#f-fecha').value, genero: $('#f-genero').value,
          direccion: $('#f-dir').value, telefono: $('#f-tel').value, email: $('#f-email').value,
          estado: $('#f-estado').value, alergias: $('#f-alergias').value,
          medicamentos: $('#f-meds').value, colegio_anterior: $('#f-colegio').value
        })});
        toast('Estudiante actualizado'); modalClose(); renderEstudiantes();
      } catch (e) { toast(e.message, 'danger'); }
    };
  }).catch(e => toast(e.message, 'danger'));
}

// ─── CURSOS ──────────────────────────────────────────────────
async function renderCursos() {
  const c = $('#content');
  c.innerHTML = `<div class="section-header"><h3>Cursos</h3></div>${loadingCard()}`;
  try {
    const cursos = await api('/cursos');
    const niveles = await api('/cursos/niveles/list');
    const grados = await api('/cursos/grados/list');
    window._niveles = niveles;
    window._grados = grados;

    let rows = cursos.length
      ? cursos.map(cur => {
      const pct = cur.cupos_max > 0 ? Math.round(cur.cupos_ocupados/cur.cupos_max*100) : 0;
      const cls = pct > 90 ? ' danger' : pct > 70 ? ' warning' : '';
      return `<tr>
        <td>${badge(cur.nivel)}</td>
        <td><strong>${escHtml(cur.grado)}</strong></td>
        <td>${escHtml(cur.seccion)}</td>
        <td>${cur.cupos_max}</td>
        <td>${cur.cupos_ocupados}</td>
        <td>
          <div class="occ-bar">
            <div class="progress-bar"><div class="progress-fill${cls}" style="width:${pct}%"></div></div>
            <small style="font-weight:600;color:${pct>90?'var(--danger)':pct>70?'var(--warning)':'var(--text-muted)'}">${pct}%</small>
          </div>
        </td>
        <td>${cur.docente || '<span class="text-muted">—</span>'}</td>
        <td>${badgeEstado(String(cur.activo))}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="verCurso('${cur.id}')">👁️</button>
          ${puede('ADMIN','SECRETARIA') ? `<button class="btn btn-sm btn-outline" onclick="editarCurso('${cur.id}')">✏️</button>` : ''}
        </td>
      </tr>`;}).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">No hay cursos registrados</td></tr>';

    c.innerHTML = `
      <div class="section-header">
        <h3>Cursos</h3>
        ${puede('ADMIN') ? '<button class="btn btn-primary" onclick="nuevoCurso()"><span>+</span> Nuevo</button>' : ''}
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nivel</th><th>Grado</th><th>Sección</th><th>Cupos</th><th>Ocupados</th><th>Ocupación</th><th>Docente</th><th>Activo</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { c.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`; }
}

function nuevoCurso() {
  const grados = window._grados || [];
  modal('Nuevo Curso', `
    <div class="form-grid">
      <div class="form-group"><label>Grado</label><select id="f-grado">${grados.map(g => `<option value="${g.id}">${g.nivel} — ${g.nombre}</option>`).join('')}</select></div>
      <div class="form-group"><label>Sección</label><select id="f-seccion"><option>A</option><option>B</option><option>C</option><option>D</option></select></div>
      <div class="form-group"><label>Cupos máx.</label><input type="number" id="f-cupos" value="35"/></div>
    </div>`,
    `<button class="btn btn-primary" id="btn-save">Guardar</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-save').onclick = async () => {
    try { await api('/cursos', { method:'POST', body: JSON.stringify({
        grado_id: parseInt($('#f-grado').value), seccion: $('#f-seccion').value,
        cupos_max: parseInt($('#f-cupos').value)
      })});
      toast('Curso creado'); modalClose(); renderCursos();
    } catch (e) { toast(e.message, 'danger'); }
  };
}

function verCurso(id) {
  api(`/cursos/${id}`).then(cur => {
    let horariosHtml = (cur.horarios||[]).map(h => `
      <tr><td>${h.dia_semana}</td><td>${h.hora_inicio}</td><td>${h.hora_fin}</td><td>${escHtml(h.asignatura)}</td></tr>`).join('') ||
      '<tr><td colspan="4" class="text-muted">Sin horarios</td></tr>';

    let estHtml = (cur.estudiantes||[]).map(e => `
      <tr><td>${escHtml(e.rut)}</td><td>${escHtml(e.nombre)} ${escHtml(e.apellido)}</td><td>${badgeEstado(e.estado)}</td></tr>`).join('') ||
      '<tr><td colspan="3" class="text-muted">Sin estudiantes matriculados</td></tr>';

    modal(`Curso: ${cur.grado} ${cur.seccion}`, `
      <div class="detail-grid">
        <div class="detail-item"><label>Nivel</label><span>${cur.nivel}</span></div>
        <div class="detail-item"><label>Grado</label><span>${cur.grado}</span></div>
        <div class="detail-item"><label>Sección</label><span>${cur.seccion}</span></div>
        <div class="detail-item"><label>Docente</label><span>${cur.docente_nombre||'Sin asignar'}</span></div>
        <div class="detail-item"><label>Cupos</label><span>${cur.cupos_ocupados}/${cur.cupos_max}</span></div>
        <div class="detail-item"><label>Activo</label><span>${cur.activo ? 'Sí' : 'No'}</span></div>
      </div>
      <div class="form-section">Horarios</div>
      <table><thead><tr><th>Día</th><th>Inicio</th><th>Fin</th><th>Asignatura</th></tr></thead><tbody>${horariosHtml}</tbody></table>
      ${puede('ADMIN','SECRETARIA') ? `
        <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="agregarHorario('${cur.id}')">+ Agregar horario</button>` : ''}
      <div class="form-section">Estudiantes matriculados</div>
      <table><thead><tr><th>RUT</th><th>Nombre</th><th>Estado</th></tr></thead><tbody>${estHtml}</tbody></table>
    `, `<button class="btn btn-outline" onclick="modalClose()">Cerrar</button>`);
    window._cursoActual = cur;
  }).catch(e => toast(e.message, 'danger'));
}

function agregarHorario(cursoId) {
  modal('Agregar Horario', `
    <div class="form-grid">
      <div class="form-group"><label>Día</label><select id="h-dia"><option>LUNES</option><option>MARTES</option><option>MIERCOLES</option><option>JUEVES</option><option>VIERNES</option></select></div>
      <div class="form-group"><label>Hora inicio</label><input type="time" id="h-inicio" value="08:00"/></div>
      <div class="form-group"><label>Hora fin</label><input type="time" id="h-fin" value="09:30"/></div>
      <div class="form-group"><label>Asignatura</label><input id="h-asig" placeholder="Matemáticas"/></div>
    </div>`,
    `<button class="btn btn-primary" id="btn-save-horario">Guardar</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-save-horario').onclick = async () => {
    try { await api(`/cursos/${cursoId}/horarios`, { method:'POST', body: JSON.stringify({
        dia_semana: $('#h-dia').value, hora_inicio: $('#h-inicio').value,
        hora_fin: $('#h-fin').value, asignatura: $('#h-asig').value
      })});
      toast('Horario agregado'); modalClose(); verCurso(cursoId);
    } catch (e) { toast(e.message, 'danger'); }
  };
}

function editarCurso(id) {
  api(`/cursos/${id}`).then(cur => {
    modal('Editar Curso', `
      <div class="form-grid">
        <div class="form-group"><label>Sección</label><select id="f-seccion"><option value="A" ${cur.seccion==='A'?'selected':''}>A</option><option value="B" ${cur.seccion==='B'?'selected':''}>B</option><option value="C" ${cur.seccion==='C'?'selected':''}>C</option></select></div>
        <div class="form-group"><label>Cupos máx.</label><input type="number" id="f-cupos" value="${cur.cupos_max}"/></div>
        <div class="form-group"><label>Activo</label><select id="f-activo"><option value="1" ${cur.activo?'selected':''}>Sí</option><option value="0" ${!cur.activo?'selected':''}>No</option></select></div>
      </div>`,
      `<button class="btn btn-primary" id="btn-save">Guardar</button>
       <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
    );
    $('#btn-save').onclick = async () => {
      try { await api(`/cursos/${id}`, { method:'PUT', body: JSON.stringify({
          seccion: $('#f-seccion').value, cupos_max: parseInt($('#f-cupos').value),
          activo: parseInt($('#f-activo').value)
        })});
        toast('Curso actualizado'); modalClose(); renderCursos();
      } catch (e) { toast(e.message, 'danger'); }
    };
  }).catch(e => toast(e.message, 'danger'));
}

// ─── MATRÍCULAS ──────────────────────────────────────────────
async function renderMatriculas() {
  const c = $('#content');
  c.innerHTML = `<div class="section-header"><h3>Matrículas</h3></div>${loadingCard()}`;
  try {
    const busqueda = new URLSearchParams(window.location.search);
    const anio = busqueda.get('anio') || '';
    const estado = busqueda.get('estado') || '';

    let url = '/matriculas';
    const params = new URLSearchParams();
    if (anio) params.set('anio', anio);
    if (estado) params.set('estado', estado);
    const qs = params.toString();
    if (qs) url += '?' + qs;

    const mats = await api(url);
    let rows = mats.length
      ? mats.map(m => `
      <tr>
        <td><strong>${escHtml(m.estudiante)}</strong></td>
        <td>${escHtml(m.estudiante_rut)}</td>
        <td>${escHtml(m.curso)}</td>
        <td>${badgeEstado(m.estado)}</td>
        <td><strong>$${Number(m.monto||0).toLocaleString('es-CL')}</strong></td>
        <td>${badgeEstado(m.pago_estado)}</td>
        <td>${escHtml(m.medio_pago || '—')}</td>
        <td>${m.fecha_matricula ? escHtml(m.fecha_matricula) : '<span class="text-muted">—</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-outline" onclick="verMatricula('${m.id}')">👁️</button>
          ${m.estado === 'PENDIENTE_PAGO' && puede('ADMIN','SECRETARIA','FINANZAS') ? `<button class="btn btn-sm btn-success" onclick="confirmarPago('${m.id}')">💰 Pagar</button>` : ''}
          ${m.estado !== 'ANULADA' && puede('ADMIN') ? `<button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger-bg)" onclick="anularMatricula('${m.id}')">🚫</button>` : ''}
        </td>
      </tr>`).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">No hay matrículas registradas</td></tr>';

    c.innerHTML = `
      <div class="section-header">
        <h3>Matrículas</h3>
        ${puede('ADMIN','SECRETARIA','APODERADO') ? '<button class="btn btn-primary" onclick="nuevaMatricula()"><span>+</span> Nueva</button>' : ''}
      </div>
      <div class="toolbar">
        <input class="search-input" placeholder="Año (ej: 2025)" id="filter-anio" value="${escHtml(anio)}" onkeyup="filtrarMatriculas()"/>
        <select id="filter-estado" onchange="filtrarMatriculas()">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE_PAGO" ${estado==='PENDIENTE_PAGO'?'selected':''}>Pendiente pago</option>
          <option value="PAGADA" ${estado==='PAGADA'?'selected':''}>Pagada</option>
          <option value="ANULADA" ${estado==='ANULADA'?'selected':''}>Anulada</option>
        </select>
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Estudiante</th><th>RUT</th><th>Curso</th><th>Estado</th><th>Monto</th><th>Pago</th><th>Medio</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { c.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`; }
}

const filtrarMatriculas = debounce(() => {
  const params = new URLSearchParams();
  const anio = $('#filter-anio').value;
  const estado = $('#filter-estado').value;
  if (anio) params.set('anio', anio);
  if (estado) params.set('estado', estado);
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
  renderMatriculas();
});

async function nuevaMatricula() {
  try {
    const estudiantes = await api('/estudiantes?estado=PREINSCRITO');
    const cursos = await api('/cursos?activo=1');
    const anios = await api('/anios');

    let estOpts = estudiantes.map(e => `<option value="${e.id}">${escHtml(e.nombre)} ${escHtml(e.apellido)} (${escHtml(e.rut)})</option>`).join('');
    let curOpts = cursos.map(c => `<option value="${c.id}">${escHtml(c.grado)} ${escHtml(c.seccion)} (${c.cupos_ocupados}/${c.cupos_max})</option>`).join('');
    let anioOpts = anios.map(a => `<option value="${a.id}">${a.anio}${a.activo?' (activo)':''}</option>`).join('');

    modal('Nueva Matrícula', `
      <div class="form-grid">
        <div class="form-group"><label>Estudiante</label><select id="f-estudiante">${estOpts || '<option>No hay estudiantes disponibles</option>'}</select></div>
        <div class="form-group"><label>Curso</label><select id="f-curso">${curOpts || '<option>No hay cursos disponibles</option>'}</select></div>
        <div class="form-group"><label>Año escolar</label><select id="f-anio">${anioOpts}</select></div>
        <div class="form-group"><label>Medio de pago</label><select id="f-medio"><option>TRANSFERENCIA</option><option>EFECTIVO</option><option>TARJETA</option></select></div>
      </div>`,
      `<button class="btn btn-primary" id="btn-save-mat">Crear Matrícula</button>
       <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
    );
    $('#btn-save-mat').onclick = async () => {
      try {
        const r = await api('/matriculas', { method:'POST', body: JSON.stringify({
            estudiante_id: $('#f-estudiante').value, curso_id: $('#f-curso').value,
            anio_escolar_id: parseInt($('#f-anio').value), medio_pago: $('#f-medio').value
          })});
        toast(`Matrícula creada. Monto: $${Number(r.monto).toLocaleString('es-CL')}`);
        modalClose(); renderMatriculas();
      } catch (e) { toast(e.message, 'danger'); }
    };
  } catch (e) { toast(e.message, 'danger'); }
}

function verMatricula(id) {
  api(`/matriculas/${id}`).then(m => {
    let pagosHtml = (m.pagos||[]).map(p => `
      <tr>
        <td>$${Number(p.monto).toLocaleString('es-CL')}</td>
        <td>${badgeEstado(p.estado)}</td>
        <td>${escHtml(p.medio_pago)}</td>
        <td>${escHtml(p.referencia||'—')}</td>
        <td>${p.fecha_pago||'—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-muted">Sin pagos registrados</td></tr>';

    modal('Detalle Matrícula', `
      <div class="detail-grid">
        <div class="detail-item"><label>Estudiante</label><span>${escHtml(m.estudiante)}</span></div>
        <div class="detail-item"><label>Curso</label><span>${escHtml(m.curso)}</span></div>
        <div class="detail-item"><label>Estado</label><span>${badgeEstado(m.estado)}</span></div>
        <div class="detail-item"><label>Fecha</label><span>${m.fecha_matricula||'Pendiente'}</span></div>
      </div>
      <div class="form-section">Pagos</div>
      <table><thead><tr><th>Monto</th><th>Estado</th><th>Medio</th><th>Referencia</th><th>Fecha</th></tr></thead><tbody>${pagosHtml}</tbody></table>
    `, `<button class="btn btn-outline" onclick="modalClose()">Cerrar</button>`);
  }).catch(e => toast(e.message, 'danger'));
}

function confirmarPago(matriculaId) {
  modal('Confirmar Pago', `
    <div class="form-group"><label>ID del pago</label><input id="f-pago-id" placeholder="Ingresa el ID del pago"/></div>
    <div class="form-group"><label>Referencia (opcional)</label><input id="f-ref" placeholder="N° de transferencia"/></div>`,
    `<button class="btn btn-success" id="btn-confirmar">Confirmar Pago</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-confirmar').onclick = async () => {
    try { await api(`/matriculas/${matriculaId}/confirmar-pago`, { method:'POST', body: JSON.stringify({
        pago_id: $('#f-pago-id').value, referencia: $('#f-ref').value
      })});
      toast('Pago confirmado y matrícula activada'); modalClose(); renderMatriculas();
    } catch (e) { toast(e.message, 'danger'); }
  };
}

async function anularMatricula(id) {
  const ok = await confirmar('¿Anular esta matrícula? Se liberará el cupo en el curso y el estudiante volverá a estado PREINSCRITO.');
  if (!ok) return;
  try {
    await api(`/matriculas/${id}/anular`, { method:'POST' });
    toast('Matrícula anulada'); renderMatriculas();
  } catch (e) { toast(e.message, 'danger'); }
}

// ─── REPORTES ──────────────────────────────────────────────
async function renderReportes() {
  const c = $('#content');
  c.innerHTML = `<div class="section-header"><h3>Reportes</h3></div>${loadingStats()}${loadingCard()}${loadingCard()}`;
  try {
    const d = await api('/reportes/dashboard');
    const vacantes = await api('/reportes/vacantes');
    const pagos = await api('/reportes/pagos');

    let vacRows = vacantes.length
      ? vacantes.map(v => `
      <tr>
        <td>${badge(v.nivel)}</td>
        <td><strong>${escHtml(v.grado)}</strong></td>
        <td>${escHtml(v.seccion)}</td>
        <td>${v.cupos_max}</td>
        <td>${v.cupos_ocupados}</td>
        <td><strong style="color:${v.vacantes_disponibles > 0 ? 'var(--success)' : 'var(--danger)'}">${v.vacantes_disponibles}</strong></td>
        <td>${v.ocupacion_pct}%</td>
        <td>${escHtml(v.docente || '—')}</td>
      </tr>`).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Sin datos</td></tr>';

    let pagoRows = (pagos.filas || []).length
      ? pagos.filas.map(p => `
      <tr>
        <td><strong>${escHtml(p.estudiante)}</strong></td>
        <td>${escHtml(p.curso)}</td>
        <td><strong>$${Number(p.monto).toLocaleString('es-CL')}</strong></td>
        <td>${badgeEstado(p.estado)}</td>
        <td>${escHtml(p.medio_pago || '—')}</td>
        <td>${p.fecha_pago || '<span class="text-muted">—</span>'}</td>
      </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Sin pagos registrados</td></tr>';

    c.innerHTML = `
      <div class="section-header"><h3>Reportes</h3></div>
      <div class="stats-grid">
        <div class="stat-card success"><span class="stat-icon">🎓</span><div class="stat-value">${d.totalMatriculados||0}</div><div class="stat-label">Matriculados</div></div>
        <div class="stat-card info"><span class="stat-icon">💰</span><div class="stat-value">$${Number(d.recaudado||0).toLocaleString('es-CL')}</div><div class="stat-label">Recaudado</div></div>
        <div class="stat-card warning"><span class="stat-icon">⏳</span><div class="stat-value">$${Number(pagos.totalPendiente||0).toLocaleString('es-CL')}</div><div class="stat-label">Pendiente</div></div>
        <div class="stat-card"><span class="stat-icon">📋</span><div class="stat-value">${d.totalVacantes||0}</div><div class="stat-label">Vacantes</div></div>
      </div>
      <div class="card">
        <div class="card-title">Vacantes disponibles</div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nivel</th><th>Grado</th><th>Sección</th><th>Cupos</th><th>Ocupados</th><th>Disponibles</th><th>%</th><th>Docente</th></tr></thead>
            <tbody>${vacRows}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Pagos <span class="card-subtitle">Recaudado: $${Number(pagos.totalRecaudado||0).toLocaleString('es-CL')} · Pendiente: $${Number(pagos.totalPendiente||0).toLocaleString('es-CL')}</span></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Estudiante</th><th>Curso</th><th>Monto</th><th>Estado</th><th>Medio</th><th>Fecha</th></tr></thead>
            <tbody>${pagoRows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { c.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`; }
}

// ─── AÑO ESCOLAR ─────────────────────────────────────────
async function renderAnios() {
  const c = $('#content');
  c.innerHTML = `<div class="section-header"><h3>Años Escolares</h3></div>${loadingCard()}`;
  try {
    const anios = await api('/anios');
    const niveles = await api('/cursos/niveles/list');
    window._niveles = niveles;

    let rows = anios.length
      ? anios.map(a => `
      <tr>
        <td><strong>${a.anio}</strong></td>
        <td>${escHtml(a.fecha_inicio_matricula)}</td>
        <td>${escHtml(a.fecha_fin_matricula)}</td>
        <td>${escHtml(a.fecha_inicio_clases)}</td>
        <td>${escHtml(a.fecha_fin_anio)}</td>
        <td>${a.nota_min_aprobacion}</td>
        <td>${badgeEstado(String(a.activo))}</td>
        <td>${a.publicado ? badge('Sí', 'green') : badge('No', 'gray')}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-outline" onclick="verAnio(${a.id})">👁️</button>
          ${puede('ADMIN') ? `<button class="btn btn-sm btn-outline" onclick="editarAnio(${a.id})">✏️</button>` : ''}
          ${!a.activo && puede('ADMIN') ? `<button class="btn btn-sm btn-success" onclick="publicarAnio(${a.id})">📢 Publicar</button>` : ''}
        </td>
      </tr>`).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">No hay años escolares configurados</td></tr>';

    c.innerHTML = `
      <div class="section-header">
        <h3>Años Escolares</h3>
        ${puede('ADMIN') ? '<button class="btn btn-primary" onclick="nuevoAnio()"><span>+</span> Nuevo</button>' : ''}
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Año</th><th>Inicio Mat.</th><th>Fin Mat.</th><th>Inicio Clases</th><th>Fin Año</th><th>Nota Mín</th><th>Activo</th><th>Publicado</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { c.innerHTML = `<div class="error-msg">${escHtml(err.message)}</div>`; }
}

function nuevoAnio() {
  modal('Nuevo Año Escolar', `
    <div class="form-grid">
      <div class="form-group"><label>Año</label><input type="number" id="f-anio" value="2026"/></div>
      <div class="form-group"><label>Inicio matrícula</label><input type="date" id="f-inicio-mat"/></div>
      <div class="form-group"><label>Fin matrícula</label><input type="date" id="f-fin-mat"/></div>
      <div class="form-group"><label>Inicio clases</label><input type="date" id="f-inicio-clases"/></div>
      <div class="form-group"><label>Fin año</label><input type="date" id="f-fin-anio"/></div>
      <div class="form-group"><label>Nota mín. aprobación</label><input type="number" step="0.1" id="f-nota" value="4.0"/></div>
      <div class="form-group"><label>Máx. asignaturas reprobadas</label><input type="number" id="f-max-rep" value="2"/></div>
    </div>`,
    `<button class="btn btn-primary" id="btn-save">Guardar</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-save').onclick = async () => {
    try { await api('/anios', { method:'POST', body: JSON.stringify({
        anio: parseInt($('#f-anio').value),
        fecha_inicio_matricula: $('#f-inicio-mat').value,
        fecha_fin_matricula: $('#f-fin-mat').value,
        fecha_inicio_clases: $('#f-inicio-clases').value,
        fecha_fin_anio: $('#f-fin-anio').value,
        nota_min_aprobacion: parseFloat($('#f-nota').value),
        max_asig_reprobadas: parseInt($('#f-max-rep').value)
      })});
      toast('Año escolar creado'); modalClose(); renderAnios();
    } catch (e) { toast(e.message, 'danger'); }
  };
}

function verAnio(id) {
  api(`/anios/activo`).then(async () => {
    const anios = await api('/anios');
    const a = anios.find(x => x.id === id);
    if (!a) { toast('No encontrado', 'danger'); return; }
    const costos = await api('/anios') // /anios/activo gives the active one with costos
      .catch(() => ({}));
    // load the specific anio's costos - we need another approach
    // The activo endpoint gives us the active one with costos
    // For non-active, we need a different endpoint
    const ae = id === (await api('/anios/activo').catch(()=>({id:-1}))).id
      ? await api('/anios/activo') : { ...a, costos: [] };

    const niveles = window._niveles || [];
    let costosHtml = (ae.costos||[]).map(c => `
      <tr>
        <td>${escHtml(c.nivel)}</td>
        <td>$${Number(c.costo_matricula).toLocaleString('es-CL')}</td>
        <td>$${Number(c.mensualidad).toLocaleString('es-CL')}</td>
        <td>${c.descuento_pct}%</td>
      </tr>`).join('') || '<tr><td colspan="4" class="text-muted">Sin costos configurados</td></tr>';

    modal(`Año Escolar ${a.anio}`, `
      <div class="detail-grid">
        <div class="detail-item"><label>Inicio matrícula</label><span>${a.fecha_inicio_matricula}</span></div>
        <div class="detail-item"><label>Fin matrícula</label><span>${a.fecha_fin_matricula}</span></div>
        <div class="detail-item"><label>Inicio clases</label><span>${a.fecha_inicio_clases}</span></div>
        <div class="detail-item"><label>Fin año</label><span>${a.fecha_fin_anio}</span></div>
        <div class="detail-item"><label>Nota mín.</label><span>${a.nota_min_aprobacion}</span></div>
        <div class="detail-item"><label>Activo</label><span>${a.activo ? 'Sí' : 'No'}</span></div>
      </div>
      <div class="form-section">Costos por nivel</div>
      <table><thead><tr><th>Nivel</th><th>Matrícula</th><th>Mensualidad</th><th>Dto.</th></tr></thead><tbody>${costosHtml}</tbody></table>
      ${niveles.length ? `<button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="configurarCostos(${id})">💰 Configurar costos</button>` : ''}
    `, `<button class="btn btn-outline" onclick="modalClose()">Cerrar</button>`);
  }).catch(e => toast(e.message, 'danger'));
}

function configurarCostos(anioId) {
  const niveles = window._niveles || [];
  const inputs = niveles.map(n => `
    <div class="form-grid-3">
      <div class="form-group"><label>${n.nombre} — Matrícula</label><input type="number" id="c-mat-${n.id}" value="75000"/></div>
      <div class="form-group"><label>Mensualidad</label><input type="number" id="c-men-${n.id}" value="95000"/></div>
      <div class="form-group"><label>Dto. %</label><input type="number" id="c-dto-${n.id}" value="0"/></div>
    </div>`).join('');

  modal('Configurar Costos', inputs,
    `<button class="btn btn-primary" id="btn-save-costos">Guardar Costos</button>
     <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
  );
  $('#btn-save-costos').onclick = async () => {
    const costos = niveles.map(n => ({
      nivel_id: n.id,
      costo_matricula: parseFloat($(`#c-mat-${n.id}`).value||0),
      mensualidad: parseFloat($(`#c-men-${n.id}`).value||0),
      descuento_pct: parseFloat($(`#c-dto-${n.id}`).value||0),
    }));
    try { await api(`/anios/${anioId}/costos`, { method:'POST', body: JSON.stringify({ costos }) });
      toast('Costos guardados'); modalClose(); renderAnios();
    } catch (e) { toast(e.message, 'danger'); }
  };
}

function editarAnio(id) {
  api('/anios').then(anios => {
    const a = anios.find(x => x.id === id);
    if (!a) return;
    modal('Editar Año Escolar', `
      <div class="form-grid">
        <div class="form-group"><label>Inicio matrícula</label><input type="date" id="f-inicio-mat" value="${a.fecha_inicio_matricula}"/></div>
        <div class="form-group"><label>Fin matrícula</label><input type="date" id="f-fin-mat" value="${a.fecha_fin_matricula}"/></div>
        <div class="form-group"><label>Inicio clases</label><input type="date" id="f-inicio-clases" value="${a.fecha_inicio_clases}"/></div>
        <div class="form-group"><label>Fin año</label><input type="date" id="f-fin-anio" value="${a.fecha_fin_anio}"/></div>
        <div class="form-group"><label>Nota mín.</label><input type="number" step="0.1" id="f-nota" value="${a.nota_min_aprobacion}"/></div>
        <div class="form-group"><label>Máx. reprobadas</label><input type="number" id="f-max-rep" value="${a.max_asig_reprobadas}"/></div>
      </div>`,
      `<button class="btn btn-primary" id="btn-save">Guardar</button>
       <button class="btn btn-outline" onclick="modalClose()">Cancelar</button>`
    );
    $('#btn-save').onclick = async () => {
      try { await api(`/anios/${id}`, { method:'PUT', body: JSON.stringify({
          fecha_inicio_matricula: $('#f-inicio-mat').value,
          fecha_fin_matricula: $('#f-fin-mat').value,
          fecha_inicio_clases: $('#f-inicio-clases').value,
          fecha_fin_anio: $('#f-fin-anio').value,
          nota_min_aprobacion: parseFloat($('#f-nota').value),
          max_asig_reprobadas: parseInt($('#f-max-rep').value)
        })});
        toast('Año escolar actualizado'); modalClose(); renderAnios();
      } catch (e) { toast(e.message, 'danger'); }
    };
  });
}

async function publicarAnio(id) {
  const ok = await confirmar('¿Publicar y activar este año escolar? Se desactivará cualquier otro año activo.');
  if (!ok) return;
  try {
    await api(`/anios/${id}/publicar`, { method:'POST' });
    toast('Año escolar publicado y activado'); renderAnios();
  } catch (e) { toast(e.message, 'danger'); }
}

// ─── Boot ───────────────────────────────────────────────────
if (TOKEN && USER?.id) {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  initApp();
}
