/**
 * Sistema de Compensaciones y Presupuesto — Frontend Logic
 * Supports: Firebase Firestore (Real-time), LocalStorage Fallback (Offline/Demo),
 *           jsPDF (Client-Side PDF Generation), KPI Detail Popups.
 */

// CONFIGURACIÓN DE FIREBASE (Reemplazar con tus credenciales de la consola Firebase)
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Determinar si debemos usar Firebase o LocalStorage
const useFirebase = typeof firebase !== 'undefined' && firebaseConfig.projectId !== "TU_PROJECT_ID";
let db;

if (useFirebase) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } catch (e) {
        console.error("Error al inicializar Firebase:", e);
    }
}

// Estado global (datos sincronizados en tiempo real)
let globalSolicitudes = [];
let globalMovimientos = [];
let globalPuestos = [];
let globalCartas = [];
let globalUnidades = [];
let globalTiposDoc = [];

let searchTimeout = null;
let movSearchTimeout = null;
let activeDetailIngresoId = null;

let rulesConfig = null;
let templatesConfig = null;

async function initAppConfig() {
    try {
        const rulesRes = await fetch('/api/cartas/config/reglas');
        if (rulesRes.ok) {
            rulesConfig = await rulesRes.json();
            console.log("Reglas dinámicas cargadas del servidor:", rulesConfig.length);
        }
    } catch (e) {
        console.warn("No se pudieron cargar las reglas del servidor, usando fallback.");
    }
    
    try {
        const tmplRes = await fetch('/api/cartas/config/plantillas');
        if (tmplRes.ok) {
            templatesConfig = await tmplRes.json();
            console.log("Plantillas dinámicas cargadas del servidor:", Object.keys(templatesConfig).length);
        }
    } catch (e) {
        console.warn("No se pudieron cargar las plantillas del servidor, usando fallback.");
    }
}

// ═══════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // Cargar configuraciones declarativas
    await initAppConfig();

    // Si no se usa Firebase, inicializar datos de demo en LocalStorage
    if (!useFirebase) {
        initLocalStorageData();
        showToast('Corriendo en modo DEMO con LocalStorage', 'info');
    } else {
        showToast('Sincronizando con Firebase Firestore', 'success');
    }

    // Configurar menú de navegación
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Pestañas de catálogos
    document.querySelectorAll('#catalogo-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#catalogo-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderCatalogoView(tab.dataset.tab);
        });
    });

    // Autodetectar plantilla al cambiar campos
    document.addEventListener('change', (e) => {
        if (e.target.closest('#form-ingreso')) updatePlantillaPreview();
    });

    // Establecer fecha por defecto en formulario
    const today = new Date().toISOString().split('T')[0];
    const fechaSol = document.querySelector('[name="fecha_solicitud"]');
    if (fechaSol) fechaSol.value = today;

    // Iniciar sincronización en tiempo real
    startRealTimeSync();
});

// ═══════════════════════════════════════════
// REAL-TIME SYNC ENGINE (FIREBASE OR LOCALSTORAGE)
// ═══════════════════════════════════════════

function subscribeToCollection(collectionName, callback) {
    if (useFirebase) {
        return db.collection(collectionName).onSnapshot(snapshot => {
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });
            callback(items);
        }, err => {
            console.error(`Error de suscripción en ${collectionName}:`, err);
        });
    } else {
        const listener = () => {
            const items = JSON.parse(localStorage.getItem(collectionName) || '[]');
            callback(items);
        };
        window.addEventListener(`localdb_change_${collectionName}`, listener);
        listener();
        return () => window.removeEventListener(`localdb_change_${collectionName}`, listener);
    }
}

function startRealTimeSync() {
    subscribeToCollection('solicitudes_ingreso', (data) => {
        globalSolicitudes = data.sort((a, b) => {
            return (b.correlativo || 0) - (a.correlativo || 0);
        });
        onDataUpdated();
    });

    subscribeToCollection('movimientos', (data) => {
        globalMovimientos = data.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        onDataUpdated();
    });

    subscribeToCollection('puestos', (data) => {
        globalPuestos = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
        onDataUpdated();
    });

    subscribeToCollection('cartas_oferta', (data) => {
        globalCartas = data.sort((a, b) => b.correlativo - a.correlativo);
        onDataUpdated();
    });

    subscribeToCollection('unidades_negocio', (data) => {
        globalUnidades = data;
    });

    subscribeToCollection('tipos_documento', (data) => {
        globalTiposDoc = data;
    });
}

function onDataUpdated() {
    updateKPIs();
    
    const activeView = document.querySelector('.view.active')?.id;
    if (activeView === 'view-dashboard') {
        renderDashboard();
    } else if (activeView === 'view-ingresos') {
        renderIngresosView();
    } else if (activeView === 'view-movimientos') {
        renderMovimientosView();
    } else if (activeView === 'view-cartas') {
        renderCartasView();
    } else if (activeView === 'view-catalogos') {
        const activeTab = document.querySelector('#catalogo-tabs .tab.active')?.dataset.tab;
        if (activeTab) renderCatalogoView(activeTab);
    }
}

// ═══════════════════════════════════════════
// WRITE OPERATIONS WRAPPER
// ═══════════════════════════════════════════

async function dbAdd(collectionName, data) {
    if (useFirebase) {
        const docRef = await db.collection(collectionName).add(data);
        return docRef.id;
    } else {
        const list = JSON.parse(localStorage.getItem(collectionName) || '[]');
        const id = collectionName.substring(0, 3) + '_' + Date.now();
        const record = { id, ...data };
        list.push(record);
        localStorage.setItem(collectionName, JSON.stringify(list));
        window.dispatchEvent(new Event(`localdb_change_${collectionName}`));
        return id;
    }
}

async function dbUpdate(collectionName, id, data) {
    if (useFirebase) {
        await db.collection(collectionName).doc(id).update(data);
    } else {
        const list = JSON.parse(localStorage.getItem(collectionName) || '[]');
        const idx = list.findIndex(x => x.id === id);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...data };
            localStorage.setItem(collectionName, JSON.stringify(list));
            window.dispatchEvent(new Event(`localdb_change_${collectionName}`));
        }
    }
}

async function dbDelete(collectionName, id) {
    if (useFirebase) {
        await db.collection(collectionName).doc(id).delete();
    } else {
        const list = JSON.parse(localStorage.getItem(collectionName) || '[]');
        const filtered = list.filter(x => x.id !== id);
        localStorage.setItem(collectionName, JSON.stringify(filtered));
        window.dispatchEvent(new Event(`localdb_change_${collectionName}`));
    }
}

// ═══════════════════════════════════════════
// NAVIGATION & VIEWS RENDERING
// ═══════════════════════════════════════════

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const view = document.getElementById('view-' + viewName);
    const nav = document.querySelector(`[data-view="${viewName}"]`);
    if (view) view.classList.add('active');
    if (nav) nav.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        ingresos: 'Solicitudes de Ingreso',
        movimientos: 'Cambios Organizacionales',
        cartas: 'Cartas Oferta',
        catalogos: 'Catálogos'
    };
    document.getElementById('topbar-title').textContent = titles[viewName] || viewName;

    onDataUpdated();
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════

