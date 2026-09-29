/* ============================================================
   BUSCADOR DE PRODUCTOS — la lupa junto al carrito
   ============================================================
   Busca por nombre entre TODOS los productos de la tienda:
   - los escritos a mano en index.html, Globos.html y Velas.html
     (se leen esas páginas y se sacan de sus botones addToCart),
   - y los subidos desde el panel (tabla "productos" de Supabase).
   La lista se arma la primera vez que alguien usa el buscador.

   Al tocar un resultado se abre su página con ?ver=Nombre, y ahí
   la tarjeta del producto se ilumina para encontrarla rápido.
   Los estilos están en css/estilos.css, sección "BUSCADOR".
   ============================================================ */

/* En qué página vive cada categoría. Las que tienen productos
   escritos a mano llevan fijos: true. */
const BUSCADOR_PAGINAS = {
  productos: { pagina: "index.html", fijos: true },
  "productos-globos": { pagina: "Globos.html", fijos: true },
  "productos-velas": { pagina: "Velas.html", fijos: true },
  "productos-peluches": { pagina: "Peluches.html" },
  "productos-cortinas": { pagina: "Cortinas.html" },
  "productos-platos": { pagina: "Platos.html" },
  "productos-vasos": { pagina: "Vasos.html" },
};
const BUSCADOR_MAXIMO = 30;

let buscadorCatalogo = null; // promesa con la lista completa
let buscadorActivo = -1; // resultado elegido con las flechas

/* "Piñatas  Bluey" → "pinatas bluey": sin acentos, en minúsculas
   y sin espacios dobles (varios nombres los traen). */
function buscadorNormalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buscadorLimpio(nombre) {
  return String(nombre).replace(/\s+/g, " ").trim();
}

function buscadorPaginaActual() {
  return location.pathname.split("/").pop() || "index.html";
}

/* ---------- Armar la lista de productos ---------- */
function buscadorSeccion(categoria) {
  const c = CATEGORIAS.find((x) => x.valor === categoria);
  return c ? c.emoji + " " + c.nombre : "";
}

/* Los productos escritos a mano: se leen de sus botones
   addToCart('Nombre', precio), igual que lo hace el chat. */
async function buscadorLeerPagina(categoria, pagina) {
  const r = await fetch(pagina);
  if (!r.ok) throw new Error(pagina + " respondió " + r.status);
  const doc = new DOMParser().parseFromString(await r.text(), "text/html");
  const lista = [];
  doc.querySelectorAll('button[onclick*="addToCart("]').forEach((boton) => {
    const m = boton
      .getAttribute("onclick")
      .match(/addToCart\(\s*'([^']+)'\s*,\s*([\d.]+)\s*\)/);
    if (!m) return;
    const img = boton.parentElement.querySelector("img");
    lista.push({
      nombre: m[1],
      precio: Number(m[2]),
      imagen: img ? img.getAttribute("src") : "",
      categoria,
      pagina,
    });
  });
  return lista;
}

async function buscadorLeerNube() {
  if (!NUBE_CONFIGURADA) return [];
  const { data, error } = await db
    .from("productos")
    .select("nombre, precio, imagen, categoria");
  if (error) throw new Error(error.message);
  return data
    .filter((p) => BUSCADOR_PAGINAS[p.categoria])
    .map((p) => ({
      nombre: p.nombre,
      precio: Number(p.precio),
      imagen: p.imagen || "",
      categoria: p.categoria,
      pagina: BUSCADOR_PAGINAS[p.categoria].pagina,
    }));
}

function buscadorCargar() {
  if (buscadorCatalogo) return buscadorCatalogo;

  const fuentes = Object.entries(BUSCADOR_PAGINAS)
    .filter(([, datos]) => datos.fijos)
    .map(([categoria, datos]) => buscadorLeerPagina(categoria, datos.pagina));
  fuentes.push(buscadorLeerNube());

  /* Si una fuente falla, las demás siguen sirviendo */
  buscadorCatalogo = Promise.allSettled(fuentes).then((resultados) => {
    const vistos = new Set();
    const lista = [];
    let fallas = 0;
    resultados.forEach((r) => {
      if (r.status === "rejected") {
        fallas++;
        console.error("Buscador:", r.reason);
        return;
      }
      r.value.forEach((p) => {
        const clave = p.pagina + "|" + buscadorNormalizar(p.nombre);
        if (vistos.has(clave)) return;
        vistos.add(clave);
        lista.push({
          ...p,
          seccion: buscadorSeccion(p.categoria),
          clave: buscadorNormalizar(p.nombre + " " + buscadorSeccion(p.categoria)),
        });
      });
    });
    /* Sin nada que buscar: se vuelve a intentar la próxima vez */
    if (fallas === resultados.length) buscadorCatalogo = null;
    return lista;
  });
  return buscadorCatalogo;
}

