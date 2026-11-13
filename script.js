/* =========================================================
   GESTOR DE GASTOS PERSONALES - LÓGICA (JavaScript puro)
   ---------------------------------------------------------
   Cada movimiento se guarda como un objeto así:
   {
     id: 1700000000000,        // número único
     tipo: "gasto",            // "gasto" o "ingreso"
     descripcion: "Supermercado",
     monto: 45000,
     categoria: "Alimentación",
     fecha: "2026-11-03"       // formato AAAA-MM-DD
   }
   Todos los movimientos están en el arreglo "movimientos",
   que se guarda en LocalStorage como texto JSON.
   ========================================================= */


/* ---------- 1. CONSTANTES ---------- */

// Nombre con el que guardamos los datos en LocalStorage
const CLAVE_STORAGE = "gestorGastos_movimientos";

// Categorías disponibles según el tipo de movimiento
const CATEGORIAS = {
    gasto: ["Alimentación", "Transporte", "Entretenimiento", "Servicios", "Salud", "Compras", "Otros"],
    ingreso: ["Sueldo", "Trabajos extras", "Transferencias", "Otros"]
};

// Colores para los gráficos (uno por categoría de gasto)
const COLORES_CATEGORIAS = {
    "Alimentación": "#047857",
    "Transporte": "#0ea5e9",
    "Entretenimiento": "#8b5cf6",
    "Servicios": "#f59e0b",
    "Salud": "#ef4444",
    "Compras": "#ec4899",
    "Otros": "#6b7280"
};

const NOMBRES_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Formateador de moneda en pesos argentinos: 45000 -> "$ 45.000"
const formatoMoneda = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});


/* ---------- 2. ESTADO DE LA APLICACIÓN ---------- */

let movimientos = [];      // lista de todos los movimientos
let idEnEdicion = null;    // id del movimiento que se está editando (null = ninguno)
const graficos = {};       // gráficos de Chart.js creados (para poder actualizarlos)


/* ---------- 3. FUNCIONES DE AYUDA ---------- */