function updateKPIs() {
    const totalIngresos = globalSolicitudes.length;
    const pendientes = globalSolicitudes.filter(s => s.estado === 'BORRADOR' || s.estado === 'IMPORTADO' || s.estado === 'PENDIENTE_BP').length;
    const aprobados = globalSolicitudes.filter(s => s.estado === 'APROBADO').length;
    const cartasEmitidas = globalSolicitudes.filter(s => s.estado === 'CARTA_EMITIDA').length;
    
    const totalMovimientos = globalMovimientos.length;
    const movPendientes = globalMovimientos.filter(m => m.estado === 'PENDIENTE').length;
    const totalPuestos = globalPuestos.length;

    document.getElementById('badge-ingresos').textContent = pendientes;

    const grid = document.getElementById('kpi-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="kpi-card" onclick="openKpiModal('total_ingresos')" title="Ver detalle de ingresos">
                <div class="kpi-label">Total Ingresos</div>
                <div class="kpi-value">${totalIngresos}</div>
                <div class="kpi-link">Ver lista 🔍</div>
            </div>
            <div class="kpi-card" onclick="openKpiModal('ingresos_pendientes')" title="Ver pendientes de aprobación">
                <div class="kpi-label">Pendientes</div>
                <div class="kpi-value">${pendientes}</div>
                <div class="kpi-change ${pendientes > 0 ? 'down' : 'up'}">
                    ${pendientes > 0 ? '⚠ Requieren atención' : '✓ Todo al día'}
                </div>
            </div>
            <div class="kpi-card" onclick="openKpiModal('ingresos_aprobados')" title="Ver ingresos aprobados">
                <div class="kpi-label">Aprobados</div>
                <div class="kpi-value">${aprobados}</div>
                <div class="kpi-link">Ver lista 🔍</div>
            </div>
            <div class="kpi-card" onclick="openKpiModal('cartas_emitidas')" title="Ver cartas emitidas">
                <div class="kpi-label">Cartas Emitidas</div>
                <div class="kpi-value">${cartasEmitidas}</div>
                <div class="kpi-link">Ver lista 🔍</div>
            </div>
            <div class="kpi-card" onclick="openKpiModal('total_movimientos')" title="Ver todos los movimientos">
                <div class="kpi-label">Movimientos</div>
                <div class="kpi-value">${totalMovimientos}</div>
                <div class="kpi-link">Ver lista 🔍</div>
            </div>
            <div class="kpi-card" onclick="openKpiModal('movimientos_pendientes')" title="Ver movimientos pendientes">
                <div class="kpi-label">Mov. Pendientes</div>
                <div class="kpi-value">${movPendientes}</div>
                <div class="kpi-link">Ver lista 🔍</div>
            </div>
            <div class="kpi-card" onclick="openKpiModal('total_puestos')" title="Ver puestos del catálogo">
                <div class="kpi-label">Puestos Activos</div>
                <div class="kpi-value">${totalPuestos}</div>
                <div class="kpi-link">Ver catálogo 🔍</div>
            </div>
        `;
    }
}

function renderDashboard() {
    const recent = globalSolicitudes.slice(0, 10);
    renderIngresosTable(recent, 'dashboard-recent', true);
}

// ═══════════════════════════════════════════
// SOLICITUDES DE INGRESO
// ═══════════════════════════════════════════

function renderIngresosView() {
    const estado = document.getElementById('filter-estado')?.value || '';
    const unidad = document.getElementById('filter-unidad')?.value || '';
    const q = document.getElementById('filter-nombre')?.value || '';

    let filtered = globalSolicitudes;
    if (estado) filtered = filtered.filter(s => s.estado === estado);
    if (unidad) filtered = filtered.filter(s => s.unidad === unidad);
    if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter(s => 
            (s.nombres_apellidos || '').toLowerCase().includes(query) ||
            (s.puesto || '').toLowerCase().includes(query)
        );
    }

    renderIngresosTable(filtered, 'ingresos-table', false);
}

function renderIngresosTable(items, containerId, compact) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No hay solicitudes</p></div>';
        return;
    }

    let html = `<table><thead><tr>
        <th>Corr.</th><th>Unidad</th><th>Nombre</th><th>Puesto</th>
        <th>CECO</th><th>Tipo</th><th>Estado</th>
        ${compact ? '' : '<th>Fecha Sol.</th><th>Salario</th><th>Modalidad</th>'}
        <th>Acciones</th>
    </tr></thead><tbody>`;

    for (const s of items) {
        const badgeClass = getBadgeClass(s.estado);
        html += `<tr>
            <td>${s.correlativo || s.id}</td>
            <td>${s.unidad || ''}</td>
            <td title="${s.nombres_apellidos}">${truncate(s.nombres_apellidos, 28)}</td>
            <td title="${s.puesto || ''}">${truncate(s.puesto || '', 25)}</td>
            <td>${s.codigo_cr || ''}</td>
            <td>${truncate(s.tipo_ingreso || '', 15)}</td>
            <td><span class="badge ${badgeClass}">${s.estado || ''}</span></td>
            ${compact ? '' : `
                <td>${formatDate(s.fecha_solicitud)}</td>
                <td>${s.salario ? 'S/.' + Number(s.salario).toLocaleString() : ''}</td>
                <td>${s.modalidad || ''}</td>
            `}
            <td>
                <div class="action-row">
                    ${s.estado === 'BORRADOR' || s.estado === 'IMPORTADO' ? `
                        <button class="action-btn" onclick="aprobarIngreso('${s.id}')" title="Aprobar">✅</button>
                    ` : ''}
                    ${s.estado === 'APROBADO' ? `
                        <button class="action-btn" onclick="generarCarta('${s.id}')" title="Generar Carta">📄</button>
                    ` : ''}
                    ${s.carta_id ? `
                        <button class="action-btn" onclick="descargarCarta('${s.carta_id}')" title="Descargar PDF">⬇️</button>
                    ` : ''}
                    <button class="action-btn" onclick="viewIngreso('${s.id}')" title="Ver detalle">👁</button>
                    <button class="action-btn danger" onclick="deleteIngreso('${s.id}')" title="Eliminar">🗑</button>
                </div>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderIngresosView(), 400);
}

// ═══════════════════════════════════════════
// CAMBIOS ORGANIZACIONALES (MOVIMIENTOS)
// ═══════════════════════════════════════════

function renderMovimientosView() {
    const tipo = document.getElementById('filter-tipo-doc')?.value || '';
    const q = document.getElementById('filter-mov-nombre')?.value || '';

    let filtered = globalMovimientos;
    if (tipo) filtered = filtered.filter(m => m.tipo_documento === tipo);
    if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter(m => 
            (m.nombre || '').toLowerCase().includes(query) ||
            (m.cargo_actual || '').toLowerCase().includes(query) ||
            (m.codigo_colaborador || '').toLowerCase().includes(query)
        );
    }

    const container = document.getElementById('movimientos-table');
    if (!container) return;

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">🔄</div><p>No hay movimientos</p></div>';
        return;
    }

    let html = `<table><thead><tr>
        <th>Código</th><th>Nombre</th><th>Cargo Actual</th><th>Tipo Doc.</th>
        <th>Fecha</th><th>Sucursal</th><th>Cargo Nuevo</th><th>ADRYAN</th><th>Estado</th>
    </tr></thead><tbody>`;

    for (const m of filtered) {
        const badgeClass = getBadgeClass(m.estado);
        html += `<tr>
            <td>${m.codigo_colaborador || ''}</td>
            <td title="${m.nombre}">${truncate(m.nombre, 28)}</td>
            <td title="${m.cargo_actual || ''}">${truncate(m.cargo_actual || '', 22)}</td>
            <td>${truncate(m.tipo_documento || '', 20)}</td>
            <td>${formatDate(m.fecha_cambio)}</td>
            <td>${m.sucursal || ''}</td>
            <td title="${m.cargo_nuevo || ''}">${truncate(m.cargo_nuevo || '', 20)}</td>
            <td>${m.adryan || ''}</td>
            <td><span class="badge ${badgeClass}">${m.estado || ''}</span></td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

function debounceMovSearch() {
    clearTimeout(movSearchTimeout);
    movSearchTimeout = setTimeout(() => renderMovimientosView(), 400);
}

// ═══════════════════════════════════════════
// CARTAS OFERTA GENERADAS
// ═══════════════════════════════════════════

function renderCartasView() {
    const container = document.getElementById('cartas-table');
    if (!container) return;

    if (!globalCartas.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>No hay cartas generadas</p></div>';
        return;
    }

    let html = `<table><thead><tr>
        <th>Corr.</th><th>Colaborador</th><th>Puesto</th>
        <th>Plantilla</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
    </tr></thead><tbody>`;

    for (const c of globalCartas) {
        html += `<tr>
            <td>${c.correlativo || ''}</td>
            <td>${truncate(c.nombre_colaborador || '', 30)}</td>
            <td>${truncate(c.puesto || '', 25)}</td>
            <td>${c.plantilla_usada || ''}</td>
            <td><span class="badge badge-generada">${c.estado}</span></td>
            <td>${formatDate(c.created_at)}</td>
            <td>
                <div class="action-row">
                    <button class="action-btn" onclick="descargarCarta('${c.id}')" title="Descargar PDF">⬇️</button>
                </div>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ═══════════════════════════════════════════
// CATALOGOS
// ═══════════════════════════════════════════

function renderCatalogoView(tipo) {
    const container = document.getElementById('catalogos-content');
    const title = document.getElementById('catalogo-title');
    if (!container) return;

    if (tipo === 'puestos') {
        title.textContent = 'Catálogo de Puestos';
        const q = document.getElementById('filter-puesto')?.value || '';
        let filtered = globalPuestos;
        if (q) {
            filtered = filtered.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()));
        }

        let html = `<table><thead><tr><th>ID</th><th>Nombre</th><th>CECO</th></tr></thead><tbody>`;
        for (const p of filtered) {
            html += `<tr><td>${p.id}</td><td>${p.nombre}</td><td>${p.codigo_ceco || ''}</td></tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } else if (tipo === 'tipos-doc') {
        title.textContent = 'Tipos de Documento';
        let html = `<table><thead><tr><th>ID</th><th>Nombre</th><th>Subtipo</th></tr></thead><tbody>`;
        for (const t of globalTiposDoc) {
            html += `<tr><td>${t.id}</td><td>${t.nombre}</td><td>${t.subtipo || '—'}</td></tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } else if (tipo === 'unidades') {
        title.textContent = 'Unidades de Negocio';
        let html = `<table><thead><tr><th>ID</th><th>Nombre</th></tr></thead><tbody>`;
        for (const u of globalUnidades) {
            html += `<tr><td>${u.id}</td><td>${u.nombre}</td></tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }
}

function loadPuestos() { renderCatalogoView('puestos'); }

// ═══════════════════════════════════════════
// POPUPS / MODALES & FORMS
// ═══════════════════════════════════════════

function openIngresoModal() {
    document.getElementById('modal-ingreso').classList.add('show');
    document.getElementById('form-ingreso').reset();
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('[name="fecha_solicitud"]').value = today;
    // Render carta tipo grid
    renderCartaTipoGrid();
    updatePlantillaPreview();
    // Reset autocomplete state
    hidePuestoDropdown();
}

function closeIngresoModal() {
    document.getElementById('modal-ingreso').classList.remove('show');
    // Reset manual selection flag for next form open
    const hidden = document.getElementById('plantilla-carta-hidden');
    if (hidden) hidden.dataset.manual = 'false';
    hidePuestoDropdown();
}


function toggleReemplazo(select) {
    const show = select.value.includes('Reemplazo');
    document.getElementById('reemplazo-fields').style.display = show ? 'block' : 'none';
}

function toggleMontoField(tipo, checkbox) {
    const input = document.querySelector(`[name="monto_${tipo}"]`);
    if (input) input.style.display = checkbox.checked ? 'block' : 'none';
}

function updatePlantillaPreview() {
    const form = document.getElementById('form-ingreso');
    if (!form) return;
    const modalidad = form.querySelector('[name="modalidad"]')?.value || '';
    const puesto = form.querySelector('[name="puesto"]')?.value || '';
    const tipo_ingreso = form.querySelector('[name="tipo_ingreso"]')?.value || '';
    const unidad = form.querySelector('[name="unidad"]')?.value || '';
    const incluye_eps = form.querySelector('[name="incluye_eps"]').checked;
    const incluye_movilidad = form.querySelector('[name="incluye_movilidad"]').checked;
    const incluye_tarjeta = form.querySelector('[name="incluye_tarjeta_alimentos"]').checked;
    const incluye_transporte = form.querySelector('[name="incluye_bono_transporte"]').checked;
    const tipo_personal = form.querySelector('[name="tipo_personal"]')?.value || '';
    const jornada = form.querySelector('[name="jornada"]')?.value || '48';
    const categoria_trab = form.querySelector('[name="categoria_trabajador"]')?.value || '';

    const mockSol = {
        modalidad, puesto, tipo_ingreso, unidad, incluye_eps,
        incluye_movilidad, incluye_tarjeta_alimentos: incluye_tarjeta,
        incluye_bono_transporte: incluye_transporte, tipo_personal,
        jornada, categoria_trabajador: categoria_trab
    };

    // Solo actualizar si no se seleccionó manualmente un tipo
    const hiddenInput = document.getElementById('plantilla-carta-hidden');
    const manuallySelected = hiddenInput?.dataset.manual === 'true';
    
    if (!manuallySelected) {
        const plantilla = determinarPlantilla(mockSol);
        setPlantillaActiva(plantilla, false);
    }
}

function setPlantillaActiva(plantilla, esManual) {
    const hiddenInput = document.getElementById('plantilla-carta-hidden');
    const nombreDiv = document.getElementById('plantilla-nombre');
    if (hiddenInput) {
        hiddenInput.value = plantilla;
        if (esManual !== undefined) hiddenInput.dataset.manual = esManual ? 'true' : 'false';
    }
    if (nombreDiv) nombreDiv.textContent = plantilla;
    // Resaltar tarjeta activa en el grid
    document.querySelectorAll('.carta-tipo-card').forEach(card => {
        card.classList.toggle('active', card.dataset.tipo === plantilla);
    });
}

// ─── AUTOCOMPLETE DE PUESTOS DESDE LIBRO2 ───

let _puestosCache = {};
let _puestosTimeout = null;

async function onPuestoInput(input) {
    const q = input.value.trim();
    const unidad = document.querySelector('[name="unidad"]')?.value || '';
    
    if (q.length < 2) {
        hidePuestoDropdown();
        return;
    }
    
    clearTimeout(_puestosTimeout);
    _puestosTimeout = setTimeout(async () => {
        const cacheKey = `${unidad}:${q.toUpperCase()}`;
        let resultados = _puestosCache[cacheKey];
        
        if (!resultados) {
            try {
                const params = new URLSearchParams({ q, unidad });
                const res = await fetch(`/api/catalogos/puestos-libro2?${params}`);
                if (res.ok) {
                    resultados = await res.json();
                    _puestosCache[cacheKey] = resultados;
                } else {
                    resultados = [];
                }
            } catch (e) {
                resultados = [];
            }
        }
        
        renderPuestoDropdown(resultados, input.value);
    }, 200);
}

function renderPuestoDropdown(items, query) {
    const dropdown = document.getElementById('puesto-dropdown');
    if (!dropdown) return;
    
    if (!items.length) {
        hidePuestoDropdown();
        return;
    }
    
    const q = query.toUpperCase();
    dropdown.innerHTML = items.slice(0, 30).map(item => {
        const nombre = item.puesto;
        const highlighted = nombre.replace(new RegExp(`(${q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'),
            '<strong style="color:var(--accent)">$1</strong>');
        return `<div class="autocomplete-item" 
            onclick="selectPuesto(${JSON.stringify(JSON.stringify(item))})"
            title="${item.departamento} > ${item.area}\nCECO: ${item.codigo_cc}">
            <div class="autocomplete-item-nombre">${highlighted}</div>
            <div class="autocomplete-item-meta">
                <span>${item.unidad}</span>
                ${item.codigo_cc ? `<span class="ceco-tag">${item.codigo_cc}</span>` : ''}
                ${item.area ? `<span style="color:var(--text-secondary);">${item.area.substring(0,25)}</span>` : ''}
            </div>
        </div>`;
    }).join('');
    
    dropdown.style.display = 'block';
}

function selectPuesto(itemJson) {
    const item = JSON.parse(itemJson);
    const puestoInput = document.getElementById('input-puesto');
    const cecoInput = document.getElementById('input-codigo-cr');
    const areaInput = document.getElementById('input-area');
    const unidadOrgInput = document.getElementById('input-unidad-org');
    const badge = document.getElementById('puesto-info-badge');
    
    if (puestoInput) puestoInput.value = item.puesto;
    if (cecoInput) cecoInput.value = item.codigo_cc || '';
    if (areaInput) areaInput.value = item.area || item.departamento || '';
    if (unidadOrgInput) unidadOrgInput.value = item.unidad_org || '';
    
    // Mostrar badge de confirmación
    if (badge) {
        badge.innerHTML = `✅ <strong>${item.puesto}</strong> — ${item.departamento}${item.area ? ' / ' + item.area : ''}  <span style="color:var(--accent);">${item.codigo_cc}</span>`;
        badge.style.display = 'block';
    }
    
    hidePuestoDropdown();
    updatePlantillaPreview();
}

function hidePuestoDropdown() {
    const dd = document.getElementById('puesto-dropdown');
    if (dd) dd.style.display = 'none';
}

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('#input-puesto') && !e.target.closest('#puesto-dropdown')) {
        hidePuestoDropdown();
    }
});