/* ---------- Buscar ---------- */
/* Todas las palabras tienen que estar en el nombre. A las de más
   de 4 letras se les quita la "s" final, para que "piñatas"
   encuentre "Piñata Bluey" y "velas" encuentre "Vela Kuromi". */
function buscadorFiltrar(lista, texto) {
  const palabras = buscadorNormalizar(texto)
    .split(" ")
    .filter(Boolean)
    .map((p) => (p.length > 4 ? p.replace(/e?s$/, "") : p));
  if (palabras.length === 0) return [];

  const inicio = buscadorNormalizar(texto);
  return lista
    .filter((p) => palabras.every((w) => p.clave.includes(w)))
    .map((p) => {
      const nombre = buscadorNormalizar(p.nombre);
      /* Primero los que empiezan igual, luego los que tienen una
         palabra que empieza igual, y al final todo lo demás */
      let orden = 2;
      if (nombre.startsWith(inicio)) orden = 0;
      else if (nombre.split(" ").some((w) => w.startsWith(palabras[0]))) orden = 1;
      return { p, orden, nombre };
    })
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
    .map((x) => x.p);
}

/* ---------- Pintar los resultados ---------- */
function buscadorEnlace(p) {
  return p.pagina + "?ver=" + encodeURIComponent(p.nombre);
}

function buscadorPintar(resultados, texto) {
  const caja = document.getElementById("buscadorResultados");
  buscadorActivo = -1;
  caja.innerHTML = "";

  if (resultados.length === 0) {
    const msg = `Hola, busqué "${texto}" en la página y no lo encontré. ¿Lo tienen?`;
    caja.innerHTML = `
      <li class="buscador-vacio">
        <p>No encontramos <strong>${escaparHTML(texto)}</strong> 😕</p>
        <a href="https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(msg)}"
           target="_blank" rel="noopener">📱 Pregúntanos por WhatsApp</a>
      </li>`;
    caja.hidden = false;
    return;
  }

  resultados.slice(0, BUSCADOR_MAXIMO).forEach((p) => {
    const li = document.createElement("li");
    li.className = "buscador-fila";
    li.innerHTML = `
      <a class="buscador-item" href="${escaparHTML(buscadorEnlace(p))}">
        <img src="${escaparHTML(p.imagen)}" alt="" loading="lazy" decoding="async" />
        <span class="buscador-item-datos">
          <span class="buscador-item-nombre">${escaparHTML(buscadorLimpio(p.nombre))}</span>
          <span class="buscador-item-seccion">${escaparHTML(p.seccion)}</span>
        </span>
        <span class="buscador-item-precio">$${escaparHTML(String(p.precio))}</span>
      </a>
      <button type="button" class="buscador-agregar"
              aria-label="Agregar ${escaparHTML(buscadorLimpio(p.nombre))} al carrito">🛒+</button>`;
    /* Si el producto está en esta misma página, no se recarga:
       solo se baja hasta él */
    li.querySelector(".buscador-item").addEventListener("click", (e) => {
      if (p.pagina !== buscadorPaginaActual()) return;
      e.preventDefault();
      buscadorCerrar();
      buscadorResaltar(p.nombre);
    });
    li.querySelector(".buscador-agregar").addEventListener("click", () =>
      addToCart(p.nombre, p.precio)
    );
    caja.appendChild(li);
  });

  if (resultados.length > BUSCADOR_MAXIMO) {
    const mas = document.createElement("li");
    mas.className = "buscador-mas";
    mas.textContent = `Y ${resultados.length - BUSCADOR_MAXIMO} más… escribe algo más exacto.`;
    caja.appendChild(mas);
  }
  caja.hidden = false;
}

async function buscadorBuscar() {
  const texto = document.getElementById("buscadorTexto").value.trim();
  const caja = document.getElementById("buscadorResultados");
  if (!texto) {
    caja.hidden = true;
    caja.innerHTML = "";
    return;
  }

  caja.innerHTML = '<li class="buscador-mas">Buscando…</li>';
  caja.hidden = false;
  const lista = await buscadorCargar();
  /* Mientras cargaba pudo cambiar lo escrito: solo cuenta lo último */
  if (document.getElementById("buscadorTexto").value.trim() !== texto) return;

  if (lista.length === 0) {
    caja.innerHTML =
      '<li class="buscador-mas">No se pudieron cargar los productos. Intenta de nuevo.</li>';
    return;
  }
  buscadorPintar(buscadorFiltrar(lista, texto), texto);
}

/* ---------- Abrir y cerrar ---------- */
function buscadorAbrir() {
  const buscador = document.getElementById("buscador");
  buscador.classList.add("buscador-abierto");
  document.getElementById("buscadorLupa").setAttribute("aria-expanded", "true");
  document.getElementById("buscadorTexto").focus();
  buscadorCargar(); // se adelanta la carga mientras escribe
}

