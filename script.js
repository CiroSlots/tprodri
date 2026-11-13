/* GESTOR DE GASTOS PERSONALES - Cada movimiento es un objeto { id, tipo, descripcion, monto, categoria, fecha }
   y todos se guardan en el arreglo "movimientos" y en LocalStorage. */

/* ---------- 1. CONFIGURACIÓN ---------- */
const CATEGORIAS = {
    gasto: ["Alimentación", "Transporte", "Entretenimiento", "Servicios", "Salud", "Compras", "Otros"],
    ingreso: ["Sueldo", "Trabajos extras", "Transferencias", "Otros"]
};
const COLORES = {
    "Alimentación": "#047857", "Transporte": "#0ea5e9", "Entretenimiento": "#8b5cf6", "Servicios": "#f59e0b",
    "Salud": "#ef4444", "Compras": "#ec4899", "Otros": "#6b7280", "Ingresos": "#047857", "Gastos": "#dc2626"
};

/* ---------- 2. FUNCIONES DE AYUDA ---------- */
// Atajo para no escribir document.getElementById todo el tiempo
const el = (id) => document.getElementById(id);
// 45000 -> "$ 45.000"
const pesos = (n) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 });
// "2026-11-03" -> "03/11/2026"
const fechaLinda = (fecha) => fecha.split("-").reverse().join("/");
// Ordena del más reciente al más antiguo
const ordenarPorFecha = (lista) => [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
// Fecha de hoy como "AAAA-MM-DD" (el formato que usa <input type="date">)
function hoy() {
    const f = new Date();
    return f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
}
// Suma ingresos y gastos de una lista
function calcularTotales(lista) {
    const sumar = (tipo) => lista.filter((m) => m.tipo === tipo).reduce((total, m) => total + m.monto, 0);
    return { ingresos: sumar("ingreso"), gastos: sumar("gasto"), balance: sumar("ingreso") - sumar("gasto") };
}
// Agrupa y suma montos por un campo. Ej: sumarPor(gastos, "categoria") -> { Salud: 12000, ... }
function sumarPor(lista, campo) {
    const resultado = {};
    lista.forEach((m) => resultado[m[campo]] = (resultado[m[campo]] || 0) + m.monto);
    return resultado;
}

/* ---------- 3. DATOS Y LOCALSTORAGE ---------- */
// Datos de ejemplo con fechas del mes actual, para que la app no arranque vacía
function datosDeEjemplo() {
    const dia = (n) => hoy().slice(0, 8) + String(Math.min(n, new Date().getDate())).padStart(2, "0");
    return [
        { id: 1, tipo: "ingreso", descripcion: "Sueldo", monto: 850000, categoria: "Sueldo", fecha: dia(1) },
        { id: 2, tipo: "gasto", descripcion: "Supermercado", monto: 45000, categoria: "Alimentación", fecha: dia(3) },
        { id: 3, tipo: "gasto", descripcion: "Carga de SUBE", monto: 15000, categoria: "Transporte", fecha: dia(5) },
        { id: 4, tipo: "gasto", descripcion: "Salida al cine", monto: 20000, categoria: "Entretenimiento", fecha: dia(8) },
        { id: 5, tipo: "gasto", descripcion: "Luz e internet", monto: 35000, categoria: "Servicios", fecha: dia(10) }
    ];
}
// Si hay datos guardados los usamos; si no, los de ejemplo
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || datosDeEjemplo();
let idEnEdicion = null;   // id del movimiento que se está editando (null = ninguno)
const guardarEnStorage = () => localStorage.setItem("movimientos", JSON.stringify(movimientos));

/* ---------- 4. NAVEGACIÓN ---------- */
// Muestra solo la sección elegida y marca su botón en el menú
function mostrarSeccion(id) {
    document.querySelectorAll(".seccion").forEach((s) => s.classList.toggle("activa", s.id === id));
    document.querySelectorAll(".menu-item").forEach((b) => b.classList.toggle("activo", b.dataset.seccion === id));
}

/* ---------- 5. DASHBOARD ---------- */
function actualizarDashboard() {
    // Tarjetas
    const t = calcularTotales(movimientos);
    el("totalBalance").textContent = pesos(t.balance);
    el("totalIngresos").textContent = pesos(t.ingresos);
    el("totalGastos").textContent = pesos(t.gastos);
    el("totalMovimientos").textContent = movimientos.length;
    // Últimos 5 movimientos
    el("listaUltimos").innerHTML = ordenarPorFecha(movimientos).slice(0, 5).map((m) => `
        <li class="movimiento"><span class="movimiento-icono ${m.tipo}">${m.tipo === "ingreso" ? "+" : "-"}</span>
            <div class="movimiento-info"><strong>${m.descripcion}</strong><span>${m.categoria} · ${fechaLinda(m.fecha)}</span></div>
            <span class="movimiento-monto texto-${m.tipo}">${pesos(m.monto)}</span></li>`).join("") || '<li class="vacio">Sin movimientos.</li>';
    // Resumen del mes actual
    const delMes = movimientos.filter((m) => m.fecha.startsWith(hoy().slice(0, 7)));
    const tm = calcularTotales(delMes);
    el("nombreMes").textContent = el("nombreMesEstadisticas").textContent = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });
    el("mesIngresos").textContent = pesos(tm.ingresos);
    el("mesGastos").textContent = pesos(tm.gastos);
    el("mesBalance").textContent = pesos(tm.balance);
    el("mesCantidad").textContent = delMes.length;
}

