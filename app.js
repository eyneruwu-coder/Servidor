// ==============================================
// LECTOR QR - LÓGICA PRINCIPAL
// Todo el procesamiento se realiza localmente
// Sin dependencias externas
// ==============================================

// Elementos del DOM
const video = document.getElementById('camara');
const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');
const estado = document.getElementById('estado');
const btnIniciar = document.getElementById('btnIniciar');
const btnDetener = document.getElementById('btnDetener');
const btnCopiar = document.getElementById('btnCopiar');
const btnAbrir = document.getElementById('btnAbrir');
const cajaResultado = document.getElementById('cajaResultado');
const textoResultado = document.getElementById('textoResultado');
const entradaImagen = document.getElementById('entradaImagen');

let transmisionCamara = null;
let escaneoActivo = false;
let idIntervalo = null;
let ultimoResultado = '';

// ==============================================
// ALGORITMO DE DECODIFICACIÓN QR (implementación básica)
// Basado en análisis de patrones de posición
// ==============================================

function decodificarQR(imagenData, ancho, alto) {
    // NOTA: Esta es una implementación educativa simplificada.
    // Para uso profesional, se recomienda integrar bibliotecas como jsQR o qrcode-reader.
    // Sin embargo, esta versión funciona completamente sin dependencias externas.
    
    // Buscamos los 3 marcadores de esquina característicos de QR
    const tamMuestra = Math.min(ancho, alto);
    const tamBloque = Math.floor(tamMuestra / 25);
    
    // Función auxiliar para verificar patrón de marcador (gráfico 7:5:3:1:3:5:7 píxeles)
    function esMarcador(x, y) {
        if (x < 0 || y < 0 || x + 7*tamBloque >= ancho || y + 7*tamBloque >= alto) return false;
        
        let valido = true;
        // Patrón horizontal
        for (let dy = 0; dy < 7; dy++) {
            const filaValida = 
                obtenerColor(x + 0*tamBloque, y + dy*tamBloque) === 0 &&
                obtenerColor(x + 1*tamBloque, y + dy*tamBloque) === 0 &&
                obtenerColor(x + 2*tamBloque, y + dy*tamBloque) === 1 &&
                obtenerColor(x + 3*tamBloque, y + dy*tamBloque) === 0 &&
                obtenerColor(x + 4*tamBloque, y + dy*tamBloque) === 1 &&
                obtenerColor(x + 5*tamBloque, y + dy*tamBloque) === 0 &&
                obtenerColor(x + 6*tamBloque, y + dy*tamBloque) === 0;
            if (!filaValida) valido = false;
        }
        return valido;
    }
    
    function obtenerColor(x, y) {
        const idx = (Math.floor(y) * ancho + Math.floor(x)) * 4;
        const gris = (imagenData[idx] + imagenData[idx+1] + imagenData[idx+2]) / 3;
        return gris < 128 ? 0 : 1; // 0 = negro, 1 = blanco
    }
    
    // Búsqueda de marcadores en cuadrícula
    const marcadores = [];
    const paso = Math.max(1, Math.floor(tamBloque / 2));
    for (let y = 0; y < alto - 7*tamBloque; y += paso) {
        for (let x = 0; x < ancho - 7*tamBloque; x += paso) {
            if (esMarcador(x, y)) {
                marcadores.push({x: x + 3.5*tamBloque, y: y + 3.5*tamBloque});
                x += 7*tamBloque; // Saltar área
            }
        }
    }
    
    // Si detectamos 3 marcadores, asumimos que hay un código QR
    if (marcadores.length >= 3) {
        return "QR detectado ✅ — Para decodificación completa de contenido, se recomienda usar bibliotecas especializadas (jsQR, ZXing).\n\nEsta versión base demuestra el funcionamiento offline y la detección de cámara.";
    }
    
    return null;
}

// ==============================================
// FUNCIONES DE CÁMARA Y ESCANEO
// ==============================================

async function iniciarCamara() {
    try {
        estado.textContent = "Solicitando permiso...";
        
        // Preferir cámara trasera en móviles
        const opciones = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        transmisionCamara = await navigator.mediaDevices.getUserMedia(opciones);
        video.srcObject = transmisionCamara;
        
        await new Promise(resolve => video.onloadedmetadata = resolve);
        
        estado.textContent = "Escaneando... Coloca el código en el marco";
        escaneoActivo = true;
        btnIniciar.classList.add('oculto');
        btnDetener.classList.remove('oculto');
        
        // Iniciar ciclo de escaneo
        idIntervalo = setInterval(escanearCuadro, 200);
        
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        estado.textContent = "❌ No se pudo acceder a la cámara";
        alert("No se pudo acceder a la cámara. Verifica los permisos y que estés usando HTTPS o archivo local.");
    }
}

function detenerCamara() {
    if (transmisionCamara) {
        transmisionCamara.getTracks().forEach(pista => pista.stop());
        transmisionCamara = null;
    }
    escaneoActivo = false;
    if (idIntervalo) {
        clearInterval(idIntervalo);
        idIntervalo = null;
    }
    video.srcObject = null;
    estado.textContent = "Escaneo detenido";
    btnIniciar.classList.remove('oculto');
    btnDetener.classList.add('oculto');
    cajaResultado.classList.add('oculto');
    btnCopiar.classList.add('oculto');
    btnAbrir.classList.add('oculto');
}

function escanearCuadro() {
    if (!escaneoActivo) return;
    
    // Dibujar cuadro de video en lienzo
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Obtener datos de imagen
    const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    
    // Intentar decodificar
    const resultado = decodificarQR(datos.data, lienzo.width, lienzo.height);
    
    if (resultado && resultado !== ultimoResultado) {
        ultimoResultado = resultado;
        mostrarResultado(resultado);
    }
}

function mostrarResultado(texto) {
    cajaResultado.classList.remove('oculto');
    textoResultado.textContent = texto;
    btnCopiar.classList.remove('oculto');
    
    // Detectar si es un enlace
    if (/^https?:\/\//i.test(texto.trim())) {
        btnAbrir.classList.remove('oculto');
    }
    
    // Vibración si está disponible
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
}

// ==============================================
// PROCESAMIENTO DE IMAGEN SUBIDA
// ==============================================

entradaImagen.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    
    const lector = new FileReader();
    lector.onload = function(evento) {
        const img = new Image();
        img.onload = function() {
            lienzo.width = img.width;
            lienzo.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
            const resultado = decodificarQR(datos.data, lienzo.width, lienzo.height);
            
            if (resultado) {
                mostrarResultado(resultado);
            } else {
                alert("No se pudo detectar un código QR en la imagen.");
            }
        };
        img.src = evento.target.result;
    };
    lector.readAsDataURL(archivo);
});

// ==============================================
// ACCIONES DE BOTONES
// ==============================================

btnIniciar.addEventListener('click', iniciarCamara);
btnDetener.addEventListener('click', detenerCamara);

btnCopiar.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(textoResultado.textContent);
        const textoOriginal = btnCopiar.textContent;
        btnCopiar.textContent = "✅ ¡Copiado!";
        setTimeout(() => btnCopiar.textContent = textoOriginal, 2000);
    } catch (err) {
        console.error('Error al copiar:', err);
        alert("No se pudo copiar al portapapeles");
    }
});

btnAbrir.addEventListener('click', () => {
    const enlace = textoResultado.textContent.trim();
    if (/^https?:\/\//i.test(enlace)) {
        window.open(enlace, '_blank');
    }
});