function buscadorCerrar() {
  const buscador = document.getElementById("buscador");
  if (!buscador) return;
  buscador.classList.remove("buscador-abierto");
  document.getElementById("buscadorLupa").setAttribute("aria-expanded", "false");
  document.getElementById("buscadorResultados").hidden = true;
}

/* Flechas arriba/abajo para elegir y Enter para abrir */
function buscadorTeclas(e) {
  const enlaces = [...document.querySelectorAll("#buscadorResultados .buscador-item")];
  if (e.key === "Escape") {
    buscadorCerrar();
    document.getElementById("buscadorLupa").focus();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const elegido = enlaces[buscadorActivo] || enlaces[0];
    if (elegido) elegido.click();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  if (enlaces.length === 0) return;
  e.preventDefault();
  buscadorActivo += e.key === "ArrowDown" ? 1 : -1;
  if (buscadorActivo < 0) buscadorActivo = enlaces.length - 1;
  if (buscadorActivo >= enlaces.length) buscadorActivo = 0;
  enlaces.forEach((a, i) => a.classList.toggle("buscador-item-activo", i === buscadorActivo));
  enlaces[buscadorActivo].scrollIntoView({ block: "nearest" });
}

/* ---------- Iluminar el producto al llegar a su página ---------- */
/* Los productos del panel tardan un poquito en aparecer, por eso
   se intenta varias veces antes de rendirse. */
function buscadorResaltar(nombre, intentos = 25) {
  const buscado = buscadorNormalizar(nombre);
  let ficha = null;

  document.querySelectorAll('button[onclick*="addToCart("]').forEach((boton) => {
    const m = boton.getAttribute("onclick").match(/addToCart\(\s*'([^']+)'/);
    if (!ficha && m && buscadorNormalizar(m[1]) === buscado) ficha = boton.parentElement;
  });
  if (!ficha) {
    document.querySelectorAll(".js-agregar").forEach((boton) => {
      const h3 = boton.parentElement.querySelector("h3");
      if (!ficha && h3 && buscadorNormalizar(h3.textContent) === buscado) {
        ficha = boton.parentElement;
      }
    });
  }

  if (!ficha) {
    if (intentos > 0) setTimeout(() => buscadorResaltar(nombre, intentos - 1), 200);
    return;
  }
  ficha.scrollIntoView({ behavior: "smooth", block: "center" });
  ficha.classList.remove("buscador-resaltado");
  void ficha.offsetWidth; // para que la animación vuelva a empezar
  ficha.classList.add("buscador-resaltado");
  setTimeout(() => ficha.classList.remove("buscador-resaltado"), 4000);
}

/* ---------- Arranque ---------- */
function iniciarBuscador() {
  const carrito = document.querySelector('header a[href="carrito.html"]');
  if (!carrito) return; // login y panel no tienen buscador

  const buscador = document.createElement("div");
  buscador.className = "buscador";
  buscador.id = "buscador";
  buscador.innerHTML = `
    <button type="button" class="buscador-lupa" id="buscadorLupa"
            aria-label="Buscar productos" aria-expanded="false">🔍</button>
    <div class="buscador-caja">
      <input type="search" id="buscadorTexto" class="buscador-texto"
             placeholder="Buscar productos…" autocomplete="off" enterkeyhint="search"
             aria-label="Buscar productos" aria-controls="buscadorResultados" />
      <button type="button" class="buscador-cerrar" id="buscadorCerrar"
              aria-label="Cerrar buscador">✕</button>
    </div>
    <ul class="buscador-resultados" id="buscadorResultados" hidden></ul>`;
  carrito.before(buscador);

  const texto = document.getElementById("buscadorTexto");
  document.getElementById("buscadorLupa").addEventListener("click", buscadorAbrir);
  document.getElementById("buscadorCerrar").addEventListener("click", buscadorCerrar);
  texto.addEventListener("input", buscadorBuscar);
  texto.addEventListener("keydown", buscadorTeclas);
  texto.addEventListener("focus", () => {
    buscadorCargar();
    if (texto.value.trim()) buscadorBuscar();
  });

  /* Tocar fuera cierra los resultados */
  document.addEventListener("click", (e) => {
    if (!buscador.contains(e.target)) buscadorCerrar();
  });

  /* ¿Se llegó aquí desde un resultado? Se ilumina el producto y se
     quita el ?ver= para que al recargar no vuelva a brincar */
  const ver = new URLSearchParams(location.search).get("ver");
  if (ver) {
    buscadorResaltar(ver);
    history.replaceState(null, "", location.pathname + location.hash);
  }
}

document.addEventListener("DOMContentLoaded", iniciarBuscador);
