/* ============================================================
   CAPA DE DATOS — de dónde salen y a dónde van los productos
   ============================================================

   Si Supabase está configurado (js/config.js), todo va a la nube y
   tus clientes ven los productos al instante.

   Si NO lo está, sigue funcionando con localStorage igual que antes,
   para que la web no se rompa mientras terminas de configurarlo.
   ============================================================ */

/* ============================================================
   1. IMÁGENES — se encogen ANTES de subirlas
   ============================================================
   Una foto de móvil pesa ~2 MB y tiene 12 megapíxeles, pero en la
   web se ve a unos 400 px. Subirla tal cual llenaría el GB gratuito
   en unas 500 fotos y haría la página lentísima. Esto la deja en
   1200 px y unos 200 KB antes de que salga del navegador.
   ============================================================ */
const LADO_MAX = 1200;
const CALIDAD = 0.82;

function encogerImagen(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
      img.onload = () => {
        let { width, height } = img;

        if (Math.max(width, height) > LADO_MAX) {
          const factor = LADO_MAX / Math.max(width, height);
          width = Math.round(width * factor);
          height = Math.round(height * factor);
        }

        const lienzo = document.createElement("canvas");
        lienzo.width = width;
        lienzo.height = height;
        lienzo.getContext("2d").drawImage(img, 0, 0, width, height);

        lienzo.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("No se pudo comprimir la imagen"));
            resolve(blob);
          },
          "image/jpeg",
          CALIDAD
        );
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

/* Convierte un Blob a texto base64, para el modo sin nube */
function blobABase64(blob) {
  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.readAsDataURL(blob);
  });
}

/* ============================================================
   2. LEER PRODUCTOS
   ============================================================ */
async function listarProductos(categoria) {
  if (!NUBE_CONFIGURADA) {
    return JSON.parse(localStorage.getItem(categoria)) || [];
  }

  const { data, error } = await db
    .from("productos")
    .select("id, nombre, precio, imagen")
    .eq("categoria", categoria)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar los productos:", error.message);
    return [];
  }
  return data;
}

/* ============================================================
   3. GUARDAR (crear o editar)
   ============================================================ */
async function guardarProducto({ id, categoria, nombre, precio, archivo }) {
  /* --- Sin nube: como antes, en el navegador --- */
  if (!NUBE_CONFIGURADA) {
    const lista = JSON.parse(localStorage.getItem(categoria)) || [];
    let imagen = null;

    if (archivo) {
      imagen = await blobABase64(await encogerImagen(archivo));
    }

    if (id !== null && id !== undefined && lista[id]) {
      lista[id] = { nombre, precio, imagen: imagen || lista[id].imagen };
    } else {
      lista.push({ nombre, precio, imagen });
    }

    localStorage.setItem(categoria, JSON.stringify(lista));
    return;
  }

  /* --- Con nube --- */
  let urlImagen = null;

  if (archivo) {
    const comprimida = await encogerImagen(archivo);
    const ruta = `${categoria}/${crypto.randomUUID()}.jpg`;

    const { error: errorSubida } = await db.storage
      .from("productos")
      .upload(ruta, comprimida, { contentType: "image/jpeg" });

    if (errorSubida) {
      throw new Error("No se pudo subir la imagen: " + errorSubida.message);
    }

    urlImagen = db.storage.from("productos").getPublicUrl(ruta)
      .data.publicUrl;
  }

  if (id) {
    /* Al editar sin foto nueva, se conserva la que ya tenía */
    const cambios = { nombre, precio };
    if (urlImagen) cambios.imagen = urlImagen;

    const { error } = await db
      .from("productos")
      .update(cambios)
      .eq("id", id);
    if (error) throw new Error("No se pudo editar: " + error.message);
  } else {
    const { error } = await db
      .from("productos")
      .insert({ categoria, nombre, precio, imagen: urlImagen });
    if (error) throw new Error("No se pudo guardar: " + error.message);
  }
}

/* ============================================================
   4. BORRAR
   ============================================================ */
async function borrarProducto(id, categoria) {
  if (!NUBE_CONFIGURADA) {
    const lista = JSON.parse(localStorage.getItem(categoria)) || [];
    lista.splice(id, 1);
    localStorage.setItem(categoria, JSON.stringify(lista));
    return;
  }

  const { error } = await db.from("productos").delete().eq("id", id);
  if (error) throw new Error("No se pudo borrar: " + error.message);
}

/* ============================================================
   5. ACCESO AL PANEL
   ============================================================
   Con Supabase esto es un login DE VERDAD: la comprobación ocurre
   en el servidor, no en el navegador, así que ya no se puede saltar
   editando el JavaScript.
   ============================================================ */
async function entrar(correo, clave) {
  if (!NUBE_CONFIGURADA) {
    /* Sin nube se usa el candado antiguo de js/auth.js */
    return accesoCorrecto(correo, clave);
  }

  const { error } = await db.auth.signInWithPassword({
    email: correo,
    password: clave,
  });
  return !error;
}

async function salir() {
  if (NUBE_CONFIGURADA) await db.auth.signOut();
  sessionStorage.removeItem("adminExpira");
  window.location.replace("login.html");
}

async function haySesion() {
  if (!NUBE_CONFIGURADA) return sesionActiva();
  const { data } = await db.auth.getSession();
  return !!data.session;
}

/* Guardia para admin.html */
async function protegerPaginaNube() {
  if (!(await haySesion())) window.location.replace("login.html");
}
