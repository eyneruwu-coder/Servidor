// ======================================================
// SERVIDOR ZEPLI — Control de Inicio Manual + Avisos
// ======================================================

// CONFIGURACIÓN
const CANTIDAD_CANALES = 20;
const TIEMPO_SINCRONIZACION = 3000;

// ESTRUCTURA DE DATOS
let estado = {
    idPrincipal: null,
    conectado: false,
    canales: []
    // Cada canal:
    // { idCanal, archivos: [], horaInicio, enEmision, indiceAviso }
};

// ======================================================
// INICIO Y CARGA PERMANENTE
// ======================================================
function inicializar() {
    cargarDatosGuardados();
    
    if (estado.canales.length === 0) {
        for (let i = 0; i < CANTIDAD_CANALES; i++) {
            estado.canales.push({
                idCanal: generarIdCanal(i + 1),
                archivos: [],
                horaInicio: null,
                enEmision: false,
                indiceAviso: null
            });
        }
        guardarDatos();
    }

    renderizarTodo();
    setInterval(renderizarTodo, TIEMPO_SINCRONIZACION);
}

function generarIdCanal(numero) {
    return `ZEPLI-CANAL-${String(numero).padStart(3, '0')}`;
}

function cargarDatosGuardados() {
    const guardado = localStorage.getItem('zepli_servidor_datos');
    if (guardado) estado = JSON.parse(guardado);
}

function guardarDatos() {
    localStorage.setItem('zepli_servidor_datos', JSON.stringify(estado));
    compartirEnRed();
}

// ======================================================
// CONEXIÓN PRINCIPAL
// ======================================================
const idGeneral = document.getElementById('idGeneral');
const btnConectarGeneral = document.getElementById('btnConectarGeneral');
const estadoGeneral = document.getElementById('estadoGeneral');

btnConectarGeneral.addEventListener('click', () => {
    const id = idGeneral.value.trim().toUpperCase();
    if (!id) {
        estadoGeneral.textContent = 'Escribe tu identificador';
        estadoGeneral.className = 'estado desconectado';
        return;
    }
    estado.idPrincipal = id;
    estado.conectado = true;
    estadoGeneral.textContent = `✅ Conectado — ID: ${id}`;
    estadoGeneral.className = 'estado conectado';
    guardarDatos();
});

// ======================================================
// RENDERIZAR TODOS LOS CANALES
// ======================================================
const listaCanales = document.getElementById('listaCanales');

function renderizarTodo() {
    listaCanales.innerHTML = '';
    estado.canales.forEach((canal, indice) => {
        const tarjeta = crearTarjetaCanal(canal, indice);
        listaCanales.appendChild(tarjeta);
    });
}

function crearTarjetaCanal(canal, indice) {
    const div = document.createElement('div');
    div.className = 'tarjeta-canal';
    div.dataset.indice = indice;

    // Estado de emisión con minuto
    let estadoEmisionHTML = '';
    if (canal.enEmision && canal.horaInicio) {
        const ahora = new Date();
        const inicio = new Date(canal.horaInicio);
        const transcurridoMs = ahora - inicio;
        const minutos = Math.floor(transcurridoMs / 60000);
        const segundos = Math.floor((transcurridoMs % 60000) / 1000);
        estadoEmisionHTML = `
            <div class="estado-emision">
                <div class="estado-en-vivo">
                    📡 EN EMISIÓN — Minuto ${minutos}:${String(segundos).padStart(2, '0')}
                </div>
            </div>
        `;
    } else {
        estadoEmisionHTML = `
            <div class="estado-emision">
                <div class="estado-preparando">
                    ⏸️ PREPARANDO — Listo para iniciar
                </div>
            </div>
        `;
    }

    // Lista de archivos
    let listaArchivosHTML = '';
    if (canal.archivos.length === 0) {
        listaArchivosHTML = '<p style="color:#666; font-size:14px;">Sin archivos subidos</p>';
    } else {
        listaArchivosHTML = canal.archivos.map((archivo, i) => `
            <div class="archivo-item ${canal.indiceAviso === i ? 'aviso' : ''}">
                <div class="archivo-info">
                    <span class="archivo-nombre">${archivo.nombre}</span>
                    <span class="archivo-tamano">${archivo.tamano} ${canal.indiceAviso === i ? ' ⭐ AVISO' : ''}</span>
                </div>
                <div style="display:flex; gap:4px; align-items:center;">
                    ${canal.indiceAviso !== i ? `<button class="btn-marcar-aviso" data-idx="${i}" title="Marcar como aviso">☆</button>` : ''}
                    <button class="btn-eliminar" data-archivo="${i}" title="Eliminar">×</button>
                </div>
            </div>
        `).join('');
    }

    // Botón de control
    const botonControl = canal.enEmision
        ? `<button class="btn-reiniciar-canal" data-indice="${indice}">🔄 Reiniciar emisión</button>`
        : `<button class="btn-iniciar-canal" data-indice="${indice}">▶️ INICIAR CANAL</button>`;

    div.innerHTML = `
        <div class="caja-id-canal">
            <label>ID Canal ${indice + 1}:</label>
            <input type="text" value="${canal.idCanal}" readonly>
        </div>

        ${estadoEmisionHTML}

        <div class="cuerpo-tarjeta">
            <div class="lado-izquierdo">
                <h4 style="margin-bottom:10px; color:#9090c0;">Archivos</h4>
                <div class="lista-archivos">${listaArchivosHTML}</div>
            </div>

            <div class="lado-derecho">
                <h4 class="subida-titulo">Subir Video</h4>
                <div class="subida-area">
                    <input type="file" class="input-archivo" accept="video/*">
                    <button class="btn-subir">Subir al Canal ${indice + 1}</button>
                </div>
                ${botonControl}
            </div>
        </div>
    `;

    asignarEventosTarjeta(div, indice);
    return div;
}

