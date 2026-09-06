/* ============================================================
   Piñatería Papelito Crepé — Código compartido por todas las páginas
   Antes esto estaba copiado dentro de cada .html (y duplicado
   varias veces por archivo, lo que rompía el JavaScript).
   ============================================================ */

const TELEFONO_WHATSAPP = "5615868610";

/* ---------- Utilidad: escapar texto para evitar romper el HTML ---------- */
function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/* ============================================================
   1. MENÚ LATERAL
   ============================================================ */
function iniciarMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  const overlay = document.getElementById("overlay");
  if (!menuBtn || !menu || !overlay) return;

  const abrir = () => {
    menu.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
  };
  const cerrar = () => {
    menu.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  };

  menuBtn.addEventListener("click", () => {
    menu.classList.contains("-translate-x-full") ? abrir() : cerrar();
  });
  overlay.addEventListener("click", cerrar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrar();
  });
}

/* ============================================================
   2. MODAL DE IMAGEN A PANTALLA COMPLETA
   ============================================================ */
function mostrarImagen(src) {
  const grande = document.getElementById("imagenGrande");
  const modal = document.getElementById("modalImagen");
  if (!grande || !modal) return;
  grande.src = src;
  modal.classList.remove("hidden");
}

function cerrarImagen() {
  const modal = document.getElementById("modalImagen");
  if (modal) modal.classList.add("hidden");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarImagen();
});

/* ============================================================
   3. CARRITO
   ============================================================ */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(name, price) {
  const item = cart.find((p) => p.name === name);
  if (item) {
    item.qty += 1;
  } else {
    cart.push({ name, price: Number(price), qty: 1 });
  }
  saveCart();
  updateCart();

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "¡Agregado!",
      text: `${name} fue agregado al carrito`,
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
    });
  }
}

function removeFromCart(name) {
  cart = cart.filter((p) => p.name !== name);
  saveCart();
  updateCart();
}

function changeQty(name, qty) {
  const item = cart.find((p) => p.name === name);
  if (!item) return;
  item.qty = Number(qty) <= 0 ? 1 : Number(qty);
  saveCart();
  updateCart();
}

function clearCart() {
  const vaciar = () => {
    cart = [];
    saveCart();
    updateCart();
  };

  if (typeof Swal === "undefined") {
    if (confirm("¿Vaciar el carrito?")) vaciar();
    return;
  }

  Swal.fire({
    title: "¿Vaciar carrito?",
    text: "Esto eliminará todos los productos",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, vaciar",
    cancelButtonText: "Cancelar",
  }).then((result) => {
    if (result.isConfirmed) vaciar();
  });
}

function updateCart() {
  let total = 0;
  let countItems = 0;
  cart.forEach((item) => {
    total += item.price * item.qty;
    countItems += item.qty;
  });

  /* Lista de productos del carrito (solo existe en algunas páginas) */
  const list = document.getElementById("cartItems");
  if (list) {
    list.innerHTML = "";

    /* Carrito vacío: antes se quedaba en blanco y parecía roto */
    if (cart.length === 0) {
      const vacio = document.createElement("li");
      vacio.className = "text-center py-6 text-gray-700";
      vacio.innerHTML = `
        <p class="text-lg">Tu carrito está vacío 🛒</p>
        <a href="principal.html" class="inline-block mt-3 text-pink-700 underline">
          Ver productos
        </a>`;
      list.appendChild(vacio);
    }

    cart.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <span class="font-semibold">${escaparHTML(item.name)}</span><br>
            <input type="number" min="1" value="${item.qty}"
                   class="w-16 mt-1 px-2 py-1 border rounded js-cantidad"/>
          </div>
          <div class="text-right">
            <p>$${item.price * item.qty}</p>
            <button class="text-red-500 text-sm hover:underline js-eliminar">Eliminar</button>
          </div>
        </div>`;
      /* Los listeners se enlazan aquí, no con onclick en el HTML:
         así un nombre con apóstrofo (ej. "Piñata D'Artagnan") no rompe nada. */
      li.querySelector(".js-cantidad").addEventListener("change", (e) =>
        changeQty(item.name, e.target.value)
      );
      li.querySelector(".js-eliminar").addEventListener("click", () =>
        removeFromCart(item.name)
      );
      list.appendChild(li);
    });
  }

  /* Totales y contadores, donde existan */
  const elTotal = document.getElementById("total");
  if (elTotal) elTotal.textContent = total;

  document.querySelectorAll("#cartCount, #contador-carrito").forEach((el) => {
    el.textContent = countItems;
    /* La burbuja roja solo se ve si hay algo en el carrito */
    el.classList.toggle("hidden", countItems === 0);
  });

  /* Enlace de pedido por WhatsApp */
  const enlace = document.getElementById("whatsappLink");
  if (enlace) {
    let msg = "Hola, quiero pedir los siguientes productos que vi en tu pagina:\n";
    cart.forEach((p) => {
      msg += `- ${p.qty} x ${p.name} = $${p.qty * p.price}\n`;
    });
    msg += `\nTotal: $${total}`;
    enlace.href = `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }
}

/* ============================================================
   4. PRODUCTOS AGREGADOS DESDE EL PANEL DE ADMIN
   ============================================================
   Cada página tiene su propio contenedor. Se busca cuál está en
   esta página y se carga solo esa categoría.
   ============================================================ */
const CONTENEDORES = {
  "productos-admin": "productos", // index.html  → Piñatas
  "productos-globos": "productos-globos", // Globos.html
  "productos-velas": "productos-velas", // Velas.html
};

async function mostrarProductosAdmin() {
  for (const [idContenedor, categoria] of Object.entries(CONTENEDORES)) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) continue;

    contenedor.innerHTML =
      '<p class="col-span-full text-center text-gray-500 py-4">Cargando productos…</p>';

    let productos = [];
    try {
      productos = await listarProductos(categoria);
    } catch (e) {
      console.error(e);
      contenedor.innerHTML =
        '<p class="col-span-full text-center text-red-600 py-4">No se pudieron cargar los productos.</p>';
      continue;
    }

    contenedor.innerHTML = "";
    if (productos.length === 0) continue;

    pintarProductos(contenedor, productos);
  }
}

function pintarProductos(contenedor, productos) {
  productos.forEach((p) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl shadow-md text-center";
    div.innerHTML = `
      <img src="${p.imagen}" alt="${escaparHTML(p.nombre)}" loading="lazy" decoding="async"
           class="w-full h-64 object-cover rounded-lg mb-4 cursor-pointer transition-transform duration-300 hover:scale-105 hover:shadow-2xl js-ampliar" />
      <h3 class="text-xl font-bold">${escaparHTML(p.nombre)}</h3>
      <p class="text-pink-600 mt-2 font-semibold">$${escaparHTML(String(p.precio))}</p>
      <button class="mt-2 bg-green-500 hover:bg-green-600 text-white py-1 px-4 rounded js-agregar">
        Agregar al carrito
      </button>`;
    div.querySelector(".js-ampliar").addEventListener("click", () =>
      mostrarImagen(p.imagen)
    );
    div.querySelector(".js-agregar").addEventListener("click", () =>
      addToCart(p.nombre, p.precio)
    );
    contenedor.appendChild(div);
  });
}

/* ============================================================
   ARRANQUE — una sola vez, cuando el HTML ya está listo
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  iniciarMenu();
  mostrarProductosAdmin();
  updateCart();
});
