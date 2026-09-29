/* ============================================================
   CHAT DE LA TIENDA — el globito de abajo a la derecha
   ============================================================
   Aquí solo está lo que ve el cliente. Quien contesta es la
   función "chat" de Supabase (supabase/functions/chat), que es
   donde vive la llave de Gemini.

   La plática se guarda en sessionStorage: sigue ahí al cambiar de
   página y se borra sola al cerrar el navegador.
   Los estilos están en css/estilos.css, sección "CHAT".
   ============================================================ */

const CHAT_URL = SUPABASE_URL + "/functions/v1/chat";
const CHAT_SALUDO =
  "¡Hola! 🎉 Soy el asistente de Piñatería Papelito Crepé. Te ayudo a " +
  "hacer tu pedido o a ver cómo va uno que ya hiciste. ¿Qué se te ofrece?";
const CHAT_SUGERENCIAS = [
  "Quiero hacer un pedido",
  "¿Cómo va mi pedido?",
  "¿Dónde entregan?",
];

/* sessionStorage puede fallar (modo privado, cookies bloqueadas):
   entonces el chat funciona igual, solo que no se acuerda al
   cambiar de página. */
function chatLeer(clave, porDefecto) {
  try {
    const v = sessionStorage.getItem(clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch {
    return porDefecto;
  }
}
function chatGuardar(clave, valor) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin memoria entre páginas, no pasa nada */
  }
}

let chatPlatica = chatLeer("chatPlatica", []);
let chatEsperando = false;

/* Texto del bot → HTML seguro. Solo se permiten negritas (**así**)
   y saltos de línea; todo lo demás se escapa. */
