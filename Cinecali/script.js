// Arreglo donde guardamos el historial de lo recaudado pa' pintar la gráfica
let historialRecaudaciones = [];
// Tarifa base en moneda colombiana (COP)
let tarifaBaseCOP = 12000;
// Variable pa' controlar el flujo de la cámara
let streamCamara = null;

// =========================================================
// BURBUJAS DE AYUDA (Muestra u oculta los globitos informativos)
// =========================================================
function mostrarAyuda(id) {
    // Le quitamos la clase oculta pa' que aparezca sobre el input
    document.getElementById(id).classList.remove("oculta");
}

function ocultarAyuda(id) {
    // Le damos un tiempito suave pa' que no desaparezca de una de golpe
    setTimeout(() => {
        document.getElementById(id).classList.add("oculta");
    }, 200);
}

// =========================================================
// RESTRICCIONES Y FILTROS EN TIEMPO REAL (Filtra lo que digita el usuario)
// =========================================================

// Limpia cualquier número o símbolo raro y frena el texto en el límite indicado
function validarSoloTexto(elemento, max) {
    elemento.value = elemento.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    if (elemento.value.length > max) {
        elemento.value = elemento.value.substring(0, max);
    }
}

// Permite únicamente dígitos numéricos enteros (nada de puntos, comas o letras)
function validarSoloNumerosEnteros(elemento, max) {
    elemento.value = elemento.value.replace(/[^0-9]/g, '');
    if (elemento.value.length > max) {
        elemento.value = elemento.value.substring(0, max);
    }
}

// Permite meter de forma estricta los números 1, 2, 3, 4 o 5 por individual
function validarSalaCinco(elemento) {
    elemento.value = elemento.value.replace(/[^1-5]/g, '');
    if (elemento.value.length > 1) {
        elemento.value = elemento.value.substring(0, 1);
    }
}

// Controla que el asiento empiece obligatoriamente por A, B o C y no pase de 100
function validarFormatoAsiento(elemento) {
    let val = elemento.value.toUpperCase();
    
    if (val.length === 0) {
        elemento.value = "";
        return;
    }

    // La primera letra obligatoriamente debe ser A, B o C
    let letra = val.charAt(0);
    if (!['A', 'B', 'C'].includes(letra)) {
        elemento.value = "";
        return;
    }

    // Aísla los números y verifica que estén en el rango de 1 a 100
    let numeros = val.substring(1).replace(/[^0-9]/g, '');
    
    if (numeros !== "") {
        let numInt = parseInt(numeros, 10);
        if (numInt > 100) {
            numeros = "100"; // Si se pasa de 100, lo frena en 100
        } else if (numInt === 0) {
            numeros = "";
        }
    }

    elemento.value = letra + numeros;
}

// =========================================================
// LOG IN Y CONTROL DE NAVEGACIÓN ENTRE PESTAÑAS
// =========================================================
function ingresar() {
    let u = document.getElementById("usuario").value.trim();
    let p = document.getElementById("password").value.trim();
    let msj = document.getElementById("msj-error-login");

    // Valida credenciales fijas
    if (u === "Cinecali" && p === "Estrenos") {
        document.getElementById("pestana-login").classList.remove("activa");
        document.getElementById("pestana-login").classList.add("oculta");
        document.getElementById("panel-principal").classList.remove("oculta");
        document.getElementById("panel-principal").classList.add("activa");
        msj.innerHTML = "";
    } else {
        msj.innerHTML = "Datos incorrectos. Verifique sus credenciales.";
    }
}

function cerrarSesion() {
    // Esconde el panel y regresa al login apagando la cámara si estaba encendida
    document.getElementById("panel-principal").classList.remove("activa");
    document.getElementById("panel-principal").classList.add("oculta");
    document.getElementById("pestana-login").classList.remove("oculta");
    document.getElementById("pestana-login").classList.add("activa");

    if (streamCamara) {
        streamCamara.getTracks().forEach(t => t.stop());
        streamCamara = null;
    }
}

function cambiarPestana(modulo) {
    // Apaga todas las pestañas primero
    document.getElementById("modulo-taquilla").classList.remove("activa", "oculta");
    document.getElementById("modulo-asientos").classList.remove("activa", "oculta");
    document.getElementById("modulo-reportes").classList.remove("activa", "oculta");

    document.getElementById("modulo-taquilla").classList.add("oculta");
    document.getElementById("modulo-asientos").classList.add("oculta");
    document.getElementById("modulo-reportes").classList.add("oculta");

    // Prende solo la pestaña seleccionada
    document.getElementById("modulo-" + modulo).classList.remove("oculta");
    document.getElementById("modulo-" + modulo).classList.add("activa");

    let botones = document.querySelectorAll(".btn-tab");
    botones.forEach(b => b.classList.remove("activo"));
    event.currentTarget.classList.add("activo");

    if (modulo === "reportes") {
        dibujarGrafica();
    }
}