// ======================================================
// EVENTOS DE CADA TARJETA
// ======================================================
function asignarEventosTarjeta(tarjeta, indice) {
    // Eliminar / Marcar como aviso / Iniciar / Reiniciar
    tarjeta.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-eliminar')) {
            const idx = parseInt(e.target.dataset.archivo);
            estado.canales[indice].archivos.splice(idx, 1);
            if (estado.canales[indice].indiceAviso === idx) {
                estado.canales[indice].indiceAviso = null;
            }
            guardarDatos();
            renderizarTodo();
        }

        if (e.target.classList.contains('btn-marcar-aviso')) {
            estado.canales[indice].indiceAviso = parseInt(e.target.dataset.idx);
            guardarDatos();
            renderizarTodo();
        }

        if (e.target.classList.contains('btn-iniciar-canal')) {
            estado.canales[indice].horaInicio = new Date().toISOString();
            estado.canales[indice].enEmision = true;
            guardarDatos();
            alert(`📡 Canal ${indice + 1} INICIADO!\nEl tiempo corre desde ahora.`);
        }

        if (e.target.classList.contains('btn-reiniciar-canal')) {
            if (confirm('¿Reiniciar la emisión? El tiempo vuelve a cero.')) {
                estado.canales[indice].horaInicio = new Date().toISOString();
                estado.canales[indice].enEmision = true;
                guardarDatos();
            }
        }
    });

    // Subir archivo
    const btnSubir = tarjeta.querySelector('.btn-subir');
    const inputArchivo = tarjeta.querySelector('.input-archivo');

    btnSubir.addEventListener('click', () => {
        if (!estado.idPrincipal) {
            alert('Primero conecta tu identificador principal arriba');
            return;
        }
        const archivo = inputArchivo.files[0];
        if (!archivo) {
            alert('Selecciona un video primero');
            return;
        }

        const tamano = formatearTamano(archivo.size);
        estado.canales[indice].archivos.push({
            nombre: archivo.name,
            tamano: tamano,
            tamanoBytes: archivo.size,
            tipo: archivo.type,
            fechaSubida: new Date().toLocaleString(),
            url: `node://${estado.idPrincipal}/${estado.canales[indice].idCanal}/${archivo.name}`
        });

        guardarDatos();
        renderizarTodo();
        inputArchivo.value = '';
    });
}

function formatearTamano(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ======================================================
// DATOS COMPARTIDOS PARA LA APP DE TV
// ======================================================
function compartirEnRed() {
    const datosPublicos = {
        tipo: 'ZEPLI_CANALES',
        idServidor: estado.idPrincipal,
        fechaActualizacion: new Date().toISOString(),
        canales: estado.canales.map(canal => {
            let desplazamientoSegundos = 0;
            let videoActivo = null;

            if (canal.enEmision && canal.horaInicio) {
                const ahora = new Date();
                const inicio = new Date(canal.horaInicio);
                desplazamientoSegundos = Math.floor((ahora - inicio) / 1000);
                videoActivo = canal.archivos.find((_, i) => i !== canal.indiceAviso);
            } else {
                if (canal.indiceAviso !== null) {
                    videoActivo = canal.archivos[canal.indiceAviso];
                }
            }

            return {
                id: canal.idCanal,
                enEmision: canal.enEmision,
                horaInicio: canal.horaInicio,
                desplazamientoSegundos: desplazamientoSegundos,
                videoActivo: videoActivo,
                hayAviso: canal.indiceAviso !== null,
                aviso: canal.indiceAviso !== null ? canal.archivos[canal.indiceAviso] : null,
                todosLosVideos: canal.archivos
            };
        })
    };

    localStorage.setItem('zepli_datos_publicos', JSON.stringify(datosPublicos));
    console.log('📤 Datos actualizados para la app de TV');
}

// ======================================================
// INICIAR
// ======================================================
document.addEventListener('DOMContentLoaded', inicializar);
