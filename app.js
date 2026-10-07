// ======================================================
// SERVIDOR ZEPLI — IndexDB + SVG Icons — Sin límites
// ======================================================

(function() {
    'use strict';

    const CANTIDAD_CANALES = 20;
    const TIEMPO_SINCRONIZACION = 3000;
    const DB_NOMBRE = 'ZepliServidor';
    const DB_VERSION = 1;

    let db = null;
    let estado = {
        idPrincipal: null,
        conectado: false,
        canales: []
    };

    // ======================================================
    // ICONOS SVG — Sin emojis
    // ======================================================
    const ICONOS = {
        live: `<svg class="svg-icon icon-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`,
        wait: `<svg class="svg-icon icon-wait" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-12h-2v6l5.25 3.15.75-1.23-4-2.37z"/></svg>`,
        play: `<svg class="svg-icon icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
        reset: `<svg class="svg-icon icon-reset" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
        star: `<svg class="svg-icon icon-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
        del: `<svg class="svg-icon icon-delete" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>`,
        upload: `<svg class="svg-icon icon-upload" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>`
    };

    // ======================================================
    // INDEXDB — Base de datos real, sin límite
    // ======================================================
    function abrirBaseDatos() {
        return new Promise((resolve, reject) => {
            const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);
            solicitud.onupgradeneeded = (e) => {
                db = e.target.result;
                if (!db.objectStoreNames.contains('estado')) {
                    db.createObjectStore('estado', { keyPath: 'tipo' });
                }
                if (!db.objectStoreNames.contains('archivos')) {
                    db.createObjectStore('archivos', { keyPath: 'id' });
                }
            };
            solicitud.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };
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
                if (solicitud.result) {
                    estado = solicitud.result.datos;
                }
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

    // ======================================================
    // LÓGICA PRINCIPAL
    // ======================================================
    function generarIdCanal(numero) {
        return 'ZEPLI-CANAL-' + String(numero).padStart(3, '0');
    }

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
        setInterval(renderizarTodo, TIEMPO_SINCRONIZACION);
    }

    function formatearTamano(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    // ======================================================
    // ELEMENTOS Y EVENTOS
    // ======================================================
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
    // RENDERIZADO
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
                        ${ICONOS.live}
                        EN EMISIÓN — Minuto ${minutos}:${String(segundos).padStart(2, '0')}
                    </div>
                </div>
            `;
        } else {
            estadoEmisionHTML = `
                <div class="estado-emision">
                    <div class="estado-preparando">
                        ${ICONOS.wait}
                        PREPARANDO — Listo para iniciar
                    </div>
                </div>
            `;
        }

        // Lista de archivos
        let listaArchivosHTML = '<p style="color:#666; font-size:14px;">Sin archivos subidos</p>';
        if (canal.archivos.length > 0) {
            listaArchivosHTML = canal.archivos.map((archivo, i) => {
                const claseAviso = canal.indiceAviso === i ? 'aviso' : '';
                const etiquetaAviso = canal.indiceAviso === i ? ICONOS.star + ' AVISO' : '';
                const botonEstrella = canal.indiceAviso !== i ?
                    `<button class="btn-marcar-aviso" data-idx="${i}">${ICONOS.star}</button>` : '';
                return `
                    <div class="archivo-item ${claseAviso}">
                        <div class="archivo-info">
                            <span class="archivo-nombre">${archivo.nombre}</span>
                            <span class="archivo-tamano">${archivo.tamano} ${etiquetaAviso}</span>
                        </div>
                        <div style="display:flex; gap:4px; align-items:center;">
                            ${botonEstrella}
                            <button class="btn-eliminar" data-archivo="${i}">${ICONOS.del}</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Botón de control
        const botonControl = canal.enEmision
            ? `<button class="btn-reiniciar-canal" data-indice="${indice}">${ICONOS.reset} Reiniciar emisión</button>`
            : `<button class="btn-iniciar-canal" data-indice="${indice}">${ICONOS.play} INICIAR CANAL</button>`;

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
                        <button class="btn-subir">${ICONOS.upload} Subir al Canal ${indice + 1}</button>
                    </div>
                    ${botonControl}
                </div>
            </div>
        `;

        asignarEventosTarjeta(div, indice);
        return div;
    }

    function asignarEventosTarjeta(tarjeta, indice) {
        // Acciones: eliminar, marcar aviso, iniciar, reiniciar
        tarjeta.addEventListener('click', async (e) => {
            if (!e.target) return;

            if (e.target.closest('.btn-eliminar')) {
                const idx = parseInt(e.target.closest('.btn-eliminar').dataset.archivo);
                const arch = estado.canales[indice].archivos[idx];
                if (arch && arch.dbId) await eliminarArchivoDB(arch.dbId);
                estado.canales[indice].archivos.splice(idx, 1);
                if (estado.canales[indice].indiceAviso === idx) {
                    estado.canales[indice].indiceAviso = null;
                }
                await guardarEstadoDB();
                compartirEnRed();
                renderizarTodo();
            }

            if (e.target.closest('.btn-marcar-aviso')) {
                estado.canales[indice].indiceAviso = parseInt(e.target.closest('.btn-marcar-aviso').dataset.idx);
                await guardarEstadoDB();
                compartirEnRed();
                renderizarTodo();
            }

            if (e.target.closest('.btn-iniciar-canal')) {
                estado.canales[indice].horaInicio = new Date().toISOString();
                estado.canales[indice].enEmision = true;
                await guardarEstadoDB();
                compartirEnRed();
                alert('Canal ' + (indice + 1) + ' INICIADO');
            }

            if (e.target.closest('.btn-reiniciar-canal')) {
                if (confirm('¿Reiniciar la emisión?')) {
                    estado.canales[indice].horaInicio = new Date().toISOString();
                    estado.canales[indice].enEmision = true;
                    await guardarEstadoDB();
                    compartirEnRed();
                }
            }
        });

        // Subir archivo — sin límite de tamaño
        const btnSubir = tarjeta.querySelector('.btn-subir');
        const inputArchivo = tarjeta.querySelector('.input-archivo');

        btnSubir.addEventListener('click', async () => {
            if (!estado.idPrincipal) {
                alert('Primero conecta tu identificador principal');
                return;
            }
            const archivos = inputArchivo.files;
            if (!archivos || archivos.length === 0) {
                alert('Selecciona un video primero');
                return;
            }

            const archivo = archivos[0];
            const tamano = formatearTamano(archivo.size);
            const dbId = 'archivo_' + Date.now() + '_' + Math.random().toString(36).slice(2);

            // Guardar blob real en IndexDB
            await guardarArchivoDB({
                id: dbId,
                nombre: archivo.name,
                tipo: archivo.type,
                tamanoBytes: archivo.size,
                blob: archivo
            });

            estado.canales[indice].archivos.push({
                dbId: dbId,
                nombre: archivo.name,
                tamano: tamano,
                tamanoBytes: archivo.size,
                tipo: archivo.type,
                fechaSubida: new Date().toLocaleString(),
                url: 'db://' + estado.idPrincipal + '/' + estado.canales[indice].idCanal + '/' + dbId
            });

            await guardarEstadoDB();
            compartirEnRed();
            renderizarTodo();
            inputArchivo.value = '';
        });
    }

    // ======================================================
    // COMPARTIR PARA APP DE TV
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

        // Solo metadatos en localStorage, los archivos reales están en IndexDB
        localStorage.setItem('zepli_datos_publicos', JSON.stringify(datosPublicos));
    }

    // ======================================================
    // ARRANQUE
    // ======================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

})();