// Convierte un objeto Date en texto "AAAA-MM-DD"
function fechaATexto(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

// Fecha de hoy como texto "AAAA-MM-DD"
function hoy() {
    return fechaATexto(new Date());
}

// Mes actual como texto "AAAA-MM"
function mesActual() {
    return hoy().slice(0, 7);
}

// Convierte "2026-11-03" en "03/11/2026" para mostrarlo
function formatearFecha(texto) {
    const partes = texto.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Da formato de pesos a un número
function formatearMonto(numero) {
    return formatoMoneda.format(numero);
}

// Evita que un texto escrito por el usuario se interprete como HTML
function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

// Muestra un aviso flotante durante unos segundos
function mostrarAviso(mensaje) {
    const aviso = document.getElementById("aviso");
    aviso.textContent = mensaje;
    aviso.classList.add("visible");
    setTimeout(() => aviso.classList.remove("visible"), 2500);
}


/* ---------- 4. DATOS DE DEMOSTRACIÓN ---------- */

// Crea movimientos de ejemplo con fechas del mes actual
function crearDatosDemo() {
    const actual = new Date();
    // Devuelve la fecha del día "n" de este mes (sin pasar del día de hoy)
    const dia = (n) => fechaATexto(new Date(actual.getFullYear(), actual.getMonth(), Math.min(n, actual.getDate())));

    return [
        { id: 1, tipo: "ingreso", descripcion: "Sueldo", monto: 850000, categoria: "Sueldo", fecha: dia(1) },
        { id: 2, tipo: "gasto", descripcion: "Supermercado", monto: 45000, categoria: "Alimentación", fecha: dia(3) },
        { id: 3, tipo: "gasto", descripcion: "Carga de SUBE", monto: 15000, categoria: "Transporte", fecha: dia(5) },
        { id: 4, tipo: "gasto", descripcion: "Salida al cine", monto: 20000, categoria: "Entretenimiento", fecha: dia(8) },
        { id: 5, tipo: "gasto", descripcion: "Luz e internet", monto: 35000, categoria: "Servicios", fecha: dia(10) },
        { id: 6, tipo: "ingreso", descripcion: "Diseño de página web", monto: 120000, categoria: "Trabajos extras", fecha: dia(12) },
        { id: 7, tipo: "gasto", descripcion: "Farmacia", monto: 12000, categoria: "Salud", fecha: dia(12) }
    ];
}


/* ---------- 5. LOCALSTORAGE (GUARDAR Y CARGAR) ---------- */

function guardarDatos() {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(movimientos));
}

function cargarDatos() {
    const guardado = localStorage.getItem(CLAVE_STORAGE);

    if (guardado === null) {
        // Primera vez que se abre la app: cargamos los datos de ejemplo
        movimientos = crearDatosDemo();
        guardarDatos();
    } else {
        try {
            movimientos = JSON.parse(guardado);
        } catch (error) {
            // Si los datos guardados están dañados, empezamos con los de ejemplo
            movimientos = crearDatosDemo();
            guardarDatos();
        }
    }
}


/* ---------- 6. CÁLCULOS ---------- */

// Suma ingresos y gastos de una lista de movimientos
function calcularTotales(lista) {
    let ingresos = 0;
    let gastos = 0;

    lista.forEach((mov) => {
        if (mov.tipo === "ingreso") {
            ingresos += mov.monto;
        } else {
            gastos += mov.monto;
        }
    });

    return { ingresos: ingresos, gastos: gastos, balance: ingresos - gastos };
}

// Devuelve un objeto { categoria: total } solo con los gastos
function calcularGastosPorCategoria(lista) {
    const resultado = {};

    lista.forEach((mov) => {
        if (mov.tipo === "gasto") {
            resultado[mov.categoria] = (resultado[mov.categoria] || 0) + mov.monto;
        }
    });

    return resultado;
}

// Ordena del más reciente al más antiguo
function ordenarPorFecha(lista) {
    return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}

// Movimientos que pertenecen al mes actual
function movimientosDelMes() {
    return movimientos.filter((mov) => mov.fecha.startsWith(mesActual()));
}


/* ---------- 7. NAVEGACIÓN ENTRE SECCIONES ---------- */

function mostrarSeccion(idSeccion) {
    // Ocultamos todas las secciones y mostramos solo la elegida
    document.querySelectorAll(".seccion").forEach((sec) => sec.classList.remove("activa"));
    document.getElementById(idSeccion).classList.add("activa");

    // Marcamos la opción correspondiente del menú
    document.querySelectorAll(".menu-item").forEach((boton) => {
        boton.classList.toggle("activo", boton.dataset.seccion === idSeccion);
    });

    // Redibujamos los gráficos de la sección visible (necesitan estar visibles para medir su tamaño)
    actualizarGraficos();
    window.scrollTo(0, 0);
}


/* ---------- 8. DASHBOARD ---------- */

function actualizarTarjetas() {
    const totales = calcularTotales(movimientos);

    const balance = document.getElementById("totalBalance");
    balance.textContent = formatearMonto(totales.balance);
    balance.className = "dato-valor " + (totales.balance < 0 ? "texto-gasto" : "");

    document.getElementById("totalIngresos").textContent = formatearMonto(totales.ingresos);
    document.getElementById("totalGastos").textContent = formatearMonto(totales.gastos);
    document.getElementById("totalMovimientos").textContent = movimientos.length;
}

// Crea el HTML de un movimiento para las listas
function crearItemMovimiento(mov) {
    const signo = mov.tipo === "ingreso" ? "+" : "-";
    const claseMonto = mov.tipo === "ingreso" ? "texto-ingreso" : "texto-gasto";

    return `
        <li class="movimiento">
            <span class="movimiento-icono ${mov.tipo}">${signo}</span>
            <div class="movimiento-info">
                <strong>${escaparHTML(mov.descripcion)}</strong>
                <span>${mov.categoria} · ${formatearFecha(mov.fecha)}</span>
            </div>
            <span class="movimiento-monto ${claseMonto}">${signo} ${formatearMonto(mov.monto)}</span>
        </li>`;
}

function mostrarUltimosMovimientos() {
    const lista = document.getElementById("listaUltimos");
    const ultimos = ordenarPorFecha(movimientos).slice(0, 5);

    if (ultimos.length === 0) {
        lista.innerHTML = '<li class="vacio">Todavía no registraste movimientos.</li>';
        return;
    }

    lista.innerHTML = ultimos.map(crearItemMovimiento).join("");
}

function mostrarResumenMensual() {
    const delMes = movimientosDelMes();
    const totales = calcularTotales(delMes);
    const nombreMes = NOMBRES_MESES[new Date().getMonth()] + " " + new Date().getFullYear();

    document.getElementById("nombreMes").textContent = nombreMes;
    document.getElementById("nombreMesEstadisticas").textContent = nombreMes;
    document.getElementById("mesIngresos").textContent = formatearMonto(totales.ingresos);
    document.getElementById("mesGastos").textContent = formatearMonto(totales.gastos);
    document.getElementById("mesCantidad").textContent = delMes.length;

    const balance = document.getElementById("mesBalance");
    balance.textContent = formatearMonto(totales.balance);
    balance.className = totales.balance < 0 ? "texto-gasto" : "texto-ingreso";

    // Buscamos la categoría con más gasto en el mes
    const porCategoria = calcularGastosPorCategoria(delMes);
    const categorias = Object.keys(porCategoria);
    const nota = document.getElementById("mesMayorGasto");

    if (categorias.length === 0) {
        nota.textContent = "No hay gastos registrados este mes.";
    } else {
        const mayor = categorias.reduce((a, b) => (porCategoria[a] >= porCategoria[b] ? a : b));
        nota.textContent = `La categoría con más gastos este mes es ${mayor} (${formatearMonto(porCategoria[mayor])}).`;
    }
}


/* ---------- 9. FORMULARIO DE MOVIMIENTOS ---------- */

// Carga las categorías en el <select> según el tipo elegido
function cargarCategoriasFormulario(tipo) {
    const select = document.getElementById("categoria");
    select.innerHTML = '<option value="">Seleccioná una categoría</option>';

    CATEGORIAS[tipo].forEach((cat) => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

// Devuelve el tipo seleccionado ("gasto" o "ingreso")
function tipoSeleccionado() {
    return document.querySelector('input[name="tipo"]:checked').value;
}

// Revisa los datos del formulario. Devuelve un texto con el error, o "" si está todo bien.
function validarFormulario(datos) {
    // Limpiamos marcas de error anteriores
    document.querySelectorAll(".campo-error").forEach((el) => el.classList.remove("campo-error"));

    if (datos.descripcion === "") {
        document.getElementById("descripcion").classList.add("campo-error");
        return "La descripción es obligatoria.";
    }
    if (datos.descripcion.length < 3) {
        document.getElementById("descripcion").classList.add("campo-error");
        return "La descripción debe tener al menos 3 caracteres.";
    }
    if (isNaN(datos.monto)) {
        document.getElementById("monto").classList.add("campo-error");
        return "Ingresá un monto válido.";
    }
    if (datos.monto <= 0) {
        document.getElementById("monto").classList.add("campo-error");
        return "El monto debe ser mayor a cero.";
    }
    if (datos.monto > 1000000000) {
        document.getElementById("monto").classList.add("campo-error");
        return "El monto es demasiado grande.";
    }
    if (datos.categoria === "") {
        document.getElementById("categoria").classList.add("campo-error");
        return "Seleccioná una categoría.";
    }
    if (datos.fecha === "") {
        document.getElementById("fecha").classList.add("campo-error");
        return "Seleccioná una fecha.";
    }
    return "";
}

// Se ejecuta al presionar "Guardar movimiento"
function guardarMovimiento(evento) {
    evento.preventDefault(); // evita que la página se recargue

    // 1. Leemos los datos del formulario
    const datos = {
        tipo: tipoSeleccionado(),
        descripcion: document.getElementById("descripcion").value.trim(),
        monto: parseFloat(document.getElementById("monto").value),
        categoria: document.getElementById("categoria").value,
        fecha: document.getElementById("fecha").value
    };

    // 2. Validamos
    const error = validarFormulario(datos);
    document.getElementById("mensajeError").textContent = error;
    if (error !== "") return;

    // Redondeamos a 2 decimales (centavos)
    datos.monto = Math.round(datos.monto * 100) / 100;

    // 3. Agregamos o modificamos
    if (idEnEdicion === null) {
        datos.id = Date.now();          // id único basado en la hora actual
        movimientos.push(datos);
        mostrarAviso("✅ Movimiento guardado");
    } else {
        const indice = movimientos.findIndex((mov) => mov.id === idEnEdicion);
        datos.id = idEnEdicion;
        movimientos[indice] = datos;
        mostrarAviso("✏️ Movimiento actualizado");
    }

    // 4. Guardamos y actualizamos toda la pantalla
    const estabaEditando = idEnEdicion !== null;
    guardarDatos();
    reiniciarFormulario();
    actualizarTodo();

    // Si estábamos editando, volvemos al historial
    if (estabaEditando) mostrarSeccion("historial");
}

// Deja el formulario vacío y en modo "nuevo"
function reiniciarFormulario() {
    document.getElementById("formMovimiento").reset();
    document.getElementById("fecha").value = hoy();
    document.getElementById("mensajeError").textContent = "";
    document.querySelectorAll(".campo-error").forEach((el) => el.classList.remove("campo-error"));
    cargarCategoriasFormulario(tipoSeleccionado());

    idEnEdicion = null;
    document.getElementById("tituloFormulario").textContent = "Nuevo movimiento";
    document.getElementById("botonGuardar").textContent = "Guardar movimiento";
    document.getElementById("botonCancelar").classList.add("oculto");
}

// Carga un movimiento existente en el formulario para modificarlo
function editarMovimiento(id) {
    const mov = movimientos.find((m) => m.id === id);
    if (!mov) return;

    reiniciarFormulario();
    idEnEdicion = id;

    document.querySelector(`input[name="tipo"][value="${mov.tipo}"]`).checked = true;
    cargarCategoriasFormulario(mov.tipo);
    document.getElementById("descripcion").value = mov.descripcion;
    document.getElementById("monto").value = mov.monto;
    document.getElementById("categoria").value = mov.categoria;
    document.getElementById("fecha").value = mov.fecha;

    document.getElementById("tituloFormulario").textContent = "Editar movimiento";
    document.getElementById("botonGuardar").textContent = "Guardar cambios";
    document.getElementById("botonCancelar").classList.remove("oculto");

    mostrarSeccion("nuevo");
}


/* ---------- 10. HISTORIAL ---------- */

// Carga todas las categorías (sin repetir) en el filtro del historial
function cargarFiltroCategorias() {
    const select = document.getElementById("filtroCategoria");
    const todas = [...new Set([...CATEGORIAS.gasto, ...CATEGORIAS.ingreso])];

    select.innerHTML = '<option value="todas">Todas las categorías</option>';
    todas.forEach((cat) => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function mostrarHistorial() {
    const textoBuscado = document.getElementById("buscador").value.trim().toLowerCase();
    const categoria = document.getElementById("filtroCategoria").value;

    // Aplicamos búsqueda y filtro
    const filtrados = ordenarPorFecha(movimientos).filter((mov) => {
        const coincideTexto = mov.descripcion.toLowerCase().includes(textoBuscado);
        const coincideCategoria = categoria === "todas" || mov.categoria === categoria;
        return coincideTexto && coincideCategoria;
    });

    // Armamos las filas de la tabla
    document.getElementById("cuerpoTabla").innerHTML = filtrados.map((mov) => {
        const signo = mov.tipo === "ingreso" ? "+" : "-";
        const claseMonto = mov.tipo === "ingreso" ? "texto-ingreso" : "texto-gasto";
        const textoTipo = mov.tipo === "ingreso" ? "Ingreso" : "Gasto";

        return `
            <tr>
                <td>${formatearFecha(mov.fecha)}</td>
                <td>${escaparHTML(mov.descripcion)}</td>
                <td>${mov.categoria}</td>
                <td><span class="etiqueta ${mov.tipo}">${textoTipo}</span></td>
                <td class="derecha ${claseMonto}"><strong>${signo} ${formatearMonto(mov.monto)}</strong></td>
                <td class="centro">
                    <button class="boton-icono" data-accion="editar" data-id="${mov.id}" title="Editar">✏️</button>
                    <button class="boton-icono eliminar" data-accion="eliminar" data-id="${mov.id}" title="Eliminar">🗑️</button>
                </td>
            </tr>`;
    }).join("");

    // Mensaje si no hay resultados y contador
    document.getElementById("historialVacio").classList.toggle("oculto", filtrados.length > 0);
    document.getElementById("contadorHistorial").textContent =
        `Mostrando ${filtrados.length} de ${movimientos.length} movimientos`;
}

function eliminarMovimiento(id) {
    const mov = movimientos.find((m) => m.id === id);
    if (!mov) return;

    const confirmado = confirm(`¿Eliminar "${mov.descripcion}" por ${formatearMonto(mov.monto)}?`);
    if (!confirmado) return;

    // Nos quedamos con todos menos el eliminado
    movimientos = movimientos.filter((m) => m.id !== id);

    // Si justo se estaba editando ese movimiento, cancelamos la edición
    if (idEnEdicion === id) reiniciarFormulario();

    guardarDatos();
    actualizarTodo();
    mostrarAviso("🗑️ Movimiento eliminado");
}

function restaurarDatosDemo() {
    const confirmado = confirm("Se borrarán todos los movimientos actuales y se cargarán los datos de ejemplo. ¿Continuar?");
    if (!confirmado) return;

    movimientos = crearDatosDemo();
    guardarDatos();
    reiniciarFormulario();
    actualizarTodo();
    mostrarAviso("Datos de ejemplo restaurados");
}


/* ---------- 11. GRÁFICOS (Chart.js) ---------- */

// Crea un gráfico o reemplaza el anterior en el mismo <canvas>
function dibujarGrafico(idCanvas, configuracion) {
    if (typeof Chart === "undefined") return; // por si no se cargó la librería

    const canvas = document.getElementById(idCanvas);
    const contenedor = canvas.parentElement;

    // Borramos el gráfico anterior para no superponerlos
    if (graficos[idCanvas]) graficos[idCanvas].destroy();

    // Quitamos un posible mensaje de "sin datos"
    const mensajeVacio = contenedor.querySelector(".grafico-vacio");
    if (mensajeVacio) mensajeVacio.remove();

    graficos[idCanvas] = new Chart(canvas, configuracion);
}

// Muestra un texto en lugar del gráfico cuando no hay datos
function mostrarGraficoVacio(idCanvas, texto) {
    if (graficos[idCanvas]) {
        graficos[idCanvas].destroy();
        delete graficos[idCanvas];
    }
    const contenedor = document.getElementById(idCanvas).parentElement;
    if (!contenedor.querySelector(".grafico-vacio")) {
        contenedor.insertAdjacentHTML("beforeend", `<p class="grafico-vacio">${texto}</p>`);
    }
}

// Gráfico de dona con los gastos por categoría
function graficoGastosPorCategoria(idCanvas) {
    const datos = calcularGastosPorCategoria(movimientos);
    const categorias = Object.keys(datos);

    if (categorias.length === 0) {
        mostrarGraficoVacio(idCanvas, "No hay gastos para mostrar.");
        return;
    }

    dibujarGrafico(idCanvas, {
        type: "doughnut",
        data: {
            labels: categorias,
            datasets: [{
                data: categorias.map((cat) => datos[cat]),
                backgroundColor: categorias.map((cat) => COLORES_CATEGORIAS[cat] || "#9ca3af"),
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                // En pantallas chicas la leyenda va abajo para que entre bien
                legend: { position: window.innerWidth < 600 ? "bottom" : "right" },
                tooltip: {
                    callbacks: { label: (ctx) => ` ${ctx.label}: ${formatearMonto(ctx.raw)}` }
                }
            }
        }
    });
}

// Gráfico de barras: total de ingresos vs total de gastos
function graficoIngresosVsGastos() {
    const totales = calcularTotales(movimientos);

    if (movimientos.length === 0) {
        mostrarGraficoVacio("graficoComparacion", "No hay movimientos para mostrar.");
        return;
    }

    dibujarGrafico("graficoComparacion", {
        type: "bar",
        data: {
            labels: ["Ingresos", "Gastos"],
            datasets: [{
                data: [totales.ingresos, totales.gastos],
                backgroundColor: ["#047857", "#dc2626"],
                borderRadius: 8,
                maxBarThickness: 90
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => " " + formatearMonto(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (valor) => formatearMonto(valor) } }
            }
        }
    });
}

// Gráfico de línea: gasto acumulado día por día en el mes actual
function graficoEvolucionMensual() {
    const diaDeHoy = new Date().getDate();
    const gastosDelMes = movimientosDelMes().filter((mov) => mov.tipo === "gasto");

    if (gastosDelMes.length === 0) {
        mostrarGraficoVacio("graficoEvolucion", "No hay gastos registrados este mes.");
        return;
    }

    // Sumamos lo gastado en cada día del mes (posición 0 = día 1)
    const gastoPorDia = new Array(diaDeHoy).fill(0);
    gastosDelMes.forEach((mov) => {
        const dia = parseInt(mov.fecha.slice(8, 10));
        if (dia <= diaDeHoy) gastoPorDia[dia - 1] += mov.monto;
    });

    // Convertimos en acumulado: cada día suma lo de los días anteriores
    const acumulado = [];
    let suma = 0;
    gastoPorDia.forEach((valor) => {
        suma += valor;
        acumulado.push(suma);
    });

    const etiquetas = gastoPorDia.map((_, i) => "Día " + (i + 1));

    dibujarGrafico("graficoEvolucion", {
        type: "line",
        data: {
            labels: etiquetas,
            datasets: [{
                label: "Gasto acumulado",
                data: acumulado,
                borderColor: "#047857",
                backgroundColor: "rgba(4, 120, 87, 0.12)",
                fill: true,
                tension: 0.25,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => " Acumulado: " + formatearMonto(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (valor) => formatearMonto(valor) } }
            }
        }
    });
}

// Lista con barras de porcentaje por categoría (sección Estadísticas)
function mostrarDetalleCategorias() {
    const datos = calcularGastosPorCategoria(movimientos);
    const total = Object.values(datos).reduce((a, b) => a + b, 0);
    const lista = document.getElementById("detalleCategorias");

    if (total === 0) {
        lista.innerHTML = '<li class="vacio">No hay gastos registrados.</li>';
        return;
    }

    // Ordenamos de mayor a menor gasto
    const ordenadas = Object.keys(datos).sort((a, b) => datos[b] - datos[a]);

    lista.innerHTML = ordenadas.map((cat) => {
        const porcentaje = (datos[cat] / total * 100).toFixed(1);
        return `
            <li>
                <div class="categoria-fila">
                    <span>${cat}</span>
                    <span><strong>${formatearMonto(datos[cat])}</strong> · ${porcentaje}%</span>
                </div>
                <div class="barra">
                    <div class="barra-relleno" style="width:${porcentaje}%; background-color:${COLORES_CATEGORIAS[cat] || "#9ca3af"}"></div>
                </div>
            </li>`;
    }).join("");
}

// Dibuja solo los gráficos de la sección que está visible
function actualizarGraficos() {
    if (document.getElementById("dashboard").classList.contains("activa")) {
        graficoGastosPorCategoria("graficoDashboard");
    }
    if (document.getElementById("estadisticas").classList.contains("activa")) {
        graficoGastosPorCategoria("graficoCategorias");
        graficoIngresosVsGastos();
        graficoEvolucionMensual();
    }
}


/* ---------- 12. ACTUALIZAR TODA LA PANTALLA ---------- */

// Se llama cada vez que cambian los datos, así todo queda sincronizado
function actualizarTodo() {
    actualizarTarjetas();
    mostrarUltimosMovimientos();
    mostrarResumenMensual();
    mostrarHistorial();
    mostrarDetalleCategorias();
    actualizarGraficos();
}


/* ---------- 13. EVENTOS ---------- */

function configurarEventos() {
    // Botones del menú lateral
    document.querySelectorAll(".menu-item").forEach((boton) => {
        boton.addEventListener("click", () => mostrarSeccion(boton.dataset.seccion));
    });

    // Botón "Ver todos" del dashboard
    document.querySelectorAll("[data-ir]").forEach((boton) => {
        boton.addEventListener("click", () => mostrarSeccion(boton.dataset.ir));
    });

    // Al cambiar entre Gasto / Ingreso, cambian las categorías
    document.querySelectorAll('input[name="tipo"]').forEach((radio) => {
        radio.addEventListener("change", () => cargarCategoriasFormulario(radio.value));
    });

    // Formulario
    document.getElementById("formMovimiento").addEventListener("submit", guardarMovimiento);
    document.getElementById("botonCancelar").addEventListener("click", () => {
        reiniciarFormulario();
        mostrarSeccion("historial");
    });

    // Búsqueda y filtro del historial (se actualiza mientras se escribe)
    document.getElementById("buscador").addEventListener("input", mostrarHistorial);
    document.getElementById("filtroCategoria").addEventListener("change", mostrarHistorial);

    // Botones Editar / Eliminar de la tabla.
    // Usamos un solo "escuchador" en el cuerpo de la tabla (delegación de eventos)
    document.getElementById("cuerpoTabla").addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;

        const id = Number(boton.dataset.id);
        if (boton.dataset.accion === "editar") editarMovimiento(id);
        if (boton.dataset.accion === "eliminar") eliminarMovimiento(id);
    });

    document.getElementById("botonRestaurar").addEventListener("click", restaurarDatosDemo);
}


/* ---------- 14. INICIO DE LA APLICACIÓN ---------- */

function iniciar() {
    cargarDatos();
    cargarFiltroCategorias();
    reiniciarFormulario();
    configurarEventos();
    actualizarTodo();
}

// Esperamos a que el HTML esté cargado para empezar
document.addEventListener("DOMContentLoaded", iniciar);