// ─── AUTO-CALCULAR FECHA TÉRMINO DE CONTRATO ───

function autoCalcFechaTermino() {
    const fechaIngreso = document.querySelector('[name="fecha_tentativa_ingreso"]')?.value;
    const tiempoContrato = document.querySelector('[name="tiempo_contrato"]')?.value || '';
    if (!fechaIngreso || !tiempoContrato) return;
    
    const fecha = new Date(fechaIngreso + 'T00:00:00');
    let meses = 0;
    const m6 = tiempoContrato.match(/(\d+)\s*mes/i);
    const ma = tiempoContrato.match(/(\d+)\s*a[ñn]/i);
    if (m6) meses = parseInt(m6[1]);
    else if (ma) meses = parseInt(ma[1]) * 12;
    
    if (meses > 0) {
        fecha.setMonth(fecha.getMonth() + meses);
        fecha.setDate(fecha.getDate() - 1);
        const termino = fecha.toISOString().split('T')[0];
        const terminoInput = document.querySelector('[name="fecha_termino_contrato"]');
        if (terminoInput && !terminoInput.value) terminoInput.value = termino;
    }
}

// ─── GRID DE TIPOS DE CARTA OFERTA ───

const TIPOS_CARTA = [
    { id: 'CO BASE', label: 'CO BASE', emoji: '📄', desc: 'Contrato estándar. Personal administrativo sujeto a fiscalización con EPS.' },
    { id: 'CO BASE (2)', label: 'CO BASE (2)', emoji: '📄', desc: 'Personal de confianza no fiscalizable (Nivel Dirección/Confianza).' },
    { id: 'CO BASE (3)', label: 'CO BASE (3)', emoji: '📄', desc: 'Variante base con 3 firmas. Para sujetos a fiscalización con formato extendido.' },
    { id: 'CO (3)', label: 'CO (3)', emoji: '🏢', desc: 'Dirección, no fiscalizable. Cargos de alta dirección institucional.' },
    { id: 'CO X', label: 'CO X', emoji: '⭐', desc: 'Plazo indeterminado / Personal de gerencia ejecutiva y alta dirección.' },
    { id: 'CO+mov+teb', label: 'CO+Movilidad+TEB', emoji: '🚘', desc: 'Incluye bono de movilidad + tarjeta de alimentos. Personal con beneficios adicionales.' },
    { id: 'CO TP', label: 'CO TP', emoji: '🎓', desc: 'Docentes a tiempo parcial (por hora lectiva). Remuneración por hora.' },
    { id: 'CO GEF', label: 'CO GEF', emoji: '🏗️', desc: 'Gestión Empresarial y Financiera (GEF) / Instituto de Emprendedores (IE).' },
    { id: 'CO sin eps', label: 'CO sin EPS', emoji: '🚫', desc: 'Sin cobertura de EPS. Personal que no aplica al beneficio de EPS.' },
    { id: 'CO Chofer', label: 'CO Chofer', emoji: '🚌', desc: 'Conductores / Choferes institucionales. Incluye tarjeta de alimentos S/.100.' },
    { id: 'CO maternidad', label: 'CO Maternidad', emoji: '🤱', desc: 'Reemplazo por licencia de maternidad. Tiempo determinado.' },
    { id: 'PRACTICANTE PRE', label: 'Practicante PRE', emoji: '📚', desc: 'Practicante pre-profesional. Convenio con centro de estudios, 30 h/semana.' },
    { id: 'PRACTICANTE PRO', label: 'Practicante PRO', emoji: '🎓', desc: 'Practicante profesional. Egresado en proceso de titulación, 30 h/semana.' },
    { id: 'CSIR', label: 'CSIR', emoji: '🏫', desc: 'Personal del Colegio San Ignacio de Recalde. Incluye bono de transporte.' },
    { id: 'PART TIME', label: 'PART TIME', emoji: '⏰', desc: 'Jornada parcial con EPS. Menos de 48 h/semana, con seguro de salud.' },
    { id: 'PART TIME (2)', label: 'PART TIME sin EPS', emoji: '⏱️', desc: 'Jornada parcial sin EPS. Menos de 48 h/semana, sin seguro de salud.' },
    { id: 'operador', label: 'Operador/Promotor', emoji: '🎪', desc: 'Operador o Promotor de eventos. Personal de soporte a eventos institucionales.' },
    { id: 'PREPARADOR FISICO', label: 'Preparador Físico', emoji: '🏃', desc: 'Preparadores físicos / Instructores de actividad física o deportiva.' },
];

let _tiposCartaFiltro = '';

