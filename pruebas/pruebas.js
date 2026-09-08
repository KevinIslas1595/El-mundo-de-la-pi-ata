/* ============================================================
   Pruebas automáticas de Piñatería Papelito Crepé
   Abre cada página en un Chrome real y comprueba que funciona.
   ============================================================ */
const puppeteer = require("puppeteer-core");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
/* Por defecto prueba en tu equipo. Para probar el sitio ya publicado:
   node pruebas/pruebas.js https://kevinislas1595.github.io/El-mundo-de-la-pi-ata */
const BASE = (process.argv[2] || "http://localhost:8080").replace(/\/$/, "");

/* Las credenciales NO van escritas aquí: este archivo se sube a GitHub.
   Se leen de pruebas/credenciales.json, que está en .gitignore.
   Ver pruebas/LEEME.md */
let USUARIO = process.env.PINATA_USUARIO || "";
let CLAVE = process.env.PINATA_CLAVE || "";

if (!USUARIO || !CLAVE) {
  try {
    const local = require("./credenciales.json");
    USUARIO = USUARIO || local.usuario;
    CLAVE = CLAVE || local.clave;
  } catch {
    /* Sin credenciales, las pruebas de acceso se saltan */
  }
}
const HAY_CREDENCIALES = Boolean(USUARIO && CLAVE);

let pasadas = 0;
let fallidas = 0;
const fallos = [];

function comprobar(nombre, condicion, detalle = "") {
  if (condicion) {
    pasadas++;
    console.log("  OK   " + nombre);
  } else {
    fallidas++;
    fallos.push(nombre + (detalle ? " -> " + detalle : ""));
    console.log("  FALLA " + nombre + (detalle ? "  (" + detalle + ")" : ""));
  }
}

/* El nombre del producto que crean las pruebas. Se borra al terminar
   y tambien al empezar, por si una prueba anterior se corto a medias. */
const PRODUCTO_PRUEBA = "Piñata D'Prueba";

/* Sin nube el login es instantaneo; con nube hay que ir al servidor de
   Supabase. Por eso se espera al resultado y no a un tiempo fijo. */
const ESPERA_MAX = 15000;

async function esperarAviso(pagina) {
  await pagina
    .waitForFunction(
      () => document.getElementById("mensaje").textContent.trim() !== "",
      { timeout: ESPERA_MAX }
    )
    .catch(() => {});
}

/* Con Supabase la sesion queda guardada en el navegador, asi que
   login.html puede saltar solo a admin.html y no haber formulario
   que rellenar. Se contemplan los dos casos. */
async function entrarAlPanel(pagina) {
  await pagina.goto(`${BASE}/login.html`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 500));
  if (!pagina.url().includes("admin.html") && (await pagina.$("#usuario"))) {
    await pagina.type("#usuario", USUARIO);
    await pagina.type("#clave", CLAVE);
    await pagina.click("#btnEntrar");
  }
  await esperarPanel(pagina);
}

async function esperarPanel(pagina) {
  await pagina
    .waitForFunction(() => location.pathname.endsWith("admin.html"), {
      timeout: ESPERA_MAX,
    })
    .catch(() => {});
  /* Un respiro para que admin.html pinte la lista */
  await new Promise((r) => setTimeout(r, 400));
}