// =========================================================
// MÓDULO TAQUILLA (Cálculo de boletas + Animación tipo reloj)
// =========================================================
function procesarTaquilla() {
    let idUser = document.getElementById("usuario-id").value.trim();
    let cliente = document.getElementById("cliente-nombre").value.trim();
    let peli = document.getElementById("peli-nombre").value.trim();
    let sala = document.getElementById("peli-sala").value.trim();
    let cantInput = document.getElementById("cant-boletas").value.trim();
    let cant = parseInt(cantInput, 10);

    // Verificación estricta de inconsistencias antes de calcular
    if (!idUser || idUser.length > 10) {
        alert("Datos incorrectos en la identificación.");
        return;
    }
    if (!cliente || cliente.length > 30) {
        alert("Datos incorrectos en el nombre del cliente (Maximo 30 caracteres).");
        return;
    }
    if (!peli || peli.length > 30) {
        alert("Datos incorrectos en el nombre de la pelicula (Maximo 30 caracteres).");
        return;
    }
    if (!sala || !['1', '2', '3', '4', '5'].includes(sala)) {
        alert("Datos incorrectos en la sala seleccionada. Solo existen 5 salas.");
        return;
    }
    if (!cantInput || isNaN(cant) || cant <= 0) {
        alert("Datos incorrectos en la cantidad de boletas.");
        return;
    }

    let totalCOP = cant * tarifaBaseCOP;
    let cajaReloj = document.getElementById("caja-reloj");
    let barra = document.getElementById("progreso-reloj");
    let cajaResultado = document.getElementById("caja-resultado");
    let monto = document.getElementById("monto-recaudado");

    // Muestra la barra de carga tipo reloj simulado
    cajaResultado.classList.add("oculta");
    cajaReloj.classList.remove("oculta");
    barra.style.width = "0%";

    let tiempo = 0;
    let intervalo = setInterval(() => {
        tiempo += 10;
        barra.style.width = tiempo + "%";

        // Al terminar el tiempo, muestra la cifra oficial en COP
        if (tiempo >= 100) {
            clearInterval(intervalo);
            cajaReloj.classList.add("oculta");

            monto.innerHTML = "$ " + totalCOP.toLocaleString("es-CO") + " COP";
            cajaResultado.classList.remove("oculta");
            historialRecaudaciones.push(totalCOP);

            // Confirmación con contraseña clave
            setTimeout(() => {
                let clave = prompt("Ingrese la clave de confirmacion ('CINE'):");
                if (clave === "CINE") {
                    document.getElementById("usuario-id").value = "";
                    document.getElementById("cliente-nombre").value = "";
                    document.getElementById("peli-nombre").value = "";
                    document.getElementById("peli-sala").value = "";
                    document.getElementById("cant-boletas").value = "";
                    cajaResultado.classList.add("oculta");
                } else {
                    alert("Clave incorrecta. Saliendo del sistema...");
                    cerrarSesion();
                }
            }, 300);
        }
    }, 150);
}

// =========================================================
// MÓDULO CAMBIO DE ASIENTOS (Recargo automático por hora actual)
// =========================================================
function procesarCambioAsiento() {
    let actual = document.getElementById("asiento-actual").value.trim();
    let nuevo = document.getElementById("asiento-nuevo").value.trim();
    let cajaRes = document.getElementById("resultado-asiento");
    let detalle = document.getElementById("detalle-asiento");
    let costo = document.getElementById("costo-asiento");

    // Expresión regular pa' comprobar que sea A, B o C seguido de un número de 1 a 100
    let regexAsiento = /^[A-C]([1-9][0-9]?|100)$/;

    if (!regexAsiento.test(actual) || !regexAsiento.test(nuevo)) {
        alert("Datos incorrectos en la ubicacion de los asientos. Verifique el formato permitido.");
        return;
    }

    // Consulta la hora del equipo pa' saber si mete recargo
    let horaActual = new Date().getHours();
    let costoFinalCOP = tarifaBaseCOP;
    let mensaje = "Horario regular (Sin recargo)";

    if (horaActual >= 15 && horaActual < 18) {
        costoFinalCOP += tarifaBaseCOP * 0.05;
        mensaje = "Horario especial (15:00 - 18:00). Se aplico recargo del 5%.";
    }

    detalle.innerHTML = "Cambio de " + actual + " a " + nuevo + "<br>" + mensaje;
    costo.innerHTML = "Total: $ " + costoFinalCOP.toLocaleString("es-CO") + " COP";
    cajaRes.classList.remove("oculta");
}

// =========================================================
// REPORTES (Gráfica lineal en Canvas) Y WEBCAM
// =========================================================
function dibujarGrafica() {
    let canvas = document.getElementById("grafica-lineas");
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibuja los ejes de la gráfica
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(20, 180);
    ctx.lineTo(340, 180);
    ctx.stroke();

    if (historialRecaudaciones.length === 0) return;

    // Dibuja la línea con los montos recaudados
    ctx.strokeStyle = "#0077cc";
    ctx.lineWidth = 2;
    ctx.beginPath();

    let maxVal = Math.max(...historialRecaudaciones, 50000);
    let pasoX = 300 / (historialRecaudaciones.length || 1);

    historialRecaudaciones.forEach((val, i) => {
        let x = 30 + (i * pasoX);
        let y = 180 - ((val / maxVal) * 140);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function iniciarCamara() {
    let video = document.getElementById("video-camara");
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            streamCamara = stream;
            video.srcObject = stream;
        })
        .catch(() => alert("No se pudo acceder a la camara"));
}

function tomarFoto() {
    let video = document.getElementById("video-camara");
    let canvas = document.getElementById("canvas-foto");

    if (!streamCamara) {
        alert("Active la camara primero");
        return;
    }

    let ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.classList.add("oculta");
    canvas.classList.remove("oculta");
    alert("Foto capturada con exito.");
}