function renderCartaTipoGrid(plantillaActiva) {
    const grid = document.getElementById('carta-tipo-grid');
    if (!grid) return;
    if (!plantillaActiva) {
        plantillaActiva = document.getElementById('plantilla-carta-hidden')?.value || 'CO BASE';
    }
    const q = (_tiposCartaFiltro || '').toLowerCase();
    const filtrados = q ? TIPOS_CARTA.filter(t =>
        t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    ) : TIPOS_CARTA;
    
    grid.innerHTML = filtrados.map(tipo => `
        <div class="carta-tipo-card ${tipo.id === plantillaActiva ? 'active' : ''}" 
            data-tipo="${tipo.id}"
            onclick="seleccionarTipoCarta('${tipo.id}')"
            title="${tipo.desc}">
            <div class="carta-tipo-emoji">${tipo.emoji}</div>
            <div class="carta-tipo-label">${tipo.label}</div>
            <div class="carta-tipo-desc">${tipo.desc}</div>
        </div>
    `).join('');
}

function seleccionarTipoCarta(tipoId) {
    _tiposCartaFiltro = '';
    const filtroInput = document.getElementById('filtro-carta-tipo');
    if (filtroInput) filtroInput.value = '';
    setPlantillaActiva(tipoId, true);
    renderCartaTipoGrid(tipoId);
    showToast(`Tipo de carta: ${tipoId}`, 'info');
}

function filtrarTiposCartaOferta(q) {
    _tiposCartaFiltro = q;
    renderCartaTipoGrid();
}


async function submitIngreso(e) {
    if (e) e.preventDefault();
    const form = document.getElementById('form-ingreso');
    const fd = new FormData(form);
    const data = {};

    for (const [key, val] of fd.entries()) {
        data[key] = val;
    }

    // Checkboxes
    data.incluye_eps = form.querySelector('[name="incluye_eps"]').checked;
    data.incluye_movilidad = form.querySelector('[name="incluye_movilidad"]').checked;
    data.incluye_tarjeta_alimentos = form.querySelector('[name="incluye_tarjeta_alimentos"]').checked;
    data.incluye_bono_transporte = form.querySelector('[name="incluye_bono_transporte"]').checked;

    if (data.salario) data.salario = parseFloat(data.salario);
    if (data.monto_movilidad) data.monto_movilidad = parseFloat(data.monto_movilidad);
    if (data.monto_tarjeta_alimentos) data.monto_tarjeta_alimentos = parseFloat(data.monto_tarjeta_alimentos);
    if (data.monto_bono_transporte) data.monto_bono_transporte = parseFloat(data.monto_bono_transporte);

    // Validaciones Poka-Yoke
    const errores = validarSolicitudClientSide(data);
    if (errores.length > 0) {
        showToast(errores.join(', '), 'error');
        return;
    }

    // Autocalcular salario en letras e plantilla
    data.salario_letras = data.salario ? numeroALetras(data.salario) : null;
    // Respetar selección manual de plantilla; si no hay, calcular
    const plantillaHidden = document.getElementById('plantilla-carta-hidden')?.value;
    data.plantilla_carta = plantillaHidden || determinarPlantilla(data);
    data.estado = 'BORRADOR';

    
    // Generar correlativo
    const maxCorr = globalSolicitudes.reduce((max, s) => (s.correlativo || 0) > max ? s.correlativo : max, 2409);
    data.correlativo = maxCorr + 1;

    try {
        await dbAdd('solicitudes_ingreso', data);
        showToast('Solicitud creada — Correlativo #' + data.correlativo, 'success');
        closeIngresoModal();
    } catch (err) {
        showToast('Error al guardar solicitud', 'error');
        console.error(err);
    }
}

// ═══════════════════════════════════════════
// WORKFLOW ACTIONS
// ═══════════════════════════════════════════

async function aprobarIngreso(id) {
    if (!confirm('¿Aprobar esta solicitud?')) return;
    try {
        await dbUpdate('solicitudes_ingreso', id, { estado: 'APROBADO' });
        showToast('Solicitud aprobada', 'success');
    } catch (e) {
        showToast('Error al aprobar', 'error');
    }
}

async function generarCarta(id) {
    if (!confirm('¿Generar y descargar la carta oferta en PDF?')) return;
    try {
        const sol = globalSolicitudes.find(s => s.id === id);
        if (!sol) {
            showToast('Solicitud no encontrada', 'error');
            return;
        }

        const maxCorr = globalCartas.reduce((max, c) => (c.correlativo || 0) > max ? c.correlativo : max, 2409);
        const correlativo = sol.correlativo || (maxCorr + 1);

        // Generar y descargar el PDF en el cliente
        descargarCartaPDF(sol, correlativo);

        // Guardar metadata en Firestore / LocalStorage
        const cartaId = await dbAdd('cartas_oferta', {
            solicitud_id: id,
            correlativo: correlativo,
            nombre_colaborador: sol.nombres_apellidos,
            puesto: sol.puesto,
            plantilla_usada: sol.plantilla_carta,
            estado: 'GENERADA',
            created_at: new Date().toISOString()
        });

        // Actualizar solicitud de ingreso
        await dbUpdate('solicitudes_ingreso', id, {
            estado: 'CARTA_EMITIDA',
            carta_id: cartaId
        });

        showToast(`Carta #${correlativo} generada y descargada.`, 'success');
    } catch (e) {
        showToast('Error al generar carta', 'error');
        console.error(e);
    }
}

async function descargarCarta(cartaId) {
    try {
        const carta = globalCartas.find(c => c.id === cartaId);
        if (!carta) {
            showToast('Carta no encontrada', 'error');
            return;
        }
        const sol = globalSolicitudes.find(s => s.id === carta.solicitud_id);
        if (!sol) {
            showToast('Datos de solicitud no encontrados', 'error');
            return;
        }
        descargarCartaPDF(sol, carta.correlativo);
        showToast('Descargando PDF...', 'success');
    } catch (e) {
        showToast('Error al descargar PDF', 'error');
        console.error(e);
    }
}

async function deleteIngreso(id) {
    if (!confirm('¿Eliminar esta solicitud? Esta acción no se puede deshacer.')) return;
    try {
        await dbDelete('solicitudes_ingreso', id);
        showToast('Solicitud eliminada', 'info');
    } catch (e) {
        showToast('Error al eliminar', 'error');
    }
}

// ═══════════════════════════════════════════
// DETAILS MODAL
// ═══════════════════════════════════════════

async function viewIngreso(id) {
    activeDetailIngresoId = id;
    const s = globalSolicitudes.find(x => x.id === id);
    if (!s) return;

    const fields = [
        ['Correlativo', s.correlativo], ['Unidad', s.unidad],
        ['Nombres', s.nombres_apellidos], ['DNI', s.dni],
        ['Puesto', s.puesto], ['CECO', s.codigo_cr],
        ['Jefe Directo', s.nombre_jefe_directo], ['Salario', s.salario ? 'S/.' + Number(s.salario).toLocaleString() : ''],
        ['Salario (letras)', s.salario_letras], ['Categoría', s.categoria],
        ['Tipo Ingreso', s.tipo_ingreso], ['Modalidad', s.modalidad],
        ['Tiempo Contrato', s.tiempo_contrato], ['Fecha Término', formatDate(s.fecha_termino_contrato)],
        ['Cat. Trabajador', s.categoria_trabajador], ['Plantilla', s.plantilla_carta],
        ['Estado', s.estado], ['Cartas generadas', s.cartas_count || (s.carta_id ? 1 : 0)],
    ];
    let html = '<div class="detail-grid">';
    for (const [label, value] of fields) {
        html += `<div class="detail-item"><div class="label">${label}</div><div class="value">${value || '—'}</div></div>`;
    }
    html += '</div>';

    document.getElementById('modal-detalle-title').textContent = `Detalle de Solicitud — ${s.nombres_apellidos}`;
    document.getElementById('detail-tab-datos').innerHTML = html;
    
    // Reset preview
    document.getElementById('detail-tab-preview').innerHTML = `
        <div class="loading-preview" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            Cargando previsualización...
        </div>
    `;
    
    switchDetailTab('datos');

    // Footer buttons
    document.getElementById('modal-detalle-footer').innerHTML = `
        <button class="btn btn-secondary" onclick="closeDetailModal()">Cerrar</button>
        ${s.estado === 'APROBADO' ? `<button class="btn btn-primary" onclick="generarCarta('${s.id}');closeDetailModal();">📄 Generar Carta</button>` : ''}
        ${s.carta_id ? `<button class="btn btn-primary" onclick="descargarCarta('${s.carta_id}');">⬇️ Descargar PDF</button>` : ''}
    `;

    document.getElementById('modal-detalle-preview').classList.add('show');
}

function closeDetailModal() {
    document.getElementById('modal-detalle-preview').classList.remove('show');
    activeDetailIngresoId = null;
}

function switchDetailTab(tab) {
    const btnDatos = document.getElementById('tab-btn-datos');
    const btnPreview = document.getElementById('tab-btn-preview');
    const contentDatos = document.getElementById('detail-tab-datos');
    const contentPreview = document.getElementById('detail-tab-preview');

    if (tab === 'datos') {
        btnDatos.style.borderBottom = '2px solid var(--accent)';
        btnDatos.style.color = 'var(--text-primary)';
        btnPreview.style.borderBottom = '2px solid transparent';
        btnPreview.style.color = 'var(--text-secondary)';
        contentDatos.style.display = 'block';
        contentPreview.style.display = 'none';
    } else if (tab === 'preview') {
        btnPreview.style.borderBottom = '2px solid var(--accent)';
        btnPreview.style.color = 'var(--text-primary)';
        btnDatos.style.borderBottom = '2px solid transparent';
        btnDatos.style.color = 'var(--text-secondary)';
        contentDatos.style.display = 'none';
        contentPreview.style.display = 'block';

        if (activeDetailIngresoId) {
            const sol = globalSolicitudes.find(x => x.id === activeDetailIngresoId);
            if (sol) {
                contentPreview.innerHTML = generarHtmlPreview(sol, sol.correlativo || 100);
            }
        }
    }
}

// ═══════════════════════════════════════════
// KPI DETAILED MODAL POPUP
// ═══════════════════════════════════════════

