// ======================================================
// SERVIDOR ZEPLI — Selección de archivos corregida + Botones
// ======================================================

(function() {
    'use strict';

    const CANTIDAD_CANALES = 20;
    const DB_NOMBRE = 'ZepliServidor';
    const DB_VERSION = 1;

    let db = null;
    let estado = {
        idPrincipal: null,
        conectado: false,
        canales: []
    };

    // ======================================================
    // ICONOS SVG
    // ======================================================
    const ICONOS = {
        live: `<svg class="svg-icon icon-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`,
        wait: `<svg class="svg-icon icon-wait" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-12h-2v6l5.25 3.15.75-1.23-4-2.37z"/></svg>`,
        play: `<svg class="svg-icon icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
        stop: `<svg class="svg-icon" style="width:16px;height:16px;fill:#fff;margin-right:6px;" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>`,
        close: `<svg class="svg-icon" style="width:16px;height:16px;fill:#fff;margin-right:6px;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        star: `<svg class="svg-icon icon-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
        del: `<svg class="svg-icon icon-delete" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>`,
        upload: `<svg class="svg-icon icon-upload" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>`,
        folder: `<svg class="svg-icon" style="width:16px;height:16px;fill:#ffd700;margin-right:6px;" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`
    };

    // ======================================================
    // INDEXDB
    // ======================================================
    function abrirBaseDatos() {
        return new Promise((resolve, reject) => {
            const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);
            solicitud.onupgradeneeded = (e) => {
                db = e.target.result;
                if (!db.objectStoreNames.contains('estado')) db.createObjectStore('estado', { keyPath: 'tipo' });
                if (!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos', { keyPath: 'id' });
            };
            solicitud.onsuccess = (e) => { db = e.target.result; resolve(); };
            solicitud.onerror = reject;
        });
    }

    async function guardarEstadoDB() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('estado', 'readwrite');
            tx.objectStore('estado').put({ tipo: 'principal', datos: estado });
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    }

    async function cargarEstadoDB() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('estado', 'readonly');
            const solicitud = tx.objectStore('estado').get('principal');
            solicitud.onsuccess = () => {
                if (solicitud.result) estado = solicitud.result.datos;
                resolve();
            };
            solicitud.onerror = reject;
        });
    }

    async function guardarArchivoDB(archivoData) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('archivos', 'readwrite');
            tx.objectStore('archivos').put(archivoData);
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    }

    async function eliminarArchivoDB(idArchivo) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('archivos', 'readwrite');
            tx.objectStore('archivos').delete(idArchivo);
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    }

    function generarIdCanal(numero) {
        return 'ZEPLI-CANAL-' + String(numero).padStart(3, '0');
    }

    function formatearTamano(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    // ======================================================
    // INICIO
    // ======================================================
    async function inicializar() {
        await abrirBaseDatos();
        await cargarEstadoDB();

        if (!estado.canales || estado.canales.length === 0) {
            estado.canales = [];
            for (let i = 0; i < CANTIDAD_CANALES; i++) {
                estado.canales.push({
                    idCanal: generarIdCanal(i + 1),
                    archivos: [],
                    horaInicio: null,
                    enEmision: false,
                    indiceAviso: null
                });
            }
            await guardarEstadoDB();
        }

        renderizarTodo();
        setInterval(renderizarTodo, 3000);
    }

    // CONEXIÓN
    const idGeneral = document.getElementById('idGeneral');
    const btnConectarGeneral = document.getElementById('btnConectarGeneral');
    const estadoGeneral = document.getElementById('estadoGeneral');
    const listaCanales = document.getElementById('listaCanales');

    btnConectarGeneral.addEventListener('click', async () => {
        const id = idGeneral.value.trim().toUpperCase();
        if (!id) {
            estadoGeneral.textContent = 'Escribe tu identificador';
            estadoGeneral.className = 'estado desconectado';
            return;
        }
        estado.idPrincipal = id;
        estado.conectado = true;
        estadoGeneral.textContent = 'Conectado — ID: ' + id;
        estadoGeneral.className = 'estado conectado';
        await guardarEstadoDB();
        compartirEnRed();
    });

    // ======================================================
    // RENDERIZAR CANALES
    // ======================================================
    function renderizarTodo() {
        if (!listaCanales || !estado.canales) return;
        listaCanales.innerHTML = '';
        estado.canales.forEach((canal, indice) => {
            listaCanales.appendChild(crearTarjetaCanal(canal, indice));
        });
    }

    function crearTarjetaCanal(canal, indice) {
        const div = document.createElement('div');
        div.className = 'tarjeta-canal';

        // Estado de emisión
        let estadoHTML = '';
        if (canal.enEmision) {
            estadoHTML = `
                <div class="estado-emision">
                    <div class="estado-en-vivo">
                        ${ICONOS.live} EN EMISIÓN — Iniciado: ${new Date(canal.horaInicio).toLocaleTimeString()}
                    </div>
                </div>
            `;
        } else {
            estadoHTML = `
                <div class="estado-emision">
                    <div class="estado-preparando">
                        ${ICONOS.wait} DETENIDO — Listo para iniciar
                    </div>
                </div>
            `;
        }

        // Lista de archivos
        let archivosHTML = '<p style="color:#666; font-size:14px;">Sin archivos subidos</p>';
        if (canal.archivos.length > 0) {
            archivosHTML = canal.archivos.map((arch, i) => {
                const aviso = canal.indiceAviso === i ? 'aviso' : '';
                const estrella = canal.indiceAviso !== i
                    ? `<button class="btn-marcar-aviso" data-idx="${i}">${ICONOS.star}</button>`
                    : '';
                return `
                    <div class="archivo-item ${aviso}">
                        <div class="archivo-info">
                            <span class="archivo-nombre">${arch.nombre}</span>
                            <span class="archivo-tamano">${arch.tamano}${canal.indiceAviso === i ? ' ⭐ AVISO' : ''}</span>
                        </div>
                        <div style="display:flex;gap:4px;">
                            ${estrella}
                            <button class="btn-eliminar" data-archivo="${i}">${ICONOS.del}</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Botones de acción
        const botones = canal.enEmision
            ? `
                <button class="btn-detener-canal" data-indice="${indice}" style="background:#d4a000;margin-top:15px;">
                    ${ICONOS.stop} Detener Canal
                </button>
                <button class="btn-cerrar-canal" data-indice="${indice}">
                    ${ICONOS.close} Cerrar Canal
                </button>
            `
            : `
                <button class="btn-iniciar-canal" data-indice="${indice}" style="background:#00c853;margin-top:15px;">
                    ${ICONOS.play} Iniciar Canal
                </button>
                <button class="btn-cerrar-canal" data-indice="${indice}">
                    ${ICONOS.close} Cerrar Canal
                </button>
            `;

        div.innerHTML = `
            <div class="caja-id-canal">
                <label>ID Canal ${indice + 1}:</label>
                <input type="text" value="${canal.idCanal}" readonly>
            </div>
            ${estadoHTML}
            <div class="cuerpo-tarjeta">
                <div class="lado-izquierdo">
                    <h4 class="subida-titulo">Archivos</h4>
                    <div class="lista-archivos">${archivosHTML}</div>
                </div>
                <div class="lado-derecho">
                    <h4 class="subida-titulo">Subir Video</h4>
                    <div class="subida-area">
                        <input type="file" class="input-archivo" data-canal="${indice}" accept="video/*" id="archivo-${indice}" style="display:none">
                        <button type="button" class="btn-elegir" data-canal="${indice}">
                            ${ICONOS.folder} Elegir archivo
                        </button>
                        <div class="nombre-archivo" id="nombre-${indice}" style="font-size:13px;color:#888;">Ningún archivo seleccionado</div>
                        
                        <div id="progreso-${indice}" style="display:none;margin-top:8px;">
                            <div style="background:#222;border-radius:4px;height:18px;overflow:hidden;">
                                <div id="barra-${indice}" style="background:#00e5ff;width:0%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#000;font-weight:bold;">0%</div>
                            </div>
                            <div id="texto-prog-${indice}" style="font-size:11px;color:#888;margin-top:4px;">Preparando...</div>
                        </div>
                        
                        <button type="button" class="btn-subir" data-canal="${indice}" style="display:none;margin-top:8px;">
                            ${ICONOS.upload} Subir Video
                        </button>
                    </div>
                    ${botones}
                </div>
            </div>
        `;

        conectarEventosTarjeta(div, indice);
        return div;
    }

    function conectarEventosTarjeta(tarjeta, indice) {
        const input = tarjeta.querySelector(`#archivo-${indice}`);
        const btnElegir = tarjeta.querySelector('.btn-elegir');
        const nombre = tarjeta.querySelector(`#nombre-${indice}`);
        const btnSubir = tarjeta.querySelector('.btn-subir');
        const barra = tarjeta.querySelector(`#barra-${indice}`);
        const textoProg = tarjeta.querySelector(`#texto-prog-${indice}`);
        const progresoDiv = tarjeta.querySelector(`#progreso-${indice}`);

        let archivoActual = null;

        // 1. Botón Elegir → abre el selector
        btnElegir.addEventListener('click', () => {
            console.log('📂 Abriendo selector para canal', indice);
            input.click();
        });

        // 2. Cuando se selecciona un archivo
        input.addEventListener('change', (e) => {
            console.log('📁 Evento change detectado', e.target.files);
            
            if (!e.target.files || e.target.files.length === 0) {
                nombre.textContent = 'Ningún archivo seleccionado';
                nombre.style.color = '#888';
                btnSubir.style.display = 'none';
                archivoActual = null;
                return;
            }

            archivoActual = e.target.files[0];
            nombre.textContent = '✓ ' + archivoActual.name + ' (' + formatearTamano(archivoActual.size) + ')';
            nombre.style.color = '#9effb8';
            btnSubir.style.display = 'flex';
            progresoDiv.style.display = 'none';
            
            console.log('✅ Archivo seleccionado:', archivoActual.name);
        });

        // 3. Subir archivo
        btnSubir.addEventListener('click', async () => {
            if (!estado.idPrincipal) {
                alert('Primero conecta tu identificador arriba');
                return;
            }
            if (!archivoActual) {
                alert('Selecciona un archivo primero');
                return;
            }

            progresoDiv.style.display = 'block';
            barra.style.width = '0%';
            barra.textContent = '0%';
            barra.style.background = '#00e5ff';
            textoProg.textContent = 'Preparando...';
            btnSubir.disabled = true;

            try {
                const archivo = archivoActual;
                const tamano = formatearTamano(archivo.size);
                const dbId = 'archivo_' + Date.now() + '_' + Math.random().toString(36).slice(2);

                // Simular progreso
                let prog = 0;
                const intervalo = setInterval(() => {
                    prog += Math.random() * 5 + 2;
                    if (prog > 95) prog = 95;
                    const pct = Math.round(prog);
                    barra.style.width = pct + '%';
                    barra.textContent = pct + '%';
                    textoProg.textContent = 'Guardando: ' + pct + '% — ' + tamano;
                }, 150);

                await guardarArchivoDB({
                    id: dbId,
                    nombre: archivo.name,
                    tipo: archivo.type,
                    tamanoBytes: archivo.size,
                    blob: archivo
                });

                clearInterval(intervalo);

                barra.style.width = '100%';
                barra.textContent = '✓ 100%';
                barra.style.background = '#00c853';
                textoProg.textContent = '¡Subido correctamente!';

                estado.canales[indice].archivos.push({
                    dbId, nombre: archivo.name, tamano,
                    tamanoBytes: archivo.size, tipo: archivo.type,
                    fechaSubida: new Date().toLocaleString(),
                    url: 'db://' + estado.idPrincipal + '/' + estado.canales[indice].idCanal + '/' + dbId
                });

                await guardarEstadoDB();
                compartirEnRed();

                setTimeout(() => renderizarTodo(), 1200);

            } catch (err) {
                console.error(err);
                barra.style.width = '100%';
                barra.textContent = 'Error';
                barra.style.background = '#ff4444';
                textoProg.textContent = 'Error: ' + err.message;
            }

            btnSubir.disabled = false;
        });

        // Acciones generales del canal
        tarjeta.addEventListener('click', async (e) => {
            const t = e.target.closest('button');
            if (!t) return;

            if (t.classList.contains('btn-iniciar-canal')) {
                estado.canales[indice].enEmision = true;
                estado.canales[indice].horaInicio = new Date().toISOString();
                await guardarEstadoDB();
                compartirEnRed();
                renderizarTodo();
            }

            if (t.classList.contains('btn-detener-canal')) {
                estado.canales[indice].enEmision = false;
                estado.canales[indice].horaInicio = null;
                await guardarEstadoDB();
                compartirEnRed();
                renderizarTodo();
            }

            if (t.classList.contains('btn-cerrar-canal')) {
                if (confirm('¿Cerrar canal? Se borrarán TODOS los videos. Esta acción no se puede deshacer.')) {
                    for (const arch of estado.canales[indice].archivos) {
                        if (arch.dbId) await eliminarArchivoDB(arch.dbId);
                    }
                    estado.canales[indice].archivos = [];
                    estado.canales[indice].enEmision = false;
                    estado.canales[indice].horaInicio = null;
                    estado.canales[indice].indiceAviso = null;
                    await guardarEstadoDB();
                    compartirEnRed();
                    renderizarTodo();
                }
            }

            if (t.classList.contains('btn-eliminar')) {
                const idx = parseInt(t.dataset.archivo);
                const arch = estado.canales[indice].archivos[idx];
                if (arch?.dbId) await eliminarArchivoDB(arch.dbId);
                estado.canales[indice].archivos.splice(idx, 1);
                if (estado.canales[indice].indiceAviso === idx) estado.canales[indice].indiceAviso = null;
                await guardarEstadoDB();
                compartirEnRed();
                renderizarTodo();
            }

            if (t.classList.contains('btn-marcar-aviso')) {
                const idx = parseInt(t.dataset.idx);
                estado.canales[indice].indiceAviso = estado.canales[indice].indiceAviso === idx ? null : idx;
                await guardarEstadoDB();
                compartirEnRed();
                renderizarTodo();
            }
        });
    }

    function compartirEnRed() {
        const datos = {
            tipo: 'ZEPLI_CANALES',
            idServidor: estado.idPrincipal,
            fechaActualizacion: new Date().toISOString(),
            canales: estado.canales.map(c => ({
                id: c.idCanal,
                enEmision: c.enEmision,
                horaInicio: c.horaInicio,
                archivos: c.archivos,
                indiceAviso: c.indiceAviso
            }))
        };
        localStorage.setItem('zepli_datos_publicos', JSON.stringify(datos));
    }

    // ARRANQUE
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

})();