function chatFormato(texto) {
  return escaparHTML(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

function chatDinero(n) {
  return "$" + Number(n).toLocaleString("es-MX");
}

/* El mensaje de WhatsApp que se manda al terminar el pedido */
function chatMensajeWhatsApp(p) {
  let msg = "Hola, hice un pedido en la página.\n";
  msg += `Folio: ${p.folio}\nNombre: ${p.nombre}\n\n`;
  p.productos.forEach((x) => {
    msg += `- ${x.cantidad} x ${x.nombre}`;
    msg += x.precio === null ? " (por cotizar)\n" : ` = ${chatDinero(x.precio * x.cantidad)}\n`;
  });
  msg += p.total === null ? "\nTotal: por cotizar" : `\nTotal: ${chatDinero(p.total)}`;
  msg += `\nEntrega: ${p.entrega}`;
  if (p.fecha_entrega) msg += `\nFecha: ${p.fecha_entrega}`;
  if (p.notas) msg += `\nNotas: ${p.notas}`;
  return `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

function chatTarjetaPedido(p) {
  const div = document.createElement("div");
  div.className = "chat-pedido";
  const filas = p.productos
    .map(
      (x) =>
        `<li>${x.cantidad} × ${escaparHTML(x.nombre)} <span>${
          x.precio === null ? "por cotizar" : chatDinero(x.precio * x.cantidad)
        }</span></li>`
    )
    .join("");
  div.innerHTML = `
    <p class="chat-pedido-folio">🧾 Pedido <strong>${escaparHTML(p.folio)}</strong></p>
    <ul>${filas}</ul>
    <p class="chat-pedido-total">Total: <strong>${
      p.total === null ? "por cotizar" : chatDinero(p.total)
    }</strong></p>
    <a class="chat-pedido-whatsapp" target="_blank" rel="noopener">
      📲 Mandar mi pedido por WhatsApp
    </a>
    <p class="chat-pedido-nota">Tu pedido queda confirmado cuando te contestemos por WhatsApp.</p>`;
  div.querySelector("a").href = chatMensajeWhatsApp(p);
  return div;
}

/* ---------- Dibujar ---------- */
function chatPintar() {
  const caja = document.getElementById("chatMensajes");
  if (!caja) return;
  caja.innerHTML = "";

  const burbuja = (rol, html) => {
    const p = document.createElement("div");
    p.className = "chat-burbuja chat-" + rol;
    p.innerHTML = html;
    caja.appendChild(p);
  };

  burbuja("bot", chatFormato(CHAT_SALUDO));
  chatPlatica.forEach((m) => {
    burbuja(m.rol, chatFormato(m.texto));
    if (m.pedido) caja.appendChild(chatTarjetaPedido(m.pedido));
  });

  /* Botones de sugerencia, solo antes de que el cliente escriba */
  if (chatPlatica.length === 0) {
    const fila = document.createElement("div");
    fila.className = "chat-sugerencias";
    CHAT_SUGERENCIAS.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s;
      b.addEventListener("click", () => chatEnviar(s));
      fila.appendChild(b);
    });
    caja.appendChild(fila);
  }

  if (chatEsperando) {
    burbuja(
      "bot chat-escribiendo",
      '<span></span><span></span><span></span><span class="panel-oculto">Escribiendo…</span>'
    );
  }
  caja.scrollTop = caja.scrollHeight;
}

/* ---------- Mandar un mensaje ---------- */
async function chatEnviar(texto) {
  texto = String(texto || "").trim();
  if (!texto || chatEsperando) return;

  chatPlatica.push({ rol: "cliente", texto: texto.slice(0, 1000) });
  chatGuardar("chatPlatica", chatPlatica);
  chatEsperando = true;
  chatPintar();

  let respuesta;
  try {
    const r = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        /* Solo el texto: las tarjetas de pedido no hacen falta allá */
        mensajes: chatPlatica.map((m) => ({ rol: m.rol, texto: m.texto })),
        carrito: typeof cart !== "undefined" ? cart : [],
      }),
    });
    const datos = await r.json().catch(() => ({}));
    if (r.ok && datos.respuesta) {
      respuesta = { rol: "bot", texto: datos.respuesta };
      if (datos.pedido) respuesta.pedido = datos.pedido;
    } else {
      respuesta = {
        rol: "bot",
        texto:
          datos.error === "ocupado"
            ? "Uy, ahorita estoy atendiendo a muchas personas 😅. Intenta en un minuto, o escríbenos directo por WhatsApp."
            : "Perdón, se me cruzaron los cables 😅. Intenta otra vez en un momento, o escríbenos directo por WhatsApp.",
        error: true,
      };
    }
  } catch {
    respuesta = {
      rol: "bot",
      texto: "No me pude conectar 📶. Revisa tu internet e intenta otra vez, o escríbenos por WhatsApp.",
      error: true,
    };
  }

  chatEsperando = false;
  /* Los avisos de error se ven, pero no se mandan a la IA la
     próxima vez: solo le confundirían. */
  if (respuesta.error) {
    chatPintar();
    const caja = document.getElementById("chatMensajes");
    const p = document.createElement("div");
    p.className = "chat-burbuja chat-bot chat-error";
    p.innerHTML =
      chatFormato(respuesta.texto) +
      `<br /><a href="https://wa.me/${TELEFONO_WHATSAPP}" target="_blank" rel="noopener">📲 Abrir WhatsApp</a>`;
    caja.appendChild(p);
    caja.scrollTop = caja.scrollHeight;
    return;
  }
  chatPlatica.push(respuesta);
  chatGuardar("chatPlatica", chatPlatica);
  chatPintar();
}

/* ---------- Abrir, cerrar, empezar de nuevo ---------- */
function chatAbrir(abrir, enfocar = true) {
  const ventana = document.getElementById("chatVentana");
  const boton = document.getElementById("chatBoton");
  ventana.hidden = !abrir;
  boton.setAttribute("aria-expanded", String(abrir));
  document.body.classList.toggle("chat-abierto", abrir);
  chatGuardar("chatAbierto", abrir);
  if (abrir) {
    chatPintar();
    if (enfocar) document.getElementById("chatTexto").focus();
  }
}

function chatReiniciar() {
  if (chatEsperando) return;
  chatPlatica = [];
  chatGuardar("chatPlatica", chatPlatica);
  chatPintar();
}

/* ---------- Armar el chat en la página ---------- */
function iniciarChat() {
  /* Sin Supabase no hay quien conteste: mejor no mostrar nada */
  if (typeof NUBE_CONFIGURADA === "undefined" || !NUBE_CONFIGURADA) return;

  const raiz = document.createElement("div");
  raiz.className = "chat";
  /* Si la página tiene el botón flotante de WhatsApp, el del chat
     se pone encima de él para que no se tapen. */
  if (document.querySelector('a.fixed[href^="https://wa.me"]')) {
    raiz.classList.add("chat-sobre-whatsapp");
  }
  raiz.innerHTML = `
    <section id="chatVentana" class="chat-ventana" hidden aria-label="Chat de la tienda">
      <div class="chat-cabecera">
        <span class="chat-avatar" aria-hidden="true">🪅</span>
        <div class="chat-titulo">
          <strong>Papelito Crepé</strong>
          <span>Asistente virtual · contesta al momento</span>
        </div>
        <button type="button" class="chat-icono" id="chatReiniciar" title="Empezar de nuevo" aria-label="Empezar la plática de nuevo">🔄</button>
        <button type="button" class="chat-icono" id="chatCerrar" title="Cerrar" aria-label="Cerrar el chat">✕</button>
      </div>
      <div id="chatMensajes" class="chat-mensajes" aria-live="polite"></div>
      <form id="chatFormulario" class="chat-formulario">
        <label for="chatTexto" class="panel-oculto">Escribe tu mensaje</label>
        <textarea id="chatTexto" rows="1" maxlength="1000" placeholder="Escribe aquí…"></textarea>
        <button type="submit" class="chat-enviar" aria-label="Enviar">➤</button>
      </form>
      <p class="chat-pie">Asistente automático. Tu pedido lo confirma la tienda por WhatsApp.</p>
    </section>
    <button type="button" id="chatBoton" class="chat-boton" aria-controls="chatVentana" aria-expanded="false">
      <span aria-hidden="true">💬</span><span class="chat-boton-texto">¿Te ayudo?</span>
    </button>`;
  document.body.appendChild(raiz);

  const texto = document.getElementById("chatTexto");
  document.getElementById("chatBoton").addEventListener("click", () =>
    chatAbrir(document.getElementById("chatVentana").hidden)
  );
  document.getElementById("chatCerrar").addEventListener("click", () => chatAbrir(false));
  document.getElementById("chatReiniciar").addEventListener("click", chatReiniciar);
  document.getElementById("chatFormulario").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = texto.value;
    texto.value = "";
    texto.style.height = "";
    chatEnviar(t);
  });
  /* Enter manda; Shift+Enter hace otro renglón */
  texto.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("chatFormulario").requestSubmit();
    }
  });
  /* La caja crece conforme se escribe, hasta 4 renglones */
  texto.addEventListener("input", () => {
    texto.style.height = "";
    texto.style.height = Math.min(texto.scrollHeight, 110) + "px";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("chatVentana").hidden) chatAbrir(false);
  });

  /* Si estaba abierto en la página anterior, sigue abierto (sin
     sacar el teclado del celular de golpe) */
  if (chatLeer("chatAbierto", false)) chatAbrir(true, false);
}

document.addEventListener("DOMContentLoaded", iniciarChat);