function openKpiModal(type) {
    const modal = document.getElementById('modal-kpi-detalle');
    const title = document.getElementById('modal-kpi-title');
    const loading = document.getElementById('kpi-detalle-loading');
    const container = document.getElementById('kpi-detalle-table-container');
    
    loading.style.display = 'block';
    container.style.display = 'none';
    modal.classList.add('show');
    
    let kpiTitle = '';
    let filteredItems = [];
    let isMovimiento = false;
    let isPuesto = false;
    
    if (type === 'total_ingresos') {
        kpiTitle = 'Detalle: Total Ingresos';
        filteredItems = globalSolicitudes;
    } else if (type === 'ingresos_pendientes') {
        kpiTitle = 'Detalle: Ingresos Pendientes';
        filteredItems = globalSolicitudes.filter(s => s.estado === 'BORRADOR' || s.estado === 'IMPORTADO' || s.estado === 'PENDIENTE_BP');
    } else if (type === 'ingresos_aprobados') {
        kpiTitle = 'Detalle: Ingresos Aprobados';
        filteredItems = globalSolicitudes.filter(s => s.estado === 'APROBADO');
    } else if (type === 'cartas_emitidas') {
        kpiTitle = 'Detalle: Cartas Oferta Emitidas';
        filteredItems = globalSolicitudes.filter(s => s.estado === 'CARTA_EMITIDA');
    } else if (type === 'total_movimientos') {
        kpiTitle = 'Detalle: Total Movimientos';
        filteredItems = globalMovimientos;
        isMovimiento = true;
    } else if (type === 'movimientos_pendientes') {
        kpiTitle = 'Detalle: Movimientos Pendientes';
        filteredItems = globalMovimientos.filter(m => m.estado === 'PENDIENTE');
        isMovimiento = true;
    } else if (type === 'total_puestos') {
        kpiTitle = 'Detalle: Catálogo de Puestos';
        filteredItems = globalPuestos;
        isPuesto = true;
    }
    
    title.textContent = kpiTitle;
    
    setTimeout(() => {
        loading.style.display = 'none';
        container.style.display = 'block';
        
        if (!filteredItems.length) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No hay registros contribuyendo a este KPI.</p>';
            return;
        }
        
        let html = '';
        if (isMovimiento) {
            html = `<table><thead><tr>
                <th>Código</th><th>Colaborador</th><th>Cargo Actual</th><th>Tipo Doc.</th><th>Cargo Nuevo</th><th>Estado</th>
            </tr></thead><tbody>`;
            for (const m of filteredItems) {
                html += `<tr>
                    <td>${m.codigo_colaborador || '—'}</td>
                    <td>${m.nombre || ''}</td>
                    <td>${m.cargo_actual || ''}</td>
                    <td>${m.tipo_documento || ''}</td>
                    <td>${m.cargo_nuevo || ''}</td>
                    <td><span class="badge ${getBadgeClass(m.estado)}">${m.estado}</span></td>
                </tr>`;
            }
        } else if (isPuesto) {
            html = `<table><thead><tr>
                <th>ID</th><th>Nombre del Puesto</th><th>Código CECO</th>
            </tr></thead><tbody>`;
            for (const p of filteredItems) {
                html += `<tr>
                    <td>${p.id}</td>
                    <td>${p.nombre}</td>
                    <td>${p.codigo_ceco || '—'}</td>
                </tr>`;
            }
        } else {
            // Solicitud de ingreso
            html = `<table><thead><tr>
                <th>Corr.</th><th>Unidad</th><th>Nombre</th><th>Puesto</th><th>CECO</th><th>Salario</th><th>Estado</th>
            </tr></thead><tbody>`;
            for (const s of filteredItems) {
                html += `<tr>
                    <td>${s.correlativo || s.id}</td>
                    <td>${s.unidad || ''}</td>
                    <td>${s.nombres_apellidos}</td>
                    <td>${s.puesto || ''}</td>
                    <td>${s.codigo_cr || ''}</td>
                    <td>${s.salario ? 'S/.' + Number(s.salario).toLocaleString() : '—'}</td>
                    <td><span class="badge ${getBadgeClass(s.estado)}">${s.estado}</span></td>
                </tr>`;
            }
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }, 300);
}

function closeKpiModal() {
    document.getElementById('modal-kpi-detalle').classList.remove('show');
}

// ═══════════════════════════════════════════
// CLIENT-SIDE PDF GENERATOR (jsPDF)
// ═══════════════════════════════════════════