/* ---------- 6. FORMULARIO (AGREGAR Y EDITAR) ---------- */
// Carga en el <select> las categorías del tipo elegido
function cargarCategorias(tipo) {
    el("categoria").innerHTML = '<option value="">Seleccioná una categoría</option>' +
        CATEGORIAS[tipo].map((c) => `<option>${c}</option>`).join("");
}
function guardarMovimiento(evento) {
    evento.preventDefault();   // evita que la página se recargue
    // 1. Leemos el formulario (sacamos < y > para que no se pueda meter HTML)
    const mov = {
        id: idEnEdicion || Date.now(),
        tipo: document.querySelector('input[name="tipo"]:checked').value,
        descripcion: el("descripcion").value.trim().replace(/[<>]/g, ""),
        monto: Number(el("monto").value),
        categoria: el("categoria").value,
        fecha: el("fecha").value
    };
    // 2. Validamos
    let error = "";
    if (mov.descripcion.length < 3) error = "La descripción debe tener al menos 3 caracteres.";
    else if (!(mov.monto > 0)) error = "Ingresá un monto válido mayor a cero.";
    else if (mov.categoria === "") error = "Seleccioná una categoría.";
    else if (mov.fecha === "") error = "Seleccioná una fecha.";
    el("mensajeError").textContent = error;
    if (error !== "") return;
    // 3. Si se estaba editando reemplazamos el movimiento; si no, agregamos uno nuevo
    if (idEnEdicion) movimientos[movimientos.findIndex((m) => m.id === idEnEdicion)] = mov;
    else movimientos.push(mov);
    // 4. Guardamos, actualizamos la pantalla y vamos al historial
    guardarEnStorage();
    limpiarFormulario();
    actualizarTodo();
    mostrarSeccion("historial");
}
// Deja el formulario vacío y en modo "nuevo movimiento"
function limpiarFormulario() {
    el("formMovimiento").reset();
    el("fecha").value = hoy();
    el("mensajeError").textContent = "";
    cargarCategorias("gasto");
    idEnEdicion = null;
    el("tituloFormulario").textContent = "Nuevo movimiento";
    el("botonCancelar").classList.add("oculto");
}
// Pasa los datos de un movimiento al formulario para modificarlo
function editar(id) {
    const m = movimientos.find((mov) => mov.id === id);
    idEnEdicion = id;
    document.querySelector(`input[value="${m.tipo}"]`).checked = true;
    cargarCategorias(m.tipo);
    ["descripcion", "monto", "categoria", "fecha"].forEach((campo) => el(campo).value = m[campo]);
    el("tituloFormulario").textContent = "Editar movimiento";
    el("botonCancelar").classList.remove("oculto");
    mostrarSeccion("nuevo");
}