(async () => {
  const navegador = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox"],
  });

  const PAGINAS = [
    "principal.html",
    "index.html",
    "Globos.html",
    "Velas.html",
    "Peluches.html",
    "Cortinas.html",
    "Platos.html",
    "Vasos.html",
    "carrito.html",
    "Contacto.html",
    "login.html",
  ];

  /* ---------- 1. Cada página carga sin errores de consola ---------- */
  console.log("\n=== 1. Errores de JavaScript en consola ===");
  for (const p of PAGINAS) {
    const pagina = await navegador.newPage();
    const errores = [];
    pagina.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text());
    });
    pagina.on("pageerror", (e) => errores.push(e.message));

    await pagina.goto(`${BASE}/${p}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 400));

    /* Se ignoran los fallos de red de imágenes externas y del CDN,
       que no dependen del código. */
    const propios = errores.filter(
      (e) => !/Failed to load resource|net::ERR|favicon/i.test(e)
    );
    comprobar(`${p} sin errores JS`, propios.length === 0, propios[0]);
    await pagina.close();
  }

  /* ---------- 2. Estructura HTML de cada página ---------- */
  console.log("\n=== 2. Estructura del documento ===");
  for (const p of PAGINAS) {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/${p}`, { waitUntil: "domcontentloaded" });
    const r = await pagina.evaluate(() => ({
      htmls: document.querySelectorAll("html").length,
      bodys: document.querySelectorAll("body").length,
      heads: document.querySelectorAll("head").length,
      modales: document.querySelectorAll("#modalImagen").length,
    }));
    comprobar(
      `${p} un solo documento`,
      r.htmls === 1 && r.bodys === 1 && r.heads === 1,
      JSON.stringify(r)
    );
    comprobar(`${p} modal unico`, r.modales <= 1, "modales=" + r.modales);
    await pagina.close();
  }

  /* ---------- 3. El menú lateral abre y cierra ---------- */
  console.log("\n=== 3. Menú lateral ===");
  {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });

    const cerradoAlInicio = await pagina.$eval("#menu", (el) =>
      el.classList.contains("-translate-x-full")
    );
    comprobar("empieza cerrado", cerradoAlInicio);

    await pagina.click("#menuBtn");
    await new Promise((r) => setTimeout(r, 350));
    const abierto = await pagina.$eval(
      "#menu",
      (el) => !el.classList.contains("-translate-x-full")
    );
    comprobar("abre al pulsar", abierto);

    await pagina.click("#overlay");
    await new Promise((r) => setTimeout(r, 350));
    const cerrado = await pagina.$eval("#menu", (el) =>
      el.classList.contains("-translate-x-full")
    );
    comprobar("cierra al pulsar fuera", cerrado);
    await pagina.close();
  }

  /* ---------- 4. Carrito ---------- */
  console.log("\n=== 4. Carrito ===");
  {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });

    await pagina.evaluate(() => {
      localStorage.removeItem("cart");
    });
    await pagina.reload({ waitUntil: "networkidle2" });

    const ocultoVacio = await pagina.$eval("#contador-carrito", (el) =>
      el.classList.contains("hidden")
    );
    comprobar("contador oculto si esta vacio", ocultoVacio);

    await pagina.evaluate(() => addToCart("Piñata de prueba", 150));
    await new Promise((r) => setTimeout(r, 200));

    const tras1 = await pagina.evaluate(() => ({
      texto: document.getElementById("contador-carrito").textContent,
      visible: !document
        .getElementById("contador-carrito")
        .classList.contains("hidden"),
      guardados: JSON.parse(localStorage.getItem("cart") || "[]").length,
    }));
    comprobar("contador muestra 1", tras1.texto === "1", tras1.texto);
    comprobar("contador se hace visible", tras1.visible);
    comprobar("se guarda en localStorage", tras1.guardados === 1);

    /* Mismo producto otra vez: debe sumar cantidad, no duplicar */
    await pagina.evaluate(() => addToCart("Piñata de prueba", 150));
    await new Promise((r) => setTimeout(r, 200));
    const tras2 = await pagina.evaluate(() => ({
      texto: document.getElementById("contador-carrito").textContent,
      lineas: JSON.parse(localStorage.getItem("cart") || "[]").length,
    }));
    comprobar("repetir suma cantidad", tras2.texto === "2", tras2.texto);
    comprobar("no duplica la linea", tras2.lineas === 1, "lineas=" + tras2.lineas);

    /* Nombre con apóstrofo: antes rompía el carrito */
    await pagina.evaluate(() => addToCart("Piñata D'Artagnan", 99));
    await new Promise((r) => setTimeout(r, 200));
    const conApostrofo = await pagina.evaluate(
      () => JSON.parse(localStorage.getItem("cart") || "[]").length
    );
    comprobar("acepta nombre con apostrofo", conApostrofo === 2);
    await pagina.close();
  }

  /* ---------- 5. El carrito llega a la página del carrito ---------- */
  console.log("\n=== 5. Página del carrito ===");
  {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/carrito.html`, { waitUntil: "networkidle2" });

    await pagina.evaluate(() => {
      localStorage.setItem(
        "cart",
        JSON.stringify([{ name: "Piñata Test", price: 200, qty: 3 }])
      );
    });
    await pagina.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 300));

    const r = await pagina.evaluate(() => ({
      total: document.getElementById("total").textContent,
      wa: document.getElementById("whatsappLink").href,
      items: document.querySelectorAll("#cartItems li").length,
    }));
    comprobar("total correcto (3 x 200 = 600)", r.total === "600", r.total);
    comprobar("hay una linea en la lista", r.items === 1, "items=" + r.items);
    comprobar(
      "el enlace de WhatsApp lleva el pedido",
      r.wa.includes("wa.me") && r.wa.includes("text="),
      r.wa.slice(0, 60)
    );

    /* Carrito vacío debe mostrar mensaje, no quedarse en blanco */
    await pagina.evaluate(() => {
      localStorage.removeItem("cart");
    });
    await pagina.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 300));
    const vacio = await pagina.$eval("#cartItems", (el) => el.textContent);
    comprobar("carrito vacio avisa", /vac/i.test(vacio), vacio.trim().slice(0, 40));
    await pagina.close();
  }

  /* ---------- 6. El panel de admin exige sesión ---------- */
  console.log("\n=== 6. Acceso al panel ===");
  {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/admin.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 500));
    comprobar(
      "admin sin sesion redirige al login",
      pagina.url().includes("login.html"),
      pagina.url()
    );
    await pagina.close();
  }

  if (!HAY_CREDENCIALES) {
    console.log(
      "  (saltadas las pruebas de acceso: falta pruebas/credenciales.json)"
    );
  }

  if (HAY_CREDENCIALES) {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/login.html`, { waitUntil: "networkidle2" });

    /* Contraseña incorrecta */
    await pagina.type("#usuario", USUARIO);
    await pagina.type("#clave", "incorrecta");
    await pagina.click("#btnEntrar");
    await esperarAviso(pagina);
    const msg = await pagina.$eval("#mensaje", (el) => el.textContent);
    comprobar("rechaza clave incorrecta", /incorrect/i.test(msg), msg);
    comprobar("no entra al panel", !pagina.url().includes("admin.html"));

    /* Credenciales correctas */
    await pagina.evaluate(() => {
      document.getElementById("usuario").value = "";
      document.getElementById("clave").value = "";
    });
    await pagina.type("#usuario", USUARIO);
    await pagina.type("#clave", CLAVE);
    await pagina.click("#btnEntrar");
    await esperarPanel(pagina);
    comprobar(
      "entra con las credenciales correctas",
      pagina.url().includes("admin.html"),
      pagina.url()
    );
    await pagina.close();
  }

  /* ---------- 7. Alta y baja de productos en el panel ---------- */
  console.log("\n=== 7. Panel: guardar y borrar ===");
  if (HAY_CREDENCIALES) {
    const pagina = await navegador.newPage();
    await entrarAlPanel(pagina);

    pagina.on("dialog", async (d) => await d.accept());

    /* Cuantos productos hay ya. No se puede dar por hecho que la
       tienda este vacia: tiene los productos de verdad. */
    const antes = await pagina.evaluate(
      () => document.querySelectorAll("#lista-productos > div").length
    );

    /* Se inserta directamente por la capa de datos, sin simular
       la selección de un archivo (eso el navegador no lo permite). */
    await pagina.evaluate(async () => {
      localStorage.removeItem("productos");
      if (NUBE_CONFIGURADA) {
        for (const p of await listarProductos("productos")) {
          if (p.nombre === "Piñata D'Prueba") {
            await borrarProducto(p.id, "productos");
          }
        }
      }
      await guardarProducto({
        id: null,
        categoria: "productos",
        nombre: "Piñata D'Prueba",
        precio: 321,
        archivo: null,
      });
    });
    await pagina.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));

    const tras = await pagina.evaluate(() => ({
      tarjetas: document.querySelectorAll("#lista-productos > div").length,
      texto: document.getElementById("lista-productos").textContent,
    }));
    comprobar(
      "el producto aparece en el panel",
      tras.tarjetas === antes + 1,
      `antes=${antes} despues=${tras.tarjetas}`
    );
    comprobar("muestra el precio", tras.texto.includes("321"));
    comprobar(
      "el apostrofo se escapa bien",
      tras.texto.includes("D'Prueba"),
      tras.texto.slice(0, 60)
    );

    /* Y se ve en la tienda */
    const tienda = await navegador.newPage();
    await tienda.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 700));
    const enTienda = await tienda.evaluate(
      () => document.getElementById("productos-admin").textContent
    );
    comprobar(
      "el producto se ve en la tienda",
      enTienda.includes("D'Prueba"),
      enTienda.trim().slice(0, 50)
    );
    await tienda.close();

    /* ---------- LA PRUEBA QUE IMPORTA ----------
       Un cliente cualquiera, en su propio navegador, sin haber
       iniciado sesión. Esto es lo que Supabase viene a arreglar. */
    const cliente = await navegador.createBrowserContext();
    const paginaCliente = await cliente.newPage();
    await paginaCliente.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 800));

    const loVeElCliente = await paginaCliente.evaluate(() => {
      const c = document.getElementById("productos-admin");
      return c ? c.textContent.includes("D'Prueba") : false;
    });

    const conNube = await paginaCliente.evaluate(() => NUBE_CONFIGURADA);

    if (conNube) {
      comprobar("UN CLIENTE VE TU PRODUCTO (con nube)", loVeElCliente);
    } else {
      comprobar(
        "sin nube, el cliente NO lo ve (problema confirmado)",
        !loVeElCliente
      );
      console.log(
        "       ^ esto es lo que arregla Supabase: hoy tus productos"
      );
      console.log("         solo existen en TU navegador.");
    }
    await paginaCliente.close();
    await cliente.close();

    /* Limpieza: en el navegador Y en la nube, para no dejar
       productos de prueba en la tienda de verdad */
    await pagina.evaluate(async () => {
      localStorage.removeItem("productos");
      if (NUBE_CONFIGURADA) {
        for (const p of await listarProductos("productos")) {
          if (p.nombre === "Piñata D'Prueba") {
            await borrarProducto(p.id, "productos");
          }
        }
      }
    });
    await pagina.close();
  }

  /* ---------- 8. Móvil: la cabecera no se solapa ---------- */
  console.log("\n=== 8. Movil (390x844) ===");
  for (const p of ["index.html", "Globos.html", "Contacto.html"]) {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: 390, height: 844 });
    await pagina.goto(`${BASE}/${p}`, { waitUntil: "networkidle2" });

    const r = await pagina.evaluate(() => {
      const btn = document.getElementById("menuBtn").getBoundingClientRect();
      const carrito = document
        .querySelector('header a[href="carrito.html"]')
        .getBoundingClientRect();
      const logo = document
        .querySelector('header a[href="principal.html"]')
        .getBoundingClientRect();
      return {
        solapaIzq: logo.left < btn.right - 1,
        solapaDer: logo.right > carrito.left + 1,
        desbordaX:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      };
    });
    comprobar(`${p} logo no tapa el menu`, !r.solapaIzq);
    comprobar(`${p} logo no tapa el carrito`, !r.solapaDer);
    comprobar(`${p} sin scroll horizontal`, !r.desbordaX);
    await pagina.close();
  }

  /* ---------- 9. Imágenes rotas ---------- */
  console.log("\n=== 9. Imagenes que no cargan ===");
  for (const p of [
    "index.html",
    "Globos.html",
    "Velas.html",
    "principal.html",
    "Peluches.html",
    "Cortinas.html",
    "Platos.html",
    "Vasos.html",
  ]) {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/${p}`, { waitUntil: "networkidle2" });
    /* Se fuerza la carga de todo para que lazy no oculte fallos */
    await pagina.evaluate(async () => {
      document.querySelectorAll("img[loading=lazy]").forEach((i) => {
        i.loading = "eager";
      });
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((r) => setTimeout(r, 2500));

    const rotas = await pagina.evaluate(() =>
      [...document.images]
        .filter((i) => i.src && i.complete && i.naturalWidth === 0)
        .map((i) => i.getAttribute("src"))
    );
    comprobar(`${p} sin imagenes rotas`, rotas.length === 0, rotas.slice(0, 3).join(", "));
    await pagina.close();
  }

  /* ---------- 10. Cada categoria tiene su hueco de productos ---------- */
  console.log("\n=== 10. Contenedor de productos por categoria ===");
  {
    const CATEGORIAS = [
      ["index.html", "productos-admin"],
      ["Globos.html", "productos-globos"],
      ["Velas.html", "productos-velas"],
      ["Peluches.html", "productos-peluches"],
      ["Cortinas.html", "productos-cortinas"],
      ["Platos.html", "productos-platos"],
      ["Vasos.html", "productos-vasos"],
    ];
    for (const [p, id] of CATEGORIAS) {
      const pagina = await navegador.newPage();
      await pagina.goto(`${BASE}/${p}`, { waitUntil: "domcontentloaded" });
      const hay = await pagina.evaluate((x) => !!document.getElementById(x), id);
      comprobar(`${p} tiene #${id}`, hay);
      await pagina.close();
    }

    /* Y los circulos de principal.html llevan a todas ellas */
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/principal.html`, { waitUntil: "domcontentloaded" });
    const enlaces = await pagina.evaluate(() =>
      [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    );
    for (const destino of [
      "Peluches.html",
      "Cortinas.html",
      "Platos.html",
      "Vasos.html",
    ]) {
      comprobar(`principal.html enlaza a ${destino}`, enlaces.includes(destino));
    }
    await pagina.close();
  }

  /* ---------- 11. Por dentro del panel de administracion ---------- */
  console.log("\n=== 11. Panel de administracion ===");
  if (HAY_CREDENCIALES) {
    const pagina = await navegador.newPage();

    /* Los errores de JavaScript del panel: aqui se cazo una vez que
       admin.html declaraba otra vez una variable que ya estaba en
       js/config.js, y el panel se quedaba en blanco. */
    const errores = [];
    pagina.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text());
    });
    pagina.on("pageerror", (e) => errores.push(e.message));

    await entrarAlPanel(pagina);
    const propios = errores.filter(
      (e) => !/Failed to load resource|net::ERR|favicon/i.test(e)
    );
    comprobar("admin.html sin errores JS", propios.length === 0, propios[0]);

    const r = await pagina.evaluate(() => ({
      botones: document.querySelectorAll(".panel-chip").length,
      opciones: document.querySelectorAll("#categoria option").length,
      categoria: document.getElementById("categoria").value,
      cuantas: typeof CATEGORIAS === "undefined" ? 0 : CATEGORIAS.length,
    }));
    comprobar(
      "hay un boton por cada categoria",
      r.botones === r.cuantas && r.cuantas > 0,
      "botones=" + r.botones + " categorias=" + r.cuantas
    );
    comprobar(
      "el desplegable tiene todas las categorias",
      r.opciones === r.cuantas,
      "opciones=" + r.opciones
    );
    comprobar("empieza en Pinatas", r.categoria === "productos", r.categoria);

    /* Los botones de colores cambian de categoria */
    await pagina.evaluate(() => {
      const boton = [...document.querySelectorAll(".panel-chip")].find(
        (b) => b.dataset.valor === "productos-vasos"
      );
      if (boton) boton.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const tras = await pagina.evaluate(() => ({
      categoria: document.getElementById("categoria").value,
      marcado: document.querySelector(".panel-chip.es-actual")
        ? document.querySelector(".panel-chip.es-actual").dataset.valor
        : "",
    }));
    comprobar(
      "el boton cambia de categoria",
      tras.categoria === "productos-vasos",
      tras.categoria
    );
    comprobar(
      "el boton elegido se queda marcado",
      tras.marcado === "productos-vasos",
      tras.marcado
    );
    await pagina.close();
  }

  await navegador.close();

  console.log("\n" + "=".repeat(50));
  console.log(`RESULTADO:  ${pasadas} correctas,  ${fallidas} fallidas`);
  if (fallos.length) {
    console.log("\nFallos:");
    fallos.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(50));
  process.exit(fallidas > 0 ? 1 : 0);
})();
