/* ============================================================
   CONTROL DE ACCESO AL PANEL DE ADMINISTRACIÓN
   ============================================================

   ⚠️  LEE ESTO, ES IMPORTANTE
   ---------------------------
   Esta página es un sitio ESTÁTICO (GitHub Pages): no hay servidor.
   Por eso NINGÚN candado hecho aquí es seguridad de verdad: alguien
   con conocimientos puede saltárselo editando el JavaScript.

   Lo que sí conseguimos con esto:
     · La contraseña ya NO está escrita en el código (solo su hash).
     · admin.html deja de abrirse escribiendo la dirección a mano.
     · La sesión caduca sola a las 2 horas.

   Si algún día vendes en línea de verdad (cobros, pedidos, stock),
   vas a necesitar un servidor real. Mientras tanto el riesgo es bajo,
   porque el panel solo guarda datos en el navegador de quien lo usa.
   ============================================================ */

/* Hash SHA-256 de la contraseña.
   ⚠️ CAMBIAR: abre herramientas/generar-clave.html, escribe tu nueva
   contraseña, copia el hash que te dé y pégalo aquí abajo.
   La contraseña anterior quedó publicada en el historial de GitHub. */
const CLAVE_HASH =
  "a9c0b152e53f42b0960a4afa244c11a98eddc7fec865b96af215281a566ee208";

const DURACION_SESION_MS = 2 * 60 * 60 * 1000; // 2 horas

/* ---------- Calcular el hash de un texto ---------- */
async function hashear(texto) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error(
      "Tu navegador bloquea el cifrado en archivos abiertos con doble clic.\n\n" +
        "Abre la página con Live Server en VS Code (http://localhost) " +
        "o desde el sitio publicado en https://"
    );
  }
  const datos = new TextEncoder().encode(texto);
  const buffer = await window.crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- Comprobar la contraseña ---------- */
async function claveCorrecta(clave) {
  return (await hashear(clave)) === CLAVE_HASH;
}

/* ---------- Estado de la sesión ---------- */
function iniciarSesion() {
  sessionStorage.setItem("adminExpira", String(Date.now() + DURACION_SESION_MS));
}

function sesionActiva() {
  const expira = Number(sessionStorage.getItem("adminExpira") || 0);
  if (!expira || Date.now() > expira) {
    sessionStorage.removeItem("adminExpira");
    return false;
  }
  return true;
}

function cerrarSesion() {
  sessionStorage.removeItem("adminExpira");
  window.location.replace("login.html");
}

/* ---------- Guardia: se llama al principio de admin.html ---------- */
function protegerPagina() {
  if (!sesionActiva()) {
    window.location.replace("login.html");
  }
}