/* ---------- 7. HISTORIAL ---------- */
function mostrarHistorial() {
    const texto = el("buscador").value.toLowerCase();
    const categoria = el("filtroCategoria").value;
    // Aplicamos la búsqueda y el filtro de categoría
    const lista = ordenarPorFecha(movimientos).filter((m) =>
        m.descripcion.toLowerCase().includes(texto) && (categoria === "todas" || m.categoria === categoria));
    el("cuerpoTabla").innerHTML = lista.map((m) => `
        <tr><td>${fechaLinda(m.fecha)}</td><td>${m.descripcion}</td><td>${m.categoria}</td>
            <td><span class="etiqueta ${m.tipo}">${m.tipo === "ingreso" ? "Ingreso" : "Gasto"}</span></td>
            <td class="derecha texto-${m.tipo}"><strong>${pesos(m.monto)}</strong></td>
            <td class="centro"><button class="boton-icono" onclick="editar(${m.id})" title="Editar">✏️</button>
                <button class="boton-icono eliminar" onclick="eliminar(${m.id})" title="Eliminar">🗑️</button></td></tr>`).join("");
    el("historialVacio").classList.toggle("oculto", lista.length > 0);
    el("contadorHistorial").textContent = `Mostrando ${lista.length} de ${movimientos.length} movimientos`;
}
function eliminar(id) {
    if (!confirm("¿Seguro que querés eliminar este movimiento?")) return;
    movimientos = movimientos.filter((m) => m.id !== id);   // nos quedamos con todos menos ese
    guardarEnStorage();
    actualizarTodo();
}

/* ---------- 8. GRÁFICOS (barras hechas con HTML y CSS) ---------- */
// "datos" es un objeto { etiqueta: monto }. La barra más grande ocupa el 100% del ancho.
function dibujarBarras(idContenedor, datos) {
    const etiquetas = Object.keys(datos);
    if (etiquetas.length === 0) return el(idContenedor).innerHTML = '<p class="vacio">No hay datos para mostrar.</p>';
    const maximo = Math.max(...Object.values(datos));
    el(idContenedor).innerHTML = etiquetas.map((e) => `
        <div class="grafico-fila">
            <div class="grafico-texto"><span>${e}</span><strong>${pesos(datos[e])}</strong></div>
            <div class="barra"><div class="barra-relleno" style="width:${datos[e] / maximo * 100}%; background-color:${COLORES[e] || "#047857"}"></div></div>
        </div>`).join("");
}
function actualizarGraficos() {
    const gastos = movimientos.filter((m) => m.tipo === "gasto");
    const t = calcularTotales(movimientos);
    dibujarBarras("graficoDashboard", sumarPor(gastos, "categoria"));
    dibujarBarras("graficoCategorias", sumarPor(gastos, "categoria"));
    dibujarBarras("graficoComparacion", movimientos.length ? { Ingresos: t.ingresos, Gastos: t.gastos } : {});
    // Evolución: gastos del mes actual sumados por día (ordenados por fecha)
    const porDia = sumarPor(gastos.filter((m) => m.fecha.startsWith(hoy().slice(0, 7))), "fecha");
    const ordenado = {};
    Object.keys(porDia).sort().forEach((fecha) => ordenado[fechaLinda(fecha)] = porDia[fecha]);
    dibujarBarras("graficoEvolucion", ordenado);
}

/* ---------- 9. ACTUALIZAR TODO (mantiene todo sincronizado) ---------- */
function actualizarTodo() {
    actualizarDashboard();
    mostrarHistorial();
    actualizarGraficos();
}

/* ---------- 10. EVENTOS E INICIO ---------- */
// Botones que cambian de sección (menú y "Ver todos")
document.querySelectorAll("[data-seccion]").forEach((boton) => boton.addEventListener("click", () => {
    if (boton.dataset.seccion === "nuevo") limpiarFormulario();
    mostrarSeccion(boton.dataset.seccion);
}));
// Al cambiar entre Gasto / Ingreso cambian las categorías
document.querySelectorAll('input[name="tipo"]').forEach((radio) =>
    radio.addEventListener("change", () => cargarCategorias(radio.value)));
el("formMovimiento").addEventListener("submit", guardarMovimiento);
el("botonCancelar").addEventListener("click", () => { limpiarFormulario(); mostrarSeccion("historial"); });
el("buscador").addEventListener("input", mostrarHistorial);
el("filtroCategoria").addEventListener("change", mostrarHistorial);
limpiarFormulario();
actualizarTodo();