function descargarCartaPDF(solicitud, correlativo) {
    const textos = obtenerTextosCarta(solicitud, correlativo);
    const { jsPDF } = window.jspdf;
    
    // Inicializar documento A4 (210 x 297 mm)
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Encabezado Institucional
    doc.setDrawColor(0, 51, 102); // USIL Blue
    doc.setLineWidth(0.5);
    doc.line(20, 20, 190, 20);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 51, 102);
    doc.text("USIL - Universidad San Ignacio de Loyola", 20, 16);
    
    // Correlativo y Fecha
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Correlativo: ${correlativo}`, 20, 32);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`La Molina, ${textos.fecha}`, 190, 32, { align: "right" });
    
    // Saludo
    let y = 45;
    doc.setFont("helvetica", "normal");
    doc.text("Estimado (a):", 20, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text(textos.nombre, 20, y);
    y += 10;
    
    // Introducción
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let introLines = doc.splitTextToSize(textos.intro, 170);
    doc.text(introLines, 20, y);
    y += (introLines.length * 6) + 6;
    
    // Filas de Datos (Simulando una Tabla)
    function addRow(label, value) {
        // Dibujar borde superior de la fila
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.line(20, y - 2, 190, y - 2);
        
        doc.setFont("helvetica", "bold");
        doc.text(label, 20, y);
        
        doc.setFont("helvetica", "normal");
        // Reemplazar saltos de línea de compensaciones para el wrap
        const cleanVal = cleanLatin1Text(value);
        let valLines = doc.splitTextToSize(cleanVal, 130);
        doc.text(valLines, 55, y);
        y += (valLines.length * 6) + 3;
    }
    
    addRow(textos.cargo_label, textos.cargo_val);
    addRow(textos.jefe_label, textos.jefe_val);
    addRow(textos.comp_label, textos.comp_val);
    addRow(textos.contrato_label, textos.contrato_val);
    addRow(textos.horario_label, textos.horario_val);
    
    if (textos.beneficios_val) {
        addRow(textos.beneficios_label, textos.beneficios_val);
    }
    
    y += 5;
    // Cierre
    let cierreLines = doc.splitTextToSize(textos.cierre, 170);
    doc.text(cierreLines, 20, y);
    y += (cierreLines.length * 6) + 20;
    
    // Firmas
    // Firma Candidato
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(20, y, 85, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(cleanLatin1Text(textos.nombre), 20, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Candidato / Aceptante", 20, y + 9);
    
    // Firma VP de Talento
    doc.setTextColor(0, 0, 0);
    doc.line(125, y, 190, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Vicepresidencia de Talento", 125, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Universidad San Ignacio de Loyola", 125, y + 9);
    
    // Footer del PDF
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.text("Documento generado por Sistema de Compensaciones y Presupuesto", 20, 285);
    doc.text("Página 1/1", 190, 285, { align: "right" });
    
    // Descargar archivo
    const safeName = textos.nombre.replace(/[^a-zA-Z0-9\s-_]/g, '_').substring(0, 40);
    doc.save(`CO_${correlativo}_${safeName}.pdf`);
}

// Limpiar caracteres para Latin-1 en jsPDF
function cleanLatin1Text(str) {
    if (!str) return '';
    return str
        .replace(/[\u2022]/g, '-')  // Viñeta a guion
        .replace(/[\u2014\u2013]/g, '-') // Em-dash/en-dash a guion
        .replace(/[\u201C\u201D\u201E]/g, '"') // Comillas dobles
        .replace(/[\u2018\u2019\u201A]/g, "'"); // Comillas simples
}

// ═══════════════════════════════════════════
// TEXT COMPILATION & TEMPLATE RULES (JS PORT)
// ═══════════════════════════════════════════

function evaluarCondicion(cond, solicitud) {
    if (cond.any) {
        return cond.any.some(c => evaluarCondicion(c, solicitud));
    }
    if (cond.all) {
        return cond.all.every(c => evaluarCondicion(c, solicitud));
    }
    const field = cond.field;
    const operator = cond.operator || 'equal';
    const targetVal = cond.value;
    
    const rawVal = solicitud[field];
    const valStr = String(rawVal || '').toUpperCase().trim();
    const targetStr = String(targetVal || '').toUpperCase().trim();
    
    if (operator === 'contains') {
        return valStr.includes(targetStr);
    } else if (operator === 'equal') {
        return valStr === targetStr;
    } else if (operator === 'not_equal') {
        return valStr != targetStr;
    } else if (operator === 'true') {
        return Boolean(rawVal) === true;
    } else if (operator === 'false') {
        return Boolean(rawVal) === false;
    }
    return false;
}

function determinarPlantilla(solicitud) {
    if (rulesConfig && rulesConfig.length > 0) {
        for (const rule of rulesConfig) {
            const plantilla = rule.plantilla;
            const condiciones = rule.condiciones || [];
            if (condiciones.length === 0 || condiciones.every(c => evaluarCondicion(c, solicitud))) {
                return plantilla;
            }
        }
        return "CO BASE";
    }
    return determinarPlantillaLegacy(solicitud);
}

function determinarPlantillaLegacy(solicitud) {
    const modalidad = (solicitud.modalidad || '').toUpperCase().trim();
    const puesto = (solicitud.puesto || '').toUpperCase().trim();
    const tipo_ingreso = (solicitud.tipo_ingreso || '').toUpperCase().trim();
    const unidad = (solicitud.unidad || '').toUpperCase().trim();
    const incluye_eps = solicitud.incluye_eps !== false;
    const incluye_movilidad = solicitud.incluye_movilidad === true;
    const incluye_tarjeta = solicitud.incluye_tarjeta_alimentos === true;
    const incluye_transporte = solicitud.incluye_bono_transporte === true;
    const tipo_personal = (solicitud.tipo_personal || '').toUpperCase().trim();
    const categoria_trab = (solicitud.categoria_trabajador || '').toUpperCase().trim();
    const jornada = solicitud.jornada || '48';

    if (modalidad.includes('PRACTICANTE') || puesto.includes('PRACTICANTE') || tipo_ingreso.includes('PRACTICANTE')) {
        if (modalidad.includes('PRE') || puesto.includes('PRE')) {
            return "PRACTICANTE PRE";
        }
        return "PRACTICANTE PRO";
    }

    if (tipo_ingreso.includes('MATERNIDAD') || tipo_ingreso.includes('LICENCIA')) {
        return "CO maternidad";
    }

    if (puesto.includes('PREPARADOR') || puesto.includes('INSTRUCTOR')) {
        return "PREPARADOR FISICO";
    }

    if (puesto.includes('OPERADOR') && puesto.includes('PROMOTOR')) {
        return "operador";
    }

    if (unidad === 'GEF' || unidad === 'IE') {
        return "CO GEF";
    }

    if (unidad === 'CSIR') {
        return "CSIR";
    }

    if (modalidad.includes('PART') || jornada !== '48') {
        return incluye_eps ? "PART TIME" : "PART TIME (2)";
    }

    if (puesto.includes('CHOFER')) {
        return "CO Chofer";
    }

    if (incluye_movilidad && incluye_tarjeta) return "CO+mov+teb";
    if (incluye_transporte && incluye_tarjeta) return "CO+mov+teb";

    if (!incluye_eps) {
        return "CO sin eps";
    }

    if (puesto.includes('DOCENTE') && modalidad.includes('TIEMPO PARCIAL')) {
        return "CO TP";
    }

    if (puesto.includes('GERENTE') || tipo_personal.includes('INDETERMINADO')) {
        return "CO X";
    }

    if (tipo_personal.includes('DIRECCION') && categoria_trab.includes('NO FISCALIZABLE')) {
        return "CO (3)";
    }

    if (tipo_personal.includes('CONFIANZA') && categoria_trab.includes('NO FISCALIZABLE')) {
        return "CO BASE (2)";
    }

    if (categoria_trab.includes('SUJETO')) {
        return "CO BASE (3)";
    }

    return "CO BASE";
}

function validarSolicitudClientSide(sol) {
    const errores = [];
    if (!sol.nombres_apellidos) errores.push("El nombre es obligatorio");
    if (!sol.puesto) errores.push("Debe especificar el puesto");
    if (!sol.unidad) errores.push("Debe seleccionar la unidad");
    if (sol.salario !== undefined && sol.salario <= 0) errores.push("El salario debe ser mayor a 0");
    if (sol.dni && sol.dni.trim().length < 8) errores.push("El DNI debe tener al menos 8 dígitos");
    if (!sol.codigo_cr) errores.push("El código CR (CECO) es obligatorio");
    if (!sol.fecha_tentativa_ingreso) errores.push("La fecha tentativa de ingreso es obligatoria");
    
    if ((sol.tipo_ingreso || '').includes('Reemplazo')) {
        if (!sol.codigo_reemplazo) errores.push("Falta código del reemplazo");
        if (!sol.nombre_reemplazo) errores.push("Falta nombre del reemplazo");
    }
    return errores;
}

function renderTemplateStr(tmplStr, context) {
    if (!tmplStr) return "";
    let res = tmplStr;
    for (const [k, v] of Object.entries(context)) {
        res = res.replaceAll(`{{${k}}}`, v !== null && v !== undefined ? String(v) : "");
    }
    return res;
}

function obtenerTextosCarta(solicitud, correlativo) {
    if (templatesConfig && Object.keys(templatesConfig).length > 0) {
        return obtenerTextosCartaDeclarativo(solicitud, correlativo);
    }
    return obtenerTextosCartaLegacy(solicitud, correlativo);
}

function obtenerTextosCartaDeclarativo(solicitud, correlativo) {
    const plantilla = solicitud.plantilla_carta || determinarPlantilla(solicitud);
    
    // Obtener config de templatesConfig
    const tmplConfig = templatesConfig[plantilla] || templatesConfig["CO BASE"] || {};
    const labels = tmplConfig.labels || {};
    const templates = tmplConfig.templates || {};
    const config = tmplConfig.config_defecto || {};
    
    const cargo = solicitud.puesto || '';
    const ceco = solicitud.codigo_cr || '';
    const jefe = solicitud.nombre_jefe_directo || '—';
    const salario = solicitud.salario || 0;
    const salario_texto = solicitud.salario_letras || numeroALetras(salario);
    
    const fecha_termino = solicitud.fecha_termino_contrato;
    const modalidad_trabajo = solicitud.modalidad_trabajo || "Presencial";
    const tipo_personal = solicitud.tipo_personal || "";
    const categoria_trab = solicitud.categoria_trabajador || "";
    const tiempo_contrato = solicitud.tiempo_contrato || "6 meses";

    // Fecha actual formateada
    const hoy = new Date();
    const meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const fecha_hoy_str = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
    const f_termino_str = fecha_termino ? formatDate(fecha_termino) : "—";
    
    const config_periodo_prueba = solicitud.periodo_prueba || config.periodo_prueba || "03 meses";
    
    const context = {
        nombre: solicitud.nombres_apellidos || "",
        puesto: cargo,
        codigo_cr: ceco,
        jefe: jefe,
        salario: salario.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        salario_letras: salario_texto,
        fecha_termino_contrato: f_termino_str,
        modalidad_trabajo: modalidad_trabajo,
        tipo_personal: tipo_personal,
        categoria_trabajador: categoria_trab,
        periodo_prueba: config_periodo_prueba,
        tiempo_contrato: tiempo_contrato,
        fecha_hoy: fecha_hoy_str
    };

    const intro = renderTemplateStr(tmplConfig.intro, context);
    
    const cargo_label = labels.cargo || "Cargo:";
    const cargo_val = renderTemplateStr(templates.cargo, context);
    
    const jefe_label = labels.dependencia || "Dependencia:";
    const jefe_val = renderTemplateStr(templates.dependencia, context);
    
    const comp_label = labels.compensacion || "Compensación:";
    let comp_val = renderTemplateStr(templates.compensacion, context);
    
    // Tarjeta de alimentos
    let incluye_ta = solicitud.incluye_tarjeta_alimentos;
    if (incluye_ta === undefined || incluye_ta === null) {
        incluye_ta = config.incluye_tarjeta_alimentos || false;
    }
    if (incluye_ta) {
        const monto_ta = Number(solicitud.monto_tarjeta_alimentos || config.monto_tarjeta_alimentos || 0);
        comp_val += `\n- Tarjeta de alimentos por un importe de S/ ${monto_ta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numeroALetras(monto_ta)})`;
    }
    
    // Bono de transporte
    let incluye_bt = solicitud.incluye_bono_transporte;
    if (incluye_bt === undefined || incluye_bt === null) {
        incluye_bt = config.incluye_bono_transporte || false;
    }
    if (incluye_bt) {
        const monto_bt = Number(solicitud.monto_bono_transporte || config.monto_bono_transporte || 0);
        comp_val += `\n- Bono de transporte por un importe diario de S/ ${monto_bt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numeroALetras(monto_bt)})`;
    }
    
    // Bono de movilidad
    let incluye_mv = solicitud.incluye_movilidad;
    if (incluye_mv === undefined || incluye_mv === null) {
        incluye_mv = config.incluye_movilidad || false;
    }
    if (incluye_mv || plantilla === "CO+mov+teb") {
        const monto_mv = solicitud.monto_movilidad;
        if (monto_mv) {
            comp_val += `\n- Bono de movilidad por un importe de S/ ${Number(monto_mv).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} diarios sujetos a la asistencia al centro de labores`;
        } else {
            comp_val += `\n- Bono de movilidad sujetos a la asistencia al centro de labores`;
        }
    }
    
    const contrato_label = labels.contrato || "Contrato:";
    let contrato_val = renderTemplateStr(templates.contrato, context);
    if (!tipo_personal && !categoria_trab) {
        const lines = contrato_val.split('\n');
        contrato_val = lines.filter(l => !l.trim().startsWith("Personal")).join('\n');
    } else {
        contrato_val = contrato_val.replace("Personal  ", "Personal ");
    }
    contrato_val = contrato_val.trim();
    
    const horario_label = labels.horario || "Horario de Trabajo:";
    const horario_val = renderTemplateStr(templates.horario, context);
    
    const beneficios_label = labels.beneficios || "Otros Beneficios:";
    let incluye_eps = solicitud.incluye_eps;
    if (incluye_eps === undefined || incluye_eps === null) {
        incluye_eps = config.incluye_eps !== false;
    }
    let beneficios_val = null;
    if (beneficios_label && incluye_eps) {
        beneficios_val = renderTemplateStr(templates.beneficios, context);
    }
    
    const cierre = renderTemplateStr(tmplConfig.cierre, context);
    
    return {
        plantilla, fecha: fecha_hoy_str, intro,
        cargo_label, cargo_val, jefe_label, jefe_val,
        comp_label, comp_val, contrato_label, contrato_val,
        horario_label, horario_val, beneficios_label, beneficios_val,
        cierre, nombre: solicitud.nombres_apellidos
    };
}

function obtenerTextosCartaLegacy(solicitud, correlativo) {
    const plantilla = solicitud.plantilla_carta || determinarPlantilla(solicitud);
    const cargo = solicitud.puesto || '';
    const ceco = solicitud.codigo_cr || '';
    const jefe = solicitud.nombre_jefe_directo || '—';
    const salario = solicitud.salario || 0;
    const salario_texto = solicitud.salario_letras || numeroALetras(salario);
    
    const fecha_termino = solicitud.fecha_termino_contrato;
    const modalidad_trabajo = solicitud.modalidad_trabajo || "Presencial";
    const tipo_personal = solicitud.tipo_personal || "";
    const categoria_trab = solicitud.categoria_trabajador || "";
    const tiempo_contrato = solicitud.tiempo_contrato || "6 meses";

    const es_practicante = plantilla.includes("PRACTICANTE");

    // Fecha actual formateada
    const hoy = new Date();
    const meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const fecha_hoy_str = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

    // Introducción
    let intro = "Nos es grato presentarle nuestra propuesta formal de empleo para integrarte a nuestra Institución, bajo los siguientes términos generales:";
    if (plantilla === "PRACTICANTE PRE" || plantilla === "CSIR") {
        intro = "Nos es grato presentarle nuestra propuesta formal de empleo para integrarte a nuestra Institución,";
    }

    // Cargo y dependencia
    const cargo_label = "Cargo:";
    const cargo_val = cargo;
    const jefe_label = "Dependencia:";
    const jefe_val = ceco;

    // Compensación
    let comp_label = es_practicante ? "Subvención:" : "Compensación:";
    let comp_val = "";
    if (es_practicante) {
        comp_val = `S/ ${salario.toFixed(2)} (${salario_texto})`;
    } else if (plantilla === "CO TP") {
        comp_val = `Remuneración bruta por hora lectiva S/. ${salario.toFixed(2)} (${salario_texto})`;
    } else {
        comp_val = `Sueldo base bruto mensual de S/. ${salario.toFixed(2)} (${salario_texto})`;
    }

    // Adicionales
    if (solicitud.incluye_tarjeta_alimentos) {
        const monto_ta = solicitud.monto_tarjeta_alimentos || 0;
        comp_val += `\n- Tarjeta de alimentos por un importe de S/ ${monto_ta.toFixed(2)} (${numeroALetras(monto_ta)})`;
    } else if (plantilla === "CO X") {
        comp_val += "\n- Tarjeta de alimentos por un importe de S/ 800 (Ochocientos con 00/100 soles)";
    } else if (plantilla === "CO Chofer") {
        comp_val += "\n- Tarjeta de alimentos por un importe de S/ 100 (Cien con 00/100 soles)";
    }

    if (solicitud.incluye_bono_transporte) {
        const monto_bt = solicitud.monto_bono_transporte || 0;
        comp_val += `\n- Bono de transporte por un importe diario de S/ ${monto_bt.toFixed(2)} (${numeroALetras(monto_bt)})`;
    } else if (plantilla === "CSIR") {
        comp_val += "\n- Bono de transporte por un importe diario de S/ 10 (Diez con 00/100 soles)";
    }

    if (solicitud.incluye_movilidad) {
        const monto_mv = solicitud.monto_movilidad || 0;
        comp_val += `\n- Bono de movilidad por un importe de S/ ${monto_mv.toFixed(2)} diarios sujetos a la asistencia al centro de labores`;
    }

    // Contrato
    const contrato_label = es_practicante ? "Convenio:" : "Contrato:";
    let contrato_val = "";
    const f_termino_str = fecha_termino ? formatDate(fecha_termino) : "—";
    
    if (es_practicante) {
        contrato_val = `Por ${tiempo_contrato} hasta el ${f_termino_str}.`;
    } else if (plantilla === "CO X") {
        contrato_val = "Plazo indeterminado con un periodo de prueba de 1 año.\nPersonal de confianza no fiscalizable.";
    } else if (plantilla === "CO maternidad") {
        contrato_val = `Suplencia por periodo de maternidad hasta el ${f_termino_str}.\nCon un periodo de prueba de 03 meses.\nPersonal ${tipo_personal} ${categoria_trab}`.trim();
    } else if (plantilla === "operador") {
        contrato_val = `Plazo fijo hasta el ${f_termino_str}.\nCon un periodo de prueba de 02 meses.`;
    } else {
        const prueba = solicitud.periodo_prueba || "03 meses";
        contrato_val = `Plazo fijo hasta el ${f_termino_str}.\nCon un periodo de prueba de ${prueba}.`;
        if (tipo_personal || categoria_trab) {
            contrato_val += `\nPersonal ${tipo_personal} ${categoria_trab}`.trim();
        }
    }

    // Horario
    const horario_label = es_practicante ? "Horario:" : "Horario de Trabajo:";
    let horario_val = "";
    if (es_practicante) {
        if (plantilla === "PRACTICANTE PRE") {
            horario_val = "El practicante tendrá una jornada formativa de treinta (30) horas semanales, la misma que será establecida de común acuerdo por USIL y el practicante.";
        } else {
            horario_val = "El practicante tendrá una jornada laboral de cuarenta y ocho (48) horas semanales, la cual se cumplirá dentro del horario que señale el Empleador.";
        }
    } else if (["CO BASE (2)", "CO TP", "PART TIME", "PART TIME (2)", "PREPARADOR FISICO"].includes(plantilla)) {
        horario_val = "El trabajador tendrá una jornada de trabajo a tiempo parcial, la cual se cumplirá dentro del horario de trabajo que señale el Empleador.";
        if (plantilla === "PREPARADOR FISICO") horario_val += " Modalidad Presencial";
    } else {
        horario_val = "El trabajador tendrá una jornada de trabajo de cuarenta y ocho (48) horas semanales, la cual se cumplirá dentro del horario de trabajo que señale el Empleador.";
    }

    if (modalidad_trabajo && plantilla !== "PREPARADOR FISICO") {
        horario_val += `\nModalidad ${modalidad_trabajo}`;
    }

    // Beneficios
    const beneficios_label = "Otros Beneficios:";
    const no_eps = ["PRACTICANTE PRE", "PRACTICANTE PRO", "CO BASE (2)", "CO sin eps", "CO GEF", "operador", "PART TIME (2)", "PREPARADOR FISICO"];
    let beneficios_val = null;
    if (!no_eps.includes(plantilla) && solicitud.incluye_eps !== false) {
        beneficios_val = "Seguro médico EPS y Seguro Oncológico en caso de afiliarse, cubierto al 100% en plan Base para usted y su familia (Cónyuge e hijos menores de 18 años).";
    }

    const cierre = "Si está de acuerdo con los términos de la presente oferta, favor de firmarla en señal de conformidad. Esta propuesta tiene validez por cinco días laborables.";

    return {
        plantilla, fecha: fecha_hoy_str, intro,
        cargo_label, cargo_val, jefe_label, jefe_val,
        comp_label, comp_val, contrato_label, contrato_val,
        horario_label, horario_val, beneficios_label, beneficios_val,
        cierre, nombre: solicitud.nombres_apellidos
    };
}

function generarHtmlPreview(solicitud, correlativo) {
    const textos = obtenerTextosCarta(solicitud, correlativo);
    const comp_html = textos.comp_val.replace(/\n/g, "<br>");
    const contrato_html = textos.contrato_val.replace(/\n/g, "<br>");
    const horario_html = textos.horario_val.replace(/\n/g, "<br>");

    let html = `<div class="carta-oferta-preview-container" style="background-color: #ffffff; padding: 2.5cm; font-family: 'Arial', sans-serif; line-height: 1.5; max-width: 21cm; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.15); color: #000; position: relative;">
        <!-- Etiqueta de Modo Edición -->
        <div style="position: absolute; top: -30px; right: 0; background: var(--accent); color: white; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; z-index: 10;">
            ✏️ MODO EDICIÓN EN TIEMPO REAL (Clickea cualquier texto para editar)
        </div>
        
        <!-- Header con Logo (image1.png) -->
        <div style="text-align: left; margin-bottom: 2rem;">
            <img src="assets/SOLICITUD DE CARTAS OFERTA_PROYECTO_image1.png" alt="USIL Logo" style="max-height: 80px; max-width: 250px;">
        </div>
        
        <div style="text-align: right; margin-bottom: 1.5rem; font-size: 11pt;" contenteditable="true" spellcheck="false">La Molina, ${textos.fecha}</div>
        
        <div style="font-size: 11pt; margin-bottom: 0.5rem;" contenteditable="true" spellcheck="false">Estimado (a):</div>
        <div style="font-size: 11pt; font-weight: bold; margin-bottom: 2rem; text-transform: uppercase;" contenteditable="true" spellcheck="false">${textos.nombre}</div>
        
        <div style="font-size: 11pt; margin-bottom: 2rem; text-align: justify;" contenteditable="true" spellcheck="false">${textos.intro}</div>
        
        <table style="width: 100%; margin-bottom: 2rem; border-collapse: collapse; font-size: 11pt;" contenteditable="true" spellcheck="false">
            <tbody>
                <tr>
                    <td style="padding: 0.5rem 0; font-weight: bold; width: 160px; vertical-align: top;">${textos.cargo_label}</td>
                    <td style="padding: 0.5rem 0;">${textos.cargo_val}</td>
                </tr>
                <tr>
                    <td style="padding: 0.5rem 0; font-weight: bold; vertical-align: top;">${textos.jefe_label}</td>
                    <td style="padding: 0.5rem 0;">${textos.jefe_val}</td>
                </tr>
                <tr>
                    <td style="padding: 0.5rem 0; font-weight: bold; vertical-align: top;">${textos.comp_label}</td>
                    <td style="padding: 0.5rem 0;">${comp_html}</td>
                </tr>
                <tr>
                    <td style="padding: 0.5rem 0; font-weight: bold; vertical-align: top;">${textos.contrato_label}</td>
                    <td style="padding: 0.5rem 0;">${contrato_html}</td>
                </tr>
                <tr>
                    <td style="padding: 0.5rem 0; font-weight: bold; vertical-align: top;">${textos.horario_label}</td>
                    <td style="padding: 0.5rem 0;">${horario_html}</td>
                </tr>`;

    if (textos.beneficios_val) {
        html += `
                <tr>
                    <td style="padding: 0.5rem 0; font-weight: bold; vertical-align: top;">${textos.beneficios_label}</td>
                    <td style="padding: 0.5rem 0;">${textos.beneficios_val}</td>
                </tr>`;
    }

    html += `
            </tbody>
        </table>
        
        <div style="font-size: 11pt; margin-top: 2rem; margin-bottom: 4rem; text-align: justify;" contenteditable="true" spellcheck="false">${textos.cierre}</div>
        
        <!-- Firmas con Imágenes Reales -->
        <div style="margin-top: 4rem; display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 3rem;">
            <div style="text-align: center; width: 45%;">
                <div style="border-top: 1px solid #000; padding-top: 8px; font-weight: bold; font-size: 11pt;" contenteditable="true" spellcheck="false">${textos.nombre}</div>
                <div style="font-size: 10pt;" contenteditable="true" spellcheck="false">Candidato / Aceptante</div>
            </div>
            <div style="text-align: center; width: 45%; position: relative;">
                <!-- Asumimos que la imagen 5 o 6 es la firma, se mostrará posicionada encima de la línea -->
                <img src="assets/SOLICITUD DE CARTAS OFERTA_PROYECTO_image5.png" alt="Firma USIL" style="max-height: 80px; position: absolute; bottom: 35px; left: 50%; transform: translateX(-50%); mix-blend-mode: multiply; pointer-events: none;">
                <div style="border-top: 1px solid #000; padding-top: 8px; font-weight: bold; font-size: 11pt;" contenteditable="true" spellcheck="false">Vicepresidencia de Talento</div>
                <div style="font-size: 10pt;" contenteditable="true" spellcheck="false">Universidad San Ignacio de Loyola</div>
            </div>
        </div>
        
        <!-- Footer / Watermark Image (image3 o image6) -->
        <div style="position: absolute; bottom: 0; left: 0; width: 100%; text-align: center;">
            <img src="assets/SOLICITUD DE CARTAS OFERTA_PROYECTO_image3.png" alt="Footer" style="max-width: 100%; pointer-events: none;">
        </div>
    </div>`;
    return html;
}

// ═══════════════════════════════════════════
// LOCALSTORAGE DEMO SEED DATA
// ═══════════════════════════════════════════

function initLocalStorageData() {
    let solicitudes = [];
    try {
        solicitudes = JSON.parse(localStorage.getItem('solicitudes_ingreso') || '[]');
    } catch (e) {
        solicitudes = [];
    }
    const hasElizabeth = solicitudes.some(s => s.correlativo == 2387 || (s.nombres_apellidos && s.nombres_apellidos.includes("ELIZABETH")));
    if (!hasElizabeth || solicitudes.length < 4) {
        solicitudes = [
            { id: "sol_4", correlativo: 2387, unidad: "IE", fecha_solicitud: "2026-04-17", fecha_tentativa_ingreso: "2026-06-04", modalidad: "FULL TIME", nombres_apellidos: "ELIZABETH KELLY QUISPE ZARATE", puesto: "ALMACENERO", codigo_cr: "S12600C046", nombre_jefe_directo: "ROBERTO CAMPOS", salario: 100.0, salario_letras: "CIEN Y 00/100 SOLES", categoria: "ADMINISTRATIVOS", tipo_ingreso: "REEMPLAZO", estado: "APROBADO", plantilla_carta: "CO GEF", incluye_eps: true, incluye_movilidad: false, incluye_tarjeta_alimentos: false, incluye_bono_transporte: false, periodo_prueba: "03 meses", jornada: "48", created_at: "2026-04-17T10:00:00Z" },
            { id: "sol_1", correlativo: 2410, unidad: "USIL", fecha_solicitud: "2026-05-20", fecha_tentativa_ingreso: "2026-06-01", modalidad: "FULL TIME", nombres_apellidos: "ARMANDO JUAREZ COBEÑAS", puesto: "ANALISTA JUNIOR DE TI", codigo_cr: "S11500M064", salario: 3500, salario_letras: "TRES MIL QUINIENTOS Y 00/100 SOLES", categoria: "ADMINISTRATIVOS", tipo_ingreso: "Ingreso sin Reemplazo", estado: "APROBADO", plantilla_carta: "CO BASE", incluye_eps: true, incluye_movilidad: false, incluye_tarjeta_alimentos: false, incluye_bono_transporte: false, periodo_prueba: "03 meses", jornada: "48", created_at: "2026-05-20T10:00:00Z" },
            { id: "sol_2", correlativo: 2411, unidad: "CSIR", fecha_solicitud: "2026-05-22", fecha_tentativa_ingreso: "2026-06-01", modalidad: "PRACTICANTE PRE", nombres_apellidos: "EDWARD ABEL DÁVILA LÓPEZ", puesto: "PRACTICANTE DE COMPENSACIONES", codigo_cr: "C11200M012", salario: 1025, salario_letras: "MIL VEINTICINCO Y 00/100 SOLES", categoria: "ADMINISTRATIVOS", tipo_ingreso: "Ingreso sin Reemplazo", estado: "BORRADOR", plantilla_carta: "PRACTICANTE PRE", incluye_eps: true, incluye_movilidad: false, incluye_tarjeta_alimentos: false, incluye_bono_transporte: false, periodo_prueba: "No aplica", jornada: "30", created_at: "2026-05-22T11:00:00Z" },
            { id: "sol_3", correlativo: 2412, unidad: "EPG", fecha_solicitud: "2026-05-24", fecha_tentativa_ingreso: "2026-06-15", modalidad: "FULL TIME", nombres_apellidos: "THOMAS JUNIOR HUAMÁN PIJO", puesto: "COORDINADOR DE ADMISION", codigo_cr: "E20100M001", salario: 5000, salario_letras: "CINCO MIL Y 00/100 SOLES", categoria: "ADMINISTRATIVOS", tipo_ingreso: "Ingreso sin Reemplazo", estado: "CARTA_EMITIDA", carta_id: "carta_1", plantilla_carta: "CO BASE", incluye_eps: true, incluye_movilidad: false, incluye_tarjeta_alimentos: false, incluye_bono_transporte: false, periodo_prueba: "03 meses", jornada: "48", created_at: "2026-05-24T09:00:00Z" }
        ];
        localStorage.setItem('solicitudes_ingreso', JSON.stringify(solicitudes));
    }
    if (!localStorage.getItem('movimientos')) {
        const mockMovimientos = [
            { id: "mov_1", codigo_colaborador: "U00182", nombre: "KARLA ANDREA RIOS VILLACREZ", cargo_actual: "ANALISTA DE RRHH", tipo_documento: "Promoción", fecha_cambio: "2026-06-01", sucursal: "UNIVERSIDAD", cargo_nuevo: "COORDINADOR DE OPERACIONES", adryan: "SI", estado: "COMPLETADO", created_at: "2026-05-18T10:00:00Z" },
            { id: "mov_2", codigo_colaborador: "U00249", nombre: "BRYAM AMED OLIVARES PEREZ", cargo_actual: "CHOFER", tipo_documento: "Asignación de Movilidad", fecha_cambio: "2026-05-15", sucursal: "UNIVERSIDAD", cargo_nuevo: "CHOFER", adryan: "NO APLICA", estado: "PENDIENTE", created_at: "2026-05-19T10:00:00Z" }
        ];
        localStorage.setItem('movimientos', JSON.stringify(mockMovimientos));
    }
    if (!localStorage.getItem('puestos')) {
        const mockPuestos = [
            { id: "puesto_1", nombre: "ANALISTA JUNIOR DE TI", codigo_ceco: "S11500M064" },
            { id: "puesto_2", nombre: "PRACTICANTE DE COMPENSACIONES", codigo_ceco: "C11200M012" },
            { id: "puesto_3", nombre: "COORDINADOR DE ADMISION", codigo_ceco: "E20100M001" },
            { id: "puesto_4", nombre: "CHOFER", codigo_ceco: "S10100M005" }
        ];
        localStorage.setItem('puestos', JSON.stringify(mockPuestos));
    }
    if (!localStorage.getItem('cartas_oferta')) {
        const mockCartas = [
            { id: "carta_1", solicitud_id: "sol_3", correlativo: 2412, nombre_colaborador: "THOMAS JUNIOR HUAMÁN PIJO", puesto: "COORDINADOR DE ADMISION", plantilla_usada: "CO BASE", estado: "GENERADA", created_at: "2026-05-24T09:30:00Z" }
        ];
        localStorage.setItem('cartas_oferta', JSON.stringify(mockCartas));
    }
    if (!localStorage.getItem('unidades_negocio')) {
        localStorage.setItem('unidades_negocio', JSON.stringify([{id: 1, nombre:"USIL"}, {id:2, nombre:"CSIR"}, {id:3, nombre:"IE"}, {id:4, nombre:"EPG"}]));
    }
    if (!localStorage.getItem('tipos_documento')) {
        localStorage.setItem('tipos_documento', JSON.stringify([
            {id:1, nombre: "Promoción", subtipo: null},
            {id:2, nombre: "Asignación de Movilidad", subtipo: null},
            {id:3, nombre: "Ajuste salarial", subtipo: null}
        ]));
    }
}

// ═══════════════════════════════════════════
// GENERAL UTILITIES
// ═══════════════════════════════════════════

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
}

function formatDate(d) {
    if (!d || d === 'None') return '';
    try {
        const dt = new Date(d);
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    } catch { return d; }
}

function getBadgeClass(estado) {
    if (!estado) return '';
    const s = estado.toLowerCase().replace(/ /g, '_');
    if (s.includes('borrador')) return 'badge-borrador';
    if (s.includes('pendiente')) return 'badge-pendiente';
    if (s.includes('aprobado')) return 'badge-aprobado';
    if (s.includes('carta') || s.includes('emitida')) return 'badge-emitida';
    if (s.includes('firmado')) return 'badge-firmado';
    if (s.includes('anulado')) return 'badge-anulado';
    if (s.includes('importado')) return 'badge-importado';
    if (s.includes('completado')) return 'badge-completado';
    return 'badge-borrador';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Global search (binds input to name search)
document.getElementById('global-search')?.addEventListener('input', (e) => {
    const q = e.target.value;
    if (q.length >= 2) {
        const filterNombreInput = document.getElementById('filter-nombre');
        if (filterNombreInput) filterNombreInput.value = q;
        switchView('ingresos');
        renderIngresosView();
    }
});
