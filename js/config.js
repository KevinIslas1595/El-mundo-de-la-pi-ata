/* ============================================================
   CONEXIÓN CON SUPABASE
   ============================================================

   👉 RELLENA ESTOS DOS DATOS (los sacas del panel de Supabase,
      en Project Settings → API). Mientras estén vacíos, la web
      sigue funcionando con el navegador como hasta ahora.

   Estos dos valores son PÚBLICOS a propósito: van en el código de
   la página y cualquiera puede verlos. No es un fallo de seguridad.
   Lo que protege tus datos son las reglas (RLS) que configuras en
   Supabase: cualquiera puede LEER los productos, pero solo tú,
   con tu usuario, puedes crear, editar o borrar.

   Los pasos completos están en CONFIGURAR-SUPABASE.md
   ============================================================ */

const SUPABASE_URL = "https://fabdpahpdxdenvsnxlpp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qgdzO3b8X0q0NGLQwxFw2w_AMD8q-_a";

/* --- A partir de aquí no hace falta tocar nada --- */

/* Se llama "db" y no "supabase" para no chocar con la variable global
   que crea la propia librería. */
const LIBRERIA_LISTA = typeof window.supabase?.createClient === "function";

const NUBE_CONFIGURADA =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20 &&
  LIBRERIA_LISTA;

if (SUPABASE_URL.startsWith("https://") && !LIBRERIA_LISTA) {
  console.error(
    "Supabase está configurado pero su librería no cargó. " +
      "¿Hay conexión a internet? La web seguirá funcionando sin la nube."
  );
}

const db = NUBE_CONFIGURADA
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* Categorías de la tienda: una sola lista para todo el sitio.
   - valor:  la clave con la que se guardan en la base de datos.
             Es la que ya usaba el panel, así no se pierde nada de
             lo que tengas guardado.
   - nombre: como se ve en el panel.
   - emoji:  el dibujito de su botón.
   De aquí salen los botones de colores de admin.html. Si algún día
   agregas otra página de productos, la añades aquí. */
const CATEGORIAS = [
  { valor: "productos", nombre: "Piñatas", emoji: "🎉" },
  { valor: "productos-globos", nombre: "Globos", emoji: "🎈" },
  { valor: "productos-velas", nombre: "Velas", emoji: "🕯️" },
  { valor: "productos-peluches", nombre: "Peluches", emoji: "🧸" },
  { valor: "productos-cortinas", nombre: "Cortinas", emoji: "🪟" },
  { valor: "productos-platos", nombre: "Platos", emoji: "🍽️" },
  { valor: "productos-vasos", nombre: "Vasos", emoji: "🥤" },
];
